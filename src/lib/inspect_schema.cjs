
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching appointments:', error);
  } else {
    console.log('Appointments sample row:', data[0]);
  }

  const { data: cols, error: colError } = await supabase.rpc('exec_sql', {
    sql: "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('appointments', 'doctors') ORDER BY table_name, column_name;"
  });

  if (colError) {
    console.error('Error fetching column types:', colError);
    // Fallback: try to guess from a row if exec_sql fails
  } else {
    console.table(cols);
  }
}

checkSchema();
