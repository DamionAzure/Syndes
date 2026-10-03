# Requirements Document

## Introduction

This spec formalizes the JavaScript ↔ Rust Tauri command boundary for the Acassist/Syndes app. The Rust scoring core (spec 04) is already built, verified, and on `main`; its nine `#[tauri::command]` functions in `Syndes/src-tauri/src/commands.rs` are the authoritative source of truth. This document does NOT propose changing the Rust backend. It establishes the contract the frontend must build against so the two sides cannot drift — spec 01 warns that a command-name typo is a silent runtime failure, and the goal here is to move that class of failure to compile time.

Scope is the boundary contract itself and two deviations from the written specs that reality now contradicts. This spec sits on top of spec 01 (Tauri command boundary) and spec 04 (Rust core), and stays consistent with spec 00 (module contract). It deliberately does NOT spec the UI screens (spec 02's lane) nor re-spec the Rust internals (spec 04's lane).

The deliverables this contract enables are three artifacts:
1. A shared, typed TypeScript bridge (a single source of truth for command names and payload/return types).
2. A reconciled Tauri build configuration that points at the real Next.js frontend.
3. A documented offline/online command map that separates the student path from the teacher path.

## Glossary

- **Boundary**: The Tauri IPC seam where webview JavaScript calls into the compiled Rust core via `invoke(name, payload)`.
- **Bridge**: The single shared TypeScript module (e.g. `api.ts` / `bridge.d.ts`) that declares every command name and its payload and return types, and wraps `invoke`. The one TypeScript source of truth for the Boundary.
- **Rust_Core**: The compiled Tauri backend already on `main`, exposing the nine commands in `Syndes/src-tauri/src/commands.rs`. The authoritative source of truth for command names, payload shapes, and return shapes.
- **Command**: One `#[tauri::command]` function exposed across the Boundary. The nine Commands are `load_module`, `check_answer`, `score_submission`, `normalize_answer`, `seal_module`, `seal_answer`, `generate_module`, `list_scaffolds`, `generate_from_scaffold`.
- **Student_Path**: The offline Commands a learner's device exercises: `load_module`, `check_answer`, `score_submission`, `normalize_answer`.
- **Teacher_Path**: The authoring Commands: `seal_module`, `seal_answer`, `generate_module`, `list_scaffolds`, `generate_from_scaffold`. Generation Commands are online; seal Commands are local.
- **IPC_Payload**: A JavaScript-facing argument or return object crossing the Boundary. IPC_Payloads use camelCase field names (e.g. `questionId`, `rawAnswer`, `answerHash`).
- **AppError**: The typed error enum returned by fallible Commands. Variants: `ModuleNotFound`, `ParseError`, `UnknownQuestionKind`, `MissingField`, `QuestionNotFound`, `ValidationError`, `GenerationError`.
- **Plaintext_Answer**: A correct answer in readable form. Exists only on the Teacher_Path in memory on the way INTO the Boundary (seal/generate input); never crosses back out, never logged.
- **Hash_Preimage**: The input to the answer hash (normalized answer, salt, question id combined) from which a Plaintext_Answer could be recovered.
- **Guaranteed_Fallback**: The behavior whereby `generate_module` and `generate_from_scaffold` always resolve to a usable, contract-valid module — serving the bundled pre-sealed fixture if the live generation fails for any reason.
- **Tauri_Build_Config**: `Syndes/src-tauri/tauri.conf.json`, whose `build.devUrl` and `build.frontendDist` wire the Tauri shell to a frontend.
- **Next_Frontend**: The actual frontend application: Next.js 16 + React 19 + Tailwind 4 + TypeScript, located in `Syndes/frontend/`.
- **Type_Parity**: The property that every TypeScript type in the Bridge mirrors its Rust counterpart field-for-field, honoring the camelCase convention on IPC_Payloads.

## Requirements

### Requirement 1: Single shared typed bridge as one source of truth

**User Story:** As a frontend developer, I want one shared typed bridge definition for every Tauri command, so that a renamed or mistyped command surfaces at compile time instead of as a silent runtime failure.

#### Acceptance Criteria

1. THE Bridge SHALL declare exactly nine Commands exposed by the Rust_Core, and no additional Commands: `load_module`, `check_answer`, `score_submission`, `normalize_answer`, `seal_module`, `seal_answer`, `generate_module`, `list_scaffolds`, and `generate_from_scaffold`.
2. THE Bridge SHALL define, for each Command, a command-name string that is byte-for-byte identical to the corresponding Rust_Core function name, with no additional, missing, or differently-named entries.
3. THE Bridge SHALL define, for each of the nine Commands, exactly one typed payload shape and exactly one typed return shape, each with every field explicitly typed and no field left as an untyped or any-equivalent type.
4. WHEN frontend code invokes any of the nine Commands, THE Bridge SHALL be the only call site through which the Tauri invoke mechanism is reached, such that zero frontend modules outside the Bridge reference the raw Tauri invoke mechanism directly.
5. IF frontend code references a command name or payload field that does not match the Bridge definition exactly, THEN THE Bridge SHALL cause the TypeScript compilation to fail with a type error that identifies the mismatched name or field.
6. IF the Rust_Core command set changes in count, command-name, payload shape, or return shape, THEN THE Bridge SHALL be updated to match the Rust_Core before the frontend is considered consistent with the Boundary, WHERE consistency is defined as the frontend TypeScript compilation completing with zero type errors against the updated Bridge.
7. WHERE the Bridge and the Rust_Core command set disagree in count, command-name, payload shape, or return shape, THE Bridge SHALL be treated as inconsistent with the Boundary until the disagreement is resolved.

### Requirement 2: Type parity with the Rust core

**User Story:** As a frontend developer, I want every bridge type to mirror its Rust counterpart field-for-field, so that payloads and returns deserialize correctly across the boundary.

#### Acceptance Criteria

1. THE Bridge SHALL define exactly one TypeScript type for each boundary type: `Module`, `Quiz`, `Question`, `CheckResult`, `ScoreResult`, `Answer`, `DraftModule`, `DraftQuestion`, `SealedAnswer`, `GenerationRequest`, `Scaffold`, `ScaffoldChoice`, and `AppError`.
2. THE Bridge SHALL name every field of the IPC-only payload types (`CheckResult`, `ScoreResult`, `Answer`, `SealedAnswer`, `GenerationRequest`, `Scaffold`, `ScaffoldChoice`, and `AppError`) in camelCase, matching the Rust serde camelCase rename.
3. THE Bridge SHALL define `Module`, `Quiz`, and `Question` using the on-disk module JSON field names from spec 00 verbatim (snake_case where the file uses it, including `schema_version`, `grade_level`, `hash_algo`, and `answer_hash`), and SHALL NOT rename those fields to camelCase.
4. THE Bridge SHALL define `CheckResult` with exactly the fields `questionId` (string), `correct` (boolean), and `points` (non-negative integer).
5. THE Bridge SHALL define `ScoreResult` with exactly the fields `correctCount` (non-negative integer), `totalCount` (non-negative integer), `pointsEarned` (non-negative integer), `pointsPossible` (non-negative integer), and `perQuestion`, WHERE `perQuestion` is an array of `CheckResult`.
6. THE Bridge SHALL define `Answer` with exactly the fields `questionId` (string) and `rawAnswer` (string).
7. THE Bridge SHALL define `SealedAnswer` with exactly the fields `salt` (string) and `answerHash` (string).
8. THE Bridge SHALL define `GenerationRequest` with a required `topic` field (string) and optional `subject` (string), `gradeLevel` (string), `sourceText` (string), and `numQuestions` (non-negative integer) fields.
9. THE Bridge SHALL define `Module`, `Quiz`, and `Question` to mirror the module JSON file described in spec 00 field-for-field, including every field named in the spec 00 field-rules table and no additional fields.
10. THE Bridge SHALL define `DraftModule` and `DraftQuestion` to carry a Plaintext_Answer only as seal input, and SHALL NOT define any Plaintext_Answer field on `Module`, `Quiz`, or `Question`.
11. WHEN a boundary payload or return value produced by the Rust_Core for any boundary type is deserialized into its TypeScript type, THE Bridge SHALL deserialize it with no missing or unmapped fields.
12. IF a `GenerationRequest` is constructed without a non-empty `topic` value, THEN THE Bridge SHALL reject it before dispatch and SHALL return an error indicating the required `topic` field is missing, leaving the request unsent.

### Requirement 3: Boundary secrecy

**User Story:** As a security-conscious maintainer, I want the frontend to never obtain a plaintext answer or hash preimage, so that correctness can only ever come from the compiled core and the "tamper-resistant" claim holds.

#### Acceptance Criteria

1. THE Bridge SHALL define the return type of `check_answer` and `score_submission` to contain only verdict fields (correctness, `correctCount`, `totalCount`) and points fields (`pointsEarned`, `pointsPossible`, per-question points), and SHALL exclude any Plaintext_Answer field and any Hash_Preimage field from those return types.
2. WHEN the frontend determines whether a student answer is correct, THE Bridge SHALL supply that result only as the return value of a `check_answer` or `score_submission` invocation.
3. THE Bridge SHALL expose no command, field, or value through which the frontend could compute answer correctness locally without invoking `check_answer` or `score_submission`.
4. WHEN a `Module` is loaded, THE Bridge SHALL carry each `salt` and `answer_hash` field to the frontend as opaque data that the frontend neither renders to the user nor uses to derive answer correctness.
5. WHERE the Teacher_Path supplies a Plaintext_Answer to `seal_module`, `seal_answer`, `generate_module`, or `generate_from_scaffold`, THE Bridge SHALL pass that Plaintext_Answer only as an input argument into the Boundary and SHALL hold no reference to that Plaintext_Answer in frontend memory or persisted state after the Command invocation resolves.
6. THE Bridge SHALL exclude every Plaintext_Answer and every Hash_Preimage from all logs, telemetry events, and persisted frontend state.
7. WHERE a question is `multiple_choice` or `true_false`, THE Bridge SHALL permit the option text to be displayed as answer choices and SHALL NOT return, through any Command result or exposed value, which option text is the correct answer.

### Requirement 4: Typed error surfacing

**User Story:** As a frontend developer, I want every backend error delivered as a typed, renderable shape, so that failures become inline alerts rather than panics or silent wrong scores.

#### Acceptance Criteria

1. THE Bridge SHALL define `AppError` as a tagged discriminated union serialized as a `{ kind, message }` object, covering exactly the variants whose `kind` values are `moduleNotFound`, `parseError`, `unknownQuestionKind`, `missingField`, `questionNotFound`, `validationError`, and `generationError`.
2. THE Bridge SHALL type every `AppError` value as carrying a string `message` field alongside its `kind` field.
3. WHEN a Command returns an error, THE Bridge SHALL deliver that error to the caller as a typed `AppError` value whose `kind` is one of the seven enumerated values.
4. IF a Command rejects, THEN THE Bridge SHALL surface the typed `AppError` to the frontend as a renderable value.
5. IF a Command rejects, THEN THE Bridge SHALL NOT present a scoring result for that failed call.
6. THE Bridge SHALL distinguish a Command error outcome from a successful result at the type level.

### Requirement 5: Offline-first student path and guaranteed-usable generation

**User Story:** As a student using the app with the radio off, I want the entire scoring path to work offline, so that load, answer, and score always function without a network.

#### Acceptance Criteria

1. THE Bridge SHALL classify `load_module`, `check_answer`, `score_submission`, and `normalize_answer` as Student_Path Commands.
2. WHEN the frontend invokes a Student_Path Command, THE Bridge SHALL make no network call.
3. THE Bridge SHALL classify `generate_module` and `generate_from_scaffold` as the only online Commands.
4. WHEN the frontend invokes `generate_module` or `generate_from_scaffold`, THE Bridge SHALL resolve to a usable contract-valid `Module` via the Guaranteed_Fallback on any live-generation failure.
5. THE Bridge SHALL define the success return type of `generate_module` and `generate_from_scaffold` as a `Module`, reflecting that these Commands do not surface a generation failure to the frontend when the Guaranteed_Fallback applies.

### Requirement 6: Explicit student vs teacher command map

**User Story:** As a developer wiring the frontend, I want the contract to state explicitly which commands are offline student-path and which are online teacher-side, so that no student screen accidentally depends on a teacher or online command.

#### Acceptance Criteria

1. THE Bridge SHALL document each Command as either Student_Path or Teacher_Path.
2. THE Bridge SHALL document each Command as offline or online.
3. THE Bridge SHALL classify `seal_module`, `seal_answer`, `generate_module`, `list_scaffolds`, and `generate_from_scaffold` as Teacher_Path Commands.
4. THE Bridge SHALL classify `seal_module`, `seal_answer`, and `list_scaffolds` as local Commands that make no network call.
5. THE command map SHALL be delivered as a documented artifact accompanying the Bridge.

### Requirement 7: Contract expressed for a React/Next.js consumer (Mutation A)

**User Story:** As a frontend developer on the real codebase, I want the boundary contract expressed for a React/Next.js consumer, so that the typed bridge is usable from the actual Next.js app rather than the vanilla stack spec 02 described.

#### Acceptance Criteria

1. THE Bridge SHALL be expressed as a typed `invoke` wrapper consumable from React client components in the Next_Frontend.
2. THE Bridge SHALL be authored in TypeScript targeting the Next_Frontend toolchain (Next.js 16, React 19, Tailwind 4, TypeScript) located in `Syndes/frontend/`.
3. THE Bridge SHALL record that the actual frontend is a Next.js and React application, which deviates from spec 02's stated "vanilla HTML/CSS/JS, no React" UI lane.
4. WHERE the Bridge invokes Tauri IPC from the Next_Frontend, THE Bridge SHALL confine `invoke` usage to client-side execution contexts.

### Requirement 8: Reconcile the Tauri build configuration with the Next.js frontend (Mutation B)

**User Story:** As a developer running the integrated app, I want the Tauri build configuration reconciled with the real Next.js frontend, so that the Tauri shell loads the actual UI instead of the stale Vite scaffold target.

#### Acceptance Criteria

1. THE Tauri_Build_Config SHALL point `build.devUrl` at the development URL served by the Next_Frontend's dev server.
2. THE Tauri_Build_Config SHALL point `build.frontendDist` at the Next_Frontend's production build output directory.
3. THE requirements SHALL record that the Tauri_Build_Config currently points `build.devUrl` at `http://localhost:1420` and `build.frontendDist` at `../dist`, which are Vite scaffold defaults inconsistent with the Next_Frontend.
4. THE Tauri_Build_Config SHALL point `build.beforeDevCommand` and `build.beforeBuildCommand` at commands that run the Next_Frontend's dev and build steps.
5. WHEN the integrated Tauri app is launched in development, THE Tauri_Build_Config SHALL cause the Tauri shell to load the Next_Frontend UI rather than the Vite default target.
