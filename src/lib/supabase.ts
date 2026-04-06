import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

let supabaseInstance: any;

if (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseUrl !== 'your_supabase_url') {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize Supabase:', err);
  }
}

if (!supabaseInstance) {
  console.warn('Supabase is not properly configured. Missing or invalid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY run env vars.');
  // Create a minimal client with dummy values so the app won't crash on boot, but CRUD will fail with real network errors.
  supabaseInstance = createClient('https://xxx.supabase.co', 'dummy-key');
}

export const supabase = supabaseInstance;
