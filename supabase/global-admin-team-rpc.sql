CREATE OR REPLACE FUNCTION public.manage_gro_admin(p_actor uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor public.team_members; target public.team_members; team public.teams; result jsonb; tid uuid;
begin
 select * into actor from public.team_members where user_id=p_actor for update;
 select * into team from public.teams where id=actor.team_id for share;
 if team.active and team.grants_global_access then actor.is_super_admin=true; actor.role='admin'; end if;
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
   if target.user_id=actor.user_id and (tid<>actor.team_id or p_data->>'role'<>target.role or not (p_data->>'active')::boolean) then raise exception 'Você não pode remover seu próprio acesso'; end if;
   if target.team_id<>tid and exists(select 1 from public.assessments where responsible_id=target.user_id and status='draft') then raise exception 'Conclua os rascunhos deste usuário antes de transferi-lo de equipe'; end if;
   update public.team_members set display_name=btrim(p_data->>'display_name'),username=p_data->>'username',contact_email=nullif(btrim(p_data->>'contact_email'),''),role=p_data->>'role',active=(p_data->>'active')::boolean,team_id=tid
   where user_id=target.user_id returning to_jsonb(team_members.*) into result;
  end if;
 else raise exception 'Operação inválida';
 end if;
 return result;
end $function$
