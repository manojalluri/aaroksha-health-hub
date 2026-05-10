
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('--- Inspecting Partners Table ---');
  const { data: partnerData, error: partnerError } = await supabase.from('partners').select('*').limit(1);
  if (partnerError) console.error('Partners Error:', partnerError);
  else console.log('Partner Columns:', Object.keys(partnerData[0] || {}));

  console.log('\n--- Inspecting Doctors Table ---');
  const { data: doctorData, error: doctorError } = await supabase.from('doctors').select('*').limit(1);
  if (doctorError) console.error('Doctors Error:', doctorError);
  else console.log('Doctor Columns:', Object.keys(doctorData[0] || {}));

  console.log('\n--- Inspecting Lab Bookings Table ---');
  const { data: labData, error: labError } = await supabase.from('lab_bookings').select('*').limit(1);
  if (labError) console.error('Lab Error:', labError);
  else console.log('Lab Columns:', Object.keys(labData[0] || {}));

  console.log('\n--- Inspecting Prescriptions Table ---');
  const { data: pharmData, error: pharmError } = await supabase.from('prescriptions').select('*').limit(1);
  if (pharmError) console.error('Prescriptions Error:', pharmError);
  else console.log('Prescription Columns:', Object.keys(pharmData[0] || {}));
}

inspectSchema();
