import { supabase } from "./supabase";

/**
 * Initializes an automatic keep-alive system for Supabase.
 * 
 * WHY THIS IS NEEDED:
 * Supabase free tier projects are automatically paused after a period of inactivity
 * (typically 1 week of no API calls or dashboard logins). By pinging the database 
 * periodically, we ensure it registers activity and prevents a "cold start" or 
 * project pause, keeping the app instantly responsive for actual users.
 */
export const initSupabaseKeepAlive = () => {
  // 6 hours in milliseconds
  const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;

  const pingSupabase = async () => {
    try {
      // Perform a lightweight query: fetch 1 row from a small, core table
      await supabase
        .from("platform_settings")
        .select("id")
        .limit(1);
        
      // Handled silently to avoid cluttering the production console
    } catch (error) {
      // Fail silently without breaking the app
    }
  };

  // Run the initial ping when the app loads
  pingSupabase();

  // Schedule the recurring background ping every 6 hours
  setInterval(pingSupabase, SIX_HOURS_IN_MS);
};
