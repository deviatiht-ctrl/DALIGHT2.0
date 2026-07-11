-- ============================================================
-- DALIGHT — Statut formulaire + champs praticien
-- Fichier: 27_form_submission_status_practitioner.sql
-- SAFE: idempotent, depends on 23_consent_forms.sql
-- ============================================================

-- 1. Statut du formulaire rempli
------------------------------------------------------------
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'en attente';

-- Valeurs attendues :
--   en attente        => formulaire reçu, pas encore consulté
--   consulté          => ouvert/admin consulté
--   traitement terminé=> diagnostic/soin renseigné
--   envoyé au client  => rapport transmis au client
UPDATE form_submissions
  SET status = 'en attente'
  WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);

-- 2. Données renseignées par le praticien après le soin
------------------------------------------------------------
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS practitioner_data JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Trigger updated_at optionnel (si table n'en a pas déjà)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_form_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ajoute une colonne updated_at si elle n'existe pas
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS form_submissions_updated_at ON form_submissions;
CREATE TRIGGER form_submissions_updated_at
  BEFORE UPDATE ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_form_submissions_updated_at();

-- ============================================================
-- DONE
-- ============================================================
SELECT '✅ 27_form_submission_status_practitioner.sql appliqué avec succès' AS status;
