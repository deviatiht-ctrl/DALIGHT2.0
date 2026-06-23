-- ============================================================
-- DALIGHT — Admin Fix + Retraits (Withdrawals)
-- Fichye: adminfix.sql
-- Prefix nouvo table: dl_
-- ============================================================

-- ── 1. FIX kolòn revenu nan reservations ──────────────────────
-- S'assure que total_amount ak deposit_amount egziste
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2) DEFAULT 0;

-- S'assure que orders gen kolòn total
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- ── 2. TABLE dl_withdrawals ───────────────────────────────────
CREATE TABLE IF NOT EXISTS dl_withdrawals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id    TEXT NOT NULL UNIQUE,
  montant         NUMERIC(12,2) NOT NULL,
  phone_number    TEXT NOT NULL,
  payment_method  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  plop_response   JSONB DEFAULT '{}'::jsonb,
  note            TEXT DEFAULT '',
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dl_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access dl_withdrawals" ON dl_withdrawals;
CREATE POLICY "Admin full access dl_withdrawals"
  ON dl_withdrawals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS dl_withdrawals_updated_at ON dl_withdrawals;
CREATE TRIGGER dl_withdrawals_updated_at
  BEFORE UPDATE ON dl_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_payment_methods_updated_at();

-- ── 3. VIEW dl_revenue_by_service ─────────────────────────────
-- Revenu reyèl: peman ki confirme sèlman (CONFIRMED oswa COMPLETED)
CREATE OR REPLACE VIEW dl_revenue_by_service AS
SELECT
  COALESCE(service, 'Autre') AS service_name,
  COUNT(*)::int                AS total_reservations,
  SUM(
    CASE
      WHEN payment_status = 'fully_paid'   THEN COALESCE(total_amount, 0)
      WHEN payment_status = 'deposit_paid' THEN COALESCE(deposit_amount, 0)
      ELSE 0
    END
  )                            AS revenue_collected,
  SUM(COALESCE(total_amount, 0)) AS revenue_potential,
  DATE_TRUNC('month', created_at) AS month
FROM reservations
WHERE status IN ('CONFIRMED', 'COMPLETED')
GROUP BY service_name, DATE_TRUNC('month', created_at)
ORDER BY month DESC, revenue_collected DESC;

-- ── 4. VIEW dl_revenue_summary ────────────────────────────────
-- Résumé mensuel: réservations + commandes
CREATE OR REPLACE VIEW dl_revenue_summary AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  'reservation'::text              AS source,
  COUNT(*)::int                    AS count,
  SUM(
    CASE
      WHEN payment_status = 'fully_paid'   THEN COALESCE(total_amount, 0)
      WHEN payment_status = 'deposit_paid' THEN COALESCE(deposit_amount, 0)
      ELSE 0
    END
  )                                AS amount_collected
FROM reservations
WHERE status IN ('CONFIRMED', 'COMPLETED')
GROUP BY DATE_TRUNC('month', created_at)

UNION ALL

SELECT
  DATE_TRUNC('month', created_at) AS month,
  'order'::text                    AS source,
  COUNT(*)::int                    AS count,
  SUM(COALESCE(total, 0))          AS amount_collected
FROM orders
WHERE status IN ('confirmed', 'completed', 'delivered')
  AND payment_status IN ('paid', 'fully_paid')
GROUP BY DATE_TRUNC('month', created_at)

ORDER BY month DESC;

-- ── 5. RLS sur views (accès authenticated uniquement) ─────────
-- Les views héritent des RLS des tables sources.
-- S'assurer que authenticated peut lire dl_revenue_by_service
GRANT SELECT ON dl_revenue_by_service TO authenticated;
GRANT SELECT ON dl_revenue_summary TO authenticated;
