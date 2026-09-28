-- Team isolation and service-only administration. Existing reports remain immutable.
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.teams enable row level security;
alter table public.team_members add column team_id uuid references public.teams(id), add column is_super_admin boolean not null default false;
alter table public.clients add column team_id uuid references public.teams(id);
alter table public.clients disable trigger user;
do $$ declare initial_team uuid; begin
 insert into public.teams(name) values('Equipe principal') returning id into initial_team;
 update public.team_members set team_id=initial_team;
 update public.clients set team_id=initial_team;
 update public.team_members set is_super_admin=true where username='gui.cardoso' and role='admin' and active;
 if not found then raise exception 'Administrador geral não encontrado'; end if;
end $$;
alter table public.clients enable trigger user;
alter table public.team_members alter column team_id set not null;
alter table public.clients alter column team_id set not null;
alter table public.team_members add constraint super_admin_role check(not is_super_admin or (role='admin' and active));
create index members_team_idx on public.team_members(team_id);
create index clients_team_idx on public.clients(team_id);
alter table public.clients drop constraint clients_cnpj_key;
alter table public.clients add constraint clients_team_cnpj_key unique(team_id,cnpj);

create or replace function private.current_team_role() returns text language sql stable security definer set search_path='' as $$
 select m.role from public.team_members m join public.teams t on t.id=m.team_id
 where m.user_id=(select auth.uid()) and m.active and (t.active or m.is_super_admin);
$$;
create function private.current_team_id() returns uuid language sql stable security definer set search_path='' as $$
 select m.team_id from public.team_members m join public.teams t on t.id=m.team_id
 where m.user_id=(select auth.uid()) and m.active and (t.active or m.is_super_admin);
$$;
create function private.is_global_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members where user_id=(select auth.uid()) and active and role='admin' and is_super_admin);
$$;
revoke all on function private.current_team_id(),private.is_global_admin() from public,anon;
grant execute on function private.current_team_id(),private.is_global_admin() to authenticated;
alter table public.clients alter column team_id set default private.current_team_id();

-- Membership writes must pass through the authenticated administration endpoint.
revoke insert,update,delete on public.team_members from authenticated;
drop policy members_admin_insert on public.team_members;
drop policy members_admin_update on public.team_members;
alter policy members_read on public.team_members using ((select private.is_global_admin()) or team_id=(select private.current_team_id()));
grant select on public.teams to authenticated;
revoke all on public.teams from anon;
create policy teams_read on public.teams for select to authenticated using ((select private.is_global_admin()) or id=(select private.current_team_id()));
alter policy clients_read on public.clients using ((select private.is_global_admin()) or team_id=(select private.current_team_id()));
alter policy clients_insert on public.clients with check (created_by=(select auth.uid()) and ((select private.is_global_admin()) or team_id=(select private.current_team_id())));
alter policy clients_update on public.clients using ((select private.is_global_admin()) or team_id=(select private.current_team_id())) with check ((select private.is_global_admin()) or team_id=(select private.current_team_id()));
create function private.guard_client_team() returns trigger language plpgsql set search_path='' as $$ begin
 if new.team_id is distinct from old.team_id then raise exception 'Não é permitido transferir clientes entre equipes.' using errcode='23514'; end if;
 return new;
end $$;
create trigger clients_team_guard before update on public.clients for each row execute function private.guard_client_team();
-- Client SELECT itself is filtered by RLS; all assessment operations inherit its team.
alter policy assessments_read on public.assessments using (exists(select 1 from public.clients c where c.id=client_id));
alter policy assessments_insert on public.assessments with check (
 exists(select 1 from public.clients c where c.id=client_id) and created_by=(select auth.uid()) and
 (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin'));
alter policy assessments_update on public.assessments using (
 exists(select 1 from public.clients c where c.id=client_id) and (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin')) with check (
 exists(select 1 from public.clients c where c.id=client_id) and (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin'));
alter policy assessments_delete_draft on public.assessments using (status='draft' and exists(select 1 from public.clients c where c.id=client_id) and (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin'));
alter policy assessments_delete_completed_admin on public.assessments using (status='completed' and exists(select 1 from public.clients c where c.id=client_id) and (select private.current_team_role())='admin');

-- Only service_role may invoke this function, after the endpoint verifies the JWT.
-- Recheck and lock the actor here so a stale browser cannot retain admin powers.
create function public.manage_gro_admin(p_actor uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor public.team_members; target public.team_members; team public.teams; result jsonb; tid uuid;
begin
 select * into actor from public.team_members where user_id=p_actor for update;
 if actor.user_id is null or not actor.active or actor.role<>'admin' then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform 1 from public.teams where id=actor.team_id and (active or actor.is_super_admin) for share;
 if not found then raise exception 'Equipe inativa' using errcode='42501'; end if;
 if p_action in ('create_team','update_team') then
  if not actor.is_super_admin then raise exception 'Somente o administrador geral pode alterar equipes' using errcode='42501'; end if;
  if p_action='create_team' then
   insert into public.teams(name) values(btrim(p_data->>'name')) returning to_jsonb(teams.*) into result;
  else
   tid=(p_data->>'id')::uuid;
   if not (p_data->>'active')::boolean and exists(select 1 from public.team_members where team_id=tid and is_super_admin) then raise exception 'A equipe do administrador geral deve permanecer ativa'; end if;
   update public.teams set name=btrim(p_data->>'name'),active=(p_data->>'active')::boolean where id=tid returning to_jsonb(teams.*) into result;
   if result is null then raise exception 'Equipe não encontrada'; end if;
  end if;
 elsif p_action in ('create_user','update_user') then
  tid=(p_data->>'team_id')::uuid;
  select * into team from public.teams where id=tid for share;
  if team.id is null or not team.active then raise exception 'Escolha uma equipe ativa'; end if;
  if not actor.is_super_admin and tid<>actor.team_id then raise exception 'Equipe não autorizada' using errcode='42501'; end if;
  if p_action='create_user' then
   insert into public.team_members(user_id,display_name,username,contact_email,role,active,team_id)
   values((p_data->>'user_id')::uuid,btrim(p_data->>'display_name'),p_data->>'username',nullif(btrim(p_data->>'contact_email'),''),p_data->>'role',true,tid)
   returning to_jsonb(team_members.*) into result;
  else
   select * into target from public.team_members where user_id=(p_data->>'user_id')::uuid for update;
   if target.user_id is null or (not actor.is_super_admin and (target.team_id<>actor.team_id or target.is_super_admin)) then raise exception 'Usuário não autorizado' using errcode='42501'; end if;
   if target.is_super_admin and (tid<>target.team_id or p_data->>'role'<>'admin' or not (p_data->>'active')::boolean) then raise exception 'O acesso do administrador geral está protegido'; end if;
   if target.user_id=actor.user_id and (tid<>actor.team_id or p_data->>'role'<>actor.role or not (p_data->>'active')::boolean) then raise exception 'Você não pode remover seu próprio acesso'; end if;
   if target.team_id<>tid and exists(select 1 from public.assessments where responsible_id=target.user_id and status='draft') then raise exception 'Conclua os rascunhos deste usuário antes de transferi-lo de equipe'; end if;
   update public.team_members set display_name=btrim(p_data->>'display_name'),username=p_data->>'username',contact_email=nullif(btrim(p_data->>'contact_email'),''),role=p_data->>'role',active=(p_data->>'active')::boolean,team_id=tid
   where user_id=target.user_id returning to_jsonb(team_members.*) into result;
  end if;
 else raise exception 'Operação inválida';
 end if;
 return result;
end $$;
revoke all on function public.manage_gro_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_gro_admin(uuid,text,jsonb) to service_role;

grant all on public.teams to service_role;
