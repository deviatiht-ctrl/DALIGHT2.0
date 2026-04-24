-- Video spotlight + storage setup for DALIGHT Head Spa Japonais
-- Run this script inside Supabase SQL editor (using the service role).

-- 1. Ensure profiles + posts tables exist (idempotent guards)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('review', 'video')),
  content TEXT,
  video_url TEXT,
  caption TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Admin email allow-list (adjust emails as needed)
CREATE OR REPLACE FUNCTION public.is_allowlisted_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt()->>'email', '') = ANY(ARRAY[
    'laurorejeanclarens0@gmail.com'
  ]);
$$;

-- 2. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self_view ON profiles;
CREATE POLICY profiles_self_view ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_view ON profiles;
CREATE POLICY profiles_admin_view ON profiles
  FOR SELECT USING (public.is_allowlisted_admin());

DROP POLICY IF EXISTS posts_public_read ON posts;
CREATE POLICY posts_public_read ON posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS posts_user_insert ON posts;
CREATE POLICY posts_user_insert ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS posts_admin_delete ON posts;
CREATE POLICY posts_admin_delete ON posts
  FOR DELETE USING (public.is_allowlisted_admin());

DROP POLICY IF EXISTS likes_public_read ON likes;
CREATE POLICY likes_public_read ON likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS likes_user_insert ON likes;
CREATE POLICY likes_user_insert ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS likes_user_delete ON likes;
CREATE POLICY likes_user_delete ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Trigger to keep like counters in sync
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes = likes - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes;
CREATE TRIGGER update_likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- 4. Create/ensure \"videos\" storage bucket exists (public playback)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 5. Storage policies for the videos bucket
-- Allow anyone to stream/download the videos
DROP POLICY IF EXISTS videos_public_read ON storage.objects;
CREATE POLICY videos_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

-- Allow admin to upload/delete videos via the client (direct email check)
DROP POLICY IF EXISTS videos_admin_insert ON storage.objects;
CREATE POLICY videos_admin_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'videos'
    AND auth.jwt() ->> 'email' = 'laurorejeanclarens0@gmail.com'
  );

DROP POLICY IF EXISTS videos_admin_delete ON storage.objects;
CREATE POLICY videos_admin_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'videos'
    AND auth.jwt() ->> 'email' = 'laurorejeanclarens0@gmail.com'
  );

-- Optional: ensure metadata updates also restricted to admins
DROP POLICY IF EXISTS videos_admin_update ON storage.objects;
CREATE POLICY videos_admin_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'videos'
    AND auth.jwt() ->> 'email' = 'laurorejeanclarens0@gmail.com'
  );

-- Done. After running this script, assign your admin user the 'admin' role:
-- UPDATE profiles SET role = 'admin' WHERE id = '<admin-auth-user-uuid>';
