-- ============================================
-- DALIGHT — Potèy Influencer v1
-- Kont influencer + estatistik kòd + demann retrè komisyon
-- Idempotent — ka egzekite plizyè fwa san pwoblèm
-- ============================================

-- 1. Mak influencer sou profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_influencer BOOLEAN DEFAULT FALSE;

-- 2. Influencer ka li itilizasyon kòd li yo (RLS sou promo_code_uses)
--    (pa li done kliyan an detay — li wè sèlman itilizasyon kòd PA LI)
DROP POLICY IF EXISTS "promo_uses_owner_select" ON promo_code_uses;
CREATE POLICY "promo_uses_owner_select" ON promo_code_uses
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM promo_codes p
        WHERE p.id = promo_code_uses.promo_code_id
          AND lower(p.owner_email) = lower(auth.jwt() ->> 'email')
      )
    );

-- Influencer ka li pwòp kòd li yo (menm si yo inaktif)
DROP POLICY IF EXISTS "promo_codes_owner_read" ON promo_codes;
CREATE POLICY "promo_codes_owner_read" ON promo_codes
    FOR SELECT USING (
      owner_type IN ('influencer', 'client')
      AND lower(owner_email) = lower(auth.jwt() ->> 'email')
    );

-- 3. Tab demann retrè komisyon
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email TEXT NOT NULL,
    month TEXT NOT NULL,                    -- 'YYYY-MM' — mwa komisyon an
    amount_htg NUMERIC(10,2) NOT NULL,
    payment_method TEXT,                    -- 'moncash', 'natcash', 'bank_transfer', 'cash'
    account_info TEXT,                      -- nimewo/kont pou peman an
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_owner ON payout_requests(owner_email);
CREATE INDEX IF NOT EXISTS idx_payout_month ON payout_requests(month);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout_requests(status);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Influencer: kreye demann pou imèl li + li pwòp demann li yo
DROP POLICY IF EXISTS "payout_insert_own" ON payout_requests;
CREATE POLICY "payout_insert_own" ON payout_requests
    FOR INSERT WITH CHECK (lower(owner_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "payout_select_own" ON payout_requests;
CREATE POLICY "payout_select_own" ON payout_requests
    FOR SELECT USING (
      lower(owner_email) = lower(auth.jwt() ->> 'email')
      OR public.is_admin()
    );

DROP POLICY IF EXISTS "payout_admin_all" ON payout_requests;
CREATE POLICY "payout_admin_all" ON payout_requests
    FOR ALL USING (public.is_admin());

-- 4. Estatistik influencer: pa mwa + pa kòd (sèlman pou imèl moun ki konekte a)
CREATE OR REPLACE FUNCTION get_influencer_stats()
RETURNS TABLE(
  month TEXT,
  code TEXT,
  uses_count BIGINT,
  revenue_htg NUMERIC,
  commission_htg NUMERIC,
  commission_paid_htg NUMERIC
) AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    to_char(u.created_at, 'YYYY-MM') AS month,
    u.code,
    COUNT(*)::BIGINT AS uses_count,
    COALESCE(SUM(r.total_amount), 0) AS revenue_htg,
    COALESCE(SUM(u.commission_amount), 0) AS commission_htg,
    COALESCE(SUM(u.commission_amount) FILTER (WHERE u.commission_paid), 0) AS commission_paid_htg
  FROM promo_code_uses u
  JOIN promo_codes p ON p.id = u.promo_code_id
  LEFT JOIN reservations r ON r.id = u.reservation_id AND r.status = 'COMPLETED'
  WHERE lower(p.owner_email) = v_email
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_influencer_stats() TO authenticated;

-- 5. Rezime global pou influencer: total + disponib pou retrè
CREATE OR REPLACE FUNCTION get_influencer_summary()
RETURNS JSONB AS $$
DECLARE
  v_email TEXT;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_uses BIGINT;
  v_requested NUMERIC;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'non connecté');
  END IF;

  SELECT
    COALESCE(SUM(u.commission_amount), 0),
    COALESCE(SUM(u.commission_amount) FILTER (WHERE u.commission_paid), 0),
    COUNT(*)
  INTO v_total, v_paid, v_uses
  FROM promo_code_uses u
  JOIN promo_codes p ON p.id = u.promo_code_id
  WHERE lower(p.owner_email) = v_email;

  SELECT COALESCE(SUM(amount_htg), 0) INTO v_requested
  FROM payout_requests
  WHERE lower(owner_email) = v_email
    AND status IN ('pending', 'approved', 'paid');

  RETURN jsonb_build_object(
    'success', true,
    'email', v_email,
    'total_uses', v_uses,
    'commission_total', v_total,
    'commission_paid', v_paid,
    'commission_requested', v_requested,
    'commission_available', GREATEST(v_total - v_requested, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_influencer_summary() TO authenticated;

SELECT '✅ Potèy influencer pare!' AS status;
