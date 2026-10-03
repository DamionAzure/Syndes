# Administrator-assigned Teacher access with online checks

Status: accepted

Syndes uses Supabase Auth for sign-in, while an Administrator assigns Teacher access. Signing in never grants Teacher access by itself. Teacher actions require an online check of current authorization; Learners may continue studying offline. This choice favors prompt enforcement of Teacher access changes while preserving offline study. The identity provider is the school's existing provider when one is available, or one selected OAuth provider for the MVP.
