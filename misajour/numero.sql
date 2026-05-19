-- =============================================
-- DALIGHT — Asire kolòn phone egziste nan reservations
-- Fichye: numero.sql
-- Kouri nan Supabase SQL Editor
-- =============================================

-- Étape 1: Ajoute kolòn phone si li pa la
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'phone'
  ) THEN
    ALTER TABLE reservations ADD COLUMN phone TEXT;
    RAISE NOTICE 'Kolòn phone ajoute nan reservations';
  ELSE
    RAISE NOTICE 'Kolòn phone deja egziste nan reservations';
  END IF;
END $$;

-- Étape 2: Verifye kolòn lan egziste
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name = 'phone';

-- Étape 3: Montre kantite rezèvasyon ki gen numero telephone
SELECT
  COUNT(*) AS total_reservations,
  COUNT(phone) AS with_phone,
  COUNT(*) - COUNT(phone) AS without_phone
FROM reservations;
