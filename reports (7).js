export function filterTransactions(
  rows,
  { search = "", action = "ALL", startDate = "", endDate = "" } = {}
) {
  const q = String(search).trim().toLowerCase();

  return (rows || []).filter(tx => {
    if (action !== "ALL" && tx.action !== action) return false;

    if (q) {
      const haystack = [
        tx.phone_id, tx.employee_number, tx.employee_name, tx.staff_email, tx.notes
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (startDate || endDate) {
      const d = new Date(tx.timestamp);
      if (Number.isNaN(d.getTime())) return false;
      const date = d.toISOString().slice(0, 10);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
    }

    return true;
  });
}

export function exportToCSV(rows, filename = `cinnamon-life-hk-mobile-${new Date().toISOString().slice(0,10)}.csv`) {
  if (!rows?.length) {
    alert("No transactions available to export.");
    return;
  }

  const headers = [
    "Date & Time", "Action", "Phone ID", "Employee Number",
    "Employee Name", "Condition", "Notes", "Staff User"
  ];

  const esc = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const body = rows.map(tx => [
    new Date(tx.timestamp).toLocaleString(),
    tx.action,
    tx.phone_id,
    tx.employee_number,
    tx.employee_name,
    tx.condition || "-",
    tx.notes || "",
    tx.staff_email || "Nehan"
  ].map(esc).join(","));

  const csv = [headers.map(esc).join(","), ...body].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
