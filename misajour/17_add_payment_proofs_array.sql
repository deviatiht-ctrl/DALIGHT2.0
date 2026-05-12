-- DALIGHT — Add payment_proofs array column to reservations
-- =============================================

-- Add payment_proofs column as JSONB array
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_proofs JSONB DEFAULT '[]';

-- Migrate existing payment_proof_url to payment_proofs
UPDATE reservations 
SET payment_proofs = jsonb_build_array(payment_proof_url)
WHERE payment_proof_url IS NOT NULL 
  AND payment_proof_url <> ''
  AND payment_proofs = '[]';

-- Verify column added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND column_name = 'payment_proofs';

-- Check migrated data
SELECT id, reservation_number, payment_proof_url, payment_proofs
FROM reservations
WHERE payment_proofs <> '[]'
LIMIT 5;
