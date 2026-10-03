let client = null;

// For a static Vercel site, browser-safe Supabase credentials can be stored
// here OR entered once through Settings. Never put a Supabase service_role key here.
const DEPLOY_SUPABASE_URL = "https://twhbircmblqiqkfjyegs.supabase.co";
const DEPLOY_SUPABASE_ANON_KEY = "sb_publishable_jvV4AD9LXR3B10LIBOe9sw_P1aDMFAq";

const storedUrl =
  localStorage.getItem("SUPABASE_URL") ||
  localStorage.getItem("supabase_url") ||
  DEPLOY_SUPABASE_URL;

const storedKey =
  localStorage.getItem("SUPABASE_ANON_KEY") ||
  localStorage.getItem("supabase_key") ||
  DEPLOY_SUPABASE_ANON_KEY;

export const appConfig = {
  supabaseUrl: storedUrl.trim(),
  supabaseKey: storedKey.trim(),
  isConfigured: false
};

export function initSupabaseClient() {
  appConfig.isConfigured = Boolean(appConfig.supabaseUrl && appConfig.supabaseKey);
  if (!appConfig.isConfigured) {
    client = null;
    return null;
  }
  if (!window.supabase?.createClient) {
    throw new Error("Supabase library did not load. Check your internet connection.");
  }
  // Always create a fresh client so new credentials take effect immediately.
  client = window.supabase.createClient(appConfig.supabaseUrl, appConfig.supabaseKey);
  return client;
}

export function getSupabase() {
  return client || initSupabaseClient();
}

export function saveSupabaseConfig(url, key) {
  const cleanUrl = String(url || "").trim();
  const cleanKey = String(key || "").trim();
  if (!cleanUrl || !cleanKey) throw new Error("Supabase URL and anon key are required.");

  appConfig.supabaseUrl = cleanUrl;
  appConfig.supabaseKey = cleanKey;
  appConfig.isConfigured = true;

  localStorage.setItem("SUPABASE_URL", cleanUrl);
  localStorage.setItem("SUPABASE_ANON_KEY", cleanKey);
  // Keep backward compatibility with older builds.
  localStorage.setItem("supabase_url", cleanUrl);
  localStorage.setItem("supabase_key", cleanKey);

  client = null;
  return initSupabaseClient();
}
