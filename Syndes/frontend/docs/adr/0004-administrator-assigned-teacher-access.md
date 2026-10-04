# Administrator-assigned Teacher access with online checks

Status: accepted

Syndes uses Supabase Auth for sign-in, while an Administrator approves access and assigns Teacher permissions through a controlled manual process in Supabase for the MVP. Signing in never grants access to published Modules or Teacher actions by itself. Teacher and Administrator actions require a fresh online check of current authorization; Learners may continue studying offline after sign-in. This choice favors prompt enforcement of privileged access changes while preserving offline study. The identity provider is the school's existing provider when one is available, or Google otherwise. Teachers and Administrators can use the learning flow through the same Account.

A new Account may sign in while approval is pending, but cannot browse or open published Modules until approved. Every approved Learner may browse all published Modules; Class assignment does not restrict the MVP Library.

Pending Accounts cannot study local Modules either. A project operator seeds the first Administrator manually through privileged Supabase access; there is no self-promotion path. If a Teacher loses connectivity while editing an already-open Draft, Syndes preserves local edits, but entering Teacher pages and starting new Teacher operations wait for a fresh online authorization check.

Removing Teacher permission leaves the Account approved for learning. An Administrator may separately revoke Account approval. Administrators may use Teacher screens and commands, subject to the same online check.
