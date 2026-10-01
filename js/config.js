/* ==========================================================================
   COMPANY PHONE TRACKER - CONFIG & SUPABASE CLIENT INITIALIZER
   ========================================================================== */

const CONFIG_STORAGE_KEY = 'company_phone_tracker_config_v1';
const DEMO_DB_STORAGE_KEY = 'company_phone_tracker_demo_db_v1';

// Default Supabase Config State
export let appConfig = {
  supabaseUrl: localStorage.getItem('SUPABASE_URL') || '',
  supabaseKey: localStorage.getItem('SUPABASE_ANON_KEY') || '',
  isConfigured: false,
  isDemoMode: true
};

export let supabaseClient = null;

// Initialize Supabase Client if credentials exist
export function initSupabaseClient() {
  if (appConfig.supabaseUrl && appConfig.supabaseKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(
        appConfig.supabaseUrl, 
        appConfig.supabaseKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        }
      );
      appConfig.isConfigured = true;
      appConfig.isDemoMode = false;
      console.log('✅ Supabase Client Initialized Successfully');
      return true;
    } catch (err) {
      console.warn('⚠️ Could not initialize Supabase Client, falling back to local demo DB:', err);
    }
  }

  // Fallback to local demo database mode
  appConfig.isConfigured = false;
  appConfig.isDemoMode = true;
  initDemoDatabase();
  return false;
}

// Save Supabase Credentials
export function saveSupabaseConfig(url, key) {
  const cleanUrl = url ? url.trim() : '';
  const cleanKey = key ? key.trim() : '';

  if (cleanUrl) localStorage.setItem('SUPABASE_URL', cleanUrl);
  else localStorage.removeItem('SUPABASE_URL');

  if (cleanKey) localStorage.setItem('SUPABASE_ANON_KEY', cleanKey);
  else localStorage.removeItem('SUPABASE_ANON_KEY');

  appConfig.supabaseUrl = cleanUrl;
  appConfig.supabaseKey = cleanKey;

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

    const initialTransactions = [];

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
