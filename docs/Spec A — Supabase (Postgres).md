# SPEC A — Supabase (Postgres) : Source of Truth for Identity + Role

**Project:** Acassist
**Owner of this spec:** Machine A (backend / Supabase)
**Companion spec:** SPEC_B_sqlite_local.md (Machine B) — read the "Seam" section of both so they agree.

---

## 0. One-sentence job

Supabase is the **only** place a role is born. OAuth proves *who* you are; Postgres decides *what* you are. The client never sets either.

---

## 1. Scope of this spec

Machine A builds:
- OAuth login via Supabase Auth (provider: Google — adjust if your event needs another).
- The Postgres schema that stores identity → role.
- The role-assignment rules (how Admin / Teacher / Student come to exist).
- Row-Level Security (RLS) so the client cannot escalate its own role.
- The token Supabase issues on login (carries the role as a custom claim) — this is the JWT Machine B's Rust core will verify offline.

Machine A does **not** touch SQLite, local caching, or the Rust verify path. That's Spec B.

---

## 2. The three roles

| Role    | How it is created                                      | Can self-register? |
|---------|--------------------------------------------------------|--------------------|
| Student | Self-registers via OAuth login                         | Yes                |
| Teacher | Provisioned by an existing Admin (invite / direct set) | No                 |
| Admin   | Bootstrapped (first one seeded), then Admin-created    | No                 |

**The leak we are closing:** a Student must have NO path to become an Admin at sign-up. This is enforced below by (a) defaulting every self-registration to `student`, and (b) making the role column writable only by the server/Admin, never by the user.

---

## 3. Login — OAuth via Supabase Auth

- Provider: Google OAuth, configured in Supabase Auth dashboard.
- Flow: client opens the provider consent screen → Supabase handles the callback → Supabase creates/finds the `auth.users` row and issues a session (access token = JWT).
- **OAuth is online-only.** Login requires a connection. This is acceptable: it fits the "online once, offline after" model. The access token issued here is what gets cached for offline use (Spec B).
- Email is **verified by the provider** — so any domain-based role gating (below) can trust it.

---

## 4. Schema (Postgres)

```sql
-- Enum of allowed roles. No other value can exist.
create type app_role as enum ('student', 'teacher', 'admin');

-- Profile row, 1:1 with auth.users. This is the source of truth for role.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        app_role not null default 'student',   -- <-- defaults to least privilege
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One-time invite codes for provisioning Teachers/Admins.
create table public.invites (
  code        text primary key,
  grants_role app_role not null,                      -- 'teacher' or 'admin'
  created_by  uuid not null references public.profiles(id),
  used_by     uuid references public.profiles(id),
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
```

**Key design point:** every new profile defaults to `student`. Elevation to teacher/admin only happens through a controlled path (section 6), never at the user's request.

---

## 5. Auto-create profile on signup (defaults to student)

```sql
-- When a new auth user appears, create their profile as a STUDENT.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'student');   -- always student at birth
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Even if the client sends `role: "admin"` anywhere in the signup payload, it is ignored — the trigger hard-codes `student`. **This is the single most important line for closing the leak.**

---

## 6. How Teachers and Admins get created

Two supported paths. Pick one for the demo; the other is roadmap.

### Path 1 — Invite code (recommended, generic)
1. An existing Admin generates an invite: a row in `invites` with `grants_role = 'teacher'` (or `'admin'`), a random code, an expiry.
2. The new user logs in via OAuth (becomes a `student` by default).
3. They redeem the code. A `security definer` function checks the code is valid/unused/unexpired, then updates their profile role and marks the invite used — **atomically**.

```sql
create or replace function public.redeem_invite(invite_code text)
returns app_role
language plpgsql
security definer set search_path = ''
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites
    where code = invite_code and used_by is null and expires_at > now()
    for update;
  if not found then
    raise exception 'invalid or expired invite';
  end if;

  update public.profiles set role = inv.grants_role, updated_at = now()
    where id = auth.uid();
  update public.invites set used_by = auth.uid(), used_at = now()
    where code = invite_code;

  return inv.grants_role;
end;
$$;
```

Note the role comes from the **invite row** (created by an Admin), never from the user. The user supplies only the code.

### Path 2 — Domain gating (optional, if staff use a distinct email domain)
If teachers sign in with `@staff.school.edu` and students with `@students.school.edu`, the signup trigger can set role from the verified email domain instead of hard-coding student. Only do this if your event's accounts actually split that way — otherwise keep everyone defaulting to student + invite.

---

## 7. Row-Level Security — the lock that stops escalation

```sql
alter table public.profiles enable row level security;

-- A user may READ their own profile.
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- A user may UPDATE their own profile BUT NOT their role.
-- (role changes go only through redeem_invite / admin functions, which are security definer)
create policy "update own profile except role" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- Admins may read all profiles.
create policy "admins read all" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
```

The critical policy is the second one: a user can edit their own profile but the `with check` clause forbids changing `role` to anything other than its current value. **Direct client-side role elevation is impossible even with a stolen session token** — the database rejects it.

---

## 8. Bootstrapping the first Admin

Chicken-and-egg: invites require an Admin, but there's no Admin yet. Seed exactly one, once:

```sql
-- Run manually ONE TIME after the first intended admin has logged in once.
update public.profiles set role = 'admin'
  where email = 'YOUR_ADMIN_EMAIL@example.com';
```

Do this from the Supabase SQL editor (service role), not from the app. After this, that Admin creates everyone else via invites. Document who the seeded admin is for the demo.

---

## 9. The token (the seam with Spec B)

On login, Supabase issues a JWT. Machine B's Rust core will verify this offline, so the role must travel **inside** the token:

- Add the role as a **custom claim** so it's present without a DB round-trip. Use a Supabase Auth Hook (custom access token hook) to inject `role` from `profiles` into the JWT claims at issue time.
- Set a **generous token lifetime** for the offline use case — think days, not minutes — so clock skew and a long judging day can't expire it mid-demo. (Short-lived tokens are correct for production; a trap for a hackathon.)
- Publish/record the JWKS endpoint (Supabase project's public keys) so Machine B can fetch and cache the verification keys **while online**.

### Handoff contract — what Spec B receives
```
access_token (JWT), signed by Supabase, containing claims:
  sub   = user id (uuid)
  email = verified email
  role  = 'student' | 'teacher' | 'admin'   <-- custom claim
  exp   = generous expiry (days)
JWKS URL = https://<project>.supabase.co/auth/v1/.well-known/jwks.json  (verify exact path in dashboard)
```

Machine B must treat this token as the ONLY source of offline role truth, and must verify its signature against the JWKS keys — never trust a role read loose from SQLite.

---

## 10. Checklist for Machine A

- [ ] Configure Google OAuth provider in Supabase Auth.
- [ ] Create `app_role` enum, `profiles`, `invites` tables.
- [ ] Add `handle_new_user` trigger (defaults to student).
- [ ] Add `redeem_invite` function.
- [ ] Enable RLS + the three policies (especially "update own profile except role").
- [ ] Add custom access token hook to inject `role` claim.
- [ ] Set generous token lifetime.
- [ ] Seed the first Admin manually, record who it is.
- [ ] Hand Spec B: a sample signed token + the JWKS URL.
