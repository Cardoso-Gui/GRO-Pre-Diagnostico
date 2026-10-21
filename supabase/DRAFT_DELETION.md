# Team 1 draft deletion restriction

Prepared change. Do not apply the production migration or publish without explicit approval.

## Scope

Only active members of the designated Team 1 (`10888888-c3e9-4bf7-ac23-76e7b1e8fe6d`) can delete a `draft` assessment. Both admin and editor members of that exact team qualify, consistent with the existing global-team access model. Generic admin, responsible owner, super-admin or global-access flags outside Team 1 do not qualify. Completed assessments cannot be deleted through the authenticated application API.

The browser hides the deletion action for others, preserves existing edit links, revalidates the account/team before confirming, and guards repeated clicks. The API deletion retains ID, status and revision predicates. The database uses the existing validated active user/session helper and actual membership, not user-editable metadata. It drops the old completed-delete policy, narrows the draft policy, and adds a restrictive DELETE ceiling to prevent permissive policy OR widening. No read, insert, update, finalization, report, rectification, storage or membership policy is changed. No records are deleted by migration.

## Prerequisites and inventory

Read-only production inspection 2026-10-21 confirmed RLS enabled, exactly two permissive DELETE policies (`assessments_delete_draft`, `assessments_delete_completed_admin`), separate SELECT/INSERT/UPDATE and no ALL policies. `private.rectification_identity_active()` exists independently of its feature flag and checks user, team/member activity and a live non-expired session. The new SECURITY INVOKER helper combines that identity check with `private.current_team_id()` exact ID; it introduces no privileged public RPC. Service role/database owners remain trusted bypass roles, not application authorization. Existing client foreign key is ON DELETE RESTRICT, and authenticated clients have no DELETE grant/policy.

## Release order

1. Verify expected code head, full tests and independent review.
2. With explicit approval, apply `20261021182230_restrict_draft_deletion_to_team_one.sql` via migration tooling. It only restricts permissions. Inspect effective policy definitions, helper ACL/security mode and unchanged non-DELETE policies afterward, without deleting real records.
3. Publish UI after database restriction is in place; old tabs fail closed through RLS during rollout.
4. Verify deployed assets/version tokens. Reverting the UI alone must not restore broader database deletion rights. Any permission rollback needs a separately reviewed, explicitly approved migration.

## Verification

Synthetic embedded PostgreSQL tests cover Team 1 editor, other-team owner/admin/superadmin, inactive membership/team, banned account, revoked session, team move, anonymous, stale revision, completed status, and a future permissive policy. Non-DELETE policies/table privileges stay identical. UI/confirmation tests cover no-network denial, role distinction, cancel, repeated clicks, account/team changes, and clearing only the matching local recovery copy.

Deletion preserves the client and separately stored photos. The deleting user's matching local recovery copies are cleared. Normal saved-draft autosave uses UPDATE and cannot recreate a deleted row. A preexisting rare lost-first-INSERT-response/local-unsaved-copy case can create a new record with the same UUID later; this restriction does not add persistent deletion tombstones or change INSERT permissions.
