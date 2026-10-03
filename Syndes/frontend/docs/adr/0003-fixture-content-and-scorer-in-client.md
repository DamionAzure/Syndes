# Fixture content and scorer ship in the client until the bridge lands

Status: proposed (security exception; needs maintainer approval)

The security standard says to keep answer keys out of client bundles. Until the Tauri bridge and the real importer exist, the learner screens run on made-up demo content: `fixture-modules.ts` behind `ModuleSource`, and `fixture-quiz-scorer.ts` behind `QuizScorer`. The fixture scorer has to know the demo answers, so they reach the browser bundle.

## Decision

Accept this as a narrow, temporary exception:
- It covers only the invented demo Modules in `fixture-modules.ts`. No teacher-authored or real Module may be added to the fixtures.
- Components never read correctness; they call `QuizScorer.score` only.
- The active source and scorer are each chosen in one place (`module-source.ts`, `quiz-scorer.ts`). Replacing both with the bridge removes the fixtures from the bundle.

## Consequences

- The exception ends when the bridge is wired in. Delete both fixture files then.
- Saved Learner answers stay in `localStorage` on the device until the Learner resets them on the Progress page. Nothing is sent anywhere. A retention rule beyond "until reset" is open for the persistence spec.
