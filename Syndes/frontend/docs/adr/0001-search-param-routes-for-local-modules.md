# Search-param routes for locally opened modules

Status: proposed

Syndes runs as a desktop app that is expected to ship the frontend as a Next.js static export. Static export does not support dynamic route segments unless every value is listed at build time with `generateStaticParams()`. Modules arrive at runtime from local files, so their IDs are unknown at build time.

We identify the module and position with search params on fixed routes, for example `/lesson?module=<id>&lesson=2`, instead of segments such as `/modules/[moduleId]/lessons/[n]`. This keeps every route exportable and links still work.

## Consequences

- Each route that reads `useSearchParams()` needs a `<Suspense>` boundary so the static shell can prerender.
- An unknown or missing `module` param is a normal state: the route shows a "Module not found on this device" message and a link back to the Library.
- If the app later moves to a server runtime, the routes can move to dynamic segments. Links are built through one route helper so that change stays in one place.
