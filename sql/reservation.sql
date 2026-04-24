-- ============================================
-- DALIGHT SPA - RESERVATION PAYMENT SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add payment columns to reservations table (if not exist)
DO $$
BEGIN
  -- payment_method: moncash, natcash, bank
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE reservations ADD COLUMN payment_method TEXT;
  END IF;

  -- payment_proof_url: URL of uploaded screenshot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_proof_url'
  ) THEN
    ALTER TABLE reservations ADD COLUMN payment_proof_url TEXT;
  END IF;

  -- deposit_amount: fixed 1000 HTG deposit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE reservations ADD COLUMN deposit_amount INTEGER DEFAULT 1000;
  END IF;

  -- phone: client phone number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'phone'
  ) THEN
    ALTER TABLE reservations ADD COLUMN phone TEXT;
  END IF;

  -- Remove pay_timing column if it exists (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'pay_timing'
  ) THEN
    ALTER TABLE reservations DROP COLUMN pay_timing;
  END IF;
END $$;

-- 2. Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Storage policies: allow authenticated users to upload proofs
-- (Drop then create to avoid duplicates)
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

-- 4. (Optional) Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_reservations_payment_method
  ON reservations (payment_method);

CREATE INDEX IF NOT EXISTS idx_reservations_status_date
  ON reservations (status, date);
