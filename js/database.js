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

// Fetch All Employees List
export async function fetchAllEmployees() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
      if (error) {
        console.warn('Supabase fetch employees error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch employees error:', e);
    }
  }

  const db = getDemoDB();
  return db.employees || [];
}

// Fetch Transactions Log History
export async function fetchTransactions() {
  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
      if (error) {
        console.warn('Supabase fetch transactions error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch transactions error:', e);
    }
  }

  const db = getDemoDB();
  return (db.transactions || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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

// ==========================================================================
// WORKFLOW 3: PHONE QR CODE MANAGEMENT (ADD, REMOVE, REPLACE)
// ==========================================================================

// Add New Phone QR Code
export async function addNewPhoneQR({ phoneId, condition = 'Good' }) {
  const cleanId = String(phoneId || '').trim().toUpperCase();
  if (!cleanId) throw new Error('Phone ID is required (e.g. PHONE-021).');

  const existing = await fetchPhoneById(cleanId);
  if (existing) {
    if (existing.is_archived) {
      // Unarchive
      return reactivatePhoneQR(cleanId);
    }
    throw new Error(`Phone QR Code "${cleanId}" already exists!`);
  }

  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'Nehan';
  const now = new Date().toISOString();

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error: insErr } = await client
      .from('phones')
      .insert({
        id: cleanId,
        status: 'AVAILABLE',
        condition: condition,
        is_archived: false,
        created_at: now,
        updated_at: now
      });

    if (insErr) throw new Error('Failed to add new phone QR: ' + insErr.message);

    await client.from('transactions').insert({
      action: 'ADD_PHONE_QR',
      phone_id: cleanId,
      employee_number: 'SYSTEM',
      employee_name: 'Inventory Added',
      condition: condition,
      notes: `New Phone QR Code added: ${cleanId}`,
      staff_email: staffEmail,
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    db.phones.push({
      id: cleanId,
      status: 'AVAILABLE',
      current_employee_id: null,
      current_employee_name: null,
      last_issue_time: null,
      last_return_time: null,
      condition: condition,
      is_archived: false,
      updated_at: now
    });

    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'ADD_PHONE_QR',
      phone_id: cleanId,
      employee_number: 'SYSTEM',
      employee_name: 'Inventory Added',
      condition: condition,
      notes: `New Phone QR Code added: ${cleanId}`,
      staff_email: staffEmail
    });

    saveDemoDB(db);
  }

  return { id: cleanId, status: 'AVAILABLE' };
}

// Remove Previous Phone QR Code (Soft delete/archive so history is preserved)
export async function removePhoneQR(phoneId, reason = 'Decommissioned / Removed') {
  const cleanId = String(phoneId || '').trim().toUpperCase();
  if (!cleanId) throw new Error('Phone ID is required to remove.');

  const phone = await fetchPhoneById(cleanId);
  if (!phone) throw new Error(`Phone "${cleanId}" not found.`);

  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'Nehan';
  const now = new Date().toISOString();

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error: updErr } = await client
      .from('phones')
      .update({
        status: 'AVAILABLE',
        is_archived: true,
        current_employee_id: null,
        current_employee_name: null,
        updated_at: now
      })
      .eq('id', cleanId);

    if (updErr) throw new Error('Failed to remove phone QR: ' + updErr.message);

    await client.from('transactions').insert({
      action: 'REMOVE_PHONE_QR',
      phone_id: cleanId,
      employee_number: phone.current_employee_id || 'SYSTEM',
      employee_name: phone.current_employee_name || 'Archived',
      condition: phone.condition || 'Good',
      notes: `Phone QR Code removed from active pool. Reason: ${reason}. Previous history preserved.`,
      staff_email: staffEmail,
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    const idx = db.phones.findIndex(p => p.id.toUpperCase() === cleanId);
    if (idx !== -1) {
      db.phones[idx].is_archived = true;
      db.phones[idx].current_employee_id = null;
      db.phones[idx].current_employee_name = null;
      db.phones[idx].updated_at = now;
    }

    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'REMOVE_PHONE_QR',
      phone_id: cleanId,
      employee_number: phone.current_employee_id || 'SYSTEM',
      employee_name: phone.current_employee_name || 'Archived',
      condition: phone.condition || 'Good',
      notes: `Phone QR Code removed from active pool. Reason: ${reason}. Previous history preserved.`,
      staff_email: staffEmail
    });

    saveDemoDB(db);
  }

  return { id: cleanId, removed: true };
}

// Replace Phone QR Code (Archives previous phone, adds/assigns new phone QR, keeps full historical log)
export async function replacePhoneQR({ previousPhoneId, newPhoneId, reason = 'Device Replacement' }) {
  const cleanPrev = String(previousPhoneId || '').trim().toUpperCase();
  const cleanNew = String(newPhoneId || '').trim().toUpperCase();

  if (!cleanPrev || !cleanNew) {
    throw new Error('Both Previous Phone QR and New Phone QR are required.');
  }

  if (cleanPrev === cleanNew) {
    throw new Error('New Phone QR must be different from Previous Phone QR.');
  }

  const prevPhone = await fetchPhoneById(cleanPrev);
  if (!prevPhone) throw new Error(`Previous Phone "${cleanPrev}" not found.`);

  const currentHolderId = prevPhone.current_employee_id;
  const currentHolderName = prevPhone.current_employee_name;

  // 1. Remove/Archive previous phone QR
  await removePhoneQR(cleanPrev, `Replaced by ${cleanNew}. Reason: ${reason}`);

  // 2. Add or Activate new phone QR
  const newPhoneExists = await fetchPhoneById(cleanNew);
  if (!newPhoneExists) {
    await addNewPhoneQR({ phoneId: cleanNew });
  }

  // 3. If previous phone was issued to an employee, automatically issue the new phone to that employee!
  if (currentHolderId) {
    await issuePhone({
      phoneId: cleanNew,
      employeeNumber: currentHolderId,
      employeeName: currentHolderName
    });
  }

  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'Nehan';
  const now = new Date().toISOString();

  const client = getSupabase();
  const notesLog = `Replaced Phone QR Code: [${cleanPrev}] ➔ [${cleanNew}] for employee [${currentHolderId || 'None'}]. Previous logs preserved.`;

  if (appConfig.isConfigured && client) {
    await client.from('transactions').insert({
      action: 'REPLACE_PHONE_QR',
      phone_id: cleanNew,
      employee_number: currentHolderId || 'SYSTEM',
      employee_name: currentHolderName || 'Staff',
      notes: notesLog,
      staff_email: staffEmail,
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'REPLACE_PHONE_QR',
      phone_id: cleanNew,
      employee_number: currentHolderId || 'SYSTEM',
      employee_name: currentHolderName || 'Staff',
      notes: notesLog,
      staff_email: staffEmail
    });
    saveDemoDB(db);
  }

  return { previousPhoneId: cleanPrev, newPhoneId: cleanNew, holder: currentHolderName };
}

// Reactivate an archived Phone QR
async function reactivatePhoneQR(phoneId) {
  const client = getSupabase();
  const now = new Date().toISOString();
  if (appConfig.isConfigured && client) {
    await client
      .from('phones')
      .update({ is_archived: false, status: 'AVAILABLE', updated_at: now })
      .eq('id', phoneId);
  } else {
    const db = getDemoDB();
    const idx = db.phones.findIndex(p => p.id.toUpperCase() === phoneId);
    if (idx !== -1) {
      db.phones[idx].is_archived = false;
      db.phones[idx].status = 'AVAILABLE';
      db.phones[idx].updated_at = now;
      saveDemoDB(db);
    }
  }
  return { id: phoneId, status: 'AVAILABLE' };
}

// ==========================================================================
// WORKFLOW 4: EMPLOYEE QR CODE MANAGEMENT (ADD, REMOVE, REPLACE)
// ==========================================================================

// Add New Employee QR Code
export async function addNewEmployeeQR({ employeeNumber, fullName, department = 'Operations' }) {
  const cleanEmpNum = String(employeeNumber || '').trim().toUpperCase();
  const cleanName = String(fullName || '').trim();
  const cleanDept = String(department || 'Operations').trim();

  if (!cleanEmpNum) throw new Error('Employee Number is required (e.g. EMP-1011).');
  if (!cleanName) throw new Error('Employee Full Name is required.');

  const existing = await fetchEmployeeByNumber(cleanEmpNum);
  if (existing) {
    throw new Error(`Employee QR Code "${cleanEmpNum}" already exists (${existing.full_name})!`);
  }

  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'Nehan';
  const now = new Date().toISOString();

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error: insErr } = await client
      .from('employees')
      .insert({
        employee_number: cleanEmpNum,
        full_name: cleanName,
        department: cleanDept,
        is_archived: false,
        created_at: now
      });

    if (insErr) throw new Error('Failed to add employee QR: ' + insErr.message);

    await client.from('transactions').insert({
      action: 'ADD_EMPLOYEE_QR',
      phone_id: 'SYSTEM',
      employee_number: cleanEmpNum,
      employee_name: cleanName,
      notes: `New Employee QR Code registered: ${cleanEmpNum} (${cleanName})`,
      staff_email: staffEmail,
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    db.employees.push({
      employee_number: cleanEmpNum,
      full_name: cleanName,
      department: cleanDept,
      is_archived: false
    });

    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'ADD_EMPLOYEE_QR',
      phone_id: 'SYSTEM',
      employee_number: cleanEmpNum,
      employee_name: cleanName,
      notes: `New Employee QR Code registered: ${cleanEmpNum} (${cleanName})`,
      staff_email: staffEmail
    });

    saveDemoDB(db);
  }

  return { employee_number: cleanEmpNum, full_name: cleanName, department: cleanDept };
}

// Remove Previous Employee QR Code (Archive employee, preserving all past shift logs)
export async function removeEmployeeQR(employeeNumber, reason = 'Former Employee / Decommissioned') {
  const cleanEmpNum = String(employeeNumber || '').trim().toUpperCase();
  if (!cleanEmpNum) throw new Error('Employee Number is required.');

  const emp = await fetchEmployeeByNumber(cleanEmpNum);
  if (!emp) throw new Error(`Employee "${cleanEmpNum}" not found.`);

  const staff = getCurrentStaff();
  const staffEmail = staff ? staff.email : 'Nehan';
  const now = new Date().toISOString();

  const client = getSupabase();
  if (appConfig.isConfigured && client) {
    const { error: updErr } = await client
      .from('employees')
      .update({ is_archived: true })
      .eq('employee_number', cleanEmpNum);

    if (updErr) throw new Error('Failed to remove employee QR: ' + updErr.message);

    await client.from('transactions').insert({
      action: 'REMOVE_EMPLOYEE_QR',
      phone_id: 'SYSTEM',
      employee_number: cleanEmpNum,
      employee_name: emp.full_name || 'Staff',
      notes: `Employee QR Code archived. Reason: ${reason}. Past logs preserved.`,
      staff_email: staffEmail,
      timestamp: now
    });
  } else {
    const db = getDemoDB();
    const idx = db.employees.findIndex(e => e.employee_number.toUpperCase() === cleanEmpNum);
    if (idx !== -1) {
      db.employees[idx].is_archived = true;
    }

    db.transactions.unshift({
      id: 'tx-' + Date.now(),
      timestamp: now,
      action: 'REMOVE_EMPLOYEE_QR',
      phone_id: 'SYSTEM',
      employee_number: cleanEmpNum,
      employee_name: emp.full_name || 'Staff',
      notes: `Employee QR Code archived. Reason: ${reason}. Past logs preserved.`,
      staff_email: staffEmail
    });

    saveDemoDB(db);
  }

  return { employee_number: cleanEmpNum, removed: true };
}

// Replace Employee QR Code (Archives previous employee badge, transfers or sets up new QR badge)
export async function replaceEmployeeQR({ previousEmployeeNumber, newEmployeeNumber, newFullName, department = 'Operations' }) {
  const cleanPrev = String(previousEmployeeNumber || '').trim().toUpperCase();
  const cleanNew = String(newEmployeeNumber || '').trim().toUpperCase();
  const cleanName = String(newFullName || '').trim();

  if (!cleanPrev || !cleanNew) {
    throw new Error('Both Previous Employee Number and New Employee Number are required.');
  }

  const prevEmp = await fetchEmployeeByNumber(cleanPrev);
  if (!prevEmp) throw new Error(`Previous Employee "${cleanPrev}" not found.`);

  const targetName = cleanName || prevEmp.full_name;

  // 1. Remove / archive previous employee QR badge
  await removeEmployeeQR(cleanPrev, `Replaced by ${cleanNew} (${targetName})`);

  // 2. Add new employee QR badge if doesn't exist
  const existingNew = await fetchEmployeeByNumber(cleanNew);
  if (!existingNew) {
    await addNewEmployeeQR({
      employeeNumber: cleanNew,
      fullName: targetName,
      department: department || prevEmp.department || 'Operations'
    });
  }

  return { previousEmployeeNumber: cleanPrev, newEmployeeNumber: cleanNew, name: targetName };
}
