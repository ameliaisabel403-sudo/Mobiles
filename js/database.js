/* ==========================================================================
   COMPANY PHONE TRACKER - DATABASE ACCESS LAYER (DAL)
   ========================================================================== */

import { getSupabase, appConfig, getDemoDB, saveDemoDB } from './config.js';
import { getCurrentStaff } from './auth.js';

// Get All Phones List
export async function fetchAllPhones() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('phones')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
      if (error) {
        console.warn('Supabase fetch phones error, falling back to local pool:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch phones network error:', e);
    }
  }

  const db = getDemoDB();
  return (db.phones || []).sort((a, b) => a.id.localeCompare(b.id));
}

// Fetch Phone By ID
export async function fetchPhoneById(phoneId) {
  const cleanId = String(phoneId || '').trim().toUpperCase();
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('phones')
        .select('*')
        .eq('id', cleanId)
        .single();

      if (!error && data) return data;
    } catch (e) {}
  }

  const db = getDemoDB();
  return (db.phones || []).find(p => p.id.toUpperCase() === cleanId) || null;
}

// Fetch Employee By Number
export async function fetchEmployeeByNumber(empNumber) {
  if (!empNumber) return null;
  const cleanNum = String(empNumber).trim().toUpperCase();
  
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .eq('employee_number', cleanNum)
        .single();

      if (!error && data) return data;
    } catch (e) {}
  }

  const db = getDemoDB();
  return (db.employees || []).find(e => e.employee_number.toUpperCase() === cleanNum) || null;
}

// Fetch All Employees
export async function fetchAllEmployees() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .order('employee_number', { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch (e) {}
  }

  const db = getDemoDB();
  return (db.employees || []).sort((a, b) => a.employee_number.localeCompare(b.employee_number));
}

// Save / Upsert Employee
export async function saveEmployee(empData, oldId = null) {
  const cleanNum = String(empData.employee_number || '').trim().toUpperCase();
  const cleanName = String(empData.full_name || '').trim();
  const cleanDept = String(empData.department || 'Operations').trim();
  const cleanPhone = String(empData.phone_number || '').trim();

  if (!cleanNum) throw new Error('Employee number is required.');
  if (!cleanName) throw new Error('Employee name is required.');

  const client = getSupabase();
  const now = new Date().toISOString();

  if (appConfig.isConfigured && client) {
    if (oldId && oldId !== cleanNum) {
      await client.from('employees').delete().eq('employee_number', oldId);
    }
    const { error } = await client
      .from('employees')
      .upsert({
        employee_number: cleanNum,
        full_name: cleanName,
        department: cleanDept,
        phone_number: cleanPhone,
        is_archived: false,
        updated_at: now
      });
    if (error) throw new Error(error.message);
  } else {
    const db = getDemoDB();
    if (oldId && oldId !== cleanNum) {
      db.employees = db.employees.filter(e => e.employee_number !== oldId);
    }
    const idx = db.employees.findIndex(e => e.employee_number === cleanNum);
    if (idx !== -1) {
      db.employees[idx] = { ...db.employees[idx], full_name: cleanName, department: cleanDept, phone_number: cleanPhone, updated_at: now };
    } else {
      db.employees.push({ employee_number: cleanNum, full_name: cleanName, department: cleanDept, phone_number: cleanPhone, created_at: now });
    }
    saveDemoDB(db);
  }
  return { employee_number: cleanNum, full_name: cleanName };
}

// Delete / Archive Employee
export async function deleteEmployee(empNumber) {
  const cleanNum = String(empNumber || '').trim().toUpperCase();
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error } = await client.from('employees').delete().eq('employee_number', cleanNum);
    if (error) throw new Error(error.message);
  } else {
    const db = getDemoDB();
    db.employees = db.employees.filter(e => e.employee_number !== cleanNum);
    saveDemoDB(db);
  }
  return true;
}

// Fetch Transactions
export async function fetchTransactions() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (!error && data) return data;
    } catch (e) {}
  }

  const db = getDemoDB();
  return (db.transactions || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Issue Phone
export async function issuePhone({ phoneId, employeeNumber, employeeName, staffEmail }) {
  const cleanPhone = String(phoneId || '').trim().toUpperCase();
  const cleanEmpNum = String(employeeNumber || '').trim().toUpperCase();
  const now = new Date().toISOString();

  const phone = await fetchPhoneById(cleanPhone);
  if (!phone) throw new Error(`Phone "${cleanPhone}" not registered.`);
  if (phone.status === 'ISSUED') {
    throw new Error(`Phone ${cleanPhone} is already issued to ${phone.current_employee_name || phone.current_employee_id}. Return it first.`);
  }

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error: phoneErr } = await client
      .from('phones')
      .update({
        status: 'ISSUED',
        current_employee_id: cleanEmpNum,
        current_employee_name: employeeName,
        last_issue_time: now,
        updated_at: now
      })
      .eq('id', cleanPhone);

    if (phoneErr) throw new Error('Failed to update phone: ' + phoneErr.message);

    await client.from('transactions').insert({
      action: 'ISSUE',
      phone_id: cleanPhone,
      employee_number: cleanEmpNum,
      employee_name: employeeName,
      condition: phone.condition || 'Good',
      notes: 'Shift hand-off',
      staff_email: staffEmail || 'Staff',
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    const idx = db.phones.findIndex(p => p.id.toUpperCase() === cleanPhone);
    if (idx !== -1) {
      db.phones[idx].status = 'ISSUED';
      db.phones[idx].current_employee_id = cleanEmpNum;
      db.phones[idx].current_employee_name = employeeName;
      db.phones[idx].last_issue_time = now;
      db.phones[idx].updated_at = now;
    }
    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'ISSUE',
      phone_id: cleanPhone,
      employee_number: cleanEmpNum,
      employee_name: employeeName,
      condition: phone.condition || 'Good',
      notes: 'Shift hand-off',
      staff_email: staffEmail || 'Staff'
    });
    saveDemoDB(db);
  }

  return { phoneId: cleanPhone, employeeNumber: cleanEmpNum, employeeName };
}

// Return Phone
export async function returnPhone({ phoneId, condition = 'Good', notes = '', staffEmail }) {
  const cleanPhone = String(phoneId || '').trim().toUpperCase();
  const now = new Date().toISOString();

  const phone = await fetchPhoneById(cleanPhone);
  if (!phone) throw new Error(`Phone "${cleanPhone}" not found.`);

  const returningEmpNum = phone.current_employee_id || 'UNKNOWN';
  const returningEmpName = phone.current_employee_name || 'Shift Staff';

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error: phoneErr } = await client
      .from('phones')
      .update({
        status: 'AVAILABLE',
        current_employee_id: null,
        current_employee_name: null,
        condition: condition,
        last_return_time: now,
        updated_at: now
      })
      .eq('id', cleanPhone);

    if (phoneErr) throw new Error('Failed to return phone: ' + phoneErr.message);

    await client.from('transactions').insert({
      action: 'RETURN',
      phone_id: cleanPhone,
      employee_number: returningEmpNum,
      employee_name: returningEmpName,
      condition: condition,
      notes: notes,
      staff_email: staffEmail || 'Staff',
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    const idx = db.phones.findIndex(p => p.id.toUpperCase() === cleanPhone);
    if (idx !== -1) {
      db.phones[idx].status = 'AVAILABLE';
      db.phones[idx].current_employee_id = null;
      db.phones[idx].current_employee_name = null;
      db.phones[idx].condition = condition;
      db.phones[idx].last_return_time = now;
      db.phones[idx].updated_at = now;
    }
    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'RETURN',
      phone_id: cleanPhone,
      employee_number: returningEmpNum,
      employee_name: returningEmpName,
      condition: condition,
      notes: notes,
      staff_email: staffEmail || 'Staff'
    });
    saveDemoDB(db);
  }

  return { phoneId: cleanPhone, condition };
}

// Add New Phone QR Code
export async function addNewPhoneQR({ phoneId }) {
  const cleanPhone = String(phoneId || '').trim().toUpperCase();
  if (!cleanPhone) throw new Error('Phone ID is required.');

  const existing = await fetchPhoneById(cleanPhone);
  if (existing) throw new Error(`Phone "${cleanPhone}" already exists.`);

  const now = new Date().toISOString();
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error } = await client.from('phones').insert({
      id: cleanPhone,
      status: 'AVAILABLE',
      condition: 'Good',
      created_at: now
    });
    if (error) throw new Error(error.message);
  } else {
    const db = getDemoDB();
    db.phones.push({ id: cleanPhone, status: 'AVAILABLE', condition: 'Good', created_at: now });
    saveDemoDB(db);
  }
  return { id: cleanPhone };
}

// Remove Phone QR Code
export async function removePhoneQR(phoneId, reason = 'Removed') {
  const cleanPhone = String(phoneId || '').trim().toUpperCase();
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    await client.from('phones').update({ is_archived: true }).eq('id', cleanPhone);
  } else {
    const db = getDemoDB();
    const idx = db.phones.findIndex(p => p.id.toUpperCase() === cleanPhone);
    if (idx !== -1) db.phones[idx].is_archived = true;
    saveDemoDB(db);
  }
  return true;
}

// Replace Phone QR Code
export async function replacePhoneQR({ previousPhoneId, newPhoneId, reason = 'Replaced' }) {
  const cleanPrev = String(previousPhoneId || '').trim().toUpperCase();
  const cleanNew = String(newPhoneId || '').trim().toUpperCase();
  await removePhoneQR(cleanPrev, reason);
  await addNewPhoneQR({ phoneId: cleanNew });
  return { previousPhoneId: cleanPrev, newPhoneId: cleanNew };
}

// Add New Employee QR
export async function addNewEmployeeQR({ employeeNumber, fullName, department = 'Operations' }) {
  return await saveEmployee({ employee_number: employeeNumber, full_name: fullName, department });
}

// Remove Employee QR
export async function removeEmployeeQR(employeeNumber, reason = 'Removed') {
  return await deleteEmployee(employeeNumber);
}

// Replace Employee QR
export async function replaceEmployeeQR({ previousEmployeeNumber, newEmployeeNumber, newFullName, department = 'Operations' }) {
  await deleteEmployee(previousEmployeeNumber);
  return await saveEmployee({
    employee_number: newEmployeeNumber,
    full_name: newFullName,
    department: department
  });
}
