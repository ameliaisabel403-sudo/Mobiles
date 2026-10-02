export function filterTransactions(rows,{search="",action="ALL"}){
 const q=search.toLowerCase();
 return rows.filter(x=>(action==="ALL"||x.action===action)&&(!q||`${x.employee_number} ${x.employee_name} ${x.phone_id} ${x.staff_email}`.toLowerCase().includes(q)));
}
export function exportToCSV(rows){
 const head=["Date","Action","Phone ID","Employee ID","Employee Name","Condition","Notes","Staff"];
 const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
 const body=rows.map(x=>[x.timestamp,x.action,x.phone_id,x.employee_number,x.employee_name,x.condition,x.notes,x.staff_email].map(esc).join(","));
 const blob=new Blob([[head.join(","),...body].join("\n")],{type:"text/csv;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`phone-tracking-report-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)
}
