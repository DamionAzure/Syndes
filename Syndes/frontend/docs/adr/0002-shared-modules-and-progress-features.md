# Modules and Progress are shared features of the learner experience

Status: proposed

Every learner screen needs the same two things: the Module being studied and the Learner's saved Progress in it. The project organization standard asks for an ADR before any feature-to-feature dependency, so these edges are recorded here.

## Decision

`features/modules` and `features/progress` are the shared contract of the learner experience. Other learner features (`home`, `lessons`, `quiz`, `flashcards`, `settings`) may import from them; they may not import from each other.

Allowed imports from `features/modules`:
- `module-types`, `module-source`, `routes`, `use-module-param`
- shared presentational components: `module-row`, `availability`, `empty-library`, `open-module-file`, `module-breadcrumb`, `module-not-found`, `version-reset-notice`

Allowed imports from `features/progress`:
- `progress-types`, `progress-store` (pure functions only), `use-progress`, `place-label`

The two shared features also depend on each other, in narrow ways:
- `modules → progress`: `routes.ts` uses the `Step` type to build Continue links, and the Module overview reads Progress to offer **Continue module** (spec R4.2).
- `progress → modules`: the Progress page lists Modules from the source and links to them with `routes`.

## Consequences

- No new edge between other features without updating this ADR.
- When the lint boundary rules are introduced, they enforce exactly this list.
- If the mutual edge starts to grow, extract the Step-to-route mapping into a small `features/learner-path` module rather than adding more cross-imports.
