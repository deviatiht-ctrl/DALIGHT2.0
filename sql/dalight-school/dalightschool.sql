-- =====================================================
-- DALIGHT SCHOOL — SQL Setup
-- Prefix: dalightschool_
-- Run this in Supabase SQL Editor
-- =====================================================

-- ── Cours ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  code        TEXT UNIQUE NOT NULL,
  color       TEXT DEFAULT '#4f46e5',
  icon        TEXT DEFAULT 'book-open',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Etudiants ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_acces  TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  avatar_url  TEXT,
  notes       TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Professeurs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_professors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_acces  TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  course_id   UUID REFERENCES dalightschool_courses(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inscriptions (etudiant <-> cours) ─────────────────
CREATE TABLE IF NOT EXISTS dalightschool_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES dalightschool_students(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- ── Documents de cours ────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  file_url       TEXT,
  file_type      TEXT DEFAULT 'pdf',  -- pdf, video, image, link, doc
  size_bytes     BIGINT,
  uploaded_by    UUID REFERENCES dalightschool_professors(id),
  is_visible     BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Devoirs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  instructions TEXT,
  due_date     TIMESTAMPTZ,
  max_score    INTEGER DEFAULT 100,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Soumissions de devoirs ────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES dalightschool_assignments(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES dalightschool_students(id) ON DELETE CASCADE,
  file_url      TEXT,
  text_content  TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  grade         NUMERIC,
  feedback      TEXT,
  graded_at     TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

-- ── Examens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  instructions     TEXT,
  questions        JSONB NOT NULL DEFAULT '[]',
  duration_minutes INTEGER DEFAULT 60,
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Resultats d'examens ───────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_exam_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES dalightschool_exams(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES dalightschool_students(id) ON DELETE CASCADE,
  answers      JSONB DEFAULT '{}',
  score        NUMERIC,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  is_submitted BOOLEAN DEFAULT false,
  UNIQUE(exam_id, student_id)
);

-- ── Notes générales ───────────────────────────────────
CREATE TABLE IF NOT EXISTS dalightschool_grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES dalightschool_students(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'manual', -- exam, assignment, attendance, final, manual
  title       TEXT,
  grade       NUMERIC NOT NULL,
  max_grade   NUMERIC DEFAULT 100,
  notes       TEXT,
  graded_by   UUID REFERENCES dalightschool_professors(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE dalightschool_courses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_professors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_enrollments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_exams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_exam_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalightschool_grades        ENABLE ROW LEVEL SECURITY;

-- Allow anon read on all (portals use anon key with code_acces check in JS)
CREATE POLICY "anon read courses"       ON dalightschool_courses       FOR SELECT TO anon USING (true);
CREATE POLICY "anon read students"      ON dalightschool_students      FOR SELECT TO anon USING (true);
CREATE POLICY "anon read professors"    ON dalightschool_professors    FOR SELECT TO anon USING (true);
CREATE POLICY "anon read enrollments"   ON dalightschool_enrollments   FOR SELECT TO anon USING (true);
CREATE POLICY "anon read documents"     ON dalightschool_documents     FOR SELECT TO anon USING (is_visible = true);
CREATE POLICY "anon read assignments"   ON dalightschool_assignments   FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "anon read submissions"   ON dalightschool_submissions   FOR SELECT TO anon USING (true);
CREATE POLICY "anon read exams"         ON dalightschool_exams         FOR SELECT TO anon USING (true);
CREATE POLICY "anon read exam_results"  ON dalightschool_exam_results  FOR SELECT TO anon USING (true);
CREATE POLICY "anon read grades"        ON dalightschool_grades        FOR SELECT TO anon USING (true);

-- Allow anon insert/update where needed (submissions, exam results)
CREATE POLICY "anon insert submissions"      ON dalightschool_submissions   FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update submissions"      ON dalightschool_submissions   FOR UPDATE TO anon USING (true);
CREATE POLICY "anon insert exam_results"     ON dalightschool_exam_results  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update exam_results"     ON dalightschool_exam_results  FOR UPDATE TO anon USING (true);

-- Authenticated (admin) can do everything
CREATE POLICY "auth all courses"       ON dalightschool_courses       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all students"      ON dalightschool_students      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all professors"    ON dalightschool_professors    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all enrollments"   ON dalightschool_enrollments   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all documents"     ON dalightschool_documents     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all assignments"   ON dalightschool_assignments   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all submissions"   ON dalightschool_submissions   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all exams"         ON dalightschool_exams         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all exam_results"  ON dalightschool_exam_results  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all grades"        ON dalightschool_grades        FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Professors insert documents, assignments, exams, grades (via anon)
CREATE POLICY "anon insert documents"   ON dalightschool_documents  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update documents"   ON dalightschool_documents  FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete documents"   ON dalightschool_documents  FOR DELETE TO anon USING (true);
CREATE POLICY "anon insert assignments" ON dalightschool_assignments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update assignments" ON dalightschool_assignments FOR UPDATE TO anon USING (true);
CREATE POLICY "anon insert exams"       ON dalightschool_exams       FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update exams"       ON dalightschool_exams       FOR UPDATE TO anon USING (true);
CREATE POLICY "anon insert grades"      ON dalightschool_grades      FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update grades"      ON dalightschool_grades      FOR UPDATE TO anon USING (true);

-- =====================================================
-- Storage buckets (run separately in Supabase dashboard if needed)
-- =====================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('school-documents', 'school-documents', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('school-submissions', 'school-submissions', true) ON CONFLICT DO NOTHING;
