import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/+esm";

export const supabase = createClient(
  "https://ncxexmekzlrliicaqfcl.supabase.co",
  "sb_publishable_mayjwNbdFk6xltqcgbfLqA_dbTjSd7q",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
