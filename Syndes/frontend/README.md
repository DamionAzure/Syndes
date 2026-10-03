# Syndes frontend

Next.js App Router frontend for Syndes, a study experience for local learning modules and quizzes. The current app is a minimal starting point; the [design system](docs/design/design-system.md) describes the proposed learner and teacher experience.

## Local development

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Project layout

`src/app/` contains routes and layouts. `src/styles/` contains global styles. Application images and the favicon live in `public/`; documentation images stay with their documents under `docs/`. Add domain modules under `src/features/`, shared presentation under `src/components/`, and cross-feature infrastructure under `src/lib/` when actual code needs those folders. See [coding standards](CODING_STANDARDS.md) and [project organization](docs/standards/project-organization.md) for ownership and dependency rules.

Agent and issue workflow is in [AGENTS.md](AGENTS.md). Project language belongs in `GLOSSARY.md` when established, and durable decisions in `docs/adr/`.
