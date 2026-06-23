-- DALIGHT — PLOP PLOP automatic payments
-- Fichye: 18_plop_plop_automatic_payments.sql
-- Prefix/diminutif pou nouvo table yo: dl_

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'manual';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway_method TEXT DEFAULT NULL;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT true;

UPDATE payment_methods
SET gateway = 'plopplop', gateway_method = slug, requires_proof = false, is_manual = false
WHERE slug IN ('moncash', 'natcash', 'kashpaw');

INSERT INTO payment_methods (name, slug, account_name, account_number, instructions, requires_proof, is_active, sort_order, gateway, gateway_method, is_manual)
VALUES
  ('Kashpaw', 'kashpaw', '', '', 'Paiement automatique sécurisé via PLOP PLOP.', false, true, 3, 'plopplop', 'kashpaw', false),
  ('Carte bancaire', 'all', '', '', 'Paiement automatique par carte bancaire ou méthode disponible via PLOP PLOP.', false, true, 4, 'plopplop', 'all', false)
ON CONFLICT (slug) DO UPDATE SET
  instructions = EXCLUDED.instructions,
  requires_proof = false,
  is_active = true,
  gateway = EXCLUDED.gateway,
  gateway_method = EXCLUDED.gateway_method,
  is_manual = false;

UPDATE payment_methods
SET gateway = 'manual', gateway_method = NULL, requires_proof = true, is_manual = true
WHERE slug IN ('bank', 'bank_transfer', 'virement', 'virement_bancaire', 'bancaire');

ALTER TABLE orders ADD COLUMN IF NOT EXISTS plop_reference_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS plop_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS plop_payment_method TEXT;

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS plop_transaction_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_payment_reference TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_plop_transaction_id TEXT;

CREATE TABLE IF NOT EXISTS dl_plop_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  transaction_id TEXT,
  context_type TEXT NOT NULL,
  context_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dl_plop_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read dl_plop_transactions" ON dl_plop_transactions;
CREATE POLICY "Authenticated read dl_plop_transactions"
  ON dl_plop_transactions FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS dl_plop_transactions_updated_at ON dl_plop_transactions;
CREATE TRIGGER dl_plop_transactions_updated_at
  BEFORE UPDATE ON dl_plop_transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_methods_updated_at();
