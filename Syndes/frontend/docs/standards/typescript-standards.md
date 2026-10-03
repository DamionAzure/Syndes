# TypeScript standards

- Write new application code in TypeScript. Keep `strict`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`, and `verbatimModuleSyntax` enabled.
- Treat browser, HTTP, storage, environment, file, and parsed JSON values as untrusted until narrowed or validated at their boundary.
- Avoid `any`, double assertions, `@ts-ignore`, broad lint suppressions, and unchecked non-null assertions. A narrow assertion needs an evident runtime invariant beside it.
- Model finite workflows with discriminated unions and exhaustively handle closed unions with `never` when useful. Prefer literal unions, `as const`, and `satisfies` over runtime enums unless the enum object is needed.
- Let TypeScript infer obvious local types. Type public contracts and complex return boundaries explicitly. Use `readonly` for non-mutating inputs and `import type` or `export type` for type-only dependencies.
- Generate types from an external schema when applicable; do not hand-maintain duplicate versions of an external contract.
