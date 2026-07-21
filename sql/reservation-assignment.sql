-- ============================================
-- DALIGHT - ASSIGNATION DES RENDEZ-VOUS
-- Permet d'assigner une réservation à un employé (prestataire)
-- ============================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES presence_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservations_assigned ON reservations(assigned_employee_id);

-- Le portail (anon) doit pouvoir mettre à jour l'assignation depuis l'admin
-- (l'admin est authentifié, mais on garde une policy anon pour cohérence portail).
DROP POLICY IF EXISTS "portal_update_reservations" ON reservations;
CREATE POLICY "portal_update_reservations" ON reservations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

SELECT 'Colonnes ajoutées à reservations' AS info;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'reservations'
AND column_name IN ('assigned_employee_id', 'assigned_employee_name', 'assigned_at')
ORDER BY column_name;
