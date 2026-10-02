let client = null;
export const appConfig = {supabaseUrl: localStorage.getItem("supabase_url")||"", supabaseKey: localStorage.getItem("supabase_key")||"", isConfigured:false};
export function initSupabaseClient(){
  appConfig.isConfigured=!!(appConfig.supabaseUrl && appConfig.supabaseKey);
  if(appConfig.isConfigured && window.supabase) client=window.supabase.createClient(appConfig.supabaseUrl,appConfig.supabaseKey);
  return client;
}
export function getSupabase(){return client || initSupabaseClient()}
export function saveSupabaseConfig(url,key){
  appConfig.supabaseUrl=url.trim(); appConfig.supabaseKey=key.trim();
  localStorage.setItem("supabase_url",appConfig.supabaseUrl); localStorage.setItem("supabase_key",appConfig.supabaseKey);
  appConfig.isConfigured=!!(appConfig.supabaseUrl&&appConfig.supabaseKey); client=null; initSupabaseClient();
}
