
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPK() {
  const { data, error } = await supabase.rpc('get_pk_for_table', { table_name_input: 'platform_settings' });
  if (error) {
    console.log('RPC failed, trying to insert a duplicate and see the error...');
    const { error: insertError } = await supabase.from('platform_settings').insert({ id: 'global', platform_name: 'AAROKSHA' });
    if (insertError) {
      console.log('Insert failed (expected if PK):', insertError.message, insertError.code);
    } else {
      console.log('Insert succeeded! id is NOT a unique PK or row was missing.');
    }
  } else {
    console.log('PK:', data);
  }
}

checkPK();
