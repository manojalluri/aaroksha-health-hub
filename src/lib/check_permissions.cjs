
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
    // If RPC doesn't exist, try a raw query via a temporary function or just try to update and see the error
    console.log('RPC failed, trying to update a dummy field to check permissions...');
    const { error: updateError } = await supabase.from('platform_settings').update({ platform_name: 'AAROKSHA' }).eq('id', 'global');
    if (updateError) {
      console.error('Update failed:', updateError.message, updateError.code);
    } else {
      console.log('Update succeeded! Permissions are likely fine.');
    }
    return;
  }
  console.log('Policies:', data);
}

checkPolicies();
