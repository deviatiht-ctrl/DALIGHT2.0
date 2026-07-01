-- Fix POS reservation errors
-- Run this migration to fix:
-- 1. "Could not find the 'payment_reference' column of 'reservations'"
-- 2. "null value in column 'user_email' violates not-null constraint"

-- Add payment_reference columns
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS plop_transaction_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_payment_reference TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_plop_transaction_id TEXT;

-- Make user_email nullable for POS walk-in clients
ALTER TABLE reservations ALTER COLUMN user_email DROP NOT NULL;
