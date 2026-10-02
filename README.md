# Company Phone Tracking System

## What is included

- 20 company phone records: PHONE-001 to PHONE-020
- Employee Management
- Add employee with Employee ID, name, department and phone
- Employee QR generated automatically after saving
- Edit and remove employees
- Employee QR scanning
- Phone QR scanning
- Issue phone workflow
- Return phone workflow
- Phone status
- Reports
- CSV export
- Supabase database support
- Demo/local mode when Supabase is not configured
- Vercel-ready static website

## Supabase

1. Open Supabase SQL Editor.
2. Run `schema.sql`.
3. Open the website.
4. Click Settings.
5. Enter Supabase Project URL and public anon key.
6. Save & Connect.

Do not use a service_role key in the browser.

## Vercel

Upload the complete project folder to Vercel. The root file is `index.html`.

## Employee workflow

1. Open Employees.
2. Enter Employee ID, name and department.
3. Click Save Employee & Generate QR.
4. Open Employee QR to print the QR.
5. Open Issue Phone.
6. Scan Employee QR.
7. Scan Phone QR.
8. Confirm Issue.
