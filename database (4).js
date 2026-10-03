import { getSupabase, appConfig } from "./config.js";

const PHONE_KEY = "phone_tracker_phones_v2";
const EMP_KEY = "phone_tracker_employees_v2";
const TX_KEY = "phone_tracker_transactions_v2";

const seedPhones = Array.from({ length: 20 }, (_, i) => ({
  id: `PHONE-${String(i + 1).padStart(3, "0")}`,
  status: "AVAILABLE",
  current_employee_id: null,
  current_employee_name: null,
  last_issue_time: null,
  last_return_time: null,
  condition: "Good"
}));

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function demoInit() {
  if (!localStorage.getItem(PHONE_KEY)) write(PHONE_KEY, seedPhones);
  if (!localStorage.getItem(EMP_KEY)) write(EMP_KEY, []);
  if (!localStorage.getItem(TX_KEY)) write(TX_KEY, []);
}
function fail(message) { throw new Error(message); }

async function query(table, operation, payload = {}) {
  const sb = getSupabase();
  if (!sb) return null;

  if (operation === "select")
    return sb.from(table).select("*").order(payload.order || "created_at", { ascending: payload.asc ?? true });
  if (operation === "one")
    return sb.from(table).select("*").eq(payload.field, payload.value).maybeSingle();
  if (operation === "insert")
    return sb.from(table).insert(payload.data).select().single();
  if (operation === "upsert")
    return sb.from(table).upsert(payload.data, { onConflict: payload.onConflict }).select().single();
  if (operation === "update")
    return sb.from(table).update(payload.data).eq(payload.field, payload.value).select().single();
  if (operation === "delete")
    return sb.from(table).delete().eq(payload.field, payload.value);
}

export async function fetchAllPhones() {
  demoInit();
  if (!appConfig.isConfigured) return read(PHONE_KEY, seedPhones);
  const r = await query("phones", "select", { order: "id", asc: true });
  if (r.error) throw r.error;
  return r.data || [];
}

export async function fetchAllEmployees() {
  demoInit();
  if (!appConfig.isConfigured) return read(EMP_KEY, []);
  const r = await query("employees", "select", { order: "employee_number", asc: true });
  if (r.error) throw r.error;
  return r.data || [];
}

export async function fetchEmployeeByNumber(id) {
  id = String(id || "").trim().toUpperCase();
  if (!id) return null;

  if (!appConfig.isConfigured)
    return read(EMP_KEY, []).find(e => e.employee_number === id) || null;

  const r = await query("employees", "one", { field: "employee_number", value: id });
  if (r.error) throw r.error;
  return r.data || null;
}

export async function fetchTransactions() {
  demoInit();
  if (!appConfig.isConfigured) return read(TX_KEY, []);

  const r = await query("transactions", "select", { order: "timestamp", asc: false });
  if (r.error) throw r.error;
  return r.data || [];
}

export async function saveEmployee(data, oldId = "") {
  const id = String(data.employee_number || "").trim().toUpperCase();
  const clean = {
    employee_number: id,
    full_name: String(data.full_name || "").trim(),
    department: String(data.department || "Housekeeping").trim(),
    phone_number: String(data.phone_number || "").trim()
  };

  if (!id || !clean.full_name) fail("Employee ID and name are required.");

  const existing = await fetchEmployeeByNumber(id);
  if (existing && id !== String(oldId || "").trim().toUpperCase())
    fail("That Employee ID already exists.");

  if (appConfig.isConfigured) {
    if (oldId && String(oldId).trim().toUpperCase() !== id) {
      const d = await query("employees", "delete", {
        field: "employee_number",
        value: String(oldId).trim().toUpperCase()
      });
      if (d.error) throw d.error;
    }
    const r = await query("employees", "upsert", {
      data: clean,
      onConflict: "employee_number"
    });
    if (r.error) throw r.error;
    return r.data;
  }

  const list = read(EMP_KEY, []);
  const old = String(oldId || "").trim().toUpperCase();
  const idx = list.findIndex(e => e.employee_number === old);
  if (idx >= 0) list[idx] = clean;
  else list.push(clean);
  write(EMP_KEY, list);
  return clean;
}

export async function deleteEmployee(id) {
  id = String(id || "").trim().toUpperCase();
  const phones = await fetchAllPhones();
  if (phones.some(p => p.current_employee_id === id))
    fail("Cannot delete an employee who currently has a phone issued.");

  if (appConfig.isConfigured) {
    const r = await query("employees", "delete", { field: "employee_number", value: id });
    if (r.error) throw r.error;
    return;
  }

  write(EMP_KEY, read(EMP_KEY, []).filter(e => e.employee_number !== id));
}

export async function issuePhone({ phoneId, employeeNumber, employeeName, staffEmail = "Nehan" }) {
  phoneId = String(phoneId || "").trim().toUpperCase();
  employeeNumber = String(employeeNumber || "").trim().toUpperCase();

  const emp = await fetchEmployeeByNumber(employeeNumber);
  if (!emp) fail("Employee not found. Add the employee first.");

  const phones = await fetchAllPhones();
  const phone = phones.find(p => p.id === phoneId);
  if (!phone) fail("Phone not found.");
  if (phone.status === "ISSUED") fail("Phone is already issued.");

  const now = new Date().toISOString();
  const tx = {
    timestamp: now,
    action: "ISSUE",
    phone_id: phoneId,
    employee_number: employeeNumber,
    employee_name: emp.full_name,
    condition: phone.condition || "Good",
    notes: "",
    staff_email: staffEmail || "Nehan"
  };

  if (appConfig.isConfigured) {
    const u = await query("phones", "update", {
      field: "id",
      value: phoneId,
      data: {
        status: "ISSUED",
        current_employee_id: employeeNumber,
        current_employee_name: emp.full_name,
        last_issue_time: now,
        updated_at: now
      }
    });
    if (u.error) throw u.error;

    const t = await query("transactions", "insert", { data: tx });
    if (t.error) {
      // Best-effort rollback if the transaction log insert fails.
      await query("phones", "update", {
        field: "id",
        value: phoneId,
        data: {
          status: "AVAILABLE",
          current_employee_id: null,
          current_employee_name: null,
          updated_at: new Date().toISOString()
        }
      });
      throw t.error;
    }
  } else {
    phone.status = "ISSUED";
    phone.current_employee_id = employeeNumber;
    phone.current_employee_name = emp.full_name;
    phone.last_issue_time = now;
    write(PHONE_KEY, phones);

    const list = read(TX_KEY, []);
    list.unshift({ id: crypto.randomUUID(), ...tx });
    write(TX_KEY, list);
  }

  return { phoneId, employeeName: emp.full_name };
}

export async function returnPhone({ phoneId, condition = "Good", notes = "", staffEmail = "Nehan" }) {
  phoneId = String(phoneId || "").trim().toUpperCase();

  const phones = await fetchAllPhones();
  const phone = phones.find(p => p.id === phoneId);
  if (!phone) fail("Phone not found.");
  if (phone.status !== "ISSUED") fail("This phone is not currently issued.");

  const now = new Date().toISOString();
  const tx = {
    timestamp: now,
    action: "RETURN",
    phone_id: phoneId,
    employee_number: phone.current_employee_id,
    employee_name: phone.current_employee_name,
    condition,
    notes: String(notes || "").trim(),
    staff_email: staffEmail || "Nehan"
  };

  if (appConfig.isConfigured) {
    const u = await query("phones", "update", {
      field: "id",
      value: phoneId,
      data: {
        status: "AVAILABLE",
        current_employee_id: null,
        current_employee_name: null,
        last_return_time: now,
        condition,
        updated_at: now
      }
    });
    if (u.error) throw u.error;

    const t = await query("transactions", "insert", { data: tx });
    if (t.error) {
      // Best-effort rollback: restore phone to ISSUED if transaction log fails.
      await query("phones", "update", {
        field: "id",
        value: phoneId,
        data: {
          status: "ISSUED",
          current_employee_id: tx.employee_number,
          current_employee_name: tx.employee_name,
          last_return_time: null,
          updated_at: new Date().toISOString()
        }
      });
      throw t.error;
    }
  } else {
    phone.status = "AVAILABLE";
    phone.current_employee_id = null;
    phone.current_employee_name = null;
    phone.last_return_time = now;
    phone.condition = condition;
    write(PHONE_KEY, phones);

    const list = read(TX_KEY, []);
    list.unshift({ id: crypto.randomUUID(), ...tx });
    write(TX_KEY, list);
  }

  return { phoneId, condition };
}
