/* ==========================================================================
   COMPANY PHONE TRACKER - DATABASE ACCESS LAYER (DAL)
   ========================================================================== */

import { getSupabase, appConfig, getDemoDB, saveDemoDB } from './config.js';
import { getCurrentStaff } from './auth.js';

// Get All Phones List
export async function fetchAllPhones() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { data, error } = await client
      .from('phones')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw new Error('Error fetching phones: ' + error.message);
    return data || [];
  } else {
    const db = getDemoDB();
    return db.phones.sort((a, b) => a.id.localeCompare(b.id));
  }
}

// Fetch Phone By ID
export async function fetchPhoneById(phoneId) {
  const cleanId = phoneId.trim().toUpperCase();
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { data, error } = await client
      .from('phones')
      .select('*')
      .eq('id', cleanId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error('Error finding phone: ' + error.message);
    }
    return data || null;
  } else {
    const db = getDemoDB();
    return db.phones.find(p => p.id.toUpperCase() === cleanId) || null;
  }
}

// Fetch Employee By Number
export async function fetchEmployeeByNumber(empNumber) {
  if (!empNumber) return null;
  const cleanNum = empNumber.trim().toUpperCase();
  
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { data, error } = await client
      .from('employees')
      .select('*')
      .eq('employee_number', cleanNum)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('Employee lookup note:', error.message);
    }
    return data || null;
  } else {
    const db = getDemoDB();
    return db.employees.find(e => e.employee_number.toUpperCase() === cleanNum) || null;
  }
}

// Fetch All Employees List
export async function fetchAllEmployees() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { data, error } = await client
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } else {
    const db = getDemoDB();
    return db.employees;
  }
}

// Fetch Transactions Log History
export async function fetchTransactions() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw new Error('Error loading transaction history: ' + error.message);
    return data || [];
  } else {
    const db = getDemoDB();
    return (db.transactions || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

// ==========================================================================
// WORKFLOW 1: ISSUE PHONE
// ==========================================================================
export async function issuePhone({ phoneId, employeeNumber, employeeName }) {
  const cleanPhoneId = phoneId ? phoneId.trim().toUpperCase() : '';
  const cleanEmpNum = employeeNumber ? employeeNumber.trim().toUpperCase() : '';
  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'staff@company.com';

  if (!cleanPhoneId) throw new Error('Phone ID is required.');
  if (!cleanEmpNum) throw new Error('Employee Number is required.');

  // 1. Verify Phone state
  const phone = await fetchPhoneById(cleanPhoneId);
  if (!phone) {
    throw new Error(`Phone ID "${cleanPhoneId}" does not exist in the system.`);
  }

  // Duplicate Check: Cannot issue an already issued phone!
  if (phone.status === 'ISSUED') {
    const holder = phone.current_employee_name || phone.current_employee_id || 'another employee';
    throw new Error(`Cannot Issue! ${cleanPhoneId} is already ISSUED to ${holder}.`);
  }

  // 2. Resolve Employee Name
  let finalEmpName = employeeName ? employeeName.trim() : '';
  if (!finalEmpName) {
    const emp = await fetchEmployeeByNumber(cleanEmpNum);
    finalEmpName = emp ? emp.full_name : `Employee ${cleanEmpNum}`;
  }

  const now = new Date().toISOString();

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    // Update phone record
    const { error: updateErr } = await client
      .from('phones')
      .update({
        status: 'ISSUED',
        current_employee_id: cleanEmpNum,
        current_employee_name: finalEmpName,
        last_issue_time: now,
        updated_at: now
      })
      .eq('id', cleanPhoneId);

    if (updateErr) throw new Error('Failed to update phone status: ' + updateErr.message);

    // Insert transaction log
    const { error: txErr } = await client
      .from('transactions')
      .insert({
        action: 'ISSUE',
        phone_id: cleanPhoneId,
        employee_number: cleanEmpNum,
        employee_name: finalEmpName,
        staff_email: staffEmail,
        timestamp: now
      });

    if (txErr) console.error('Transaction log insertion note:', txErr.message);

  } else {
    // Demo Mode Local DB Execution
    const db = getDemoDB();
    const phoneIdx = db.phones.findIndex(p => p.id.toUpperCase() === cleanPhoneId);
    if (phoneIdx !== -1) {
      db.phones[phoneIdx].status = 'ISSUED';
      db.phones[phoneIdx].current_employee_id = cleanEmpNum;
      db.phones[phoneIdx].current_employee_name = finalEmpName;
      db.phones[phoneIdx].last_issue_time = now;
      db.phones[phoneIdx].updated_at = now;
    }

    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'ISSUE',
      phone_id: cleanPhoneId,
      employee_number: cleanEmpNum,
      employee_name: finalEmpName,
      condition: phone ? phone.condition : 'Good',
      staff_email: staffEmail
    });

    saveDemoDB(db);
  }

  return {
    phoneId: cleanPhoneId,
    employeeNumber: cleanEmpNum,
    employeeName: finalEmpName,
    timestamp: now
  };
}

// ==========================================================================
// WORKFLOW 2: RETURN PHONE
// ==========================================================================
export async function returnPhone({ phoneId, condition = 'Good', notes = '' }) {
  const cleanPhoneId = phoneId ? phoneId.trim().toUpperCase() : '';
  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'staff@company.com';

  if (!cleanPhoneId) throw new Error('Phone ID is required for return.');

  // 1. Fetch Phone to auto-identify current employee & check status
  const phone = await fetchPhoneById(cleanPhoneId);
  if (!phone) {
    throw new Error(`Phone ID "${cleanPhoneId}" does not exist in the system.`);
  }

  // Duplicate Check: Cannot return an available phone!
  if (phone.status === 'AVAILABLE') {
    throw new Error(`Cannot Return! ${cleanPhoneId} is already marked AVAILABLE.`);
  }

  const assignedEmpNum = phone.current_employee_id || 'UNKNOWN';
  const assignedEmpName = phone.current_employee_name || 'Unassigned Staff';
  const now = new Date().toISOString();

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    // Update phone record to AVAILABLE
    const { error: updateErr } = await client
      .from('phones')
      .update({
        status: 'AVAILABLE',
        condition: condition,
        last_return_time: now,
        current_employee_id: null,
        current_employee_name: null,
        updated_at: now
      })
      .eq('id', cleanPhoneId);

    if (updateErr) throw new Error('Failed to update phone return: ' + updateErr.message);

    // Insert transaction log
    const { error: txErr } = await client
      .from('transactions')
      .insert({
        action: 'RETURN',
        phone_id: cleanPhoneId,
        employee_number: assignedEmpNum,
        employee_name: assignedEmpName,
        condition: condition,
        notes: notes ? notes.trim() : null,
        staff_email: staffEmail,
        timestamp: now
      });

    if (txErr) console.error('Transaction log insertion note:', txErr.message);

  } else {
    // Demo Mode Local DB Execution
    const db = getDemoDB();
    const phoneIdx = db.phones.findIndex(p => p.id.toUpperCase() === cleanPhoneId);
    if (phoneIdx !== -1) {
      db.phones[phoneIdx].status = 'AVAILABLE';
      db.phones[phoneIdx].condition = condition;
      db.phones[phoneIdx].last_return_time = now;
      db.phones[phoneIdx].current_employee_id = null;
      db.phones[phoneIdx].current_employee_name = null;
      db.phones[phoneIdx].updated_at = now;
    }

    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'RETURN',
      phone_id: cleanPhoneId,
      employee_number: assignedEmpNum,
      employee_name: assignedEmpName,
      condition: condition,
      notes: notes ? notes.trim() : '',
      staff_email: staffEmail
    });

    saveDemoDB(db);
  }

  return {
    phoneId: cleanPhoneId,
    employeeNumber: assignedEmpNum,
    employeeName: assignedEmpName,
    condition,
    timestamp: now
  };
}
