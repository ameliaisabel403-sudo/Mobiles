/* ==========================================================================
   COMPANY PHONE TRACKER - AUTHENTICATION MODULE
   ========================================================================== */

import { supabaseClient, appConfig } from './config.js';

let currentUser = null;

// Initialize Auth State & Listeners
export async function initAuth(onAuthStateChange) {
  if (appConfig.isConfigured && supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        currentUser = session.user;
      } else {
        currentUser = null;
      }

      // Listen to Auth Changes
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session ? session.user : null;
        if (onAuthStateChange) onAuthStateChange(currentUser);
      });
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  } else {
    // In Demo Mode, check local storage session or default to logged in staff Nehan
    const demoUser = localStorage.getItem('demo_auth_user');
    if (demoUser) {
      currentUser = JSON.parse(demoUser);
    } else {
      currentUser = { email: 'Nehan', id: 'nehan-staff-01' };
      localStorage.setItem('demo_auth_user', JSON.stringify(currentUser));
    }
  }

  if (onAuthStateChange) onAuthStateChange(currentUser);
  return currentUser;
}

// Staff Login Action
export async function loginStaff(email, password) {
  if (appConfig.isConfigured && supabaseClient) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      throw new Error(error.message);
    }
    currentUser = data.user;
    return currentUser;
  } else {
    // Demo Mode Authentication
    if (!email || !password) {
      throw new Error('Please enter staff email and password.');
    }
    currentUser = { email: email.trim(), id: 'demo-staff-' + Date.now() };
    localStorage.setItem('demo_auth_user', JSON.stringify(currentUser));
    return currentUser;
  }
}

// Staff Logout Action
export async function logoutStaff() {
  if (appConfig.isConfigured && supabaseClient) {
    await supabaseClient.auth.signOut();
  } else {
    localStorage.removeItem('demo_auth_user');
  }
  currentUser = null;
}

// Get Current Logged-in Staff User
export function getCurrentStaff() {
  return currentUser;
}

export function isAuthenticated() {
  return currentUser !== null;
}
