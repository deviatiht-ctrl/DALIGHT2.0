-- =====================================================
-- DALIGHT SCHOOL — SQL Setup (idempotent — safe to re-run)
-- Prefix: dalightschool_
-- Run this in Supabase SQL Editor
-- =====================================================

-- ── 1. TABLES ─────────────────────────────────────────
-- (CREATE TABLE IF NOT EXISTS = pas d'erreur si déjà existant)

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

CREATE TABLE IF NOT EXISTS dalightschool_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES dalightschool_students(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS dalightschool_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  file_url    TEXT,
  file_type   TEXT DEFAULT 'pdf',
  size_bytes  BIGINT,
  uploaded_by UUID REFERENCES dalightschool_professors(id) ON DELETE SET NULL,
  is_visible  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS dalightschool_grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES dalightschool_students(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES dalightschool_courses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'manual',
  title       TEXT,
  grade       NUMERIC NOT NULL,
  max_grade   NUMERIC DEFAULT 100,
  notes       TEXT,
  graded_by   UUID REFERENCES dalightschool_professors(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. RLS ACTIVATION ─────────────────────────────────
-- (ENABLE RLS est idempotent — pas d'erreur si déjà activé)

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

-- ── 3. POLICIES ───────────────────────────────────────
-- DROP IF EXISTS avant chaque CREATE pour éviter "policy already exists"

-- courses
DROP POLICY IF EXISTS "anon read courses"  ON dalightschool_courses;
DROP POLICY IF EXISTS "auth all courses"   ON dalightschool_courses;
CREATE POLICY "anon read courses" ON dalightschool_courses FOR SELECT TO anon USING (true);
CREATE POLICY "auth all courses"  ON dalightschool_courses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- students
DROP POLICY IF EXISTS "anon read students" ON dalightschool_students;
DROP POLICY IF EXISTS "auth all students"  ON dalightschool_students;
CREATE POLICY "anon read students" ON dalightschool_students FOR SELECT TO anon USING (true);
CREATE POLICY "auth all students"  ON dalightschool_students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- professors
DROP POLICY IF EXISTS "anon read professors" ON dalightschool_professors;
DROP POLICY IF EXISTS "auth all professors"  ON dalightschool_professors;
CREATE POLICY "anon read professors" ON dalightschool_professors FOR SELECT TO anon USING (true);
CREATE POLICY "auth all professors"  ON dalightschool_professors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- enrollments
DROP POLICY IF EXISTS "anon read enrollments" ON dalightschool_enrollments;
DROP POLICY IF EXISTS "auth all enrollments"  ON dalightschool_enrollments;
CREATE POLICY "anon read enrollments" ON dalightschool_enrollments FOR SELECT TO anon USING (true);
CREATE POLICY "auth all enrollments"  ON dalightschool_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- documents
DROP POLICY IF EXISTS "anon read documents"   ON dalightschool_documents;
DROP POLICY IF EXISTS "anon insert documents" ON dalightschool_documents;
DROP POLICY IF EXISTS "anon update documents" ON dalightschool_documents;
DROP POLICY IF EXISTS "anon delete documents" ON dalightschool_documents;
DROP POLICY IF EXISTS "auth all documents"    ON dalightschool_documents;
CREATE POLICY "anon read documents"   ON dalightschool_documents FOR SELECT TO anon USING (is_visible = true);
CREATE POLICY "anon insert documents" ON dalightschool_documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update documents" ON dalightschool_documents FOR UPDATE TO anon USING (true);
CREATE POLICY "anon delete documents" ON dalightschool_documents FOR DELETE TO anon USING (true);
CREATE POLICY "auth all documents"    ON dalightschool_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- assignments
DROP POLICY IF EXISTS "anon read assignments"   ON dalightschool_assignments;
DROP POLICY IF EXISTS "anon insert assignments" ON dalightschool_assignments;
DROP POLICY IF EXISTS "anon update assignments" ON dalightschool_assignments;
DROP POLICY IF EXISTS "auth all assignments"    ON dalightschool_assignments;
CREATE POLICY "anon read assignments"   ON dalightschool_assignments FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "anon insert assignments" ON dalightschool_assignments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update assignments" ON dalightschool_assignments FOR UPDATE TO anon USING (true);
CREATE POLICY "auth all assignments"    ON dalightschool_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- submissions
DROP POLICY IF EXISTS "anon read submissions"   ON dalightschool_submissions;
DROP POLICY IF EXISTS "anon insert submissions" ON dalightschool_submissions;
DROP POLICY IF EXISTS "anon update submissions" ON dalightschool_submissions;
DROP POLICY IF EXISTS "auth all submissions"    ON dalightschool_submissions;
CREATE POLICY "anon read submissions"   ON dalightschool_submissions FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert submissions" ON dalightschool_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update submissions" ON dalightschool_submissions FOR UPDATE TO anon USING (true);
CREATE POLICY "auth all submissions"    ON dalightschool_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- exams
DROP POLICY IF EXISTS "anon read exams"   ON dalightschool_exams;
DROP POLICY IF EXISTS "anon insert exams" ON dalightschool_exams;
DROP POLICY IF EXISTS "anon update exams" ON dalightschool_exams;
DROP POLICY IF EXISTS "auth all exams"    ON dalightschool_exams;
CREATE POLICY "anon read exams"   ON dalightschool_exams FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert exams" ON dalightschool_exams FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update exams" ON dalightschool_exams FOR UPDATE TO anon USING (true);
CREATE POLICY "auth all exams"    ON dalightschool_exams FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- exam_results
DROP POLICY IF EXISTS "anon read exam_results"   ON dalightschool_exam_results;
DROP POLICY IF EXISTS "anon insert exam_results" ON dalightschool_exam_results;
DROP POLICY IF EXISTS "anon update exam_results" ON dalightschool_exam_results;
DROP POLICY IF EXISTS "auth all exam_results"    ON dalightschool_exam_results;
CREATE POLICY "anon read exam_results"   ON dalightschool_exam_results FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert exam_results" ON dalightschool_exam_results FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update exam_results" ON dalightschool_exam_results FOR UPDATE TO anon USING (true);
CREATE POLICY "auth all exam_results"    ON dalightschool_exam_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- grades
DROP POLICY IF EXISTS "anon read grades"   ON dalightschool_grades;
DROP POLICY IF EXISTS "anon insert grades" ON dalightschool_grades;
DROP POLICY IF EXISTS "anon update grades" ON dalightschool_grades;
DROP POLICY IF EXISTS "auth all grades"    ON dalightschool_grades;
CREATE POLICY "anon read grades"   ON dalightschool_grades FOR SELECT TO anon USING (true);
CREATE POLICY "anon insert grades" ON dalightschool_grades FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon update grades" ON dalightschool_grades FOR UPDATE TO anon USING (true);
CREATE POLICY "auth all grades"    ON dalightschool_grades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. STORAGE BUCKETS ────────────────────────────────
-- (ON CONFLICT DO NOTHING = pas d'erreur si déjà existant)

INSERT INTO storage.buckets (id, name, public)
  VALUES ('school-documents', 'school-documents', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('school-submissions', 'school-submissions', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'school-documents public read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "school-documents public read"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id IN ('school-documents', 'school-submissions'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'school-documents anon upload' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "school-documents anon upload"
      ON storage.objects FOR INSERT TO anon
      WITH CHECK (bucket_id IN ('school-documents', 'school-submissions'));
  END IF;
END $$;
