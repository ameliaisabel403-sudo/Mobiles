/* ==========================================================================
   COMPANY PHONE TRACKER - MAIN APPLICATION COORDINATOR
   ========================================================================== */

import { initSupabaseClient, appConfig, saveSupabaseConfig, supabaseClient } from './config.js';
import { initAuth, loginStaff, logoutStaff, getCurrentStaff, isAuthenticated } from './auth.js';
import { fetchAllPhones, fetchTransactions, fetchEmployeeByNumber, fetchAllEmployees, issuePhone, returnPhone } from './database.js';
import { openScannerModal, closeScannerModal, parsePhoneIdFromQR } from './scanner.js';
import { renderQRMatrix, renderEmployeeQRMatrix } from './qr-generator.js';
import { filterTransactions, exportToCSV } from './reports.js';

let cachedPhones = [];
let cachedTransactions = [];
let cachedEmployees = [];

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Supabase Client
  initSupabaseClient();
  updateConfigStatusUI();

  // 2. Initialize Auth & Session Listener
  await initAuth((user) => {
    updateAuthUI(user);
    refreshDashboardData();
  });

  // 3. Setup Realtime Sync
  setupRealtimeSync();

  // 4. Register Navigation & Form Listeners
  setupNavigation();
  setupFormsAndModals();
  setupSettingsPanel();

  // 5. Load Initial Data
  await refreshDashboardData();
});

// Setup Supabase Realtime Subscriptions + Auto Polling Fallback
function setupRealtimeSync() {
  if (appConfig.isConfigured && supabaseClient) {
    try {
      supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'phones' }, () => {
          refreshDashboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          refreshDashboardData();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime note:', e);
    }
  }

  // Polls every 8 seconds across all open devices for instant sync
  setInterval(() => {
    refreshDashboardData();
  }, 8000);
}

// Refresh Dashboard Stats, Tables, and Data
export async function refreshDashboardData() {
  try {
    showLoader(true);
    cachedPhones = await fetchAllPhones();
    cachedTransactions = await fetchTransactions();
    cachedEmployees = await fetchAllEmployees();

    renderKPIStats();
    renderActiveIssuedPhones();
    renderPhoneStatusGrid();
    renderTransactionsTable();
    populateEmployeeDropdowns();
  } catch (err) {
    showToast('Failed to load dashboard data: ' + err.message, 'error');
  } finally {
    showLoader(false);
  }
}

// Render KPI Summary Stat Cards
function renderKPIStats() {
  const totalCount = 20;
  const availableCount = cachedPhones.filter(p => p.status === 'AVAILABLE').length;
  const issuedCount = cachedPhones.filter(p => p.status === 'ISSUED').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const returnedTodayCount = cachedTransactions.filter(tx => {
    return tx.action === 'RETURN' && tx.timestamp && tx.timestamp.startsWith(todayStr);
  }).length;

  const elTotal = document.getElementById('stat-total');
  const elAvail = document.getElementById('stat-available');
  const elIssued = document.getElementById('stat-issued');
  const elRet = document.getElementById('stat-returned-today');

  if (elTotal) elTotal.textContent = totalCount;
  if (elAvail) elAvail.textContent = availableCount;
  if (elIssued) elIssued.textContent = issuedCount;
  if (elRet) elRet.textContent = returnedTodayCount;
}

// Render Active Issued Phones List View
function renderActiveIssuedPhones() {
  const container = document.getElementById('active-issued-container');
  if (!container) return;

  const issuedList = cachedPhones.filter(p => p.status === 'ISSUED');

  if (issuedList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
        <p>✨ All 20 company phones are currently returned and available.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Phone ID</th>
            <th>Holding Employee</th>
            <th>Employee #</th>
            <th>Issue Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${issuedList.map(p => `
            <tr>
              <td><span class="badge badge-issued">${p.id}</span></td>
              <td><strong>${p.current_employee_name || 'Assigned Staff'}</strong></td>
              <td><code>${p.current_employee_id || '-'}</code></td>
              <td>${p.last_issue_time ? new Date(p.last_issue_time).toLocaleString() : '-'}</td>
              <td>
                <button class="btn btn-sm btn-cyan" onclick="window.quickReturnPhone('${p.id}')">
                  ↩️ Quick Return
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Render Complete Phone Status Matrix Table (PHONE-001 to PHONE-020)
function renderPhoneStatusGrid() {
  const container = document.getElementById('phone-status-table-body');
  if (!container) return;

  container.innerHTML = cachedPhones.map(p => {
    const isIssued = p.status === 'ISSUED';
    const statusBadge = isIssued 
      ? `<span class="badge badge-issued">ISSUED</span>` 
      : `<span class="badge badge-available">AVAILABLE</span>`;

    const conditionBadge = p.condition === 'Damaged' 
      ? `<span class="badge badge-damaged">⚠️ Damaged</span>`
      : `<span class="badge badge-good">✓ Good</span>`;

    return `
      <tr>
        <td><strong>${p.id}</strong></td>
        <td>${statusBadge}</td>
        <td>${p.current_employee_id ? `<code>${p.current_employee_id}</code>` : '-'}</td>
        <td>${p.current_employee_name || '-'}</td>
        <td>${p.last_issue_time ? new Date(p.last_issue_time).toLocaleString() : '-'}</td>
        <td>${p.last_return_time ? new Date(p.last_return_time).toLocaleString() : '-'}</td>
        <td>${conditionBadge}</td>
      </tr>
    `;
  }).join('');
}

// Render Transactions History Log Table
function renderTransactionsTable() {
  const container = document.getElementById('transactions-table-body');
  if (!container) return;

  const search = (document.getElementById('filter-search')?.value || '').trim();
  const action = document.getElementById('filter-action')?.value || 'ALL';
  const startDate = document.getElementById('filter-start-date')?.value || '';
  const endDate = document.getElementById('filter-end-date')?.value || '';

  const filtered = filterTransactions(cachedTransactions, { search, action, startDate, endDate });

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-dim);">
          No transactions match the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filtered.map(tx => {
    const actionBadge = tx.action === 'ISSUE'
      ? `<span class="badge badge-issued">ISSUE</span>`
      : `<span class="badge badge-available">RETURN</span>`;

    const condBadge = tx.condition === 'Damaged'
      ? `<span class="badge badge-damaged">Damaged</span>`
      : (tx.condition ? `<span class="badge badge-good">Good</span>` : '-');

    return `
      <tr>
        <td><small>${new Date(tx.timestamp).toLocaleString()}</small></td>
        <td>${actionBadge}</td>
        <td><strong>${tx.phone_id}</strong></td>
        <td><code>${tx.employee_number}</code></td>
        <td>${tx.employee_name}</td>
        <td>${condBadge}</td>
        <td><small>${tx.notes || '-'}</small></td>
        <td><small>${tx.staff_email || 'Staff'}</small></td>
      </tr>
    `;
  }).join('');
}

// Populate Employee Select Options
function populateEmployeeDropdowns() {
  const datalist = document.getElementById('employee-list-options');
  if (!datalist) return;

  datalist.innerHTML = cachedEmployees.map(e => `
    <option value="${e.employee_number}">${e.full_name} (${e.department || 'Staff'})</option>
  `).join('');
}

// Navigation Tab Handler
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn[data-view]');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

export function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const activeSec = document.getElementById(`view-${viewId}`);
  if (activeSec) activeSec.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (viewId === 'qr-print') {
    renderQRMatrix('qr-matrix-container');
  }

  if (viewId === 'employee-qr-print') {
    renderEmployeeQRMatrix('employee-qr-matrix-container', cachedEmployees);
  }
}
window.switchView = switchView;
window._onSwitchView = function(viewId) {
  if (viewId === 'qr-print') {
    renderQRMatrix('qr-matrix-container');
  }
  if (viewId === 'employee-qr-print') {
    renderEmployeeQRMatrix('employee-qr-matrix-container', cachedEmployees);
  }
};
window.refreshDashboardData = refreshDashboardData;

// Forms & Modals Controller
function setupFormsAndModals() {
  // 1. Employee Number Input change -> auto populate Employee Name
  const empInput = document.getElementById('issue-emp-number');
  if (empInput) {
    empInput.addEventListener('change', async (e) => {
      const val = e.target.value.trim();
      if (val) {
        const emp = await fetchEmployeeByNumber(val);
        const nameInput = document.getElementById('issue-emp-name');
        if (emp && nameInput) {
          nameInput.value = emp.full_name;
        }
      }
    });
  }

  // 1b. Fully Automated Employee Card -> Phone Scan Workflow
  window.scanEmployeeCardQR = function() {
    showToast('👤 Scan Employee QR Card now...', 'success');
    openScannerModal(async (scannedEmpId) => {
      const cleanEmpId = String(scannedEmpId).trim().toUpperCase();
      const empInput = document.getElementById('issue-emp-number');
      const nameInput = document.getElementById('issue-emp-name');
      
      if (empInput) {
        empInput.value = cleanEmpId;
        empInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Fetch employee info
      let empName = '';
      try {
        const emp = await fetchEmployeeByNumber(cleanEmpId);
        empName = emp ? emp.full_name : `Employee ${cleanEmpId}`;
        if (nameInput) nameInput.value = empName;
      } catch (e) {
        empName = `Employee ${cleanEmpId}`;
      }

      showToast(`👤 Employee verified: ${empName}. Opening phone scan...`, 'success');

      // Automatically launch Step 2: Mobile/Phone scan without clicking anything
      setTimeout(() => {
        showToast('📱 Now align Phone QR Tag in camera...', 'success');
        openScannerModal(async (scannedPhoneRaw) => {
          const cleanPhoneId = parsePhoneIdFromQR(scannedPhoneRaw);
          const phoneInput = document.getElementById('issue-phone-id');
          if (phoneInput) {
            phoneInput.value = cleanPhoneId;
            phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Check if phone is already issued
          const existingPhone = cachedPhones.find(p => p.id === cleanPhoneId);
          if (existingPhone && existingPhone.status === 'ISSUED') {
            showToast(`⚠️ ${cleanPhoneId} is already issued to ${existingPhone.current_employee_name || 'another staff'}.`, 'error');
            return;
          }

          // Automatically complete the entire issuance process!
          try {
            showLoader(true);
            const res = await issuePhone({
              phoneId: cleanPhoneId,
              employeeNumber: cleanEmpId,
              employeeName: empName
            });
            showToast(`🎉 DONE! ${res.phoneId} issued to ${res.employeeName}!`, 'success');
            const form = document.getElementById('form-issue-phone');
            if (form) form.reset();
            await refreshDashboardData();
            switchView('dashboard');
          } catch (issueErr) {
            showToast(issueErr.message, 'error');
          } finally {
            showLoader(false);
          }
        });
      }, 700);
    });
  };

  const empScanBtn = document.getElementById('btn-issue-scan-emp-qr');
  if (empScanBtn) {
    empScanBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scanEmployeeCardQR();
    });
  }

  // 2. Issue Form Scan QR Button
  window.scanIssuePhoneQR = function() {
    openScannerModal((scannedPhoneId) => {
      const cleanId = parsePhoneIdFromQR(scannedPhoneId);
      const input = document.getElementById('issue-phone-id');
      if (input) {
        input.value = cleanId;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showToast(`Scanned Phone: ${cleanId}`, 'success');
    });
  };

  const issueScanBtn = document.getElementById('btn-issue-scan-qr');
  if (issueScanBtn) {
    issueScanBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scanIssuePhoneQR();
    });
  }

  // 3. Issue Form Submit -> Open Confirmation Modal
  const issueForm = document.getElementById('form-issue-phone');
  if (issueForm) {
    issueForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawPhoneId = document.getElementById('issue-phone-id').value;
      const phoneId = parsePhoneIdFromQR(rawPhoneId);
      const empNum = document.getElementById('issue-emp-number').value.trim().toUpperCase();
      const empName = document.getElementById('issue-emp-name').value.trim();

      if (!phoneId || !empNum) {
        showToast('Please enter both Employee Number and Phone ID.', 'warning');
        return;
      }

      const phone = cachedPhones.find(p => p.id === phoneId);
      if (phone && phone.status === 'ISSUED') {
        showToast(`Error: ${phoneId} is ALREADY ISSUED to ${phone.current_employee_name || 'staff'}.`, 'error');
        return;
      }

      openConfirmModal('ISSUE', {
        phoneId,
        empNum,
        empName: empName || `Employee ${empNum}`,
        time: new Date().toLocaleString()
      });
    });
  }

  // 4. Return Form Scan QR Button
  window.scanReturnPhoneQR = function() {
    openScannerModal((scannedPhoneId) => {
      const cleanId = parsePhoneIdFromQR(scannedPhoneId);
      const input = document.getElementById('return-phone-id');
      if (input) {
        input.value = cleanId;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      handleReturnLookup(cleanId);
      showToast(`Scanned Phone: ${cleanId}`, 'success');
    });
  };

  const returnScanBtn = document.getElementById('btn-return-scan-qr');
  if (returnScanBtn) {
    returnScanBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scanReturnPhoneQR();
    });
  }

  // Return Phone ID Manual Input Change -> Auto Lookup Holder
  const returnPhoneInput = document.getElementById('return-phone-id');
  if (returnPhoneInput) {
    returnPhoneInput.addEventListener('change', (e) => {
      const cleanId = parsePhoneIdFromQR(e.target.value);
      handleReturnLookup(cleanId);
    });
  }

  // Return Form Submit
  const returnForm = document.getElementById('form-return-phone');
  if (returnForm) {
    returnForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawPhoneId = document.getElementById('return-phone-id').value;
      const phoneId = parsePhoneIdFromQR(rawPhoneId);
      const condition = document.getElementById('return-condition').value;
      const notes = document.getElementById('return-notes').value;

      if (!phoneId) {
        showToast('Please enter or scan a Phone ID to return.', 'warning');
        return;
      }

      try {
        showLoader(true);
        const res = await returnPhone({ phoneId, condition, notes });
        showToast(`✅ Successfully returned ${res.phoneId}. Marked as ${res.condition}.`, 'success');
        
        returnForm.reset();
        document.getElementById('return-holder-info').innerHTML = '';
        await refreshDashboardData();
        switchView('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        showLoader(false);
      }
    });
  }

  // Scanner Close Button
  const scannerClose = document.getElementById('btn-close-scanner');
  if (scannerClose) {
    scannerClose.addEventListener('click', closeScannerModal);
  }

  // Quick Select Fallback Scanner Options
  // Quick Select Fallback Scanner Options (Desktop or Camera blocked)
  const quickSelect = document.getElementById('scanner-quick-select');
  if (quickSelect) {
    quickSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        closeScannerModal();
        if (val.startsWith('EMP-')) {
          const empInput = document.getElementById('issue-emp-number');
          if (empInput) {
            empInput.value = val;
            empInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          fetchEmployeeByNumber(val).then(emp => {
            const nameInput = document.getElementById('issue-emp-name');
            if (emp && nameInput) nameInput.value = emp.full_name;
          });
          showToast(`Selected Employee: ${val}`, 'success');
        } else {
          const cleanId = parsePhoneIdFromQR(val);
          const activeView = document.querySelector('.view-section.active')?.id;
          if (activeView === 'view-issue') {
            const input = document.getElementById('issue-phone-id');
            if (input) {
              input.value = cleanId;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } else if (activeView === 'view-return') {
            const input = document.getElementById('return-phone-id');
            if (input) {
              input.value = cleanId;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            handleReturnLookup(cleanId);
          }
          showToast(`Selected Phone: ${cleanId}`, 'success');
        }
        quickSelect.value = '';
      }
    });
  }

  // Filter Listeners for Reports Page
  ['filter-search', 'filter-action', 'filter-start-date', 'filter-end-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderTransactionsTable);
      el.addEventListener('change', renderTransactionsTable);
    }
  });

  // Export CSV Button
  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportToCSV(cachedTransactions);
    });
  }
}

// Handle Auto-Lookup of Assigned Employee on Return
async function handleReturnLookup(phoneId) {
  if (!phoneId) return;
  const container = document.getElementById('return-holder-info');
  if (!container) return;

  const phone = cachedPhones.find(p => p.id === phoneId);

  if (!phone) {
    container.innerHTML = `<div style="color: var(--accent-rose); font-size: 0.9rem;">⚠️ Phone "${phoneId}" not found in database.</div>`;
    return;
  }

  if (phone.status === 'AVAILABLE') {
    container.innerHTML = `
      <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.85rem; border-radius: 8px; color: #fbbf24;">
        ⚠️ <strong>${phoneId} is currently AVAILABLE (not issued).</strong>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.3); padding: 1rem; border-radius: 10px;">
      <h4 style="color: var(--accent-cyan); margin-bottom: 0.5rem;">Current Assigned Holder:</h4>
      <p style="font-size: 1.05rem; font-weight: 700; color: #fff;">${phone.current_employee_name || 'Staff'}</p>
      <p style="font-size: 0.88rem; color: var(--text-muted);">Employee Number: <code>${phone.current_employee_id || 'N/A'}</code></p>
      <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.3rem;">Issued At: ${phone.last_issue_time ? new Date(phone.last_issue_time).toLocaleString() : 'N/A'}</p>
    </div>
  `;
}

// Open Confirmation Modal for Issue
function openConfirmModal(type, data) {
  const modal = document.getElementById('confirm-modal');
  const body = document.getElementById('confirm-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; margin-bottom: 1rem;">
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📱➡️👤</div>
      <h3 style="font-size: 1.3rem;">Confirm Phone Issuance</h3>
    </div>
    <div style="background: var(--bg-glass); border: 1px solid var(--border-glass); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
      <p><strong>Phone ID:</strong> <span class="badge badge-issued">${data.phoneId}</span></p>
      <p style="margin-top: 0.4rem;"><strong>Employee #:</strong> <code>${data.empNum}</code></p>
      <p style="margin-top: 0.4rem;"><strong>Employee Name:</strong> ${data.empName}</p>
      <p style="margin-top: 0.4rem; font-size: 0.85rem; color: var(--text-dim);"><strong>Timestamp:</strong> ${data.time}</p>
    </div>
    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
      <button class="btn btn-glass" onclick="window.closeConfirmModal()">Cancel</button>
      <button class="btn btn-success" id="btn-confirm-issue-final">Confirm Issue</button>
    </div>
  `;

  modal.classList.add('active');

  document.getElementById('btn-confirm-issue-final').onclick = async () => {
    try {
      showLoader(true);
      const res = await issuePhone({
        phoneId: data.phoneId,
        employeeNumber: data.empNum,
        employeeName: data.empName
      });
      showToast(`✅ ${res.phoneId} successfully issued to ${res.employeeName}!`, 'success');
      window.closeConfirmModal();
      document.getElementById('form-issue-phone').reset();
      await refreshDashboardData();
      switchView('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      showLoader(false);
    }
  };
}

window.closeConfirmModal = function() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.classList.remove('active');
};

// Global Quick Return Helper from Dashboard Table
window.quickReturnPhone = function(phoneId) {
  switchView('return');
  const input = document.getElementById('return-phone-id');
  if (input) {
    input.value = phoneId;
    handleReturnLookup(phoneId);
  }
};

// Setup Settings Modal & Supabase Credentials Config
window.openSettingsModal = function() {
  const modalSettings = document.getElementById('settings-modal');
  if (modalSettings) {
    const urlInput = document.getElementById('setting-supabase-url');
    const keyInput = document.getElementById('setting-supabase-key');
    if (urlInput) urlInput.value = appConfig.supabaseUrl || '';
    if (keyInput) keyInput.value = appConfig.supabaseKey || '';
    modalSettings.classList.add('active');
  }
};

window.closeSettingsModal = function() {
  const modalSettings = document.getElementById('settings-modal');
  if (modalSettings) {
    modalSettings.classList.remove('active');
  }
};

window.closeScannerModal = function() {
  closeScannerModal();
};

window.openScannerModal = function(callback) {
  openScannerModal(callback);
};

function setupSettingsPanel() {
  const btnSettings = document.getElementById('btn-open-settings');
  const modalSettings = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const formSettings = document.getElementById('form-settings');

  if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
      e.preventDefault();
      window.openSettingsModal();
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', (e) => {
      e.preventDefault();
      window.closeSettingsModal();
    });
  }

  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = document.getElementById('setting-supabase-url').value;
      const key = document.getElementById('setting-supabase-key').value;

      saveSupabaseConfig(url, key);
      updateConfigStatusUI();
      modalSettings.classList.remove('active');
      showToast('Supabase Settings Saved! Re-connecting...', 'success');
      refreshDashboardData();
    });
  }
}

// Update UI Badge for Auth & Supabase Config Mode
function updateConfigStatusUI() {
  const badge = document.getElementById('db-mode-badge');
  if (!badge) return;

  if (appConfig.isConfigured) {
    badge.className = 'badge badge-available';
    badge.textContent = '🟢 SUPABASE LIVE';
  } else {
    badge.className = 'badge badge-issued';
    badge.textContent = '⚡ DEMO DB MODE';
  }
}

function updateAuthUI(user) {
  const userEl = document.getElementById('nav-user-email');
  const btnLogin = document.getElementById('btn-open-login');
  const btnLogout = document.getElementById('btn-logout');

  if (user) {
    if (userEl) userEl.textContent = user.email || 'Staff';
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-flex';
  } else {
    if (userEl) userEl.textContent = 'Not Logged In';
    if (btnLogin) btnLogin.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'none';
  }
}

// Toast Notification Engine
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : '⚠️')}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoader(show) {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = show ? 'block' : 'none';
}
