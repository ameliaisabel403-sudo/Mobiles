import { getSupabase, appConfig } from "./config.js";

let currentUser = null;

export async function initAuth(onAuthStateChange) {
  if (appConfig.isConfigured) {
    const supabase = getSupabase();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user || null;
      supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        onAuthStateChange?.(currentUser);
      });
    } catch (err) {
      console.error("Error fetching auth session:", err);
      currentUser = null;
    }
  } else {
    currentUser = { email: "Nehan", id: "nehan-staff-01" };
    localStorage.setItem("demo_auth_user", JSON.stringify(currentUser));
  }

  onAuthStateChange?.(currentUser);
  return currentUser;
}

export async function loginStaff(email, password) {
  if (appConfig.isConfigured) {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: String(email || "").trim(),
      password: password || ""
    });
    if (error) throw new Error(error.message);
    currentUser = data.user;
    return currentUser;
  }

  if (!email || !password) throw new Error("Please enter staff email and password.");
  currentUser = { email: String(email).trim(), id: `demo-staff-${Date.now()}` };
  localStorage.setItem("demo_auth_user", JSON.stringify(currentUser));
  return currentUser;
}

export async function logoutStaff() {
  if (appConfig.isConfigured) await getSupabase().auth.signOut();
  else localStorage.removeItem("demo_auth_user");
  currentUser = null;
}

export function getCurrentStaff() { return currentUser; }
export function isAuthenticated() { return currentUser !== null; }
