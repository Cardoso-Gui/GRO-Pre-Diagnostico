# Prepared report rectification backend

Status: local code and synthetic tests only. The migration has NOT been applied to a connected project. No report has been corrected and no permission activated. Applying it requires separate explicit activation approval; publishing the UI is a separate deployment decision.

## Guarantees and exact permission delta

The original `public.assessments` row is never updated by this feature. Its snapshot, revision, report_revision, title, answers, ownership, creation/completion timestamps and actors remain intact. No existing trigger, guard, membership, role, schema grant or table grant is changed.

New objects and permissions:

- `private.assessment_rectifications`: immutable, RLS-enabled append-only correction history with UUID, per-assessment monotonic sequence, request UUID, expected sequence, server-derived actor/name/team/time, reason, submitted business patch, server-derived before/after diff and effective snapshot. `assessment_id` uses `ON DELETE RESTRICT`, not a cascading delete. An assessment with correction history can no longer be deleted through an existing completed-report deletion path.
- `private.assessment_rectification_control`: RLS-enabled private feature gate. No client permissions.
- `authenticated` receives SELECT on the new history table only. The SELECT policy requires a currently active non-anonymous/non-banned/non-deleted account and an original completed-assessment row visible through its existing SELECT RLS. No direct INSERT/UPDATE/DELETE/TRUNCATE is granted. PUBLIC, anon and service_role are explicitly revoked on these new tables.
- `authenticated` receives EXECUTE on four public invoker RPCs: `read_assessment_report(uuid,boolean)`, `read_assessment_report_summaries(uuid[])`, `can_rectify_assessment(uuid)`, and `rectify_assessment(uuid,integer,uuid,text,jsonb)`.
- `authenticated` also receives EXECUTE on three tightly bounded private helpers: identity-active lookup, exact correction capability lookup, and the append helper. The append helper independently checks and locks the account, session, membership, team, feature gate and original assessment; calling it directly does not skip authorization or validation. Other internal validator/diff/photo/immutability helpers are not client-callable.
- New helper functions using SECURITY DEFINER have an empty search_path, fully qualified objects, no dynamic SQL and explicit caller checks. They do not rely on browser claims or editable user_metadata. All new functions revoke default PUBLIC access; no anonymous RPC access is granted.
- The exact write audience is any currently active member of team `10888888-c3e9-4bf7-ac23-76e7b1e8fe6d` whose actual membership role is `admin`, with an active team/account and a matching unexpired server-side auth.sessions row for the signed JWT session_id. Revoked, expired, missing or mismatched sessions fail closed. Being a global admin elsewhere, being a collaborator within that team, a matching display name, or a browser-side flag is insufficient. Future admins added to this exact team would also qualify. This is team-scoped authorization, NOT permanently restricted to a single user ID.

No new credentials, external grants, auth provider changes, RLS changes on existing tables, or relaxed completed-assessment UPDATE permissions are introduced. Existing original revision allocation is untouched.

## API contract

`read_assessment_report(p_assessment_id uuid, p_original boolean default false)` returns:

- `assessment`: `{id,client_id,title,report_revision,revision,completed_at,final_snapshot,team_members:{display_name}}`.
- `sequence`: latest correction sequence, or 0. It is NOT the report revision and must not replace the revision displayed to users.
- `can_rectify`: exact current server capability.
- `history`: ordered `{id,sequence,actor_id,actor_name,created_at,reason,changes}` entries. Changes contain JSON-pointer `path`, `before`, `after`, `before_present`, `after_present`. Arrays are recorded as entire changed business fields, not ambiguous positional identities.
- `original_report_document`: original frozen document, for preserving untouched/legacy report sections during canonical rendering.

`p_original=true` returns the untouched original assessment snapshot but still includes the latest sequence and full history. Invalid/invisible/inactive requests raise an error, never silently fall back to original content.

`read_assessment_report_summaries(p_assessment_ids uuid[])` returns visible completed reports only as `[{id,title,sequence,can_rectify}]`, limited to 1000 requested IDs. It uses the same invoker/original RLS visibility and carries no report body or history.

`rectify_assessment(p_assessment_id uuid, p_expected_sequence integer, p_request_id uuid, p_reason text, p_changes jsonb)` returns the same full read envelope after success. The request UUID must be retained after an uncertain network result and retried only with identical reason, expected sequence and patch. Same UUID with different payload/actor fails. An exact retry returns the current state without adding another history entry, even if a later correction already exists.

- Conflict: SQLSTATE `40001`; reopen/compare rather than overwrite.
- Unauthorized/disabled/unavailable: `42501`.
- Invalid business patch, no-op, reason, reference or mismatched idempotency reuse: `22023`.
- Audit UPDATE/DELETE/TRUNCATE: `23514` (also denied by client privileges).

## Business allowlist and preservation

The checked-in `rectification-patch-schema.json` is embedded in the migration and tested for consistency. A patch can contain only:

- `title`.
- `client`: historical legal/trade name, CNPJ, CNAE, contact name/phone/email, and allowlisted address fields (street, number, complement, district, city, state, postal_code).
- `answers`: visitDate, employees, dimensionOptions, selectedSectors, jobsBySector, selectedRiskMode, gheList, selectedRisksByTarget, riskSourcesBySelection, epiBySelection.

Nested object shapes and scalar types are also checked. Business risk details include damage, damageSelections, damageOther, damageOtherEnabled, existing measures, controls, proposed improvements and assessment/measurement recommendation. Changed quantities must be positive integers; changed required names cannot be blank; measurement and EPI applicability use Sim/Não. Unchanged legacy scalar values are not rewritten to match newer defaults.

The browser cannot submit final_snapshot, report_document, client links, team/actor/owner IDs, status, timestamps, schema version, revision, report_revision, security fields or audit values. CNPJ/currentCompany inside answers cannot be patched directly; the server synchronizes only historical client identity fields actually changed by the patch. CNAE-description and street-prefix display caches are invalidated only when their source values change. The live clients table is never modified.

Object patches merge recursively. Arrays intentionally replace their business field but preserve unknown historical object properties unchanged. Stable keys (map key, job name, GHE ID, linked sector/job, workstation name) match records when siblings move or disappear. New/changed unknown properties and omission of unknown properties on a retained record are rejected. Whole removal of a business item remains an explicit change. Ambiguous duplicate names and complex identity changes can require editing separately; unknown data is never silently discarded to make an edit pass.

Selected-risk references must correspond to current active jobs/GHEs and repository risk codes. New/edited detail and EPI entries must refer to selected risks; untouched orphan detail caches remain preserved but inert. New workstation photos must have the original client prefix, the expected path shape and an existing private storage object. No upload or deletion occurs in these RPCs.

Effective `answers.report_document` is removed after a correction; the original remains untouched and available separately. Consumers must regenerate affected sections from effective business data and preserve untouched original document sections. They must NOT display a stale original document as if a failed correction read succeeded. The content rendering/preview/print behavior is tested separately in the JavaScript layer.

## Authorization dependency verified read-only

On 2026-10-20 UTC the connected schema was inspected READ-ONLY:

- assessments_read: authenticated SELECT, `EXISTS (SELECT 1 FROM clients c WHERE c.id=assessments.client_id)`.
- clients_read: authenticated SELECT, `private.is_global_admin() OR team_id=private.current_team_id()`.
- authenticated already has USAGE on private; auth.jwt() exists and auth.sessions has id/user_id UUID and nullable not_after timestamptz; authenticated has NO direct sessions SELECT and receives none. auth.users has is_anonymous (boolean NOT NULL), banned_until and deleted_at (timestamptz); storage.objects bucket_id/name are text.
- assessments.revision is bigint; report_revision is integer. No original schema was changed.

The public invoker RPC and history RLS use the live original assessment policy. The private elevated append helper independently repeats the currently verified client-team visibility predicate in addition to its exact-team/raw-admin authorization. If the original visibility policy later changes, review/update this helper before deployment; do not assume a SECURITY DEFINER function can inherit the caller's RLS automatically.

## Local tests, limitations and activation checklist

Run `npm ci` then `node --test tests/rectification-database.test.mjs` (or the repository `npm test`). These tests use pinned PGlite 0.5.10, actual embedded PostgreSQL 18.6, fresh synthetic roles/schemas/rows in memory and no network URL. Do not point the fixture SQL at production.

Covered: exact authorization and forged claims; direct private helper denial; anonymous/inactive/banned/deleted identities and revoked/expired/missing/malformed/mismatched sessions; original RLS and transferred-client visibility; original columns/guard invariance; business diffs and identity synchronization; original document availability; idempotent retries and stale sequence conflict; strict metadata/nested-field denial; malformed references; bounded list visibility; legacy-array removal/preservation; photo existence/client constraints; no direct table writes; privileged audit UPDATE/DELETE/TRUNCATE rejection; restricted parent deletion; and disable-with-history-preserved.

Limitations: PGlite is a single-connection embedded engine. Stale-sequence behavior is executed, but truly simultaneous independent PostgreSQL sessions and revocation-vs-write races are not claimed as tested. The SQL lock order and READ COMMITTED row-lock/sequence behavior are statically reviewed.

A real two-session test is prepared in `supabase/tests/rectification-concurrency.mjs`. It creates a fresh temporary PostgreSQL cluster with TCP disabled, uses only a private Unix socket, seeds only synthetic data, checks actual lock waits using pg_blocking_pids, and stops/removes its own temporary cluster. It accepts a temporary package directory, never a database URL. Install the optional pinned packages separately with `npm install --prefix /tmp/gro-postgres-concurrency --save-exact embedded-postgres@18.4.0-beta.17 pg@8.16.3`, then run `node supabase/tests/rectification-concurrency.mjs /tmp/gro-postgres-concurrency` as a non-root user in an environment permitted to create local sockets.

Attempt on 2026-10-20: native PostgreSQL 18.4 initialized, but the execution sandbox denied Unix-domain socket creation and the permitted escalation route failed before command execution. The server exited before test connections, so no simultaneous-session result is asserted. This is an environment blocker, not a passed test or a production test.

Before activation, execute that script successfully in an isolated PostgreSQL-capable environment (never client data). It verifies competing writes produce `40001`, identical requests add only one audit row, sign-out serializes with in-flight writes, and a write behind membership revocation fails instead of appending. Check the target PostgreSQL version and run project advisors only under approved read access.

Reverify exact team UUID, role meaning, current policies, private schema grants, auth columns and storage schema before applying. Confirm the team-scoped ongoing permission audience, preservation-only rollback, frontend/backend compatibility and independent review. This preparation itself authorizes no migration, permission activation, production correction, push, merge or deployment.

## Deactivation without deleting history

`disable-report-rectification.sql` updates only the new feature gate and revokes authenticated execution on the public write RPC/private append helper. Read/history remains available, original content is preserved, and can_rectify becomes false. It does not drop tables, remove audit entries or relax the original guard. Executing this administrative script requires its own authorization. Re-enabling is a separately reviewed and approved permission change, not an automatic retry or rollback.

## Frontend and release gate

The editor is `rectify.html?id=...`, reached through server-authorized Retificar links in the report and report list. It reuses the questionnaire, provides explicit sector/job/GHE rename operations that retain linked risks, and keeps draft-saving/completion disabled in favor of a before/after review plus required reason and explicit confirmation. Names, address, contact, visit date, headcount, sectors/jobs/GHE, exposures, damages, prevention, EPIs, photos and recommendations are business fields; ownership/auth/completion/revision metadata are not editable.

The review preflights the effective document, blocks pending photo uploads, detects edits made during asynchronous validation, and retains request identity on uncertain saves. Cancel does not write. Membership/session loss closes the dialog and blocks it from reappearing after pending loads. Actual baseline-to-edited deltas are replayed onto the frozen original to avoid silently persisting form normalization of unrelated legacy records.

Normal reading, reuse, report summaries and printing all use the effective read contract. `report-document-overlay.js` rebuilds only sections depending on changed business values, after expanding persisted whole-array before/after diffs into leaf paths. Other original JSON nodes, including unknown legacy sections, remain unchanged. Date/title-only changes do not regenerate the original body; the report's ordinary date/title overlays display the effective value. Supported legacy detail-heading aliases are normalized, and ambiguous duplicate affected sections fail explicitly. The original remains separately viewable. No failed correction read silently falls back to the old document.

A local native PostgreSQL 18.4 multi-session attempt was blocked before test connections because the execution sandbox denied Unix socket creation. The permitted escalation also failed before execution because of an unrelated protected filesystem setup path. This is NOT a concurrency test pass. The reproducible script is `supabase/tests/rectification-concurrency.mjs`; it starts a fresh temporary PostgreSQL instance, uses synthetic fixtures only, listens on a private local Unix socket with no TCP listener, and accepts NO remote database URL. It checks two simultaneous writers, duplicate request retries, session-revocation serialization, membership-revocation serialization and original-row invariance.

The prepared `.github/workflows/rectification-security.yml` runs `npm ci`, `npm test`, and `npm run test:concurrency` on a standard `ubuntu-latest` GitHub Actions runner when a draft pull request changes relevant files or someone explicitly dispatches the workflow. Its token has contents-read only and checkout does not persist credentials. It uses no production secrets, Supabase credentials, production database, client data, publishing or deployment step. It may consume the repository's ordinary GitHub Actions quota/minutes under its existing plan; no paid capacity or billing setting is enabled by this change. This workflow has NOT been published or run yet.

Release order: obtain publication/CI approval; push a reviewed feature branch and open a draft PR; require the isolated security job to pass for the exact commit; finish applicable browser review; obtain separate action-time permission for the new database capability; only then apply migration and publish frontend code in a coordinated rollout. Do not activate production permissions while the real multi-session gate is unverified.

After any correction exists, do not roll back to the pre-feature report reader: that older reader would silently display originals. The safe rollback disables new corrections using the dedicated script but retains the effective reader and audit history. No automatic data correction is authorized by preparing or activating this feature.
