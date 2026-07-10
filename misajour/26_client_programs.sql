-- ============================================================
-- DALIGHT — Suivi client / programmes de soins
-- Fichier: 26_client_programs.sql
-- SAFE: idempotent, depends on reservations, services, profiles
-- ============================================================

-- Make sure admin check function exists
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
-- 1. TABLE client_programs (programme global d’un client)
-- ============================================================
CREATE TABLE IF NOT EXISTS client_programs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id     UUID REFERENCES reservations(id) ON DELETE SET NULL,
  client_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name        TEXT NOT NULL,
  client_email       TEXT NOT NULL,
  client_phone       TEXT DEFAULT '',
  service_id         UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name       TEXT NOT NULL,
  service_category   TEXT DEFAULT '',         -- ex: 'wood_therapy', 'head_spa', 'massage'
  total_sessions     INTEGER NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date         DATE,
  end_date           DATE,
  goals              TEXT DEFAULT '',          -- objectifs du client
  therapist_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes              TEXT DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_programs_reservation ON client_programs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_client_id   ON client_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_client_email ON client_programs(client_email);
CREATE INDEX IF NOT EXISTS idx_client_programs_service_id  ON client_programs(service_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_status      ON client_programs(status);
CREATE INDEX IF NOT EXISTS idx_client_programs_category    ON client_programs(service_category);

-- ============================================================
-- 2. TABLE client_program_sessions (séances individuelles)
-- ============================================================
CREATE TABLE IF NOT EXISTS client_program_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id         UUID NOT NULL REFERENCES client_programs(id) ON DELETE CASCADE,
  session_number     INTEGER NOT NULL,
  session_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg          DECIMAL(5,2),
  measurements       JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_metrics    JSONB NOT NULL DEFAULT '{}'::jsonb, -- données spécifiques au service
  massage_notes      TEXT DEFAULT '',
  diet_notes         TEXT DEFAULT '',
  observations       TEXT DEFAULT '',
  therapist_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_client_program_sessions_program ON client_program_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_client_program_sessions_date   ON client_program_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_client_program_sessions_number ON client_program_sessions(session_number);

-- ============================================================
-- 3. TABLE client_program_photos (photos de progression)
-- ============================================================
CREATE TABLE IF NOT EXISTS client_program_photos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id         UUID NOT NULL REFERENCES client_programs(id) ON DELETE CASCADE,
  session_id         UUID REFERENCES client_program_sessions(id) ON DELETE SET NULL,
  photo_url          TEXT NOT NULL,
  caption            TEXT DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_program_photos_program ON client_program_photos(program_id);
CREATE INDEX IF NOT EXISTS idx_client_program_photos_session  ON client_program_photos(session_id);

-- ============================================================
-- 4. TRIGGERS updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_client_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_client_program_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_programs_updated_at ON client_programs;
CREATE TRIGGER trg_client_programs_updated_at
  BEFORE UPDATE ON client_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_client_programs_updated_at();

DROP TRIGGER IF EXISTS trg_client_program_sessions_updated_at ON client_program_sessions;
CREATE TRIGGER trg_client_program_sessions_updated_at
  BEFORE UPDATE ON client_program_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_program_sessions_updated_at();

-- ============================================================
-- 5. VUE programmes avec progression
-- ============================================================
CREATE OR REPLACE VIEW client_program_progress AS
SELECT
  cp.*,
  COALESCE(s.completed_sessions, 0) AS completed_sessions,
  GREATEST(cp.total_sessions - COALESCE(s.completed_sessions, 0), 0) AS remaining_sessions,
  first_session.weight_start,
  last_session.weight_end,
  last_session.latest_date
FROM client_programs cp
LEFT JOIN (
  SELECT program_id,
         COUNT(*) FILTER (WHERE completed = true) AS completed_sessions,
         MAX(session_date) AS latest_date
  FROM client_program_sessions
  GROUP BY program_id
) s ON s.program_id = cp.id
LEFT JOIN (
  SELECT program_id, weight_kg AS weight_start
  FROM client_program_sessions
  WHERE session_number = 1
) first_session ON first_session.program_id = cp.id
LEFT JOIN (
  SELECT DISTINCT ON (program_id) program_id, weight_kg AS weight_end, session_date AS latest_date
  FROM client_program_sessions
  ORDER BY program_id, session_date DESC, session_number DESC
) last_session ON last_session.program_id = cp.id;

-- ============================================================
-- 6. RLS — admin seulement
-- ============================================================
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_client_programs ON client_programs;
CREATE POLICY admin_all_client_programs ON client_programs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_all_client_program_sessions ON client_program_sessions;
CREATE POLICY admin_all_client_program_sessions ON client_program_sessions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_all_client_program_photos ON client_program_photos;
CREATE POLICY admin_all_client_program_photos ON client_program_photos
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 7. FONCTION pour créer un programme depuis une réservation
-- ============================================================
CREATE OR REPLACE FUNCTION create_program_from_reservation(
  p_reservation_id UUID,
  p_total_sessions INTEGER DEFAULT 1,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_therapist_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_service_category TEXT;
  v_program_id UUID;
BEGIN
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT COALESCE(category, '') INTO v_service_category
  FROM services WHERE id = v_reservation.service_id;

  INSERT INTO client_programs (
    reservation_id,
    client_id,
    client_name,
    client_email,
    service_id,
    service_name,
    service_category,
    total_sessions,
    status,
    start_date,
    therapist_id
  ) VALUES (
    v_reservation.id,
    v_reservation.user_id,
    COALESCE(v_reservation.user_name, ''),
    v_reservation.user_email,
    v_reservation.service_id,
    v_reservation.service,
    v_service_category,
    p_total_sessions,
    'active',
    p_start_date,
    p_therapist_id
  )
  RETURNING id INTO v_program_id;

  RETURN v_program_id;
END;
$$;
