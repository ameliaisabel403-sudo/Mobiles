/* ==========================================================================
   COMPANY PHONE TRACKER - CONFIG & SUPABASE CLIENT INITIALIZER
   ========================================================================== */

const CONFIG_STORAGE_KEY = 'company_phone_tracker_config_v1';
const DEMO_DB_STORAGE_KEY = 'company_phone_tracker_demo_db_v2';

export const DEPLOY_SUPABASE_URL = "https://twhbircmblqiqkfjyegs.supabase.co";
export const DEPLOY_SUPABASE_ANON_KEY = "sb_publishable_jvV4AD9LXR3B10LIBOe9sw_P1aDMFAq";

const storedUrl =
  localStorage.getItem("SUPABASE_URL") ||
  localStorage.getItem("supabase_url") ||
  DEPLOY_SUPABASE_URL;

const storedKey =
  localStorage.getItem("SUPABASE_ANON_KEY") ||
  localStorage.getItem("supabase_key") ||
  DEPLOY_SUPABASE_ANON_KEY;

// Default Supabase Config State
export let appConfig = {
  supabaseUrl: String(storedUrl || "").trim(),
  supabaseKey: String(storedKey || "").trim(),
  isConfigured: true,
  isDemoMode: false
};

export let supabaseClient = null;

// Initialize Supabase Client
export function initSupabaseClient() {
  const activeUrl = (localStorage.getItem("SUPABASE_URL") || localStorage.getItem("supabase_url") || DEPLOY_SUPABASE_URL).trim();
  const activeKey = (localStorage.getItem("SUPABASE_ANON_KEY") || localStorage.getItem("supabase_key") || DEPLOY_SUPABASE_ANON_KEY).trim();

  appConfig.supabaseUrl = activeUrl;
  appConfig.supabaseKey = activeKey;

  if (activeUrl && activeKey) {
    if (window.supabase?.createClient) {
      try {
        supabaseClient = window.supabase.createClient(
          activeUrl, 
          activeKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true
            }
          }
        );
        appConfig.isConfigured = true;
        appConfig.isDemoMode = false;
        console.log('✅ Supabase Client Initialized Successfully: 🟢 SUPABASE LIVE (https://twhbircmblqiqkfjyegs.supabase.co)');
        return supabaseClient;
      } catch (err) {
        console.warn('⚠️ Supabase createClient error:', err);
      }
    } else {
      console.warn('⚠️ window.supabase library not loaded yet.');
    }
  }

  // Fallback to local demo database mode if network completely fails
  appConfig.isConfigured = Boolean(activeUrl && activeKey);
  appConfig.isDemoMode = !appConfig.isConfigured;
  initDemoDatabase();
  return null;
}

export function getSupabase() {
  return supabaseClient || initSupabaseClient();
}

// Save Supabase Credentials
export function saveSupabaseConfig(url, key) {
  const cleanUrl = String(url || "").trim();
  const cleanKey = String(key || "").trim();
  if (!cleanUrl || !cleanKey) throw new Error("Supabase URL and anon key are required.");

  appConfig.supabaseUrl = cleanUrl;
  appConfig.supabaseKey = cleanKey;
  appConfig.isConfigured = true;
  appConfig.isDemoMode = false;

  localStorage.setItem("SUPABASE_URL", cleanUrl);
  localStorage.setItem("SUPABASE_ANON_KEY", cleanKey);
  localStorage.setItem("supabase_url", cleanUrl);
  localStorage.setItem("supabase_key", cleanKey);

  supabaseClient = null;
  return initSupabaseClient();
}

// Default Seed Data for Demo Mode (Local Storage Fallback)
function initDemoDatabase() {
  const existingDB = localStorage.getItem(DEMO_DB_STORAGE_KEY);
  if (!existingDB) {
    const defaultPhones = [];
    for (let i = 1; i <= 20; i++) {
      const numStr = String(i).padStart(3, '0');
      defaultPhones.push({
        id: `PHONE-${numStr}`,
        status: 'AVAILABLE',
        current_employee_id: null,
        current_employee_name: null,
        last_issue_time: null,
        last_return_time: null,
        condition: 'Good',
        updated_at: new Date().toISOString()
      });
    }

    const defaultEmployees = [
      { employee_number: 'EMP-1001', full_name: 'Alex Mercer', department: 'Logistics' },
      { employee_number: 'EMP-1002', full_name: 'Sarah Jenkins', department: 'Field Operations' },
      { employee_number: 'EMP-1003', full_name: 'Michael Chen', department: 'Warehouse' },
      { employee_number: 'EMP-1004', full_name: 'Emily Rodriguez', department: 'Quality Control' },
      { employee_number: 'EMP-1005', full_name: 'David Kim', department: 'Technical Support' },
      { employee_number: 'EMP-1006', full_name: 'Jessica Taylor', department: 'Fleet Management' },
      { employee_number: 'EMP-1007', full_name: 'James Wilson', department: 'Security' },
      { employee_number: 'EMP-1008', full_name: 'Amanda Martinez', department: 'Inventory' },
      { employee_number: 'EMP-1009', full_name: 'Robert Patel', department: 'Delivery Ops' },
      { employee_number: 'EMP-1010', full_name: 'Lisa Anderson', department: 'Site Inspection' }
    ];

    // Generate at least 3 days of transaction history
    const now = new Date();
    const day1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const day2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const day3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const initialTransactions = [
      // Day 3 ago
      {
        id: 'tx-hist-01',
        timestamp: new Date(day3.setHours(8, 15, 0, 0)).toISOString(),
        action: 'ISSUE',
        phone_id: 'PHONE-001',
        employee_number: 'EMP-1001',
        employee_name: 'Alex Mercer',
        condition: 'Good',
        notes: 'Morning shift start',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-02',
        timestamp: new Date(day3.setHours(17, 30, 0, 0)).toISOString(),
        action: 'RETURN',
        phone_id: 'PHONE-001',
        employee_number: 'EMP-1001',
        employee_name: 'Alex Mercer',
        condition: 'Good',
        notes: 'Returned end of shift',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-03',
        timestamp: new Date(day3.setHours(9, 0, 0, 0)).toISOString(),
        action: 'ISSUE',
        phone_id: 'PHONE-002',
        employee_number: 'EMP-1002',
        employee_name: 'Sarah Jenkins',
        condition: 'Good',
        notes: 'Housekeeping shift',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-04',
        timestamp: new Date(day3.setHours(18, 10, 0, 0)).toISOString(),
        action: 'RETURN',
        phone_id: 'PHONE-002',
        employee_number: 'EMP-1002',
        employee_name: 'Sarah Jenkins',
        condition: 'Good',
        notes: 'Completed in order',
        staff_email: 'Nehan'
      },
      // Day 2 ago
      {
        id: 'tx-hist-05',
        timestamp: new Date(day2.setHours(8, 30, 0, 0)).toISOString(),
        action: 'ISSUE',
        phone_id: 'PHONE-003',
        employee_number: 'EMP-1003',
        employee_name: 'Michael Chen',
        condition: 'Good',
        notes: 'Shift start',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-06',
        timestamp: new Date(day2.setHours(17, 45, 0, 0)).toISOString(),
        action: 'RETURN',
        phone_id: 'PHONE-003',
        employee_number: 'EMP-1003',
        employee_name: 'Michael Chen',
        condition: 'Good',
        notes: 'Clean condition',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-07',
        timestamp: new Date(day2.setHours(10, 0, 0, 0)).toISOString(),
        action: 'ISSUE',
        phone_id: 'PHONE-004',
        employee_number: 'EMP-1004',
        employee_name: 'Emily Rodriguez',
        condition: 'Good',
        notes: 'Floor inspection shift',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-08',
        timestamp: new Date(day2.setHours(19, 20, 0, 0)).toISOString(),
        action: 'RETURN',
        phone_id: 'PHONE-004',
        employee_number: 'EMP-1004',
        employee_name: 'Emily Rodriguez',
        condition: 'Good',
        notes: 'All items returned',
        staff_email: 'Nehan'
      },
      // Day 1 ago (Yesterday)
      {
        id: 'tx-hist-09',
        timestamp: new Date(day1.setHours(8, 0, 0, 0)).toISOString(),
        action: 'ISSUE',
        phone_id: 'PHONE-005',
        employee_number: 'EMP-1005',
        employee_name: 'David Kim',
        condition: 'Good',
        notes: 'Maintenance shift',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-10',
        timestamp: new Date(day1.setHours(17, 15, 0, 0)).toISOString(),
        action: 'RETURN',
        phone_id: 'PHONE-005',
        employee_number: 'EMP-1005',
        employee_name: 'David Kim',
        condition: 'Good',
        notes: 'Returned on time',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-11',
        timestamp: new Date(day1.setHours(9, 30, 0, 0)).toISOString(),
        action: 'ISSUE',
        phone_id: 'PHONE-006',
        employee_number: 'EMP-1006',
        employee_name: 'Jessica Taylor',
        condition: 'Good',
        notes: 'Guest room inspection',
        staff_email: 'Nehan'
      },
      {
        id: 'tx-hist-12',
        timestamp: new Date(day1.setHours(18, 0, 0, 0)).toISOString(),
        action: 'RETURN',
        phone_id: 'PHONE-006',
        employee_number: 'EMP-1006',
        employee_name: 'Jessica Taylor',
        condition: 'Good',
        notes: 'Normal wear, good battery',
        staff_email: 'Nehan'
      }
    ];

    const initialDemoDB = {
      phones: defaultPhones,
      employees: defaultEmployees,
      transactions: initialTransactions
    };

    localStorage.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(initialDemoDB));
  }
}

export function getDemoDB() {
  const data = localStorage.getItem(DEMO_DB_STORAGE_KEY);
  return data ? JSON.parse(data) : { phones: [], employees: [], transactions: [] };
}

export function saveDemoDB(db) {
  localStorage.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(db));
}
