import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://atwoqvfpufckhebwbhhg.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0d29xdmZwdWZja2hlYndiaGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTg2NzAsImV4cCI6MjA2OTQzNDY3MH0.m4mENt9HUpweLzweY7Kto2im5RTKkiDaE6mjzbppInI";

export const supabase = createClient(supabaseUrl, supabaseKey);
