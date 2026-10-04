# Data API authorization check

`data-api-access.mjs` checks the deployed Supabase Data API through HTTP. It
issues only `GET` requests and uses only the public project key and caller
access tokens. It never creates, changes, or deletes Accounts or Modules.
Supabase grants and RLS both matter at this boundary ([Supabase Data API
security](https://supabase.com/docs/guides/api/securing-your-api)). The
`current_account_access()` RPC is `STABLE`, so PostgREST permits a read-only
`GET` call ([PostgREST RPC documentation](https://postgrest.org/en/v14/references/api/functions.html)).

## Anonymous check

Export the project's public URL and publishable/legacy anon key at run time:

```sh
export NEXT_PUBLIC_SUPABASE_URL='https://PROJECT_REF.supabase.co'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='PUBLIC_KEY'
node supabase/tests/data-api-access.mjs anon
```

The expected result is `ok: anonymous Module read denied`. The check requires
HTTP 401 or 403, not merely an empty array, so an empty table cannot mask an
open anonymous grant. On 2026-10-04 this check passed against the Syndes project
after the Account authority migration. No test Accounts or Module rows were
accessed.

## Full read matrix

Run this mode only against a disposable project or branch containing synthetic
test Accounts and Modules. The script requires five distinct, unexpired
Supabase Auth access JWTs. Supply them through environment variables at run
time; never save tokens in this repository, shell history, issue comments, or
test output. The test Accounts must have these current server-side states:

| Token variable | Current access row |
| --- | --- |
| `SYNDES_TEST_PENDING_TOKEN` | No row; signed in and Pending |
| `SYNDES_TEST_STUDENT_TOKEN` | Active, approved Student |
| `SYNDES_TEST_TEACHER_TOKEN` | Active, approved Teacher |
| `SYNDES_TEST_ADMIN_TOKEN` | Active, approved Administrator |
| `SYNDES_TEST_REVOKED_TOKEN` | Inactive Account |

The revoked token must have been issued **before** revocation and must still
carry an old `app_metadata.approved = true` or Teacher/Administrator role claim.
Keep that exact token unrefreshed and unexpired, then set its Account's
`active = false` through the privileged manual process. This is what makes the
last case a stale-token test rather than merely a revoked-state test. The script
decodes the JWT only to check its subject, expiry, and stale claim; the Data
API still validates the signature.

Create four uniquely named, sealed **lesson** Module fixtures in the disposable
project. Set their environment variables to their Module ids:

| Id variable | Owner | Published |
| --- | --- | --- |
| `SYNDES_TEST_PUBLISHED_MODULE_ID` | Any test Account other than Pending | Yes |
| `SYNDES_TEST_TEACHER_MODULE_ID` | Teacher test Account | No |
| `SYNDES_TEST_ADMIN_MODULE_ID` | Administrator test Account | No |
| `SYNDES_TEST_REVOKED_MODULE_ID` | Revoked test Account | Yes; retained after revocation |

Use a test-only prefix such as `syndes-auth-test-...`. The two unpublished
fixtures verify owner isolation. The retained published fixture proves the
revoked Account is denied even when its own Module still exists. The script
queries only `id`, `owner`, and `published`, never Module content or answers.

After setting the five token and four Module id variables, run:

```sh
node supabase/tests/data-api-access.mjs matrix
```

It checks the live RPC response against each bearer JWT's Account id and
expected state, then probes visibility of all four known rows for every
Account. A missing fixture fails the preflight rather than passing as a hidden
row. A successful run prints two `ok:` lines. Remove the disposable project or
branch after the run, or delete its synthetic Modules and Auth Accounts through
the privileged test-project process. The script performs no cleanup because it
performs no writes.

## Write authorization

This harness intentionally performs no write probes against a real project.
PostgREST writes commit by default, and a process interruption cannot
guarantee cleanup. The SQL role-boundary suite
`0002_account_authority.test.sql` tests Student denial, Teacher owner insert,
cross-owner update/delete denial, owner-transfer denial, self-promotion denial,
and removal of Teacher permission in a rolling-back transaction.

For a disposable Data API project, verify the remaining HTTP write boundary
manually with synthetic sealed Modules and confirmed cleanup: Pending and
Student inserts must fail; Teacher and Administrator inserts with their own
`owner` must succeed; an insert with another Account's `owner` must fail;
cross-owner update/delete must affect no row; changing a Module's `owner` must
fail; and the unrefreshed token must lose writes after Teacher permission or
whole-Account access is removed. Delete every test Module and Auth Account
after checking the results. Do not perform this matrix against real student
or teacher content.

If OAuth provider configuration or disposable Account tokens are unavailable,
run only `anon` and report the full matrix as unverified. A passing anonymous
check alone does not establish the authenticated RLS matrix.
