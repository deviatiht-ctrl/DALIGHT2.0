-- =============================================
-- DALIGHT — Modes de Paiement Dynamiques
-- Fichye: 06_payment_methods.sql
-- Kouri nan Supabase SQL Editor
-- =============================================

-- Étape 1: Kreye tab payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  account_name  TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  instructions  TEXT DEFAULT '',
  logo_url      TEXT DEFAULT '',
  requires_proof BOOLEAN NOT NULL DEFAULT true,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_methods_updated_at ON payment_methods;
CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_payment_methods_updated_at();

-- Étape 2: RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Auth manage payment methods" ON payment_methods;

CREATE POLICY "Public read payment methods"
  ON payment_methods FOR SELECT USING (is_active = true);

CREATE POLICY "Auth manage payment methods"
  ON payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Étape 3: Ajoute kolòn paiement nan tab orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Étape 4: Ajoute kolòn paiement nan tab reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_proof_url TEXT DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Étape 5: Done inisyal (MonCash, NatCash pré-configurés)
INSERT INTO payment_methods (name, slug, account_name, account_number, instructions, requires_proof, is_active, sort_order)
VALUES
  ('MonCash', 'moncash',
   'DANOE ADAM', '+509 47477221',
   'Ouvrez MonCash → Transfert → Entrez le numéro → Prenez un screenshot du reçu',
   true, true, 1),
  ('NatCash', 'natcash',
   'Fabiola Laborde', '+509 42965018',
   'Ouvrez NatCash → Transfert → Entrez le numéro → Prenez un screenshot du reçu',
   true, true, 2),
  ('Cash à la livraison', 'cash',
   '', '',
   'Payez en espèces lors de la réception de votre commande',
   false, true, 3),
  ('Virement Bancaire', 'bank',
   'Danoe Adam (BNC)', '3310013350 (HTG) / 3311005245 (USD)',
   'Effectuez le virement puis envoyez le reçu par email à dalightbeauty15mai@gmail.com',
   true, true, 4)
ON CONFLICT (slug) DO UPDATE SET
  account_name   = EXCLUDED.account_name,
  account_number = EXCLUDED.account_number,
  instructions   = EXCLUDED.instructions;

-- Étape 6: Bucket Supabase Storage pour preuves de paiement
-- (À créer manuellement dans Storage > New Bucket: "payment-proofs", public: false)
-- Ou via API si autorisé:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false) ON CONFLICT DO NOTHING;
