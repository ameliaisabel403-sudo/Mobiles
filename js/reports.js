/* ==========================================================================
   COMPANY PHONE TRACKER - REPORTS & CSV EXPORT MODULE
   ========================================================================== */

// Filter Transactions List based on search inputs
export function filterTransactions(transactions, { search = '', action = 'ALL', startDate = '', endDate = '' }) {
  if (!transactions) return [];

  const cleanSearch = search.trim().toLowerCase();

  return transactions.filter(tx => {
    // 1. Action Filter
    if (action !== 'ALL' && tx.action !== action) {
      return false;
    }

    // 2. Search Text Filter (Phone ID, Employee Number, Employee Name, Staff Email)
    if (cleanSearch) {
      const matchPhone = (tx.phone_id || '').toLowerCase().includes(cleanSearch);
      const matchEmpNum = (tx.employee_number || '').toLowerCase().includes(cleanSearch);
      const matchEmpName = (tx.employee_name || '').toLowerCase().includes(cleanSearch);
      const matchStaff = (tx.staff_email || '').toLowerCase().includes(cleanSearch);

      if (!matchPhone && !matchEmpNum && !matchEmpName && !matchStaff) {
        return false;
      }
    }

    // 3. Date Range Filter
    if (startDate) {
      const txDate = new Date(tx.timestamp).toISOString().split('T')[0];
      if (txDate < startDate) return false;
    }
    if (endDate) {
      const txDate = new Date(tx.timestamp).toISOString().split('T')[0];
      if (txDate > endDate) return false;
    }

    return true;
  });
}

// Generate CSV string & Download File
export function exportToCSV(transactions, filename = 'phone-tracker-transactions.csv') {
  if (!transactions || transactions.length === 0) {
    alert('No transactions available to export.');
    return;
  }

  // CSV Headers
  const headers = [
    'Date & Time',
    'Action',
    'Phone ID',
    'Employee Number',
    'Employee Name',
    'Condition',
    'Notes',
    'Staff User'
  ];

  // Map rows
  const rows = transactions.map(tx => [
    new Date(tx.timestamp).toLocaleString(),
    tx.action,
    tx.phone_id,
    tx.employee_number,
    `"${(tx.employee_name || '').replace(/"/g, '""')}"`,
    tx.condition || '-',
    `"${(tx.notes || '').replace(/"/g, '""')}"`,
    tx.staff_email || 'System'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  // Trigger Download Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
