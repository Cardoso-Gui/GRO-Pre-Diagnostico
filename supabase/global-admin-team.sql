alter table public.teams add column grants_global_access boolean not null default false;
do $$ begin
 if (select count(*) from public.teams where lower(btrim(name))='administradores')<>1 then raise exception 'Equipe Administradores não é única';end if;
 update public.teams set grants_global_access=true where lower(btrim(name))='administradores';
end $$;
-- Stable designation: renaming or creating a similarly named team does not grant access.
create or replace function private.is_global_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id
 where m.user_id=(select auth.uid()) and m.active and ((m.is_super_admin and m.role='admin') or (t.active and t.grants_global_access)));
$$;
create or replace function private.current_team_role() returns text language sql stable security definer set search_path='' as $$
 select case when m.is_super_admin or t.grants_global_access then 'admin' else m.role end
 from public.team_members m join public.teams t on t.id=m.team_id
 where m.user_id=(select auth.uid()) and m.active and (t.active or m.is_super_admin);
$$;
