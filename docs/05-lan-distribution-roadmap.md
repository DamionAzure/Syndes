# 05 — LAN Distribution (Offline Module Sharing) — ROADMAP

Status: **Roadmap / not built.** Forward-looking design, not an implemented lane.
Captures the intended shape so it can be picked up as a milestone after the event.

## One-line idea

A teacher's device becomes a **local module server**: it hands out sealed module
JSON to learners' devices over the local network (LAN / Wi-Fi), with **no internet
required**. As long as a learner's device can run the app and reach the teacher on
the same network, it can receive and run modules.

## Why this fits Syndes

- Modules are already **self-contained sealed JSON** (spec 00) that score fully
  offline in the Rust core (spec 04). A learner needs only to *receive the file* —
  there is no server dependency for scoring. LAN sharing is a **transport**
  problem, not a rearchitecture.
- The app ships a **Rust backend process** (Tauri), which can open a socket and
  host an HTTP server — something a plain web page cannot do. This is the key
  enabler.
- Sealed modules carry **salted hashes, never plaintext answers** (spec 00/03), so
  serving them over a shared network leaks no answer keys. The payload is safe to
  broadcast.
- `pullModule` (online Supabase path, `src/lib/moduleStore.ts`) already proves the
  "fetch sealed JSON -> write local file -> hand to `load_module`" bridge. The LAN
  client reuses that exact shape with a different source URL.

## "No internet" != "no network"

The goal is to work **without an internet uplink**, not without a network. A LAN
still needs something to connect devices. Reliability, best to worst:

1. **Shared offline router/AP (most reliable).** Teacher + learners join an
   existing Wi-Fi with no internet. Everyone gets LAN IPs; the teacher's HTTP
   server is reachable. Recommended target for v1.
2. **Laptop hotspot (workable).** Windows "Mobile hotspot"; teacher laptop serves.
3. **Phone Wi-Fi hotspot (least reliable, OEM-dependent).** Android/ColorOS may
   isolate hotspot clients from the host or assign a gateway IP awkward to bind a
   server to. Often works, not guaranteed. Best-effort, not v1.

## Architecture

```
Teacher device (host)                         Learner device (client)
+-------------------------------+             +---------------------------+
|  Tauri app                    |             |  Tauri app                |
|   Rust core                   |             |   Rust core               |
|    - module store (sealed)    |             |    - load_module (same)   |
|    - LAN server  <--- NEW     |  HTTP/LAN   |    - LAN client  <--- NEW |
|      axum on 0.0.0.0:<port>   | <=========> |      fetch sealed JSON    |
|      GET /modules             |  sealed     |      write local file     |
|      GET /modules/{id}        |  JSON       |      -> load_module       |
+-------------------------------+             +---------------------------+
```

The server serves the **same bytes** `load_module` already consumes. The learner
path ends by handing a local file to the **unchanged** offline core — identical to
the Supabase `pullModule` bridge, swapping the source from Supabase to a LAN URL.

## v1 scope (minimum credible feature)

- **Teacher — Rust HTTP server** (`axum` or `tiny_http`) bound to `0.0.0.0:<port>`:
  - `GET /modules` -> summaries `{ id, title, subject, grade_level, type }`.
  - `GET /modules/{id}` -> the sealed module JSON (exact `load_module` bytes).
  - Serve only **published/sealed** modules; never drafts or plaintext.
- **Teacher UI:** "Start sharing" shows the reachable address (`http://<ip>:<port>`)
  and a **QR code** encoding it. Connected-learner count if cheap.
- **Learner UI:** "Join a session" — **scan the QR or type IP:port**, fetch
  `/modules`, pick one, download, run. Reuses the `pullModule`-style bridge.
- **Network target:** shared offline router/AP first (most reliable).

Out of v1 (deferred): auto-discovery, phone-hotspot hosting, background serving,
auth beyond a basic session code.

## Deferred / v2+

- **Zero-config discovery (mDNS/Bonjour, `_syndes._tcp.local`)** so learners need
  no IP/QR. mDNS multicast is flaky on some Android/Wi-Fi setups and some networks
  block it — hence QR/manual first.
- **Phone-hotspot hosting** (phone is both AP and server). OEM-dependent; validate
  on target devices (incl. Oppo/ColorOS) before promising it.
- **Android foreground service** so the server survives backgrounding / screen
  sleep. Required for a phone to be a dependable host.
- **Session code / lightweight auth** so random LAN devices cannot enumerate
  everything. Low-risk given sealed payloads, but good hygiene.
- **Push/broadcast** ("send to all joined") on top of v1 pull.
- **Attempt/score collection back to the teacher** over the same LAN (reverse
  direction) once distribution works.

## Risks & constraints

- **Mobile backgrounding** stops the server without a foreground service (v2).
- **Socket permissions:** Tauri capabilities must allow binding a listener;
  Android needs `INTERNET` permission and the server in-process.
- **Hotspot client isolation** on some OEMs can block client->host traffic.
- **Open-network exposure:** anyone on the LAN can hit the endpoint. Sealed
  payloads keep this low-risk; a session code closes the gap.
- **Port conflicts / firewalls** (Windows Defender prompt on first bind).

## Security posture

- Serve **only sealed, published** modules — the no-plaintext invariant (spec
  00/03) means the wire payload never contains answer keys.
- Never serve drafts, `.env`, JWKS, tokens, or app-data table contents.
- Prefer binding to the LAN interface and gating with a per-session code before
  exposing a list endpoint on an open network.

## Rough effort estimate

- Rust `axum` server + two routes: ~0.5 day.
- Learner fetch bridge (reuse `pullModule` shape): ~0.5 day.
- Teacher/learner UI (start sharing + QR, join + list): ~1 day.
- Discovery (mDNS) + Android foreground service + hotspot validation: ~2-3 days —
  the bulk of the real-world risk.

## Relationship to existing lanes

- **Reuses, does not replace,** the offline core (`load_module`, spec 04) and the
  sealed-module contract (spec 00). Scoring stays 100% offline and unchanged.
- **Parallels** the Supabase online store (Spec A): same "sealed JSON in, local
  file out" bridge, different transport. A device could use Supabase online and
  LAN offline — the formats are identical.

