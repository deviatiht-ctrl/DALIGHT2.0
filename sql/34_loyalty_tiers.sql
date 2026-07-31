-- ============================================
-- DALIGHT — Loyalty Tiers System (Bronze/Argent/Premium)
-- Adds tier column + auto-calculation function
-- ============================================

-- 1. Add tier column to loyalty_cards
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze'
  CHECK (tier IN ('bronze', 'argent', 'premium'));

-- 2. Add reward_label column (if not exists)
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS reward_label TEXT DEFAULT '';

-- 3. Function to calculate tier from total points across all cards for a client
CREATE OR REPLACE FUNCTION get_client_tier(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_total_points INTEGER;
BEGIN
  SELECT COALESCE(SUM(points_balance), 0) INTO v_total_points
  FROM loyalty_cards WHERE client_email = p_email;

  IF v_total_points >= 2000 THEN
    RETURN 'premium';
  ELSIF v_total_points >= 500 THEN
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
  SELECT COALESCE(SUM(points_balance), 0) INTO v_total
  FROM loyalty_cards WHERE client_email = p_email;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update upsert_loyalty_card to also set tier
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
  v_config loyalty_config%ROWTYPE;
  v_card loyalty_cards%ROWTYPE;
  v_card_id UUID;
  v_code TEXT;
  v_stamps_before INTEGER;
  v_reward_earned BOOLEAN;
  v_new_tier TEXT;
  v_total_points INTEGER;
BEGIN
  -- Find config for this service
  SELECT * INTO v_config FROM loyalty_config WHERE service_id = p_service_id AND is_active = true LIMIT 1;

  -- If no service-specific config, try by service_name
  IF NOT FOUND THEN
    SELECT * INTO v_config FROM loyalty_config WHERE service_name = p_service_name AND is_active = true LIMIT 1;
  END IF;

  -- If still no config, don't create a card
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Find existing card for this client + service
  SELECT * INTO v_card FROM loyalty_cards
    WHERE client_email = p_client_email AND service_id = v_config.service_id AND status = 'active'
    LIMIT 1;

  IF FOUND THEN
    -- Update existing card: add a stamp
    v_stamps_before := v_card.stamps_count;
    v_reward_earned := (v_stamps_before + 1 >= v_card.total_required);

    UPDATE loyalty_cards SET
      stamps_count = stamps_count + 1,
      reward_earned = v_reward_earned,
      points_balance = points_balance + v_config.points_per_session,
      reward_label = v_config.reward_label,
      last_updated = NOW()
    WHERE id = v_card.id;

    v_card_id := v_card.id;
  ELSE
    -- Create new card
    v_code := generate_loyalty_card_code();

    INSERT INTO loyalty_cards (
      card_code, client_name, client_email, client_phone, user_id,
      service_id, service_name, config_id,
      stamps_count, total_required, reward_type,
      reward_earned, points_balance, reward_label,
      tier, status, expires_at
    ) VALUES (
      v_code, p_client_name, p_client_email, p_client_phone, p_user_id,
      v_config.service_id, p_service_name, v_config.id,
      1, v_config.threshold, v_config.reward_type,
      (1 >= v_config.threshold), v_config.points_per_session, v_config.reward_label,
      'bronze', 'active', NOW() + (v_config.valid_months || ' months')::INTERVAL
    ) RETURNING id INTO v_card_id;

    v_stamps_before := 0;
    v_reward_earned := (1 >= v_config.threshold);
  END IF;

  -- Update tier for ALL cards belonging to this client
  v_total_points := get_client_total_points(p_client_email);
  v_new_tier := get_client_tier(p_client_email);
  UPDATE loyalty_cards SET tier = v_new_tier WHERE client_email = p_client_email;

  -- Log transaction
  INSERT INTO loyalty_transactions (card_id, type, reservation_id, description, stamps_before, stamps_after)
  VALUES (v_card_id, 'stamp', p_reservation_id, 'Séance complétée', v_stamps_before, v_stamps_before + 1);

  -- If reward just earned, log it
  IF v_reward_earned AND v_stamps_before + 1 >= (SELECT total_required FROM loyalty_cards WHERE id = v_card_id) THEN
    INSERT INTO loyalty_transactions (card_id, type, reservation_id, description, stamps_before, stamps_after)
    VALUES (v_card_id, 'reward_earned', p_reservation_id, 'Récompense débloquée!', v_stamps_before + 1, v_stamps_before + 1);
  END IF;

  RETURN v_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant execute on new functions
GRANT EXECUTE ON FUNCTION get_client_tier(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_client_total_points(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_loyalty_card(TEXT, TEXT, TEXT, UUID, TEXT, UUID, UUID) TO authenticated, anon;

-- 7. Update existing cards with correct tier
UPDATE loyalty_cards SET tier = get_client_tier(client_email);

-- 8. Verification
SELECT '✅ Loyalty tiers system ready!' AS status;
SELECT 'Tiers: bronze (0-499), argent (500-1999), premium (2000+)' AS info;
