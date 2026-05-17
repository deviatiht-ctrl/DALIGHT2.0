-- =============================================
-- DALIGHT — Ajoute Lundi (DOW=1) nan Disponibilite
-- Fichye: lundi.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- REZOUD: Lundi te fèmen nan database la.
-- Sa a mete Lundi disponib 08:00 — 18:00 ak kapasite 3.
-- =============================================

-- Étape 1: Retire ansyen règ Lundi ki te bloke (is_available=false, 00:00)
DELETE FROM availability_rules WHERE day_of_week = 1;

-- Étape 2: Ajoute tout kreno Lundi disponib (08:00 — 18:00)
INSERT INTO availability_rules (day_of_week, time_slot, is_available, max_capacity, service_type)
VALUES
  (1, '08:00:00', true, 3, 'all'),
  (1, '09:00:00', true, 3, 'all'),
  (1, '10:00:00', true, 3, 'all'),
  (1, '11:00:00', true, 3, 'all'),
  (1, '12:00:00', true, 3, 'all'),
  (1, '13:00:00', true, 3, 'all'),
  (1, '14:00:00', true, 3, 'all'),
  (1, '15:00:00', true, 3, 'all'),
  (1, '16:00:00', true, 3, 'all'),
  (1, '17:00:00', true, 3, 'all'),
  (1, '18:00:00', true, 3, 'all')
ON CONFLICT (day_of_week, time_slot) DO UPDATE
  SET is_available = true,
      max_capacity = 3,
      service_type = 'all';

-- Étape 3: Retire tout eksepsyon ki te bloke Lundi yo nan lavni
DELETE FROM availability_exceptions
WHERE EXTRACT(DOW FROM exception_date) = 1
  AND is_blocked = true
  AND exception_date >= CURRENT_DATE;

-- Étape 4: Konfirmasyon — Montre tout règ Lundi
SELECT
  'Lundi' AS jour,
  time_slot,
  is_available,
  max_capacity,
  service_type
FROM availability_rules
WHERE day_of_week = 1
ORDER BY time_slot;
