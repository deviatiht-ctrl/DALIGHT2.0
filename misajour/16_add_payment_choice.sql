-- DALIGHT — Add payment_choice column to reservations
-- =============================================

-- Add payment_choice column
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_choice TEXT DEFAULT 'deposit';

-- Add CHECK constraint for payment_choice
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_payment_choice_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_payment_choice_check 
  CHECK (payment_choice IN ('deposit', 'full'));

-- Verify column added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND column_name = 'payment_choice';
