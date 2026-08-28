import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";

const SUPABASE_URL = "https://ncxexmekzlrliicaqfcl.supabase.co";
const SUPABASE_KEY = "sb_publishable_mayjwNbdFk6xltqcgbfLqA_dbTjSd7q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
