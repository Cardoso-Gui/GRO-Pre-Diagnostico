-- PREPARED ONLY: requires explicit production permission/release approval.
-- Restricts DELETE only; no assessment rows or read/write/finalization rules change.
-- Depends on the existing validated identity helper from report_rectification.
begin;

create function private.draft_deletion_allowed() returns boolean
language sql stable security invoker set search_path='' as $$
 select private.rectification_identity_active()
  and private.current_team_id()='10888888-c3e9-4bf7-ac23-76e7b1e8fe6d'::uuid;
$$;
revoke all on function private.draft_deletion_allowed() from public,anon,service_role;
grant execute on function private.draft_deletion_allowed() to authenticated;

-- Both legacy policies were permissive. A retained completed policy would OR
-- with the new rule, so explicitly remove that old deletion path.
drop policy if exists assessments_delete_completed_admin on public.assessments;
alter policy assessments_delete_draft on public.assessments
 using (status='draft' and (select private.draft_deletion_allowed())
  and exists(select 1 from public.clients c where c.id=client_id));

-- Enforce the same ceiling if another permissive DELETE/ALL policy is added later.
create policy assessments_delete_team_one_only on public.assessments
 as restrictive for delete to authenticated
 using (status='draft' and (select private.draft_deletion_allowed())
  and exists(select 1 from public.clients c where c.id=client_id));
commit;
