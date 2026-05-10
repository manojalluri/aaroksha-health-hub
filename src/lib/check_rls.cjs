
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name_input: 'platform_settings' });
  if (error) {
    console.log('RPC failed, trying raw query via anon key (might fail if not permitted)...');
    const { data: policies, error: queryError } = await supabase.from('pg_policies').select('*').eq('tablename', 'platform_settings');
    if (queryError) {
      console.error('Query failed:', queryError.message);
      // Try to just list all policies via a different approach
      const { data: allPolicies, error: allErr } = await supabase.rpc('list_policies');
      if (allErr) console.error('All list failed too');
      else console.log('All Policies:', allPolicies);
    } else {
      console.log('Policies:', policies);
    }
  } else {
    console.log('Policies:', data);
  }
}

async function tryDirectQuery() {
    // If I have direct DB access via the CLI, I can just use that.
    // But since the CLI was failing to show output, I'll try to find another way.
    console.log('Trying to identify the problem by checking the current user metadata...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current User (if any):', user?.id, user?.email);
}

checkPolicies();
tryDirectQuery();
