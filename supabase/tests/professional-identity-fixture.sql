-- SYNTHETIC LOCAL DATABASE ONLY. Apply after rectification-fixture.sql.
-- Restores the existing administration/assessment authorization surface omitted by
-- that narrower fixture. Production migration does NOT apply any of these grants.
alter table public.team_members add column username text unique;
alter table public.team_members add constraint members_role_check check(role in ('admin','editor'));
alter table public.team_members add constraint super_admin_role check(not is_super_admin or (role='admin' and active));
alter table public.assessments alter column id set default gen_random_uuid();
alter table public.assessments alter column status set default 'draft';
alter table public.assessments alter column answers set default '{}'::jsonb;
alter table public.assessments alter column schema_version set default 1;
alter table public.assessments add constraint operator_fk foreign key(responsible_id) references public.team_members(user_id);
alter table public.assessments add constraint assessment_status_check check(status in ('draft','completed'));
create function private.current_team_role() returns text language sql stable security definer set search_path='' as $$
 select case when m.is_super_admin or t.grants_global_access then 'admin' else m.role end
 from public.team_members m join public.teams t on t.id=m.team_id
 where m.user_id=(select auth.uid()) and m.active and (t.active or m.is_super_admin);
$$;
revoke all on function private.current_team_role(),private.current_team_id(),private.is_global_admin() from public,anon;
grant execute on function private.current_team_role(),private.current_team_id(),private.is_global_admin() to authenticated;
alter table public.teams enable row level security;
create policy teams_read on public.teams for select to authenticated using (private.is_global_admin() or id=private.current_team_id());
alter policy assessments_update on public.assessments using (
 exists(select 1 from public.clients c where c.id=client_id) and (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin')) with check (
 exists(select 1 from public.clients c where c.id=client_id) and (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin'));
create policy assessments_insert on public.assessments for insert to authenticated with check (
 exists(select 1 from public.clients c where c.id=client_id) and created_by=(select auth.uid()) and
 (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin'));
grant insert on public.assessments to authenticated;
grant usage on schema public,private,auth to service_role;
grant all on all tables in schema public to service_role;

-- Match the live table ACL shape verified read-only on 2026-10-20. RLS policies
-- still govern writes; no membership writes are granted to authenticated.
grant delete on public.assessments to authenticated;
grant all on public.teams to authenticated;
revoke all on function private.guard_assessment() from public,anon,authenticated,service_role;
