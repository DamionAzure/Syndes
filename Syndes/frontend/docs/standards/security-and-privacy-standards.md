# Security and privacy standards

- Treat browser, network, file, storage, and environment inputs as untrusted. Validate at the boundary that uses them.
- Read secrets only in server-only modules. Values prefixed with `NEXT_PUBLIC_` are public and must contain no secrets.
- Enforce authentication, authorization, ownership, and applicable rate limits at trusted server boundaries. Client checks only improve usability.
- Use least privilege for service credentials, storage policies, and deployment access. Do not reveal protected resource existence to unauthorized callers.
- Minimize student data collection and retention. Define purpose, access, retention, deletion, and sync behavior before persisting new personal data or module responses.
- Keep teacher-only answers and privileged content out of student-facing exports and client bundles. Do not assume hashes of low-entropy answers protect an answer key.
- Do not commit `.env` files, credentials, real student data, uploaded private material, or raw diagnostic captures. Do not log secrets, tokens, student responses, or full request bodies.
- Review dependencies for necessity and provenance; commit `package-lock.json` with dependency changes.
