-- ============================================
-- DALIGHT — Sistèm Kòd Promo v1
-- Influencers + komisyon + referans kliyan (parrainage) + rabè
-- Idempotent — ka egzekite plizyè fwa san pwoblèm
-- ============================================

-- 1. Tab promo_codes (kreye si li pa egziste)
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_usd', 'fixed_htg')),
    discount_value DECIMAL(10, 2) NOT NULL,
    min_purchase_usd DECIMAL(10, 2),
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Kolòn pou influencers / parrainage
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'admin'
  CHECK (owner_type IN ('admin', 'influencer', 'client'));
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS owner_email TEXT;
-- Komisyon influencer: % sou pri total rezervasyon an (apre rabè)
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) DEFAULT 0;
-- Pwen fidelite pou mèt kòd la (parrainage kliyan) — bay lè rezervasyon an COMPLETED
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS points_per_use INTEGER DEFAULT 0;
-- Ki kote kòd la valab: 'all' | 'services' (rezervasyon) | 'products' (boutik)
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'all'
  CHECK (applies_to IN ('all', 'services', 'products'));
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Kolòn sou reservations pou kòd promo
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- 4. Kolòn sou orders (boutik) si tab la egziste
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 5. Tab tracking itilizasyon kòd yo
CREATE TABLE IF NOT EXISTS promo_code_uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    order_id UUID,
    client_email TEXT,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    commission_amount NUMERIC(10,2) DEFAULT 0,
    commission_paid BOOLEAN DEFAULT FALSE,
    points_awarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_uses_code ON promo_code_uses(code);
CREATE INDEX IF NOT EXISTS idx_promo_uses_reservation ON promo_code_uses(reservation_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_created ON promo_code_uses(created_at);
CREATE INDEX IF NOT EXISTS idx_promo_codes_owner ON promo_codes(owner_type, owner_email);

-- ============================================
-- 6. RLS
-- ============================================
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Kòd aktif liab pa tout moun (pou validasyon nan checkout/rezèvasyon)
DROP POLICY IF EXISTS "promo_codes_public_read" ON promo_codes;
CREATE POLICY "promo_codes_public_read" ON promo_codes
    FOR SELECT USING (is_active = TRUE AND (valid_until IS NULL OR valid_until > NOW()));

DROP POLICY IF EXISTS "promo_codes_admin_all" ON promo_codes;
CREATE POLICY "promo_codes_admin_all" ON promo_codes
    FOR ALL USING (public.is_admin());

-- Itilizasyon: nenpòt moun ka anrejistre yon itilizasyon (record_promo_use fè validasyon an)
DROP POLICY IF EXISTS "promo_uses_insert_public" ON promo_code_uses;
CREATE POLICY "promo_uses_insert_public" ON promo_code_uses
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "promo_uses_select_own" ON promo_code_uses;
CREATE POLICY "promo_uses_select_own" ON promo_code_uses
    FOR SELECT USING (public.is_admin() OR client_email = auth.email());

DROP POLICY IF EXISTS "promo_uses_admin_all" ON promo_code_uses;
CREATE POLICY "promo_uses_admin_all" ON promo_code_uses
    FOR ALL USING (public.is_admin());

-- ============================================
-- 7. Fonksyon: anrejistre yon itilizasyon kòd (SECURITY DEFINER)
--    Validasyon konplè + uses_count++ atomik. Rele apre rezervasyon/kòmand kreye.
-- ============================================
CREATE OR REPLACE FUNCTION record_promo_use(
  p_code TEXT,
  p_reservation_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_use_id UUID;
BEGIN
  SELECT * INTO v_promo FROM promo_codes
    WHERE upper(code) = upper(trim(p_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code invalide');
  END IF;
  IF NOT v_promo.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code inactif');
  END IF;
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code expiré');
  END IF;
  IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code pas encore valide');
  END IF;
  IF v_promo.max_uses IS NOT NULL AND v_promo.uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite d''utilisation atteinte');
  END IF;

  -- Evite doub pou menm rezervasyon/kòmand
  IF p_reservation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM promo_code_uses WHERE reservation_id = p_reservation_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'code', v_promo.code);
  END IF;
  IF p_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM promo_code_uses WHERE order_id = p_order_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'code', v_promo.code);
  END IF;

  INSERT INTO promo_code_uses (promo_code_id, code, reservation_id, order_id, client_email, discount_amount)
  VALUES (v_promo.id, v_promo.code, p_reservation_id, p_order_id, p_client_email, p_discount_amount)
  RETURNING id INTO v_use_id;

  UPDATE promo_codes SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = v_promo.id;

  RETURN jsonb_build_object('success', true, 'use_id', v_use_id, 'code', v_promo.code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_promo_use(TEXT, UUID, UUID, TEXT, NUMERIC) TO authenticated, anon;

-- ============================================
-- 8. Kòd parrainage kliyan: jwenn oswa kreye
--    Rele nan paj fidelite a. Kliyan an jwenn yon kòd REF-XXXXXX
--    ki bay rabè bay moun ki itilize li + pwen bay mèt la.
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_referral_code(p_email TEXT, p_name TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_caller_email TEXT;
  v_is_admin BOOLEAN;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN RETURN NULL; END IF;
  p_email := lower(trim(p_email));

  -- Si kòd la egziste deja, retounen li (tout moun ka li li)
  SELECT code INTO v_code FROM promo_codes
    WHERE owner_type = 'client' AND owner_email = p_email AND is_active
    LIMIT 1;
  IF FOUND THEN RETURN v_code; END IF;

  -- Kreyasyon: sèlman mèt kont lan oswa admin
  v_caller_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin := public.is_admin();
  IF v_caller_email <> p_email AND NOT v_is_admin THEN
    RETURN NULL;
  END IF;

  LOOP
    v_code := 'REF-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = v_code);
  END LOOP;

  INSERT INTO promo_codes (
    code, discount_type, discount_value, owner_type,
    owner_name, owner_email, commission_pct, points_per_use,
    applies_to, is_active
  ) VALUES (
    v_code, 'percentage', 5, 'client',
    COALESCE(p_name, p_email), p_email, 0, 50,
    'services', TRUE
  );

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_or_create_referral_code(TEXT, TEXT) TO authenticated, anon;

-- ============================================
-- 9. Trigger: lè rezervasyon pase COMPLETED
--    - kalkile komisyon influencer an (sou total_amount)
--    - bay pwen parrainage bay mèt kòd kliyan an
-- ============================================
CREATE OR REPLACE FUNCTION process_promo_on_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_use promo_code_uses%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_card_id UUID;
  v_card_email TEXT;
BEGIN
  IF NOT (TG_OP = 'UPDATE' AND NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED') THEN
    RETURN NEW;
  END IF;
  IF NEW.promo_code IS NULL OR NEW.promo_code = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_use FROM promo_code_uses
    WHERE reservation_id = NEW.id
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_promo FROM promo_codes WHERE id = v_use.promo_code_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Komisyon sou montan total rezervasyon an
  IF COALESCE(v_promo.commission_pct, 0) > 0 THEN
    UPDATE promo_code_uses
      SET commission_amount = ROUND(COALESCE(NEW.total_amount, 0) * v_promo.commission_pct / 100)
      WHERE id = v_use.id;
  END IF;

  -- Pwen parrainage (kòd ki apartenen yon kliyan, pa li menm)
  IF v_use.points_awarded = FALSE
     AND v_promo.owner_type = 'client'
     AND COALESCE(v_promo.points_per_use, 0) > 0
     AND v_promo.owner_email IS NOT NULL
     AND lower(v_promo.owner_email) <> lower(COALESCE(NEW.user_email, '')) THEN

    SELECT id, client_email INTO v_card_id, v_card_email
      FROM loyalty_cards
      WHERE lower(client_email) = lower(v_promo.owner_email) AND status = 'active'
      LIMIT 1;

    IF v_card_id IS NOT NULL THEN
      UPDATE loyalty_cards SET
        total_points = total_points + v_promo.points_per_use,
        points_balance = points_balance + v_promo.points_per_use,
        last_updated = NOW()
      WHERE id = v_card_id;

      -- Rekalkile tier la (bronze/argent/premium)
      UPDATE loyalty_cards SET tier = get_client_tier(v_card_email) WHERE id = v_card_id;

      INSERT INTO loyalty_transactions (card_id, type, reservation_id, description, stamps_before, stamps_after)
      VALUES (v_card_id, 'adjustment', NEW.id,
        'Parrainage +' || v_promo.points_per_use || ' pts (code ' || v_promo.code || ' utilisé par ' || COALESCE(NEW.user_email, '?') || ')',
        NULL, NULL);

      UPDATE promo_code_uses SET points_awarded = TRUE WHERE id = v_use.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_promo_on_completed ON reservations;
CREATE TRIGGER trg_promo_on_completed
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION process_promo_on_completed();

-- ============================================
-- 10. Rapò komisyon pa mwa pou admin
--     SELECT * FROM promo_commission_report(); oswa filtre:
--     SELECT * FROM promo_commission_report() WHERE month = '2026-10';
-- ============================================
CREATE OR REPLACE FUNCTION promo_commission_report()
RETURNS TABLE(
  month TEXT,
  code TEXT,
  owner_type TEXT,
  owner_name TEXT,
  owner_email TEXT,
  uses_count BIGINT,
  revenue_htg NUMERIC,
  commission_htg NUMERIC,
  commission_paid_htg NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(u.created_at, 'YYYY-MM') AS month,
    u.code,
    p.owner_type,
    p.owner_name,
    p.owner_email,
    COUNT(*)::BIGINT AS uses_count,
    COALESCE(SUM(r.total_amount), 0) AS revenue_htg,
    COALESCE(SUM(u.commission_amount), 0) AS commission_htg,
    COALESCE(SUM(u.commission_amount) FILTER (WHERE u.commission_paid), 0) AS commission_paid_htg
  FROM promo_code_uses u
  JOIN promo_codes p ON p.id = u.promo_code_id
  LEFT JOIN reservations r ON r.id = u.reservation_id AND r.status = 'COMPLETED'
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1 DESC, 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION promo_commission_report() TO authenticated;

-- ============================================
-- Verifikasyon
-- ============================================
SELECT '✅ Sistèm kòd promo pare!' AS status;
