import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://atwoqvfpufckhebwbhhg.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZWV2d2J6Y29rdW5sd3Rjemt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzY1NTEsImV4cCI6MjA3MTg1MjU1MX0.UQtE_sYQNEjH-TMWjxT0X6_y7BelpdEuXuo8ljBd_9U";

export const supabase = createClient(supabaseUrl, supabaseKey);
