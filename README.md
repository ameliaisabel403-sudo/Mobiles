# Company Phone Tracking System

A modern, responsive, mobile-first Web Application for tracking company-owned Android phones (`PHONE-001` through `PHONE-020`). Built with HTML5, CSS3 Glassmorphism UI, Supabase Auth & PostgreSQL database, camera-based QR code scanning, and Vercel hosting readiness.

## Features

- 📱 **Issue Phone Workflow**: Enter Employee ID, scan phone QR code, review confirmation card, issue phone, and update DB status to `ISSUED`.
- 🔄 **Return Phone Workflow**: Scan phone QR code without asking for Employee ID. System automatically looks up active employee, asks for device condition (`Good` / `Damaged`), logs transaction, and updates DB status to `AVAILABLE`.
- 📊 **Real-time Dashboard**: Live counters (Total: 20, Available, Issued, Returned Today), active phone tracking cards, and full device matrix.
- 📷 **Camera QR Scanner**: HTML5 real-time camera scanning for device QR tags + manual quick-select override for desktop testing.
- 🏷️ **QR Code Generator & Printable Labels**: Dynamic QR codes generated for `PHONE-001` to `PHONE-020` with print label layout.
- 📑 **Transaction Reports & CSV Export**: Search/filter transaction history by Employee, Phone ID, Action, or Date range. One-click CSV export.
- 🔒 **Supabase Auth & RLS Security**: Row Level Security enabled for database tables, authenticated staff login/logout, and safe frontend key usage (Public Anon key only).
- 💾 **Local Demo Mode Fallback**: Works out of the box with an interactive in-memory demo database before Supabase credentials are configured!

---

## Quick Setup Instructions

### 1. Run as a Web Application Locally
Simply open `index.html` in any web browser (Chrome, Edge, Safari, Firefox) or serve using any static web server.

### 2. Connect to Supabase Database
1. Go to [Supabase](https://supabase.com) and create a free project.
2. In the Supabase Dashboard, go to **SQL Editor** and run the script provided in `schema.sql`.
3. Go to **Project Settings -> API** and copy:
   - `Project URL`
   - `anon / public key`
4. Open the Web Application, click the **Supabase Settings** button in the header (or settings gear), enter your `Project URL` and `Anon Key`, and click **Save & Connect**.

### 3. Deploy to Vercel
1. Push this repository to GitHub or upload the folder to Vercel.
2. Select **Static Site** preset (Root Directory: `./`).
3. Click **Deploy**. Your application is now live online!
