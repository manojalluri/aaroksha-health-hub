
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
  const { data, error } = await supabase.from('platform_settings').select('*').limit(1).maybeSingle();
  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }
  console.log('Current Settings in DB:', JSON.stringify(data, null, 2));
}

checkSettings();
