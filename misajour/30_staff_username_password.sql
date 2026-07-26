-- ============================================================
-- DALIGHT — Pòtal Anplwaye : login ak username / password
-- Fichier: 30_staff_username_password.sql
-- Ranplase ansyen sistèm "code d'accès" pa username + password
-- bay pa admin la nan Employés & Présence -> Portail employé.
-- ============================================================

ALTER TABLE presence_employees
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password TEXT;

-- Username dwe inik (men ka NULL pou anplwaye ki pa gen aksè pòtal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_employees_username
  ON presence_employees (LOWER(username)) WHERE username IS NOT NULL;

-- Verifikasyon
SELECT 'Colonnes ajoutées à presence_employees' AS info;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'presence_employees'
AND column_name IN ('username', 'password')
ORDER BY column_name;
