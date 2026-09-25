-- Applied to the hosted project. Only active owners/admins may delete drafts.
create policy assessments_delete_draft on public.assessments for delete to authenticated
using (status='draft' and (select private.current_team_role()) is not null
and (responsible_id=(select auth.uid()) or (select private.current_team_role())='admin'));
grant delete on public.assessments to authenticated;

