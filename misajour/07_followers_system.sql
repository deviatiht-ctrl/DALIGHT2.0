-- =============================================
-- DALIGHT — Followers/Following System
-- Fichye: 07_followers_system.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- PWOJE:
--   - Konekte itilizè kapab follow lòt itilizè
--   - Tout moun kapal we followers yo
--   - Sistèm follow/unfollow ak konte
--   - Sistèm subscribe nan paj (subscribers table)
-- =============================================

-- 1. Kreye tab followers (pou follow lòt itilizè)
CREATE TABLE IF NOT EXISTS followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 2. Kreye tab subscribers (pou subscribe nan paj DALIGHT)
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. Ajoute index pou performans
CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_followers_created ON followers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscribers_user ON subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_created ON subscribers(created_at DESC);

-- 3. Fonksyon pou follow yon itilizè
CREATE OR REPLACE FUNCTION follow_user(
  p_follower_id UUID,
  p_following_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Pa pèmèt moun follow tèt yo
  IF p_follower_id = p_following_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa ka follow tèt ou');
  END IF;

  INSERT INTO followers (follower_id, following_id)
  VALUES (p_follower_id, p_following_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  -- Check si li te kreye oswa deja egziste
  IF FOUND THEN
    v_result := jsonb_build_object('success', true, 'action', 'followed');
  ELSE
    v_result := jsonb_build_object('success', true, 'action', 'already_following');
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fonksyon pou unfollow yon itilizè
CREATE OR REPLACE FUNCTION unfollow_user(
  p_follower_id UUID,
  p_following_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM followers
  WHERE follower_id = p_follower_id AND following_id = p_following_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN jsonb_build_object('success', true, 'action', 'unfollowed');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Pa t ap follow sa');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonksyon pou we si moun ap follow yon itilizè
CREATE OR REPLACE FUNCTION is_following(
  p_follower_id UUID,
  p_following_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM followers
    WHERE follower_id = p_follower_id AND following_id = p_following_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fonksyon pou konte followers yon itilizè
CREATE OR REPLACE FUNCTION get_follower_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM followers
    WHERE following_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fonksyon pou konte following yon itilizè
CREATE OR REPLACE FUNCTION get_following_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM followers
    WHERE follower_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Fonksyon pou we tout followers yon itilizè
CREATE OR REPLACE FUNCTION get_followers(p_user_id UUID)
RETURNS TABLE (
  follower_id UUID,
  follower_name TEXT,
  follower_email TEXT,
  followed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.follower_id,
    COALESCE(p.full_name, p.email) as follower_name,
    p.email as follower_email,
    f.created_at as followed_at
  FROM followers f
  JOIN profiles p ON f.follower_id = p.id
  WHERE f.following_id = p_user_id
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Fonksyon pou we tout following yon itilizè
CREATE OR REPLACE FUNCTION get_following(p_user_id UUID)
RETURNS TABLE (
  following_id UUID,
  following_name TEXT,
  following_email TEXT,
  followed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.following_id,
    COALESCE(p.full_name, p.email) as following_name,
    p.email as following_email,
    f.created_at as followed_at
  FROM followers f
  JOIN profiles p ON f.following_id = p.id
  WHERE f.follower_id = p_user_id
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Aktive Realtime pou tab followers ak subscribers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'followers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE followers;
    RAISE NOTICE 'followers ajouté à supabase_realtime';
  ELSE
    RAISE NOTICE 'followers déjà dans supabase_realtime';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'subscribers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE subscribers;
    RAISE NOTICE 'subscribers ajouté à supabase_realtime';
  ELSE
    RAISE NOTICE 'subscribers déjà dans supabase_realtime';
  END IF;
END $$;

-- 11. Row Level Security (RLS) pou followers
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Followers are viewable by everyone" ON followers;
CREATE POLICY "Followers are viewable by everyone"
  ON followers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can follow when authenticated" ON followers;
CREATE POLICY "Users can follow when authenticated"
  ON followers FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow their own follows" ON followers;
CREATE POLICY "Users can unfollow their own follows"
  ON followers FOR DELETE
  USING (auth.uid() = follower_id);

-- 12. Row Level Security (RLS) pou subscribers
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscribers are viewable by everyone" ON subscribers;
CREATE POLICY "Subscribers are viewable by everyone"
  ON subscribers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can subscribe when authenticated" ON subscribers;
CREATE POLICY "Users can subscribe when authenticated"
  ON subscribers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsubscribe their own subscription" ON subscribers;
CREATE POLICY "Users can unsubscribe their own subscription"
  ON subscribers FOR DELETE
  USING (auth.uid() = user_id);

-- 13. Verify kreyasyon
SELECT 
  'followers table created' as status,
  (SELECT COUNT(*) FROM followers) as row_count;

SELECT 
  'subscribers table created' as status,
  (SELECT COUNT(*) FROM subscribers) as row_count;

SELECT 
  'Functions created' as status,
  COUNT(*) as function_count
FROM pg_proc
WHERE proname IN ('follow_user', 'unfollow_user', 'is_following', 'get_follower_count', 'get_following_count', 'get_followers', 'get_following');
