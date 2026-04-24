-- ============================================
-- DALIGHT SPA - RESERVATION TABLE V2.0
-- Complete recreation with all columns
-- ============================================

-- 1. Drop existing table and recreate (DANGER: This will delete all data!)
-- Only use this if you want to start fresh
-- DROP TABLE IF EXISTS reservations CASCADE;

-- 2. Create the complete reservations table with all columns
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    phone TEXT,
    service TEXT NOT NULL,
    services JSONB,
    date DATE NOT NULL,
    time TIME NOT NULL,
    notes TEXT,
    payment_method TEXT,
    deposit_amount INTEGER DEFAULT 1000,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_proof_url TEXT
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status_date ON reservations(status, date);
CREATE INDEX IF NOT EXISTS idx_reservations_reservation_number ON reservations(reservation_number);

-- 4. Enable RLS (Row Level Security)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own reservations" ON reservations;
DROP POLICY IF EXISTS "Users can insert their own reservations" ON reservations;
DROP POLICY IF EXISTS "Users can update their own reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can update all reservations" ON reservations;

-- 6. Create policies for users
-- Users can view their own reservations
CREATE POLICY "Users can view their own reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own reservations  
CREATE POLICY "Users can insert their own reservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own pending reservations
CREATE POLICY "Users can update their own reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (user_id = auth.uid());

-- 7. Create policies for admins (service_role)
CREATE POLICY "Admins can view all reservations"
  ON reservations FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Admins can update all reservations"
  ON reservations FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Admins can delete reservations"
  ON reservations FOR DELETE
  TO service_role
  USING (true);

-- 8. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;

CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Create storage bucket for payment proofs if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 10. Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Anyone can view payment proofs" ON storage.objects;
CREATE POLICY "Anyone can view payment proofs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Admins can delete payment proofs" ON storage.objects;
CREATE POLICY "Admins can delete payment proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-proofs');

-- ============================================
-- TABLE STRUCTURE SUMMARY:
-- ============================================
-- id: UUID (primary key, auto-generated)
-- reservation_number: TEXT (unique, user-friendly ID like "DL12345678")
-- user_id: UUID (reference to auth.users)
-- user_email: TEXT (user email)
-- user_name: TEXT (full name)
-- phone: TEXT (phone number)
-- service: TEXT (service names as comma-separated string)
-- services: JSONB (complete service objects from cart)
-- date: DATE (reservation date)
-- time: TIME (reservation time)
-- notes: TEXT (additional notes)
-- payment_method: TEXT (moncash, natcash, bank)
-- deposit_amount: INTEGER (default 1000 HTG)
-- status: TEXT (PENDING, CONFIRMED, CANCELLED, COMPLETED)
-- created_at: TIMESTAMP (auto-generated)
-- updated_at: TIMESTAMP (auto-updated on modify)
-- payment_proof_url: TEXT (URL to uploaded proof image)
-- ============================================
