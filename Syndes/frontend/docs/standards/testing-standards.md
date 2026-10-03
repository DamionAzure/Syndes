# Testing standards

Test observable behavior at the highest stable seam that still gives fast, deterministic feedback. The runner is Vitest with Testing Library in jsdom; run it once with `npm test`, and colocate tests as `*.test.ts` or `*.test.tsx`.

- Use unit or module-integration tests for pure domain logic, component tests for synchronous UI behavior, and browser tests for critical navigation, offline behavior, permissions, and framework integration when those flows exist.
- Name tests for behavior. Cover success, expected failure, authorization denial, boundary values, and important state transitions in proportion to the feature.
- Keep tests independent of execution order, network services, real student data, and wall-clock timing unless a test explicitly targets those boundaries.
- Mock external boundaries rather than the implementation under test. Assert visible output and state, not private function calls or brittle markup. Prefer role-, label-, and name-based UI queries.
- Reproduce a fixed defect with a regression test at the appropriate seam. Avoid large snapshots and coverage targets that hide intent.
- Route Handlers and Server Actions need boundary tests for validation and authorization when introduced. Validate offline persistence and version compatibility at their contract boundaries.
