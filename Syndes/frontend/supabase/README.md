# Supabase Account authority and Module store

Supabase Auth establishes Account identity. The private `app_private.account_access`
row establishes current authorization. A successful first sign-in has no access
row and is **Pending**: it cannot browse Modules or teach. An Administrator
approves an Account and assigns Teacher permission through a privileged manual
process. The client never receives a service-role key or writes access rows.

## Migrations

- `0001_modules_table.sql` creates the sealed Module store.
- `0002_sealed_shape_validation.sql` rejects plaintext answers and derives
  browse metadata from the sealed Module.
- `20261003224618_account_authority.sql` replaces the old claim-based policies with current-state policies
  and the `current_account_access()` RPC. The superseded claim-based `0003`
  policy file was removed so a later migration run cannot reinstall weaker
  rules. Apply all remaining migrations in filename order
  to a new project. Existing projects must compare migration history and schema
  before applying a missing migration; an existing table is not proof that its
  earlier migrations were recorded.

On 2026-10-04, the existing Syndes project had the `modules` table and both
validation/update triggers, with RLS enabled, but no recorded migrations. Its
published-read policy allowed anonymous access and `is_approved()` was absent.
The new authority migration drops those policies and can patch that schema
directly. Before later use of `supabase db push`, reconcile the already-applied
legacy SQL files with the remote migration history after verifying their full
definitions. Do not assume its history reflects its schema.

The private access table has `account_id` (an `auth.users.id`), `approved`,
`role` (`Student`, `Teacher`, or `Administrator`), and `active`. Approval grants
learning access. Teacher permission grants authoring access independently of
learning approval. `active = false` revokes the whole Account. A missing row is
Pending (`approved = false`, `role = Student`, `active = true`). A deleted Auth
user is denied, even if an old bearer token has not expired.

The Data API rules are:

| Caller | Published Modules | Own unpublished sealed Modules | Write own sealed Modules |
| --- | --- | --- | --- |
| Signed out or Pending | No | No | No |
| Active approved Student | Yes | No | No |
| Active Teacher or Administrator | If approved | Yes | Yes |
| Inactive Account | No | No | No |

No Account can read or write another Teacher's unpublished sealed Module.
Plaintext **Drafts** remain local and must be separated by Account in the app.
All Data API decisions read the current private row. Stale JWT `app_metadata`
role or approval claims cannot preserve access after a server-side change.

## Online authorization contract

`POST /rest/v1/rpc/current_account_access` with
`Authorization: Bearer <Supabase access token>`, the public `apikey`,
`Content-Type: application/json`, and `{}` as the body. The RPC takes no Account
id or role argument. It binds to the verified JWT's `auth.uid()` and returns:

```json
{
  "account_id": "the-bearer-token-sub-uuid",
  "approved": false,
  "role": "Student",
  "active": true
}
```

No access row returns that Pending state. `active: false` means whole-Account
revocation. `approved: false` with `active: true` means learning approval is
absent or withdrawn. An unsigned request cannot call the RPC. Native code must
verify the response `account_id` against its validated token subject, and must
require a fresh successful RPC call for each Teacher operation. A response
cannot be used as an indefinitely valid Teacher grant.

## Manual Account operations

Use the Supabase SQL editor or a server-side connection with privileged access.
Verify the person's Auth user id and school identity before changing any row.
The first Administrator is seeded by a project operator; the app has no
self-promotion path. These examples intentionally use a placeholder UUID:

```sql
-- Approve learning for a signed-in Account.
insert into app_private.account_access (account_id, approved)
values ('00000000-0000-0000-0000-000000000000', true)
on conflict (account_id) do update set approved = true, active = true;

-- Grant Teacher permission separately; approval is unchanged.
insert into app_private.account_access (account_id, role)
values ('00000000-0000-0000-0000-000000000000', 'Teacher')
on conflict (account_id) do update set role = 'Teacher';

-- Seed the first Administrator after verifying operator identity.
insert into app_private.account_access (account_id, approved, role)
values ('00000000-0000-0000-0000-000000000000', true, 'Administrator')
on conflict (account_id) do update
set approved = true, role = 'Administrator', active = true;

-- Revoke all access, or restore it later without deleting local work.
update app_private.account_access set active = false
where account_id = '00000000-0000-0000-0000-000000000000';
update app_private.account_access set active = true
where account_id = '00000000-0000-0000-0000-000000000000';
```

To remove Teacher permission while preserving learning approval, change `role`
to `Student`. To withdraw learning approval while preserving Teacher permission,
set `approved = false`. Provision the school's OAuth provider in Supabase Auth
if it exists; otherwise configure Google. Register the app's exact OAuth
redirect. Provider setup and approval are separate operations.

## Verification

The SQL suites in `tests/` run against a local or disposable database after
the migrations. `0002_account_authority.test.sql` runs authenticated-role
requests with distinct bearer identities and stale claims, then rolls back its
fixtures. It checks Pending, Student, Teacher, own-row isolation, and revocation.
Run a real Data API request with a valid Supabase session as an integration
check before production rollout. Never run the fixture suite against live
student data.

The online Module store contains already-sealed Modules only. The Account-scoped
download and local Module bridge lives in `src/features/modules/module-source.ts`.
The service-role key
and other secrets must never appear in `NEXT_PUBLIC_*` values or client bundles.
