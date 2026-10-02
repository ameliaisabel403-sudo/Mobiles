-- ==============================================================================
-- COMPANY PHONE TRACKING SYSTEM - SUPABASE SQL SCHEMA
-- Execute this SQL script in your Supabase SQL Editor (https://app.supabase.com)
-- ==============================================================================

-- 1. DROP EXISTING TABLES IF RE-CREATING
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS phones CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 2. CREATE EMPLOYEES TABLE
CREATE TABLE employees (
    employee_number VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) DEFAULT 'Operations',
    phone_number VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE PHONES TABLE
CREATE TABLE phones (
    id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ISSUED')),
    current_employee_id VARCHAR(50) REFERENCES employees(employee_number) ON DELETE SET NULL,
    current_employee_name VARCHAR(100),
    last_issue_time TIMESTAMPTZ,
    last_return_time TIMESTAMPTZ,
    condition VARCHAR(20) NOT NULL DEFAULT 'Good' CHECK (condition IN ('Good', 'Damaged')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE TRANSACTIONS LOG TABLE
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action VARCHAR(20) NOT NULL CHECK (action IN ('ISSUE', 'RETURN')),
    phone_id VARCHAR(50) NOT NULL REFERENCES phones(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    condition VARCHAR(20) CHECK (condition IN ('Good', 'Damaged')),
    notes TEXT,
    staff_email VARCHAR(150) NOT NULL
);

-- 5. INDEXES FOR FAST QUERYING & FILTERING
CREATE INDEX idx_phones_status ON phones(status);
CREATE INDEX idx_transactions_phone ON transactions(phone_id);
CREATE INDEX idx_transactions_emp ON transactions(employee_number);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);

-- 6. SEED PHONES (PHONE-001 THROUGH PHONE-020)
INSERT INTO phones (id, status, condition) VALUES
('PHONE-001', 'AVAILABLE', 'Good'),
('PHONE-002', 'AVAILABLE', 'Good'),
('PHONE-003', 'AVAILABLE', 'Good'),
('PHONE-004', 'AVAILABLE', 'Good'),
('PHONE-005', 'AVAILABLE', 'Good'),
('PHONE-006', 'AVAILABLE', 'Good'),
('PHONE-007', 'AVAILABLE', 'Good'),
('PHONE-008', 'AVAILABLE', 'Good'),
('PHONE-009', 'AVAILABLE', 'Good'),
('PHONE-010', 'AVAILABLE', 'Good'),
('PHONE-011', 'AVAILABLE', 'Good'),
('PHONE-012', 'AVAILABLE', 'Good'),
('PHONE-013', 'AVAILABLE', 'Good'),
('PHONE-014', 'AVAILABLE', 'Good'),
('PHONE-015', 'AVAILABLE', 'Good'),
('PHONE-016', 'AVAILABLE', 'Good'),
('PHONE-017', 'AVAILABLE', 'Good'),
('PHONE-018', 'AVAILABLE', 'Good'),
('PHONE-019', 'AVAILABLE', 'Good'),
('PHONE-020', 'AVAILABLE', 'Good')
ON CONFLICT (id) DO NOTHING;

-- 7. SEED INITIAL EMPLOYEES
INSERT INTO employees (employee_number, full_name, department) VALUES
('EMP-1001', 'Alex Mercer', 'Logistics'),
('EMP-1002', 'Sarah Jenkins', 'Field Operations'),
('EMP-1003', 'Michael Chen', 'Warehouse'),
('EMP-1004', 'Emily Rodriguez', 'Quality Control'),
('EMP-1005', 'David Kim', 'Technical Support'),
('EMP-1006', 'Jessica Taylor', 'Fleet Management'),
('EMP-1007', 'James Wilson', 'Security'),
('EMP-1008', 'Amanda Martinez', 'Inventory'),
('EMP-1009', 'Robert Patel', 'Delivery Ops'),
('EMP-1010', 'Lisa Anderson', 'Site Inspection')
ON CONFLICT (employee_number) DO NOTHING;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS on all tables
ALTER TABLE phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full read/write access
CREATE POLICY "Authenticated staff can view phones" ON phones
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated staff can update phones" ON phones
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated staff can view employees" ON employees
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated staff can insert employees" ON employees
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated staff can view transactions" ON transactions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated staff can insert transactions" ON transactions
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow public read access to phones/employees if operating in open kiosk mode (Optional)
CREATE POLICY "Public read access for kiosk phones" ON phones
    FOR SELECT TO anon USING (true);

CREATE POLICY "Public read access for kiosk employees" ON employees
    FOR SELECT TO anon USING (true);

CREATE POLICY "Public write access for kiosk transactions" ON transactions
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Public update access for kiosk phones" ON phones
    FOR UPDATE TO anon USING (true);
