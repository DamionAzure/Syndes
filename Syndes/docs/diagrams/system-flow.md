# Syndes proposed system flow

This flowchart combines the proposed learner journey in the [frontend design system](../../frontend/docs/design/design-system.md) with the teacher generation and local scoring paths in the Tauri core. Solid arrows describe the intended user journey; labels call out where a step depends on a condition.

```mermaid
flowchart TD
    T0([Teacher starts]) --> T1[Choose a scaffold or enter topic and source notes]
    T1 --> T2{Online generation succeeds?}
    T2 -- Yes --> T3[Generate draft lessons and questions]
    T2 -- No --> T4[Use prepared fallback module]
    T3 --> T5[Teacher reviews and edits content and cleartext answers]
    T5 --> T6[Seal answers and validate module]
    T6 --> T7[Export local module JSON]
    T4 --> T7

    T7 --> S0([Student opens Syndes])
    S0 --> S1[Open local module file or choose saved module]
    S1 --> S2{File parses and validates?}
    S2 -- No --> S3[Show actionable import error]
    S3 --> S1
    S2 -- Yes --> S4[Add module to local library]
    S4 --> S5[Read quick overview and outcomes]
    S5 --> S6{Saved progress for this version?}
    S6 -- Yes --> S7[Continue at saved step]
    S6 -- No --> S8[Start first lesson]
    S7 --> S9[Read lessons in order]
    S8 --> S9
    S9 --> S10{More lessons?}
    S10 -- Yes --> S9
    S10 -- No --> S11{Quiz present?}
    S11 -- No --> S17[Mark module complete]
    S11 -- Yes --> S12[Answer one question at a time]
    S12 --> S13[Save answers and current place locally]
    S13 --> S14{All required answers provided?}
    S14 -- No --> S12
    S14 -- Yes --> S15[Submit to on-device scorer]
    S15 --> S16[Show numeric result and per-question review]
    S16 --> S17
    S16 --> S18{Next action}
    S18 -- Retry --> S12
    S18 -- Review lesson --> S9
```

## Data and trust boundary

```mermaid
flowchart LR
    A[Teacher draft with cleartext answers] --> B[Seal: normalize, salt, hash]
    B --> C[Validated local module JSON]
    C --> D[Student imports module]
    D --> E[On-device lesson and quiz UI]
    E --> F[On-device answer comparison]
    F --> G[Score and per-question verdicts]
    H[(Local progress and answers)] <--> E
    I[Online generation service] --> A
```

The learner import, lesson, quiz, and scoring path is intended to work without a connection. Online generation is confined to teacher preparation. The result shows verdicts and points; sealed answer hashes do not provide a displayable answer key.

## Proposal versus current implementation

- **Proposed UI:** Library → overview → lessons 1…N → short quiz → result, with local progress, retry, and review.
- **Available core:** Tauri commands for local module loading and validation, answer checking, submission scoring, sealing, scaffold selection, and generation with a prepared fallback.
- **Still to align:** The current module model has one optional `lesson` field, while the proposed UI describes an ordered multi-lesson sequence. The current generation command seals the draft before returning it, so the depicted teacher review of cleartext answers needs a separate authoring step. The frontend is a starting page, and the screens, local progress storage, and unanswered-question gate are proposed rather than implemented.
