-- ============================================================
-- DALIGHT — Formulaires de consentement (Consent Forms)
-- Fichier: 23_consent_forms.sql
-- SAFE: works on fresh installs AND existing databases.
-- Ne casse AUCUNE réservation existante.
-- ============================================================

-- ── 0. S'assurer que la fonction is_admin() existe ───────────
-- (Elle est normalement créée dans sql/admin.sql. On la (re)crée ici
--  de façon idempotente pour éviter toute erreur si absente.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    (auth.jwt() ->> 'email') = ANY (ARRAY[
      'laurorejeanclarens0@gmail.com'
    ])
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- ============================================================
-- 1. TABLE form_templates (modèles créés par l'admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS form_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  form_type         TEXT DEFAULT '',          -- ex: "Consentement Head Spa"
  service_id        UUID,                      -- lien optionnel vers services.id
  service_name      TEXT DEFAULT '',           -- nom du service (pour matching)
  service_category  TEXT DEFAULT '',           -- catégorie optionnelle
  applies_to_all    BOOLEAN NOT NULL DEFAULT false, -- s'applique à tous les services
  fields            JSONB NOT NULL DEFAULT '[]'::jsonb, -- liste des questions/champs
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_templates_service_id ON form_templates(service_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_active ON form_templates(is_active);

-- ============================================================
-- 2. TABLE form_submissions (formulaires remplis par les clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS form_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number  TEXT UNIQUE NOT NULL,       -- ex: FORM-A1B2C3
  form_template_id  UUID REFERENCES form_templates(id) ON DELETE SET NULL,
  reservation_id    UUID REFERENCES reservations(id) ON DELETE SET NULL,
  user_id           UUID,                        -- auth.users.id du client
  client_name       TEXT DEFAULT '',
  client_email      TEXT DEFAULT '',
  client_phone      TEXT DEFAULT '',
  service_name      TEXT DEFAULT '',
  form_title        TEXT DEFAULT '',
  form_type         TEXT DEFAULT '',
  answers           JSONB NOT NULL DEFAULT '[]'::jsonb, -- réponses du client
  signature_data    TEXT DEFAULT '',             -- signature (data URL base64)
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_reservation ON form_submissions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON form_submissions(client_email);
CREATE INDEX IF NOT EXISTS idx_form_submissions_phone ON form_submissions(client_phone);
CREATE INDEX IF NOT EXISTS idx_form_submissions_ref ON form_submissions(reference_number);

-- ============================================================
-- 3. TRIGGER updated_at pour form_templates
-- ============================================================
CREATE OR REPLACE FUNCTION update_form_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_templates_updated_at ON form_templates;
CREATE TRIGGER form_templates_updated_at
  BEFORE UPDATE ON form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_form_templates_updated_at();

-- ============================================================
-- 4. RLS — form_templates
-- ============================================================
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_templates public read active" ON form_templates;
CREATE POLICY "form_templates public read active"
  ON form_templates FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "form_templates admin read all" ON form_templates;
CREATE POLICY "form_templates admin read all"
  ON form_templates FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "form_templates admin insert" ON form_templates;
CREATE POLICY "form_templates admin insert"
  ON form_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_templates admin update" ON form_templates;
CREATE POLICY "form_templates admin update"
  ON form_templates FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_templates admin delete" ON form_templates;
CREATE POLICY "form_templates admin delete"
  ON form_templates FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 5. RLS — form_submissions
-- ============================================================
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Le client peut insérer sa propre soumission
DROP POLICY IF EXISTS "form_submissions insert own" ON form_submissions;
CREATE POLICY "form_submissions insert own"
  ON form_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Le client voit ses propres soumissions ; l'admin voit tout
DROP POLICY IF EXISTS "form_submissions read own or admin" ON form_submissions;
CREATE POLICY "form_submissions read own or admin"
  ON form_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Admin peut mettre à jour / supprimer
DROP POLICY IF EXISTS "form_submissions admin update" ON form_submissions;
CREATE POLICY "form_submissions admin update"
  ON form_submissions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_submissions admin delete" ON form_submissions;
CREATE POLICY "form_submissions admin delete"
  ON form_submissions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 6. Générateur automatique du reference_number (si non fourni)
-- ============================================================
CREATE OR REPLACE FUNCTION set_form_submission_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := 'FORM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_submissions_set_ref ON form_submissions;
CREATE TRIGGER form_submissions_set_ref
  BEFORE INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION set_form_submission_reference();

-- ============================================================
-- DONE
-- ============================================================
SELECT '✅ 23_consent_forms.sql appliqué avec succès' AS status;
