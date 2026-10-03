// Supabase browser client — ANON KEY ONLY (spec: supabase-database, Req 10.1-10.4).
//
// What the anon key can do is defined entirely by Row-Level Security (migration
// 0003), so shipping it in the client is safe. The SERVICE ROLE key and the
// GROQ_API_KEY are server-side secrets and MUST NEVER be referenced here or
// bundled into the client — only NEXT_PUBLIC_* values are exposed to the browser.

import { createClient } from "@supabase/supabase-js";

// Bracket access: tsconfig has noPropertyAccessFromIndexSignature, and env vars
// come from an index signature.
const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

if (!url || !anonKey) {
  // Fail loud at startup rather than making half-configured calls that error
  // obscurely later. The teacher-side online lane needs both to function.
  throw new Error(
    "Supabase client not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env",
  );
}

export const supabase = createClient(url, anonKey);
