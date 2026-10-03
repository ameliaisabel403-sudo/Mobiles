import { initSupabaseClient, appConfig, saveSupabaseConfig } from "./config.js";
import { initAuth, getCurrentStaff } from "./auth.js";
import {
  fetchAllPhones,
  fetchAllEmployees,
  fetchEmployeeByNumber,
  fetchTransactions,
  issuePhone,
  returnPhone,
  addNewPhoneQR,
  removePhoneQR,
  replacePhoneQR,
  addNewEmployeeQR,
  removeEmployeeQR,
  replaceEmployeeQR
} from "./database.js";
import { openScannerModal, closeScannerModal } from "./scanner.js";
import { renderQRMatrix, renderEmployeeQRMatrix } from "./qr-generator.js";
import { filterTransactions, exportToCSV } from "./reports.js";

let phones = [];
let employees = [];
let transactions = [];
let busyCount = 0;

// Initialize immediately if DOM is ready, or on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  initSupabaseClient();
  setupNavigation();
  setupEvents();
  setupQRManagementButtons();
  updateBadge();
  await initAuth(user => updateUser(user));
  await refresh();
}

// Global window bindings for navigation and modals
window.refresh = refresh;
window.refreshDashboardData = refresh;
window.showView = showView;
window.switchView = showView;
window.openScannerModal = openScannerModal;
window.closeScannerModal = closeScannerModal;
window.scanEmployeeCardQR = startEmployeeAutoFlow;
window.scanIssuePhoneQR = () =>
  openScannerModal(id => setVal("issue-phone-id", id), { mode: "phone", quickOptions: phones });
window.scanReturnPhoneQR = () =>
  openScannerModal(id => { setVal("return-phone-id", id); showHolder(id); }, { mode: "phone", quickOptions: phones });
window.closeConfirmModal = closeConfirmModal;

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => showView(btn.dataset.view);
  });
}

function showView(view) {
  document.querySelectorAll(".view-section").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
  document.getElementById(`view-${view}`)?.classList.add("active");
  document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add("active");

  if (view === "qr-print") renderQRMatrix("qr-matrix-container", phones);
  if (view === "employee-qr-print") renderEmployeeQRMatrix("employee-qr-matrix-container", employees);
  if (view === "manage-phones") renderManagePhones();
  if (view === "manage-employees") renderManageEmployees();
}

function setupEvents() {
  document.getElementById("form-issue-phone")?.addEventListener("submit", handleIssue);
  document.getElementById("form-return-phone")?.addEventListener("submit", handleReturn);
  document.getElementById("issue-emp-number")?.addEventListener("input", () => fillEmployee(val("issue-emp-number")));
  document.getElementById("issue-emp-number")?.addEventListener("change", () => fillEmployee(val("issue-emp-number")));
  document.getElementById("issue-emp-number")?.addEventListener("blur", () => fillEmployee(val("issue-emp-number")));
  document.getElementById("return-phone-id")?.addEventListener("input", () => showHolder(val("return-phone-id")));
  document.getElementById("return-phone-id")?.addEventListener("change", () => showHolder(val("return-phone-id")));

  ["filter-search", "filter-action", "filter-start-date", "filter-end-date"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderReports);
    document.getElementById(id)?.addEventListener("change", renderReports);
  });

  document.getElementById("btn-export-csv")?.addEventListener("click", () => exportToCSV(getFilteredTransactions()));
  document.getElementById("btn-open-settings")?.addEventListener("click", openSettings);
  document.getElementById("btn-close-settings")?.addEventListener("click", closeSettings);

  document.getElementById("form-settings")?.addEventListener("submit", async e => {
    e.preventDefault();
    const url = val("setting-supabase-url").trim();
    const key = val("setting-supabase-key").trim();
    if (!url || !key) { toast("Please enter both Supabase URL and public anon key.", "error"); return; }
    try {
      saveSupabaseConfig(url, key);
      closeSettings();
      updateBadge();
      await refresh();
      toast("Supabase connected successfully.", "success");
    } catch (err) {
      toast(err.message || "Could not connect to Supabase.", "error");
    }
  });

  document.getElementById("scanner-quick-select")?.addEventListener("change", e => {
    if (e.target.value && window._scannerQuickSelect) window._scannerQuickSelect(e.target.value);
  });

  document.getElementById("btn-add-employee")?.addEventListener("click", () => openEmployeeModal());
  document.getElementById("btn-add-phone")?.addEventListener("click", () => openPhoneModal());
  document.getElementById("form-employee-modal")?.addEventListener("submit", async e => {
    e.preventDefault();
    await saveEmployeeFromModal();
  });

  window.addEventListener("beforeunload", () => { try { closeScannerModal(); } catch {} });
}

// ============================================================================
// PHONE & EMPLOYEE QR CODE MANAGEMENT (ADD, REPLACE, REMOVE)
// ============================================================================
function setupQRManagementButtons() {
  // Phone QR Code Actions
  window.promptAddNewPhoneQR = async () => {
    const nextNum = phones.length + 1;
    const defaultId = `PHONE-${String(nextNum).padStart(3, "0")}`;
    const phoneId = prompt("Enter New Phone ID:", defaultId);
    if (!phoneId) return;
    try {
      busy(true);
      await addNewPhoneQR({ phoneId });
      toast(`Phone QR Code ${phoneId.toUpperCase()} created successfully.`, "success");
      await refresh();
      showView("qr-print");
    } catch (err) {
      toast(err.message || "Could not add Phone QR Code.", "error");
    } finally {
      busy(false);
    }
  };

  window.promptReplacePhoneQR = async (presetId = null) => {
    const prevPhone = presetId || prompt("Enter Current Phone ID to Replace (e.g. PHONE-001):");
    if (!prevPhone) return;
    const newPhone = prompt(`Enter New Replacement Phone ID for ${prevPhone}:`);
    if (!newPhone) return;
    try {
      busy(true);
      await replacePhoneQR({
        previousPhoneId: prevPhone,
        newPhoneId: newPhone,
        reason: "Replaced device tag"
      });
      toast(`Phone QR Code replaced: ${prevPhone} ➔ ${newPhone}.`, "success");
      await refresh();
      showView("qr-print");
    } catch (err) {
      toast(err.message || "Could not replace Phone QR Code.", "error");
    } finally {
      busy(false);
    }
  };

  window.promptRemovePhoneQR = async (presetId = null) => {
    const phoneId = presetId || prompt("Enter Phone ID to Remove (e.g. PHONE-001):");
    if (!phoneId) return;
    if (!confirm(`Are you sure you want to remove ${phoneId}? Historical shift records will be kept.`)) return;
    try {
      busy(true);
      await removePhoneQR(phoneId, "Removed by manager");
      toast(`Phone QR Code ${phoneId} removed.`, "success");
      await refresh();
      showView("qr-print");
    } catch (err) {
      toast(err.message || "Could not remove Phone QR Code.", "error");
    } finally {
      busy(false);
    }
  };

  // Employee QR Code Actions
  window.promptAddNewEmployeeQR = async () => {
    const nextEmp = `EMP-${1000 + employees.length + 1}`;
    const empNum = prompt("Enter New Employee ID:", nextEmp);
    if (!empNum) return;
    const name = prompt(`Enter Full Name for ${empNum}:`);
    if (!name) return;
    const dept = prompt(`Enter Department for ${name}:`, "Operations") || "Operations";
    try {
      busy(true);
      await addNewEmployeeQR({
        employeeNumber: empNum,
        fullName: name,
        department: dept
      });
      toast(`Employee QR Code for ${name} (${empNum}) created!`, "success");
      await refresh();
      showView("employee-qr-print");
    } catch (err) {
      toast(err.message || "Could not add Employee QR Code.", "error");
    } finally {
      busy(false);
    }
  };

  window.promptReplaceEmployeeQR = async (presetId = null) => {
    const prevEmp = presetId || prompt("Enter Current Employee Number to Replace (e.g. EMP-1001):");
    if (!prevEmp) return;
    const newEmp = prompt(`Enter New Replacement Employee Number for ${prevEmp}:`);
    if (!newEmp) return;
    const newName = prompt(`Enter New/Updated Full Name (leave blank to keep current):`, "");
    try {
      busy(true);
      await replaceEmployeeQR({
        previousEmployeeNumber: prevEmp,
        newEmployeeNumber: newEmp,
        newFullName: newName
      });
      toast(`Employee QR Code replaced: ${prevEmp} ➔ ${newEmp}.`, "success");
      await refresh();
      showView("employee-qr-print");
    } catch (err) {
      toast(err.message || "Could not replace Employee QR Code.", "error");
    } finally {
      busy(false);
    }
  };

  window.promptRemoveEmployeeQR = async (presetId = null) => {
    const empNum = presetId || prompt("Enter Employee Number to Remove (e.g. EMP-1001):");
    if (!empNum) return;
    if (!confirm(`Are you sure you want to remove ${empNum}? Past transactions will remain intact.`)) return;
    try {
      busy(true);
      await removeEmployeeQR(empNum, "Deactivated by staff");
      toast(`Employee QR Code ${empNum} removed.`, "success");
      await refresh();
      showView("employee-qr-print");
    } catch (err) {
      toast(err.message || "Could not remove Employee QR Code.", "error");
    } finally {
      busy(false);
    }
  };
}

async function startEmployeeAutoFlow() {
  openScannerModal(async employeeId => {
    await fillEmployee(employeeId);
    const employee = await fetchEmployeeByNumber(employeeId);
    if (!employee) return;
    setTimeout(() => {
      openScannerModal(async phoneId => {
        setVal("issue-phone-id", phoneId);
        await completeIssue(employeeId, phoneId);
      }, { mode: "phone", quickOptions: phones });
    }, 250);
  }, { mode: "employee", quickOptions: employees });
}

function handleIssue(e) {
  e.preventDefault();
  const empId = val("issue-emp-number");
  const phoneId = val("issue-phone-id");
  const empName = val("issue-emp-name") || "Shift Staff";

  if (!empId) { toast("Please enter an Employee ID.", "error"); return; }
  if (!phoneId) { toast("Please scan or enter a Phone ID.", "error"); return; }

  openConfirmModal({
    title: "Verify & Confirm Phone Issue",
    details: `
      <p><b>Phone ID:</b> ${escapeHtml(phoneId)}</p>
      <p><b>Employee:</b> ${escapeHtml(empName)} (${escapeHtml(empId)})</p>
      <p><b>Action:</b> Shift Issuance</p>
    `,
    confirmText: "Confirm Issue ✓",
    onConfirm: async () => {
      await completeIssue(empId, phoneId);
    }
  });
}

async function completeIssue(employeeId, phoneId) {
  try {
    busy(true);
    const id = normalizeEmployeeId(employeeId);
    const phone = normalizePhoneId(phoneId);
    if (!id) throw new Error("Please enter an Employee ID.");
    if (!phone) throw new Error("Please scan or enter a valid Phone ID.");
    const emp = await fetchEmployeeByNumber(id);
    if (!emp) throw new Error("Employee not found. Please register employee first.");

    await issuePhone({
      phoneId: phone,
      employeeNumber: id,
      employeeName: emp.full_name,
      staffEmail: getCurrentStaff()?.email || "Staff"
    });

    toast(`${phone} issued to ${emp.full_name}.`, "success");
    document.getElementById("form-issue-phone")?.reset();
    setVal("issue-emp-name", "");
    closeConfirmModal();
    await refresh();
    showView("dashboard");
  } catch (err) {
    toast(err.message || "Could not issue phone.", "error");
  } finally {
    busy(false);
  }
}

function handleReturn(e) {
  e.preventDefault();
  const phoneId = val("return-phone-id");
  const condition = val("return-condition") || "Good";
  const notes = val("return-notes") || "";

  if (!phoneId) { toast("Please scan or enter a Phone ID.", "error"); return; }

  openConfirmModal({
    title: "Verify & Confirm Phone Return",
    details: `
      <p><b>Phone ID:</b> ${escapeHtml(phoneId)}</p>
      <p><b>Condition:</b> ${escapeHtml(condition)}</p>
      <p><b>Notes:</b> ${escapeHtml(notes || "None")}</p>
    `,
    confirmText: "Confirm Return ✓",
    onConfirm: async () => {
      try {
        busy(true);
        const result = await returnPhone({
          phoneId,
          condition,
          notes,
          staffEmail: getCurrentStaff()?.email || "Staff"
        });
        toast(`${result.phoneId} returned successfully.`, "success");
        document.getElementById("form-return-phone")?.reset();
        const holder = document.getElementById("return-holder-info");
        if (holder) holder.innerHTML = "";
        closeConfirmModal();
        await refresh();
        showView("dashboard");
      } catch (err) {
        toast(err.message || "Could not return phone.", "error");
      } finally {
        busy(false);
      }
    }
  });
}

function openConfirmModal({ title, details, confirmText, onConfirm }) {
  const modal = document.getElementById("confirm-modal");
  const body = document.getElementById("confirm-modal-body");
  if (!modal || !body) return;

  body.innerHTML = `
    <h3 class="card-title" style="margin-bottom: 1rem;">${title}</h3>
    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; line-height: 1.6;">
      ${details}
    </div>
    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
      <button type="button" class="btn btn-glass" onclick="window.closeConfirmModal()">Cancel</button>
      <button type="button" id="btn-modal-confirm" class="btn btn-primary">${confirmText}</button>
    </div>
  `;

  document.getElementById("btn-modal-confirm").onclick = onConfirm;
  modal.classList.add("active");
}

function closeConfirmModal() {
  document.getElementById("confirm-modal")?.classList.remove("active");
}

async function refresh() {
  try {
    busy(true);
    [phones, employees, transactions] = await Promise.all([
      fetchAllPhones(), fetchAllEmployees(), fetchTransactions()
    ]);
    renderDashboard();
    renderStatus();
    populateEmployees();
    renderReports();
    renderQRMatrix("qr-matrix-container", phones);
    renderEmployeeQRMatrix("employee-qr-matrix-container", employees);
  } catch (err) {
    console.error(err);
    toast(err.message || "Could not load data.", "error");
  } finally {
    busy(false);
  }
}

function renderManageEmployees() {
  const container = document.getElementById("manage-employees-list");
  if (!container) return;
  if (!employees.length) {
    container.innerHTML = `<p class="muted">No employees added yet. Click "Add New Employee" to get started.</p>`;
    return;
  }
  container.innerHTML = `<div class="table-responsive"><table class="data-table">
    <thead><tr><th>Employee #</th><th>Full Name</th><th>Department</th><th>Phone</th><th>Actions</th></tr></thead>
    <tbody>${employees.map(emp => `<tr>
      <td><b>${escapeHtml(emp.employee_number)}</b></td>
      <td>${escapeHtml(emp.full_name)}</td>
      <td>${escapeHtml(emp.department || "-")}</td>
      <td>${escapeHtml(emp.phone_number || "-")}</td>
      <td style="display:flex;gap:0.5rem;">
        <button class="btn btn-sm btn-glass" onclick="window.editEmployee('${escapeHtml(emp.employee_number)}')">✏️ Edit</button>
        <button class="btn btn-sm" style="background:#ef4444;color:#fff;" onclick="window.removeEmployee('${escapeHtml(emp.employee_number)}')">🗑️ Remove</button>
      </td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderManagePhones() {
  const container = document.getElementById("manage-phones-list");
  if (!container) return;
  container.innerHTML = `<div class="table-responsive"><table class="data-table">
    <thead><tr><th>Phone ID</th><th>Status</th><th>Condition</th><th>Holder</th><th>Actions</th></tr></thead>
    <tbody>${phones.map(p => `<tr>
      <td><b>${escapeHtml(p.id)}</b></td>
      <td><span class="badge ${p.status === "AVAILABLE" ? "badge-available" : "badge-issued"}">${escapeHtml(p.status)}</span></td>
      <td>${escapeHtml(p.condition || "Good")}</td>
      <td>${escapeHtml(p.current_employee_name || "-")}</td>
      <td><button class="btn btn-sm btn-glass" onclick="window.replacePhoneQR('${escapeHtml(p.id)}')">🔄 Replace QR</button></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function openEmployeeModal(emp = null) {
  const modal = document.getElementById("employee-modal");
  if (!modal) return;
  document.getElementById("emp-modal-title").textContent = emp ? "✏️ Edit Employee" : "➕ Add New Employee";
  setVal("emp-modal-number", emp?.employee_number || "");
  setVal("emp-modal-name", emp?.full_name || "");
  setVal("emp-modal-dept", emp?.department || "Housekeeping");
  setVal("emp-modal-phone", emp?.phone_number || "");
  const oldIdEl = document.getElementById("emp-modal-old-id");
  if (oldIdEl) oldIdEl.value = emp?.employee_number || "";
  modal.classList.add("active");
}

function openPhoneModal() {
  toast("Phones PHONE-001 to PHONE-020 are pre-loaded. Click 'Replace QR' to regenerate label.", "info");
}

async function saveEmployeeFromModal() {
  try {
    busy(true);
    const oldId = document.getElementById("emp-modal-old-id")?.value;
    const { saveEmployee } = await import("./database.js");
    await saveEmployee({
      employee_number: val("emp-modal-number"),
      full_name: val("emp-modal-name"),
      department: val("emp-modal-dept"),
      phone_number: val("emp-modal-phone")
    }, oldId);
    document.getElementById("employee-modal")?.classList.remove("active");
    toast("Employee saved successfully.", "success");
    await refresh();
    renderManageEmployees();
  } catch (err) {
    toast(err.message || "Could not save employee.", "error");
  } finally {
    busy(false);
  }
}

window.editEmployee = (id) => {
  const emp = employees.find(e => e.employee_number === id);
  if (emp) openEmployeeModal(emp);
};

window.removeEmployee = async (id) => {
  if (!confirm(`Remove employee ${id}? This cannot be undone.`)) return;
  try {
    busy(true);
    const { deleteEmployee } = await import("./database.js");
    await deleteEmployee(id);
    toast(`Employee ${id} removed.`, "success");
    await refresh();
    renderManageEmployees();
  } catch (err) {
    toast(err.message || "Could not remove employee.", "error");
  } finally {
    busy(false);
  }
};

window.replacePhoneQR = (phoneId) => {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(phoneId)}&t=${Date.now()}`;
  const win = window.open("", "_blank");
  win.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding:2rem;">
    <h2>QR Code for ${phoneId}</h2>
    <img src="${url}" style="width:200px;height:200px;" /><br><br>
    <p>Right-click to save, or click Print below.</p>
    <button onclick="window.print()" style="padding:0.5rem 1.5rem;margin-top:1rem;">🖨️ Print</button>
  </body></html>`);
};

function renderDashboard() {
  setText("stat-total", phones.length);
  setText("stat-available", phones.filter(p => p.status === "AVAILABLE").length);
  setText("stat-issued", phones.filter(p => p.status === "ISSUED").length);
  const today = new Date().toISOString().slice(0, 10);
  setText("stat-returned-today",
    transactions.filter(t => t.action === "RETURN" && String(t.timestamp).startsWith(today)).length);
  
  const container = document.getElementById("active-issued-container");
  if (!container) return;
  const issued = phones.filter(p => p.status === "ISSUED");
  container.innerHTML = issued.length
    ? `<div class="table-responsive"><table class="data-table">
       <thead><tr><th>Phone</th><th>Employee</th><th>ID</th><th>Issued</th></tr></thead>
       <tbody>${issued.map(p => `<tr>
         <td><b>${escapeHtml(p.id)}</b></td>
         <td>${escapeHtml(p.current_employee_name || "-")}</td>
         <td>${escapeHtml(p.current_employee_id || "-")}</td>
         <td>${formatDate(p.last_issue_time)}</td>
       </tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">No phones are currently issued.</p>`;
}

function renderStatus() {
  const body = document.getElementById("phone-status-table-body");
  if (!body) return;
  body.innerHTML = phones.map(p => `<tr>
    <td><b>${escapeHtml(p.id)}</b></td>
    <td><span class="badge ${p.status === "AVAILABLE" ? "badge-available" : "badge-issued"}">${escapeHtml(p.status)}</span></td>
    <td>${escapeHtml(p.current_employee_id || "-")}</td>
    <td>${escapeHtml(p.current_employee_name || "-")}</td>
    <td>${formatDate(p.last_issue_time)}</td>
    <td>${formatDate(p.last_return_time)}</td>
    <td>${escapeHtml(p.condition || "-")}</td>
  </tr>`).join("");
}

function populateEmployees() {
  const list = document.getElementById("employee-list-options");
  if (!list) return;
  list.innerHTML = employees.map(e =>
    `<option value="${escapeHtml(e.employee_number)}">${escapeHtml(e.full_name)}</option>`
  ).join("");
}

async function fillEmployee(id) {
  const normalized = normalizeEmployeeId(id);
  setVal("issue-emp-number", normalized);
  if (!normalized) { setVal("issue-emp-name", ""); return null; }
  try {
    const employee = await fetchEmployeeByNumber(normalized);
    if (!employee) { setVal("issue-emp-name", ""); return null; }
    setVal("issue-emp-name", employee.full_name);
    return employee;
  } catch (err) {
    return null;
  }
}

function showHolder(id) {
  const holder = document.getElementById("return-holder-info");
  if (!holder) return;
  const phone = phones.find(p => p.id === normalizePhoneId(id));
  if (!phone) {
    holder.innerHTML = `<div class="holder">Phone not found.</div>`;
  } else if (phone.status === "AVAILABLE") {
    holder.innerHTML = `<div class="holder">This phone is currently available.</div>`;
  } else {
    holder.innerHTML = `<div class="holder"><b>Current Holder:</b><br>
      ${escapeHtml(phone.current_employee_name || "-")}<br>
      <span class="small">${escapeHtml(phone.current_employee_id || "-")}</span><br>
      <span class="small">Issued: ${formatDate(phone.last_issue_time)}</span>
    </div>`;
  }
}

function renderReports() {
  const body = document.getElementById("transactions-table-body");
  if (!body) return;
  const rows = getFilteredTransactions();
  body.innerHTML = rows.length ? rows.map(x => `<tr>
    <td>${formatDate(x.timestamp)}</td>
    <td><span class="badge ${x.action === "ISSUE" ? "badge-issued" : "badge-available"}">${escapeHtml(x.action)}</span></td>
    <td>${escapeHtml(x.phone_id)}</td>
    <td>${escapeHtml(x.employee_number)}</td>
    <td>${escapeHtml(x.employee_name)}</td>
    <td>${escapeHtml(x.condition || "-")}</td>
    <td>${escapeHtml(x.notes || "-")}</td>
    <td>${escapeHtml(x.staff_email || "Staff")}</td>
  </tr>`).join("") : `<tr><td colspan="8" class="muted">No transactions found.</td></tr>`;
}

function getFilteredTransactions() {
  return filterTransactions(transactions, {
    search: val("filter-search"),
    action: val("filter-action") || "ALL",
    startDate: val("filter-start-date"),
    endDate: val("filter-end-date")
  });
}

function openSettings() {
  setVal("setting-supabase-url", appConfig.supabaseUrl || "");
  setVal("setting-supabase-key", appConfig.supabaseKey || "");
  document.getElementById("settings-modal")?.classList.add("active");
}

function closeSettings() {
  document.getElementById("settings-modal")?.classList.remove("active");
}
window.openSettingsModal = openSettings;
window.closeSettingsModal = closeSettings;

function updateBadge() {
  const badge = document.getElementById("db-mode-badge");
  if (!badge) return;
  badge.className = `badge ${appConfig.isConfigured ? "badge-live" : "badge-issued"}`;
  badge.textContent = appConfig.isConfigured ? "🟢 SUPABASE LIVE" : "⚡ DEMO DB MODE";
}

function updateUser(user) {
  const el = document.getElementById("nav-user-email");
  if (el) el.textContent = user?.email || getCurrentStaff()?.email || "Staff";
}

function toast(message, type = "") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const d = document.createElement("div");
  d.className = `toast ${type}`;
  d.textContent = message;
  c.appendChild(d);
  setTimeout(() => d.remove(), 4500);
}

function busy(on) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  const loader = document.getElementById("global-loader");
  if (loader) loader.style.display = busyCount > 0 ? "block" : "none";
}

function val(id) { return document.getElementById(id)?.value || ""; }
function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value ?? ""; }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = String(value); }

function normalizePhoneId(value) {
  let s = String(value || "").trim().toUpperCase();
  if (s.includes("/")) s = s.split("/").filter(Boolean).pop();
  const m = s.match(/(?:PHONE[-_ ]*)?0*(\d{1,2})$/);
  return m && +m[1] >= 1 && +m[1] <= 20 ? `PHONE-${String(+m[1]).padStart(3, "0")}` : s;
}

function normalizeEmployeeId(value) {
  let s = String(value || "").trim().toUpperCase();
  if (s.includes("/")) s = s.split("/").filter(Boolean).pop();
  const m = s.match(/(?:EMPLOYEE[-_ ]*|EMP[-_ ]*)?(\d{1,10})$/);
  return m && !s.startsWith("EMP-") ? `EMP-${m[1]}` : s;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}
