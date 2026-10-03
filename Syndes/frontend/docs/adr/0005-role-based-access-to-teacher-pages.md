# Role-based access to Teacher pages

Status: proposed. Needs maintainer review because it touches authorization.

Students may use only the Learn side. Teachers may use Learn and Teach. The app is a static export served by Tauri, so it has no server and no middleware. The only trusted party is the Rust core, which already resolves the role from a verified session (`auth_resolve_role`, SPEC B).

## Decision

**The Rust core enforces access.** `seal_module`, `seal_answer`, `generate_module`, `generate_from_scaffold` and `list_scaffolds` call `require_teacher` before reading their input.
- It uses `resolve_access(state, true)` and allows only Teacher or Admin with `readOnly: false`.
- Any other caller gets `AppError::Forbidden`, which serializes as `{ "kind": "forbidden", "message": … }`.
- If the session store failed to open, the auth state is never managed. Tauri then rejects these commands before they run, so the check fails closed.

**The webview follows the core's answer and never decides a role itself.**
- `lib/access/access-bridge.ts` calls `auth_resolve_role`. Outside Tauri, on any error, or on any unexpected payload, it resolves to the Student floor.
- `TeachGuard` (in `app/teach/layout.tsx`) asks again with `requirePrivileged: true` each time someone enters the Teach section.
  - It renders nothing from the page until the core answers.
  - It sends anyone who isn't a Teacher to Home with `router.replace`.
- The prerendered HTML for every `/teach` route shows only the checking state.
- The Teach nav group is listed only after the core confirms a Teacher. While the check is running, it stays hidden.

**Admin counts as a Teacher**, matching `Role::is_privileged` in the core.

**For development only:** in plain `next dev` there is no Rust core. Setting `NEXT_PUBLIC_SYNDES_DEV_ROLE=teacher` (or `admin`) stands in for a verified Teacher.
- It is read only when `NODE_ENV` is `development` and the page is outside Tauri.
- `next build` sets `NODE_ENV` to production, so shipped builds ignore it.
- Example: `$env:NEXT_PUBLIC_SYNDES_DEV_ROLE="teacher"; npm run dev`.

## Consequences

- **The client checks are for usability, not secrecy.** A static export ships every page's code, including the inline payload with page headings, to every device. Nothing secret may live in the bundle. Real Learner records and anything else teacher-only must come from a teacher-gated Rust command, never from client fixtures.
- **Nobody can become a Teacher yet.** There is no sign-in flow, so in the desktop app everyone resolves to the Student floor until a session is stored with `auth_online_login`. That needs the Supabase sign-in from Spec A.
- **New teacher-only commands must call `require_teacher` first.** Student-path commands (`load_module`, `check_answer`, `score_submission`) stay ungated so Learners can study offline.
