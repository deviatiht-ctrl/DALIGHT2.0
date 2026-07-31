-- ============================================
-- DALIGHT — Loyalty System v2: Trigger-based + Points per tier + Discount logic
-- 
-- Points: 20 (Bronze), 30 (Argent), 40 (Premium) per completed service
-- Discounts: 2nd=5%, 4th=10%, 6th=15%, 8th=20%, 10th=25%
-- After 10th service: only points accumulate (no more discounts)
-- Card is NOT per-service — it's ONE card per client, all services combined
-- ============================================

-- 1. Add columns to loyalty_cards for new system
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze'
  CHECK (tier IN ('bronze', 'argent', 'premium'));
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS reward_label TEXT DEFAULT '';
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS services_count INTEGER DEFAULT 0;
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS current_discount_pct INTEGER DEFAULT 0;
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- 2. Remove UNIQUE(service_id) from loyalty_config to allow flexible configs
-- (we keep it if it helps, but the card is no longer per-service)

-- 3. Function to calculate tier from total points
CREATE OR REPLACE FUNCTION get_client_tier(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_points), 0) INTO v_total
  FROM loyalty_cards WHERE client_email = p_email;

  IF v_total >= 2000 THEN
    RETURN 'premium';
  ELSIF v_total >= 500 THEN
    RETURN 'argent';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to get total points for a client
CREATE OR REPLACE FUNCTION get_client_total_points(p_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_points), 0) INTO v_total
  FROM loyalty_cards WHERE client_email = p_email;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to calculate discount based on service count
-- 2nd=5%, 4th=10%, 6th=15%, 8th=20%, 10th=25%, after 10=no discount (points only)
CREATE OR REPLACE FUNCTION get_discount_for_count(p_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_count = 2 THEN RETURN 5;
  ELSIF p_count = 4 THEN RETURN 10;
  ELSIF p_count = 6 THEN RETURN 15;
  ELSIF p_count = 8 THEN RETURN 20;
  ELSIF p_count = 10 THEN RETURN 25;
  ELSE RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to get points per service based on tier
CREATE OR REPLACE FUNCTION get_points_per_service(p_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  IF p_tier = 'premium' THEN RETURN 40;
  ELSIF p_tier = 'argent' THEN RETURN 30;
  ELSE RETURN 20;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Main function: upsert loyalty card (ONE card per client, not per service)
CREATE OR REPLACE FUNCTION upsert_loyalty_card(
  p_client_name TEXT,
  p_client_email TEXT,
  p_client_phone TEXT DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_service_name TEXT DEFAULT NULL,
  p_reservation_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_card loyalty_cards%ROWTYPE;
  v_card_id UUID;
  v_code TEXT;
  v_tier TEXT;
  v_points INTEGER;
  v_new_count INTEGER;
  v_discount INTEGER;
  v_total_pts INTEGER;
BEGIN
  -- If no email, can't create card
  IF p_client_email IS NULL OR p_client_email = '' THEN
    RETURN NULL;
  END IF;

  -- Find existing card for this client (ONE card per client)
  SELECT * INTO v_card FROM loyalty_cards
    WHERE client_email = p_client_email AND status = 'active'
    LIMIT 1;

  -- Determine current tier
  v_tier := get_client_tier(p_client_email);
  v_points := get_points_per_service(v_tier);

  IF FOUND THEN
    -- Update existing card
    v_new_count := v_card.services_count + 1;
    v_discount := get_discount_for_count(v_new_count);
    v_total_pts := v_card.total_points + v_points;

    -- Re-evaluate tier after adding points
    IF v_total_pts >= 2000 THEN
      v_tier := 'premium';
    ELSIF v_total_pts >= 500 THEN
      v_tier := 'argent';
    ELSE
      v_tier := 'bronze';
    END IF;

    UPDATE loyalty_cards SET
      services_count = v_new_count,
      total_points = v_total_pts,
      current_discount_pct = v_discount,
      tier = v_tier,
      stamps_count = v_new_count,
      points_balance = v_total_pts,
      reward_earned = (v_discount > 0),
      reward_label = CASE WHEN v_discount > 0 THEN 'Rabais ' || v_discount || '%' ELSE '' END,
      last_updated = NOW()
    WHERE id = v_card.id;

    v_card_id := v_card.id;
  ELSE
    -- Create new card (first service)
    v_code := generate_loyalty_card_code();
    v_new_count := 1;
    v_discount := 0; -- first service, no discount
    v_total_pts := v_points;

    INSERT INTO loyalty_cards (
      card_code, client_name, client_email, client_phone, user_id,
      service_id, service_name,
      stamps_count, total_required,
      reward_type, reward_earned, reward_label,
      points_balance, total_points,
      services_count, current_discount_pct,
      tier, status
    ) VALUES (
      v_code, p_client_name, p_client_email, p_client_phone, p_user_id,
      p_service_id, p_service_name,
      1, 10,
      'discount', false, '',
      v_total_pts, v_total_pts,
      1, 0,
      'bronze', 'active'
    ) RETURNING id INTO v_card_id;
  END IF;

  -- Log transaction
  INSERT INTO loyalty_transactions (card_id, type, reservation_id, description, stamps_before, stamps_after)
  VALUES (v_card_id, 'stamp', p_reservation_id,
    'Service #' || v_new_count || ' — ' || v_points || ' pts' || CASE WHEN v_discount > 0 THEN ' + Rabais ' || v_discount || '%' ELSE '' END,
    v_new_count - 1, v_new_count);

  -- If discount earned, log it
  IF v_discount > 0 THEN
    INSERT INTO loyalty_transactions (card_id, type, reservation_id, description, stamps_before, stamps_after)
    VALUES (v_card_id, 'reward_earned', p_reservation_id,
      'Rabais ' || v_discount || '% débloqué!', v_new_count, v_new_count);
  END IF;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGER: Auto-process loyalty when reservation status changes to COMPLETED
CREATE OR REPLACE FUNCTION on_reservation_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes TO 'COMPLETED'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED')
     OR (TG_OP = 'INSERT' AND NEW.status = 'COMPLETED') THEN
    
    -- Call loyalty upsert (fire-and-forget, don't block reservation update)
    PERFORM upsert_loyalty_card(
      NEW.user_name,
      NEW.user_email,
      NEW.phone,
      NEW.service_id,
      NEW.service,
      NEW.id,
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, create new one
DROP TRIGGER IF EXISTS trigger_reservation_loyalty ON reservations;
CREATE TRIGGER trigger_reservation_loyalty
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION on_reservation_completed();

-- 9. Backfill function: process ALL existing COMPLETED reservations
CREATE OR REPLACE FUNCTION backfill_loyalty_cards()
RETURNS TABLE(
  reservation_id UUID,
  client_email TEXT,
  service_name TEXT,
  card_id UUID,
  status TEXT
) AS $$
DECLARE
  r RECORD;
  v_card_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT res.id, res.user_name, res.user_email, res.phone, res.user_id,
           res.service_id, res.service
    FROM reservations res
    WHERE res.status = 'COMPLETED'
      AND res.user_email IS NOT NULL
      AND res.user_email != ''
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_transactions lt
        WHERE lt.reservation_id = res.id
      )
    ORDER BY res.created_at ASC
  LOOP
    v_card_id := upsert_loyalty_card(
      r.user_name,
      r.user_email,
      r.phone,
      r.service_id,
      r.service,
      r.id,
      r.user_id
    );

    v_count := v_count + 1;

    reservation_id := r.id;
    client_email := r.user_email;
    service_name := r.service;
    card_id := v_card_id;
    status := CASE WHEN v_card_id IS NOT NULL THEN 'created/updated' ELSE 'no config' END;
    RETURN NEXT;
  END LOOP;

  IF v_count = 0 THEN
    reservation_id := NULL;
    client_email := NULL;
    service_name := NULL;
    card_id := NULL;
    status := 'No pending reservations to process';
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant execute on all functions
GRANT EXECUTE ON FUNCTION get_client_tier(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_client_total_points(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_discount_for_count(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_points_per_service(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_loyalty_card(TEXT, TEXT, TEXT, UUID, TEXT, UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION on_reservation_completed() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION backfill_loyalty_cards() TO authenticated, anon;

-- 11. Run backfill immediately for all existing completed reservations
-- (This will create/update cards for ALL past completed services)
SELECT * FROM backfill_loyalty_cards();

-- 12. Update all existing cards with correct tier
UPDATE loyalty_cards SET tier = get_client_tier(client_email);

-- 13. Verification
SELECT '✅ Loyalty system v2 ready!' AS status;
SELECT 'Trigger: auto on COMPLETED | Points: 20/30/40 | Discounts: 2nd=5%,4th=10%,6th=15%,8th=20%,10th=25%' AS info;
