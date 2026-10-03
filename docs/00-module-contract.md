# Acassist — Kiro Spec: Shared Module Contract (00)

*Build Over Nights · Education Crisis track · Build day: Saturday, Oct 3, 2026 (~12-hour single block)*

**This is the interface every lane builds against — UI, teacher/content, and the Rust scoring core.** Freeze this first thing Saturday morning (0:00–0:45 scope-freeze block). If the shape changes after lanes start, both sides break. One source of truth: this file.

> Status: SPEC (planning). Not an implementation. Kiro generates code from this Saturday, not before.

---

## requirements.md

### R1 — A module is a single plain JSON file
- A module MUST be one `.json` file loaded from local disk (simulates a "pushed" module — real distribution is OUT of scope).
- No custom format, no DSL, no `.aca` extension. Plain JSON only.

### R2 — No plaintext answers, ever
- The shipped module MUST NOT contain the correct answer in readable form.
- Each quiz question carries `answer_hash` + `salt` only. The plaintext answer exists only on the teacher side at seal time.

### R3 — One normalization rule, mirrored on both sides
- The teacher side (seal) and the student side (input) MUST normalize answers identically before hashing.
- Normalization: `lowercase | trim | collapse-internal-whitespace | strip-punctuation`.
- Any mismatch between seal-time and check-time normalization produces "correct answer marked wrong" bugs. This is the single highest-risk contract point.

### R4 — Three question kinds, no more (for the event)
- `multiple_choice`, `identification`, `true_false`.
- `true_false` is a two-option multiple choice. Matching/ordering/fill-blank are ROADMAP.

### R5 — Hash the answer text, not the option index
- For multiple choice, the hash is computed over the normalized option *text*, not its position. Keeps one code path with identification. (MC is inherently low-entropy; that is the honest "tamper-resistant, not unbreakable" story, not something this contract fixes.)

### R6 — Device-neutral
- Hash input is `question_id : normalized_answer : salt`. No device id. Same module scores identically on any device, distributed any way.

---

## design.md

### Module shape

```jsonc
{
  "schema_version": "1.0",
  "module": {
    "id": "mod_photosynthesis_01",   // stable unique id
    "type": "quiz",                  // "quiz" | "lesson" — renderer switches on this
    "title": "Photosynthesis Basics",
    "subject": "Science",
    "grade_level": "elementary"      // metadata; drives presentation only (never scoring)
  },

  "lesson": {                        // present when there is lesson content; render-only
    "blocks": [
      { "kind": "heading",   "text": "What is Photosynthesis?" },
      { "kind": "paragraph", "text": "Plants make food from sunlight..." }
      // future block kinds (image, list) are ROADMAP; renderer ignores unknown kinds safely
    ]
  },

  "quiz": {
    "hash_algo": "SHA-256",
    "normalization": "lowercase|trim|collapse-ws|strip-punct",  // the CONTRACT string
    "questions": [
      {
        "id": "q1",                  // stable — part of the hash input, never reused/renumbered
        "kind": "multiple_choice",   // "multiple_choice" | "identification" | "true_false"
        "prompt": "Which gas do plants take in?",
        "options": ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],  // MC/TF only
        "salt": "a3f9c2e1...",       // per-question random salt (hex), shipped in the file
        "answer_hash": "9b74c9b2...",// SHA-256(id : normalized_answer : salt), hex
        "points": 1
      },
      {
        "id": "q2",
        "kind": "identification",
        "prompt": "Name the green pigment in leaves.",
        "salt": "7de11a04...",
        "answer_hash": "c1f0aa5d...",
        "points": 1
      }
    ]
  }
}
```

### Field rules (the contract table)

| Field | Who writes | Who reads | Frozen after seal? | Notes |
|-------|-----------|-----------|--------------------|-------|
| `module.id` | teacher | all | yes | stable identifier |
| `module.type` | teacher | UI | — | renderer switch |
| `module.grade_level` | teacher | UI | — | presentation only, NEVER scoring |
| `lesson.blocks[]` | teacher | UI | — | render-only; unknown `kind` ignored |
| `quiz.normalization` | teacher | UI + Rust | yes | the contract string both sides obey |
| `question.id` | teacher | UI + Rust | **yes** | hash input — immutable |
| `question.salt` | teacher (seal) | Rust | **yes** | hash input — immutable |
| `question.answer_hash` | teacher (seal) | Rust | **yes** | the sealed answer |
| `question.options[]` | teacher | UI | — | MC/TF display + the text that gets hashed |
| `question.points` | teacher | UI | — | UI tallies the score |

### Normalization — the exact rule (both sides implement identically)

```
normalize(s):
  1. Unicode NFC
  2. lowercase
  3. trim leading/trailing whitespace
  4. collapse internal whitespace runs to a single space
  5. strip punctuation (Unicode punctuation category P*)
```

Decide edge cases Friday so no one improvises Saturday: punctuation = Unicode category P (covers `.`, `,`, `'`, `-`, etc.); diacritics are KEPT (do not strip accents — "José" stays "josé"). If the team wants accent-insensitive matching, that is a contract change, decided together, not improvised.

---

## tasks.md

- [ ] **T0 (0:00–0:45, ALL):** Freeze this contract out loud. Confirm the three question kinds, the normalization string, and "no plaintext answers." Lock `schema_version` at `1.0`.
- [ ] **T1 (contract owner):** Commit this file as `MODULE_CONTRACT.md` + a `module.schema.json` (JSON Schema) in the repo so lanes can validate against it.
- [ ] **T2 (ALL lanes):** Each lane writes a 2-line "I read from / I write to" note against the field table above, so dependencies are explicit before coding.
- [ ] **T3 (content lane):** Produce ONE hand-authored example module (`example.module.json`) that validates against the schema — the shared fixture the UI and Rust lanes develop against before AI generation works.
