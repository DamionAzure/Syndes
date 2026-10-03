# Coding standards

These standards apply to Syndes application code, tests, configuration, and technical documentation. They adapt the transferable rules from [`noelorph/diy-souvenir-spot-photobooth`](https://github.com/noelorph/diy-souvenir-spot-photobooth/blob/main/CODING_STANDARDS.md) and its `docs/standards/` directory to this project. Photobooth hardware, printer, and Supabase-specific rules are outside this project's current scope.

**Must** means required. **Should** is the normal choice; explain a deviation. **May** means optional.

An explicit maintainer request or approved issue defines the work to deliver. `GLOSSARY.md`, when present, defines domain terms; accepted `docs/adr/` records define durable architectural decisions. `AGENTS.md` and `docs/agents/` define agent workflow. Read the installed Next.js documentation for version-specific framework behavior. Surface conflicts between these sources rather than silently choosing one.

## Engineering principles

- Use names that express intent and domain meaning. Keep modules and functions focused; make control flow readable. Comments explain constraints and tradeoffs, not obvious code.
- Implement the smallest complete behavior in scope. Avoid speculative abstractions, dependencies, configuration, and empty architecture folders. Remove dead code.
- Deduplicate shared knowledge and rules when they truly change together; a little clear duplication is preferable to an unstable abstraction.
- Keep domain logic independent of React, Next.js request objects, storage, and external services. UI owns rendering and interactions; external systems sit behind narrow boundaries.
- Follow the repository's lint and typecheck output. Keep unrelated style cleanup out of behavioral changes.

## Detailed standards

- [Project organization](docs/standards/project-organization.md)
- [Next.js and React](docs/standards/next-and-react-standards.md)
- [TypeScript](docs/standards/typescript-standards.md)
- [Testing](docs/standards/testing-standards.md)
- [Accessibility and UX](docs/standards/accessibility-and-ux.md)
- [Security and privacy](docs/standards/security-and-privacy-standards.md)

## Definition of done

For application and configuration changes, run `npm run lint`, `npm run typecheck`, and `npm run build`. Run focused automated tests when they exist and are relevant. Review security, privacy, accessibility, and failure states in proportion to the change. Update setup and architecture documentation when behavior or project structure changes. Documentation-only edits need proportionate checks, not an unrelated build.

Record a narrow exception and its reason in the relevant issue or ADR. Security, privacy, and data-integrity exceptions require explicit maintainer approval.
