import { createClient } from '@supabase/supabase-js';

// ── Read from environment variables (set in .env — never hardcode here) ────────
const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ── Startup validation — fail fast with a clear error ─────────────────────────
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Aaroksha] Missing Supabase environment variables.\n' +
    'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'See .env.example for the required format.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Store auth tokens in localStorage (standard for web apps)
    // Sessions are further scoped by RLS on the server side
    persistSession: true,
    autoRefreshToken: true,
  },
});
