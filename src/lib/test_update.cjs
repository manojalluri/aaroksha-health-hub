
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  const newName = 'AAROKSHA TEST ' + Date.now();
  console.log('Attempting to update platform_name to:', newName);
  
  const { data, error, status, statusText } = await supabase
    .from('platform_settings')
    .update({ platform_name: newName })
    .eq('id', 'global')
    .select();
    
  if (error) {
    console.error('Update failed:', error.message, error.code);
  } else {
    console.log('Update Status:', status, statusText);
    console.log('Returned Data:', JSON.stringify(data, null, 2));
    if (!data || data.length === 0) {
      console.error('CRITICAL: No rows were updated! Is id "global" correct?');
    }
  }
}

testUpdate();
