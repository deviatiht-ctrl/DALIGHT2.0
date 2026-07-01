-- ============================================
-- DALIGHT SPA - EMPLOYEE PRESENCE SYSTEM
-- Tables for employee registration, QR codes, and attendance logs
-- ============================================

-- 1. Employees table
CREATE TABLE IF NOT EXISTS presence_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    position TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    nif TEXT,
    photo_url TEXT,
    qr_code_url TEXT,
    qr_data TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Attendance logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES presence_employees(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    entry_time TIME,
    exit_time TIME,
    entry_method TEXT DEFAULT 'qr_scan',
    exit_method TEXT DEFAULT 'qr_scan',
    entry_scanned_by TEXT,
    exit_scanned_by TEXT,
    status TEXT DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_presence_employees_active ON presence_employees(is_active);
CREATE INDEX IF NOT EXISTS idx_presence_employees_number ON presence_employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_date ON attendance_logs(employee_id, log_date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(log_date);

-- 4. Enable RLS
ALTER TABLE presence_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- 5. Policies for admin users (authenticated admin panel)
DROP POLICY IF EXISTS "Admins can view all employees" ON presence_employees;
DROP POLICY IF EXISTS "Admins can manage all employees" ON presence_employees;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance_logs;

CREATE POLICY "Admins can view all employees"
  ON presence_employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all employees"
  ON presence_employees FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all attendance"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all attendance"
  ON attendance_logs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employees-photos', 'employees-photos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for authenticated admin users
DROP POLICY IF EXISTS "Allow authenticated uploads to employees-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select from employees-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update from employees-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from employees-photos" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to employees-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employees-photos');

CREATE POLICY "Allow authenticated select from employees-photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'employees-photos');

CREATE POLICY "Allow authenticated update from employees-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'employees-photos')
  WITH CHECK (bucket_id = 'employees-photos');

CREATE POLICY "Allow authenticated delete from employees-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'employees-photos');
