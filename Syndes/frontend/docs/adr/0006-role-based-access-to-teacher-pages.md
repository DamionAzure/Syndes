# Role-based access to Teacher pages

Status: accepted for the MVP.

Approved Students may use Learn. Teachers and Administrators may also use Teach after a fresh online check. The app is a static export served by Tauri, so it has no server and no middleware. The Rust core verifies the Account's Supabase session and reads current authority from the server (`auth_resolve_role`).

## Decision

**The Rust core enforces access.** `seal_module`, `seal_answer`, `generate_module`, `generate_from_scaffold` and `list_scaffolds` call `require_teacher` before reading their input.
- It uses a fresh online access check and allows only Teacher or Admin with `readOnly: false`.
- Any other caller gets `AppError::Forbidden`, which serializes as `{ "kind": "forbidden", "message": … }`.
- If the session store failed to open, the auth state is never managed. Tauri then rejects these commands before they run, so the check fails closed.

**The webview follows the core's answer and never decides a role itself.**
- `lib/access/access-bridge.ts` calls `auth_resolve_role`. Outside Tauri in production, on any error, or on any unexpected payload, it resolves to the Student floor.
- `TeachGuard` (in `app/teach/layout.tsx`) asks again with `requirePrivileged: true` each time someone enters the Teach section.
  - It renders nothing from the page until the core answers.
  - It sends anyone without current Teacher or Administrator authority to Home with `router.replace`.
- The prerendered HTML for every `/teach` route shows only the checking state.
- The Teach nav group is listed only after the core confirms Teacher or Administrator authority. While the check is running, it stays hidden.

**For development only:** in plain `next dev` there is no Rust core. Setting `NEXT_PUBLIC_SYNDES_DEV_ROLE=teacher` (or `admin`) stands in for a verified Teacher (or Administrator).
- It is read only when `NODE_ENV` is `development` and the page is outside Tauri.
- `next build` sets `NODE_ENV` to production, so shipped builds ignore it.
- Example: `$env:NEXT_PUBLIC_SYNDES_DEV_ROLE="teacher"; npm run dev`.

## Consequences

- **The client checks are for usability, not secrecy.** A static export ships every page's code, including the inline payload with page headings, to every device. Nothing secret may live in the bundle. Real Learner records and anything else teacher-only must come from a teacher-gated Rust command, never from client fixtures.
- **New teacher-only commands must call `require_teacher` first.** Student-path commands (`load_module`, `check_answer`, `score_submission`) check approved Account access and honor the offline study decision in ADR-0007. Pending Accounts cannot use them.
- **Current authority is online for privileged work.** A cached token never grants Teacher access by itself. A Teacher may preserve edits to an already-open local Draft during a connection loss, but entering Teach or starting generation, sealing, or publishing waits for current online authorization. Administrators follow the same rule.
