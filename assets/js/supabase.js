import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";

const SUPABASE_URL = "https://ncxexmekzlrliicaqfcl.supabase.co";
const SUPABASE_KEY = "sb_publishable_mayjwNbdFk6xltqcgbfLqA_dbTjSd7q";

async function resilientFetch(input, init = {}) {
  const url = typeof input === "string" ? input : (input?.url || "");
  const method = String(init?.method || input?.method || "GET").toUpperCase();
  const isPasswordLogin = method === "POST" && url.includes("/auth/v1/token") && url.includes("grant_type=password");
  if (!isPasswordLogin) return fetch(input, init);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (error?.name !== "AbortError" || attempt === 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError || new Error("Login network request failed.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: resilientFetch }
});
