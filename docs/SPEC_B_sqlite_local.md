# SPEC B — SQLite (Local) : Offline Cache of the Role + Local App Data

**Project:** Acassist
**Owner of this spec:** Machine B (Tauri / Rust core / local DB)
**Companion spec:** SPEC_A_supabase_postgres.md (Machine A) — read its "The token (the seam)" section; that is your input contract.

---

## 0. One-sentence job

SQLite caches the role Supabase **already** decided, and owns genuinely-local data. It never *decides* a role. When the trusted path fails, it fails **toward** the stricter online check — never toward trusting a local role.

---

## 1. Scope of this spec

Machine B builds:
- The local SQLite schema (cached session + local app data).
- The Rust verify path: validate the Supabase JWT's signature offline against cached JWKS keys.
- The Modular build order (online gate first, JWT verify layered on top, removable).
- The Grace fallback (JWT verify fails → drop to the stricter online gate, never to the raw SQLite role).

Machine B does **not** assign roles, run OAuth, or write RBAC rules. That's Spec A.

---

## 2. The two things SQLite stores

1. **Cached auth/session** — the verified role from Supabase, so the app works offline after one online login.
2. **Local app data** — quiz modules (JSON), attempts, scores, drafts. The offline-first content the Rust core already handles.

```sql
-- Cached session. Populated ONLY after a successful online login + verify.
create table cached_session (
  user_id       text primary key,
  email         text not null,
  role          text not null check (role in ('student','teacher','admin')),
  access_token  text not null,        -- the signed Supabase JWT (source of role truth)
  jwks_cache    text not null,        -- Supabase public keys, fetched while online
  cached_at     integer not null,     -- unix seconds
  token_exp     integer not null      -- from the JWT 'exp' claim
);

-- Local app data (unchanged from your existing offline-first design).
-- modules, attempts, scores, etc. — owned by the Rust core as today.
```

**Critical:** the `role` column here is a *cache*, not an authority. It is only ever written from a verified token (section 4). A role read loose from this table is NEVER trusted on its own.

---

## 3. The leak to avoid (read this twice)

SQLite lives on the user's device. Anyone can open it with a SQLite browser and edit `role` to `'admin'`. Therefore:

> **A role read from SQLite is only valid if the accompanying signed token verifies.**

If you ever branch on `cached_session.role` without checking the token signature, you've reopened the exact leak the whole design exists to close. The role string is a convenience; the **signature** is the proof.

---

## 4. The Rust verify path (the trusted layer)

On app start / privileged action, offline:

1. Read `access_token` + `jwks_cache` from `cached_session`.
2. Verify the JWT signature against the JWKS public key (Rust: `jsonwebtoken` crate or similar).
3. Check `exp` hasn't passed (using device clock — see the clock-skew caution).
4. Only if the signature + expiry are valid, trust the `role` claim **inside the token** (not the loose column).

```rust
// Pseudocode — the shape, not the final code.
fn verify_cached_role() -> Result<Role, AuthError> {
    let session = sqlite_load_cached_session()?;
    let keys = parse_jwks(&session.jwks_cache)?;
    let claims = verify_jwt(&session.access_token, &keys)?; // signature + exp checked here
    Ok(claims.role) // trust ONLY the in-token role
}
```

**Clock-skew caution:** offline, the device clock is the only truth. If the token expired or the clock drifted, verify fails. Spec A sets a *generous* token lifetime (days) exactly to keep this from biting mid-demo — but your fallback (section 6) must still handle a failed verify gracefully.

---

## 5. Modular build order (build the demo-safe thing first)

Build in THIS order. Do not invert it.

1. **Online re-check gate FIRST.** Get the full demo running green with this as the only enforcement: any privileged action (Admin/Teacher writes) requires being online and re-checks Supabase. Offline, everyone is effectively Student-scoped / read-only. This is your floor — a working, secure app with zero crypto.
2. **Layer JWT verify ON TOP** (section 4), as a removable enhancement. It enables trusted offline roles.
3. If JWT verify misbehaves at 2am, delete the layer → you still have step 1, a shippable secure demo.

> The habit: build the version that demos, get it green, THEN add the impressive layer on top of a known-good base — never underneath it.

---

## 6. Grace fallback (fail toward MORE verification, never less)

When the JWT verify path fails for ANY reason (bad signature, expired, clock skew, missing JWKS):

```
JWT verify fails
   │
   ├─► FALL BACK TO: the online re-check gate   (stricter: requires connection)
   │        │
   │        └─► gate unreachable (offline)? ──► "Connect to continue" + Student-scoped read-only
   │
   └─► NEVER fall back to: trusting cached_session.role on its own  (this fails OPEN = the leak)
```

**The rule:** fallback drops to a *stricter* layer, never a looser one. JWT fails → online gate (needs connection). It must never fall back to "eh, trust the local role." Fail toward more verification, never less. A fallback that fails open is worse than no fallback.

---

## 7. The seam with Spec A (your input contract)

You receive from Machine A:
```
access_token (JWT), signed by Supabase, claims:
  sub   = user id (uuid)
  email = verified email
  role  = 'student' | 'teacher' | 'admin'
  exp   = generous expiry (days)
JWKS URL = https://<project>.supabase.co/auth/v1/.well-known/jwks.json  (confirm exact path)
```

Your responsibilities on the seam:
- Fetch + cache JWKS **while online** (so offline verify has keys).
- Store the token in `cached_session` after a successful online login.
- Verify signature offline; trust only the in-token role.

---

## 8. Checklist for Machine B

- [ ] Create `cached_session` table + confirm local app-data tables.
- [ ] On successful online login: store token, fetch + cache JWKS, record `token_exp`.
- [ ] Implement Rust JWT verify (signature + exp) against cached JWKS.
- [ ] Build the online re-check gate FIRST; get demo green on it.
- [ ] Layer JWT verify on top as a removable module.
- [ ] Wire Grace fallback: verify fail → online gate → (offline) read-only Student scope.
- [ ] Confirm NO code path branches on the loose `role` column without a signature check.
- [ ] Set a generous assumption on token lifetime; test with device clock offline.
