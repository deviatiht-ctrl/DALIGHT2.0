-- ============================================
-- DALIGHT SPA - RESERVATION BALANCE PAYMENT COLUMNS
-- Add columns for paying the remaining balance after deposit
-- ============================================

-- Add balance payment tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'balance_amount_paid'
  ) THEN
    ALTER TABLE reservations ADD COLUMN balance_amount_paid INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'balance_payment_method'
  ) THEN
    ALTER TABLE reservations ADD COLUMN balance_payment_method TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'balance_payment_reference'
  ) THEN
    ALTER TABLE reservations ADD COLUMN balance_payment_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'balance_plop_transaction_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN balance_plop_transaction_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'balance_plop_client_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN balance_plop_client_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_choice'
  ) THEN
    ALTER TABLE reservations ADD COLUMN payment_choice TEXT DEFAULT 'deposit';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE reservations ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'plop_transaction_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN plop_transaction_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'plop_client_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN plop_client_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'reservation_number'
  ) THEN
    ALTER TABLE reservations ADD COLUMN reservation_number TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE reservations ADD COLUMN total_amount INTEGER DEFAULT 0;
  END IF;
END $$;

-- Index for balance payment lookups
CREATE INDEX IF NOT EXISTS idx_reservations_balance_ref ON reservations(balance_payment_reference);
