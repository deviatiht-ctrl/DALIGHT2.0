-- =============================================
-- DALIGHT — Règ Disponibilite pa Default
-- Fichye: 08_default_availability.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- OBJEKTIF:
--   Mete tout jou disponib pa default (sof Lendi)
--   Horè: 08h00 — 18h00 (chak ede)
--   Kapasite: 3 rezèvasyon pè kreno
--   Admin ka bloke/modifye apre via availability_exceptions
-- =============================================

-- Asire kolòn yo egziste nan availability_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'availability_rules' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE availability_rules ADD COLUMN service_type TEXT DEFAULT 'all';
  END IF;
END $$;

-- Retire vye règ yo si ou vle rekòmanse pwòp (opsyonèl — dekomante si nesesè)
-- TRUNCATE TABLE availability_rules;

-- =============================================
-- INSERE RÈG POU CHAK JOU (sof Lendi = DOW 1)
-- DOW: 0=Dimanche, 2=Madi, 3=Mèkredi, 4=Jedi, 5=Vandredi, 6=Samdi
-- Kreno: 08:00 a 18:00
-- =============================================
INSERT INTO availability_rules (day_of_week, time_slot, is_available, max_capacity, service_type)
SELECT
  d.dow,
  t.slot::TIME,
  true,
  3,
  'all'
FROM
  (VALUES (0),(2),(3),(4),(5),(6)) AS d(dow),
  (VALUES
    ('08:00:00'),('09:00:00'),('10:00:00'),('11:00:00'),('12:00:00'),
    ('13:00:00'),('14:00:00'),('15:00:00'),('16:00:00'),('17:00:00'),('18:00:00')
  ) AS t(slot)
ON CONFLICT (day_of_week, time_slot) DO UPDATE
  SET is_available  = EXCLUDED.is_available,
      max_capacity  = EXCLUDED.max_capacity,
      service_type  = EXCLUDED.service_type;

-- Konfirmasyon
SELECT
  CASE day_of_week
    WHEN 0 THEN 'Dimanche'
    WHEN 2 THEN 'Mardi'
    WHEN 3 THEN 'Mercredi'
    WHEN 4 THEN 'Jeudi'
    WHEN 5 THEN 'Vendredi'
    WHEN 6 THEN 'Samedi'
  END AS jour,
  time_slot,
  is_available,
  max_capacity
FROM availability_rules
WHERE service_type = 'all'
ORDER BY day_of_week, time_slot;
