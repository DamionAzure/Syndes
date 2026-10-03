# Next.js and React standards

- Before changing framework behavior, consult the relevant documentation in the installed `node_modules/next/dist/docs/` tree. The installed Next.js version is authoritative.
- Use Server Components by default. Add `"use client"` only for browser APIs, event handlers, lifecycle behavior, or interactive local state. Keep the client import graph small.
- Treat Client Components as browser code even when prerendered. Never import secrets or privileged modules into them. Mark privileged data-access modules with `server-only` when introduced, and pass only minimal serializable data to clients.
- Treat Server Actions and Route Handlers as public server boundaries. Each must authenticate, authorize, and validate untrusted input independently. Recheck ownership immediately before protected operations.
- Keep persistent business state at its authoritative storage boundary. Use React state for transient interaction and URL state for linkable navigation. For offline work, define the local persistence contract explicitly before relying on it.
- Derive values during render rather than syncing derived state in effects. Put interaction logic in event handlers when possible.
- Start independent I/O together. Add loading, error, and Suspense boundaries where they improve feedback or recovery.
- Add memoization, caching, and dynamic imports only when identity, computation cost, bundle size, or observed behavior justifies them. Prefer direct imports to broad barrels.
- Give each route a descriptive title and clear heading. Follow the [accessibility standard](accessibility-and-ux.md).
- Apply the installed `vercel-react-best-practices` skill when writing or reviewing React or Next.js code.

Relevant local references include `01-app/01-getting-started/02-project-structure.md`, `05-server-and-client-components.md`, and `03-architecture/accessibility.md` under `node_modules/next/dist/docs/`.
