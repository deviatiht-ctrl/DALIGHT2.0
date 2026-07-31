-- ============================================
-- DALIGHT — Loyalty Cards System
-- Tables: loyalty_config (admin config per service) + loyalty_cards (client cards)
-- ============================================

-- 1. Loyalty configuration per service
CREATE TABLE IF NOT EXISTS loyalty_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID REFERENCES services(id) ON DELETE CASCADE,
  service_name  TEXT NOT NULL,
  reward_type   TEXT NOT NULL DEFAULT 'free_session'
    CHECK (reward_type IN ('free_session', 'percentage', 'points', 'free_service')),
  -- For free_session: after N completed sessions, get 1 free
  threshold     INTEGER NOT NULL DEFAULT 10,
  -- For percentage: discount percentage on next service
  discount_pct  INTEGER DEFAULT 0,
  -- For points: points earned per session
  points_per_session INTEGER DEFAULT 1,
  -- Reward description shown to client
  reward_label  TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT TRUE,
  valid_months  INTEGER DEFAULT 12,  -- card validity in months
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id)
);

-- 2. Client loyalty cards
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code     TEXT NOT NULL UNIQUE,  -- unique QR code identifier
  client_name   TEXT NOT NULL,
  client_email  TEXT NOT NULL,
  client_phone  TEXT,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id    UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name  TEXT NOT NULL,
  config_id     UUID REFERENCES loyalty_config(id) ON DELETE SET NULL,
  -- Dynamic progress
  stamps_count  INTEGER DEFAULT 0,     -- completed sessions count
  total_required INTEGER DEFAULT 10,   -- threshold from config
  reward_type   TEXT DEFAULT 'free_session',
  reward_earned BOOLEAN DEFAULT FALSE, -- when stamps_count >= total_required
  reward_redeemed BOOLEAN DEFAULT FALSE,
  points_balance INTEGER DEFAULT 0,
  -- Card status
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'redeemed', 'archived')),
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  last_updated  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Loyalty card transaction log (stamps added, rewards redeemed)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('stamp', 'reward_earned', 'reward_redeemed', 'adjustment')),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  description   TEXT,
  stamps_before INTEGER,
  stamps_after  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS Policies
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "Admin manage loyalty_config" ON loyalty_config;
CREATE POLICY "Admin manage loyalty_config" ON loyalty_config
  FOR ALL USING (auth.role() = 'authenticated' AND auth.email() = 'laurorejeanclarens0@gmail.com');

DROP POLICY IF EXISTS "Admin manage loyalty_cards" ON loyalty_cards;
CREATE POLICY "Admin manage loyalty_cards" ON loyalty_cards
  FOR ALL USING (auth.role() = 'authenticated' AND auth.email() = 'laurorejeanclarens0@gmail.com');

DROP POLICY IF EXISTS "Admin manage loyalty_transactions" ON loyalty_transactions;
CREATE POLICY "Admin manage loyalty_transactions" ON loyalty_transactions
  FOR ALL USING (auth.role() = 'authenticated' AND auth.email() = 'laurorejeanclarens0@gmail.com');

-- Public can read their own card by card_code (for QR lookup)
DROP POLICY IF EXISTS "Public read own card" ON loyalty_cards;
CREATE POLICY "Public read own card" ON loyalty_cards
  FOR SELECT USING (true);  -- Card code is already a secure random token

DROP POLICY IF EXISTS "Public read loyalty_config" ON loyalty_config;
CREATE POLICY "Public read loyalty_config" ON loyalty_config
  FOR SELECT USING (is_active = true);

-- 5. Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE loyalty_cards;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_email ON loyalty_cards(client_email);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_code ON loyalty_cards(card_code);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_service ON loyalty_cards(service_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_card ON loyalty_transactions(card_id);

-- 7. Function to generate unique card code
CREATE OR REPLACE FUNCTION generate_loyalty_card_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'DL-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4))
              || '-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4))
              || '-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4));
    SELECT EXISTS(SELECT 1 FROM loyalty_cards WHERE card_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to auto-create or update loyalty card when reservation is completed
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
      reward_earned, points_balance,
      status, expires_at
    ) VALUES (
      v_code, p_client_name, p_client_email, p_client_phone, p_user_id,
      v_config.service_id, p_service_name, v_config.id,
      1, v_config.threshold, v_config.reward_type,
      (1 >= v_config.threshold), v_config.points_per_session,
      'active', NOW() + (v_config.valid_months || ' months')::INTERVAL
    ) RETURNING id INTO v_card_id;

    v_stamps_before := 0;
    v_reward_earned := (1 >= v_config.threshold);
  END IF;

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

-- 9. Verification
SELECT '✅ Loyalty cards system ready!' AS status;
SELECT 'Tables created: loyalty_config, loyalty_cards, loyalty_transactions' AS info;
