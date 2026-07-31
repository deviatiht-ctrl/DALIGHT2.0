-- ============================================
-- DALIGHT — Backfill Loyalty Cards for Existing Completed Reservations
-- Run this to generate cards for all past COMPLETED reservations
-- ============================================

-- Function to backfill: process all COMPLETED reservations that don't have a loyalty transaction yet
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
    SELECT res.id, res.user_name, res.user_email, res.user_phone, res.user_id,
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
      r.user_phone,
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

-- Grant execute
GRANT EXECUTE ON FUNCTION backfill_loyalty_cards() TO authenticated, anon;

-- Verification
SELECT '✅ Backfill function ready! Run: SELECT * FROM backfill_loyalty_cards();' AS info;
