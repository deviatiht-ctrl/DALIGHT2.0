-- ============================================
-- DALIGHT GIVEAWAYS MIGRATION
-- Ajoute les nouveaux champs pour les URLs multiples
-- ============================================

-- Ajouter les colonnes JSONB pour les URLs multiples
ALTER TABLE giveaways 
ADD COLUMN IF NOT EXISTS instagram_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS facebook_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tiktok_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS twitter_urls JSONB DEFAULT '[]'::jsonb;

-- Migration des données existantes (si nécessaire)
UPDATE giveaways 
SET instagram_urls = CASE WHEN instagram_url IS NOT NULL THEN to_jsonb(ARRAY[instagram_url]) ELSE '[]'::jsonb END
WHERE instagram_urls = '[]'::jsonb AND instagram_url IS NOT NULL;

UPDATE giveaways 
SET facebook_urls = CASE WHEN facebook_url IS NOT NULL THEN to_jsonb(ARRAY[facebook_url]) ELSE '[]'::jsonb END
WHERE facebook_urls = '[]'::jsonb AND facebook_url IS NOT NULL;

UPDATE giveaways 
SET tiktok_urls = CASE WHEN tiktok_url IS NOT NULL THEN to_jsonb(ARRAY[tiktok_url]) ELSE '[]'::jsonb END
WHERE tiktok_urls = '[]'::jsonb AND tiktok_url IS NOT NULL;

UPDATE giveaways 
SET twitter_urls = CASE WHEN twitter_url IS NOT NULL THEN to_jsonb(ARRAY[twitter_url]) ELSE '[]'::jsonb END
WHERE twitter_urls = '[]'::jsonb AND twitter_url IS NOT NULL;

-- Index pour accélérer la recherche des liens de parrainage
CREATE INDEX IF NOT EXISTS idx_participants_vote_key ON giveaway_participants(unique_vote_key);

-- Ajouter des champs pour vérifier l'engagement des votants sur les réseaux sociaux
ALTER TABLE giveaway_votes
ADD COLUMN IF NOT EXISTS voter_instagram_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS voter_subscribed_instagram BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voter_liked_post BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voter_commented_post BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
