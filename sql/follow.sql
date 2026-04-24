-- ============================================
-- DALIGHT HEAD SPA - FONCTIONNALITÉS SOCIALES
-- Exécuter après storage.sql
-- ============================================

-- ============================================
-- TRIGGER pour mettre à jour le compteur de likes
-- ============================================

CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET likes = COALESCE(likes, 0) + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET likes = GREATEST(COALESCE(likes, 0) - 1, 0) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_likes_count_trigger ON likes;
CREATE TRIGGER update_likes_count_trigger
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_count();

-- ============================================
-- FONCTION pour obtenir le nombre d'abonnés
-- ============================================

CREATE OR REPLACE FUNCTION get_subscriber_count()
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM subscribers;
$$ LANGUAGE sql STABLE;

-- ============================================
-- FONCTION pour vérifier si un utilisateur est abonné
-- ============================================

CREATE OR REPLACE FUNCTION is_subscribed(check_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM subscribers WHERE user_id = check_user_id
    );
$$ LANGUAGE sql STABLE;

-- ============================================
-- FONCTION pour obtenir les posts avec infos likes
-- ============================================

CREATE OR REPLACE FUNCTION get_posts_with_likes(
    post_type TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_name TEXT,
    type TEXT,
    video_url TEXT,
    image_url TEXT,
    content TEXT,
    caption TEXT,
    likes INTEGER,
    is_pinned BOOLEAN,
    created_at TIMESTAMPTZ,
    user_has_liked BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.user_name,
        p.type,
        p.video_url,
        p.image_url,
        p.content,
        p.caption,
        p.likes,
        p.is_pinned,
        p.created_at,
        EXISTS (
            SELECT 1 FROM likes l 
            WHERE l.post_id = p.id AND l.user_id = auth.uid()
        ) AS user_has_liked
    FROM posts p
    WHERE p.is_active = TRUE
        AND (post_type IS NULL OR p.type = post_type)
    ORDER BY p.is_pinned DESC, p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- REALTIME - Activer pour posts et likes
-- ============================================

-- Activer la réplication pour le temps réel
-- Note: Ces commandes peuvent échouer si les tables sont déjà dans la publication
-- Exécutez-les une par une si nécessaire
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE posts;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE likes;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE subscribers;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
