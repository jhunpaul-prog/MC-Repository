import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://atwoqvfpufckhebwbhhg.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0d29xdmZwdWZja2hlYndiaGhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzg1ODY3MCwiZXhwIjoyMDY5NDM0NjcwfQ.Pb4hw5isKhrMdag6WF8Affs7eVpRQBVA-SBtsG05nXo';

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
