
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkType() {
  const { data, error } = await supabase.from('platform_settings').select('id').limit(1).maybeSingle();
  if (data) {
    console.log('ID value:', data.id);
    console.log('ID type:', typeof data.id);
  } else {
    console.log('No data found');
  }
}

checkType();
