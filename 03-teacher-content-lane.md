# Acassist — Kiro Spec: Teacher / Content Lane (03)

*AI (Groq) module generation + the sealing step + the pre-generated fallback module. Owned by the exec lead (AI content generation + quiz logic/data).*

> Status: SPEC (planning). This lane runs ONLINE on the teacher side — it is the "easy case." It must never become a dependency of the offline student path. The sealing step is where plaintext answers get turned into hashes; after sealing, no plaintext answer survives in the module file.

---

## requirements.md

### R1 — Output is a contract-valid module JSON
- Generation MUST produce a module that validates against `module.schema.json` (spec 00). The generator's only job is: content in -> valid module JSON out.

### R2 — Sealing removes plaintext answers
- The generator knows the correct answers (it wrote them). The SEAL step converts each correct answer into `{ salt, answer_hash }` using the SAME normalization + hash as the Rust core, then DROPS the plaintext answer from the output.
- CRITICAL: the shipped module MUST NOT contain the plaintext answer. Seal, then strip.

### R3 — Normalization parity with the core
- The seal step MUST normalize answers with the exact rule in spec 00 (NFC, lowercase, trim, collapse-ws, strip-punct). If seal-time and check-time normalization differ, every affected answer scores wrong. This is the #1 cross-lane bug.

### R4 — A pre-generated fallback module always exists
- A hand-authored, known-good module (`example.module.json`) MUST exist before the demo. A failed/slow live Groq call during the demo MUST fall back to it. The live call is a bonus, never a dependency.

### R5 — Groq is online-only, teacher-side
- No AI on the student/offline path. Groq is chosen for latency. Live generation happens ONLY after the student core checkpoint is green.

### R6 — Guided authoring for non-techy teachers (SHOULD)
- Deterministic prompting scaffolds (templates / structured fields) so a teacher down to elementary level never faces a blank prompt box. This is a SHOULD — build only after the core holds.

---

## design.md

### Pipeline

```
teacher input (topic / source text, aligned to DepEd competencies)
        |
   [Groq generation]  -> draft module (WITH plaintext answers, in memory only)
        |
   [SEAL step]        -> for each question:
                           salt = random()
                           answer_hash = SHA-256(id : normalize(answer) : salt)
                           drop plaintext answer
        |
   contract-valid module.json  (hashes + salts only — safe to ship)
```

### The seal step (the load-bearing part)
- Runs the SAME `normalize()` as the Rust core (spec 00). Keep them in sync — ideally the seal step calls the same Rust normalizer via a Tauri command, so there is literally one implementation. If seal is done in JS/another language, it MUST mirror the rule exactly and be tested against the core.
- Input entropy warning: MC/true_false answers are low-entropy. Sealing does not make them "secure" — it keeps plaintext out of the file. Do not claim more (matches the pitch's honest framing).

### Fallback module
- `example.module.json`: one lesson + a short quiz (mix of MC + identification), hand-authored, schema-valid, sealed. This is ALSO the shared fixture the UI and Rust lanes develop against from hour zero (spec 00, T3).

### Content source (honest framing)
- Modules are aligned to DepEd curriculum competencies (MELCs — government works). Acassist does NOT bundle or redistribute DepEd's copyrighted learning materials; the teacher brings content they are authorized to use. Keep this true in any sample content.

### What this lane does NOT do
- No student-side AI. No network on the student path. No live-generation dependency in the demo. No accounts.

---

## tasks.md

- [ ] **T1 (EARLY, before AI works):** Hand-author `example.module.json` (lesson + MC + identification), sealed with the real normalization. Hand it to the UI and Rust lanes as the shared fixture. This unblocks everyone and is the demo fallback.
- [ ] **T2:** Build Groq generation: teacher input -> draft module JSON. Validate against the schema.
- [ ] **T3:** Build the seal step calling the core's normalizer (or a tested mirror). Verify a sealed module scores correctly in the Rust core end-to-end.
- [ ] **T4 (ONLY after the student-core checkpoint ~7:30–8:30 is green):** wire live generation into the teacher UI, with the fallback module guaranteed if the call fails/slows.
- [ ] **SHOULD (only if core is solid):** deterministic prompting scaffolds / templates for non-techy teachers.
