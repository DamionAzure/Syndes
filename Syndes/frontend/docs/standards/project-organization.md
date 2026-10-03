# Project organization

Use domain-first feature modules and keep App Router entries focused on routing and composition. This is an ownership guide, not a request to create empty folders.

```text
src/
├── app/                    # Routes, layouts, route handlers, loading/error UI
│   └── <route>/
│       ├── page.tsx        # Thin route entry
│       └── _components/    # Private route composition, when needed
├── components/
│   ├── layout/             # Shared navigation and application shells
│   └── ui/                 # Domain-neutral visual primitives
├── features/
│   └── <domain>/           # One actual product capability per module
├── lib/                    # Cross-feature infrastructure and utilities
└── styles/                 # Global styles
```

- Create each optional directory only when it has content. The current small home route can remain self-contained. A substantive route should delegate its rendering and orchestration to a private `_components/` directory or a feature module.
- `src/app/` owns route wiring and access policy. Nothing outside `src/app/` imports route-private modules. Use route groups such as `(teacher)` only when routes share a real layout or policy.
- `src/features/<domain>/` owns domain behavior, UI, contracts, and data operations. Name features for product capabilities such as modules or quizzes, not route compositions such as a dashboard. Add `components/`, `actions/`, `queries/`, `server/`, or `lib/` inside a feature only when needed.
- A feature exposes a small intentional interface. Keep browser-safe exports separate from server-only entry points; avoid broad barrel exports and direct imports into another feature's private files.
- `src/components/ui/` holds reusable, domain-neutral controls; `src/components/layout/` holds shared shells and navigation. Neither owns business rules or data access.
- `src/lib/` holds only cross-feature infrastructure. Code that becomes meaningless without one feature belongs in that feature.
- Dependencies flow from `app` to `features`, `components`, and `lib`; from `features` to `components` and `lib`; and from `components` to `lib`. Document an actual feature-to-feature dependency in an ADR before introducing one. Enforce relevant boundaries in lint as those modules are introduced.
- Use Next.js reserved filenames exactly. Use descriptive kebab-case for other module filenames, PascalCase for exported React components, and `*.test.ts` or `*.test.tsx` for colocated tests. Prefer direct imports within a module.

Keep durable requirements, research, standards, and architecture decisions under `docs/`. Do not place student records, uploaded module content, secrets, or raw captures there.

Keep application images served to users in `public/`, grouped by purpose when useful. Reference them in app code from the site root. Keep documentation images beside the documents they illustrate under `docs/`, along with their licenses and written design guidance.
