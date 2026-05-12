-- =============================================
-- DALIGHT — Balance Payment & Modification
-- Fichye: 10_reservation_balance.sql
-- Kouri nan Supabase SQL Editor
-- =============================================

-- 1. Ajoute nouvo kolòn nan tab reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_amount       NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_paid_amount NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance_proof_url  TEXT DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS modification_reason TEXT DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS modified_at        TIMESTAMPTZ;

-- 2. Mete ajou reservations ki gen prèv paiement → deposit_paid
UPDATE reservations
SET payment_status = 'deposit_paid'
WHERE payment_proof_url IS NOT NULL
  AND payment_proof_url <> ''
  AND (payment_status IS NULL OR payment_status = 'pending');

-- 3. RLS: Pèmèt kliyan mete ajou pwòp rezèvasyon yo
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients read own reservations"   ON reservations;
DROP POLICY IF EXISTS "Clients insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Clients update own reservations" ON reservations;

CREATE POLICY "Clients read own reservations"
  ON reservations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clients insert own reservations"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients update own reservations"
  ON reservations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Admin: full access (si pa genyen deja)
DROP POLICY IF EXISTS "Admin full access reservations" ON reservations;
CREATE POLICY "Admin full access reservations"
  ON reservations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );
