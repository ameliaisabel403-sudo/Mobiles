import { initSupabaseClient, appConfig, saveSupabaseConfig } from "./config.js";
import { initAuth, getCurrentStaff } from "./auth.js";
import {
  fetchAllPhones, fetchAllEmployees, fetchEmployeeByNumber, fetchTransactions,
  saveEmployee, deleteEmployee, issuePhone, returnPhone
} from "./database.js";
import { openScannerModal, closeScannerModal } from "./scanner.js";
import { renderQRMatrix, renderEmployeeQRMatrix } from "./qr-generator.js";
import { filterTransactions, exportToCSV } from "./reports.js";

let phones = [];
let employees = [];
let transactions = [];
let busyCount = 0;

document.addEventListener("DOMContentLoaded", async () => {
  initSupabaseClient();
  setupNavigation();
  setupEvents();
  updateBadge();
  await initAuth(user => updateUser(user));
  await refresh();
  renderQRMatrix("qr-matrix-container");
  renderEmployeeQRMatrix("employee-qr-matrix-container", employees);
});

window.refresh = refresh;

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });
}

function showView(view) {
  document.querySelectorAll(".view-section").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));

  document.getElementById(`view-${view}`)?.classList.add("active");
  document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add("active");

  if (view === "qr-print") renderQRMatrix("qr-matrix-container");
  if (view === "employee-qr-print") renderEmployeeQRMatrix("employee-qr-matrix-container", employees);
}
window.showView = showView;
window.switchView = showView;

function setupEvents() {
  document.getElementById("btn-issue-scan-emp-qr")?.addEventListener("click", startEmployeeAutoFlow);
  document.getElementById("btn-issue-scan-qr")?.addEventListener("click", () =>
    openScannerModal(id => setVal("issue-phone-id", id), { mode: "phone", quickOptions: phones })
  );
  document.getElementById("btn-return-scan-qr")?.addEventListener("click", () =>
    openScannerModal(id => {
      setVal("return-phone-id", id);
      showHolder(id);
    }, { mode: "phone", quickOptions: phones })
  );

  document.getElementById("issue-emp-number")?.addEventListener("change", () =>
    fillEmployee(val("issue-emp-number"))
  );
  document.getElementById("issue-emp-number")?.addEventListener("blur", () =>
    fillEmployee(val("issue-emp-number"))
  );
  document.getElementById("return-phone-id")?.addEventListener("change", () =>
    showHolder(val("return-phone-id"))
  );

  document.getElementById("form-issue-phone")?.addEventListener("submit", handleIssue);
  document.getElementById("form-return-phone")?.addEventListener("submit", handleReturn);

  ["filter-search", "filter-action", "filter-start-date", "filter-end-date"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderReports);
    document.getElementById(id)?.addEventListener("change", renderReports);
  });

  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    exportToCSV(getFilteredTransactions());
  });

  document.getElementById("btn-open-settings")?.addEventListener("click", openSettings);
  document.getElementById("btn-close-settings")?.addEventListener("click", closeSettings);

  document.getElementById("form-settings")?.addEventListener("submit", async e => {
    e.preventDefault();
    const url = val("setting-supabase-url").trim();
    const key = val("setting-supabase-key").trim();
    if (!url || !key) {
      toast("Please enter both Supabase URL and public anon key.", "error");
      return;
    }
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
    if (e.target.value) window._scannerQuickSelect?.(e.target.value);
  });

  // Replace the legacy inline scanner handlers with the current module handlers.\n  window.openScannerModal = openScannerModal;\n  window.closeScannerModal = closeScannerModal;\n  window.scanEmployeeCardQR = startEmployeeAutoFlow;\n  window.scanIssuePhoneQR = () => openScannerModal(id => setVal("issue-phone-id", id), { mode: "phone", quickOptions: phones });\n  window.scanReturnPhoneQR = () => openScannerModal(id => { setVal("return-phone-id", id); showHolder(id); }, { mode: "phone", quickOptions: phones });\n\n  window.addEventListener("beforeunload", () => {
    try { closeScannerModal(); } catch {}
  });
}

async function startEmployeeAutoFlow() {
  openScannerModal(async employeeId => {
    await fillEmployee(employeeId);
    const employee = await fetchEmployeeByNumber(employeeId);
    if (!employee) return;

    // Employee scan succeeds -> immediately open the phone scanner.
    setTimeout(() => {
      openScannerModal(async phoneId => {
        setVal("issue-phone-id", phoneId);
        await completeIssue(employeeId, phoneId);
      }, { mode: "phone", quickOptions: phones });
    }, 250);
  }, { mode: "employee", quickOptions: employees });
}

async function handleIssue(e) {
  e.preventDefault();
  await completeIssue(val("issue-emp-number"), val("issue-phone-id"));
}

async function completeIssue(employeeId, phoneId) {
  try {
    busy(true);
    const id = normalizeEmployeeId(employeeId);
    const phone = normalizePhoneId(phoneId);

    const emp = await fetchEmployeeByNumber(id);
    if (!emp) throw new Error("Employee not found. Add the employee first.");
    if (!phone) throw new Error("Please scan or enter a valid phone ID.");

    await issuePhone({
      phoneId: phone,
      employeeNumber: id,
      employeeName: emp.full_name,
      staffEmail: getCurrentStaff()?.email || "Staff"
    });

    setVal("issue-emp-number", id);
    setVal("issue-emp-name", emp.full_name);
    setVal("issue-phone-id", phone);

    toast(`${phone} issued to ${emp.full_name}.`, "success");
    document.getElementById("form-issue-phone")?.reset();
    await refresh();
    showView("dashboard");
  } catch (err) {
    toast(err.message || "Could not issue phone.", "error");
  } finally {
    busy(false);
  }
}

async function handleReturn(e) {
  e.preventDefault();
  try {
    busy(true);
    const result = await returnPhone({
      phoneId: val("return-phone-id"),
      condition: val("return-condition") || "Good",
      notes: val("return-notes"),
      staffEmail: getCurrentStaff()?.email || "Staff"
    });
    toast(`${result.phoneId} returned successfully.`, "success");
    e.target.reset();
    document.getElementById("return-holder-info").innerHTML = "";
    await refresh();
    showView("dashboard");
  } catch (err) {
    toast(err.message || "Could not return phone.", "error");
  } finally {
    busy(false);
  }
}

async function refresh() {
  try {
    busy(true);
    [phones, employees, transactions] = await Promise.all([
      fetchAllPhones(),
      fetchAllEmployees(),
      fetchTransactions()
    ]);
    renderDashboard();
    renderStatus();
    populateEmployees();
    renderReports();
    renderQRMatrix("qr-matrix-container");
    renderEmployeeQRMatrix("employee-qr-matrix-container", employees);
  } catch (err) {
    console.error(err);
    toast(err.message || "Could not load data.", "error");
  } finally {
    busy(false);
  }
}

function renderDashboard() {
  setText("stat-total", phones.length);
  setText("stat-available", phones.filter(p => p.status === "AVAILABLE").length);
  setText("stat-issued", phones.filter(p => p.status === "ISSUED").length);

  const today = new Date().toISOString().slice(0, 10);
  setText(
    "stat-returned-today",
    transactions.filter(t => t.action === "RETURN" && String(t.timestamp).startsWith(today)).length
  );

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
    <td>${escapeHtml(p.status)}</td>
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
  if (!normalized) {
    setVal("issue-emp-name", "");
    return null;
  }
  try {
    const employee = await fetchEmployeeByNumber(normalized);
    if (!employee) {
      setVal("issue-emp-name", "");
      toast("Employee not found. Please check the QR code.", "warn");
      return null;
    }
    setVal("issue-emp-name", employee.full_name);
    return employee;
  } catch (err) {
    toast(err.message || "Could not find employee.", "error");
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
    <td>${escapeHtml(x.action)}</td>
    <td>${escapeHtml(x.phone_id)}</td>
    <td>${escapeHtml(x.employee_number)}</td>
    <td>${escapeHtml(x.employee_name)}</td>
    <td>${escapeHtml(x.condition || "-")}</td>
    <td>${escapeHtml(x.notes || "-")}</td>
    <td>${escapeHtml(x.staff_email || "Nehan")}</td>
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
  setTimeout(() => d.remove(), 4000);
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
  return m && s !== `EMP-${m[1]}` ? `EMP-${m[1]}` : s;
}
function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
