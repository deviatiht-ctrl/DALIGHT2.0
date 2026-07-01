-- ============================================
-- DALIGHT GIVEAWAYS / CONCOURS SYSTEM
-- ============================================

-- Create Storage bucket for flyers
-- Note: This needs to be run in Supabase Storage section, not SQL Editor
-- Bucket name: giveaways-flyers
-- Make it public for public access to images

-- Table pour les concours/giveaways
CREATE TABLE IF NOT EXISTS giveaways (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  flyer_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  tiktok_url TEXT,
  twitter_url TEXT,
  instagram_urls JSONB DEFAULT '[]'::jsonb,
  facebook_urls JSONB DEFAULT '[]'::jsonb,
  tiktok_urls JSONB DEFAULT '[]'::jsonb,
  twitter_urls JSONB DEFAULT '[]'::jsonb,
  rules TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les participants aux concours
CREATE TABLE IF NOT EXISTS giveaway_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  instagram_username VARCHAR(100),
  facebook_username VARCHAR(100),
  tiktok_username VARCHAR(100),
  is_subscribed_instagram BOOLEAN DEFAULT false,
  is_subscribed_facebook BOOLEAN DEFAULT false,
  is_subscribed_tiktok BOOLEAN DEFAULT false,
  tagged_friends_count INTEGER DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  unique_vote_key VARCHAR(255) UNIQUE, -- Pour validation unique
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les votes (pour éviter les votes multiples)
CREATE TABLE IF NOT EXISTS giveaway_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES giveaway_participants(id) ON DELETE CASCADE,
  voter_email VARCHAR(255) NOT NULL,
  voter_name VARCHAR(255),
  ip_address VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, voter_email)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(is_active);
CREATE INDEX IF NOT EXISTS idx_giveaways_dates ON giveaways(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_participants_giveaway ON giveaway_participants(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_participants_email ON giveaway_participants(email);
CREATE INDEX IF NOT EXISTS idx_votes_participant ON giveaway_votes(participant_id);

-- RLS Policies
ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_votes ENABLE ROW LEVEL SECURITY;

-- Policy pour giveaways (lecture publique pour tous, écriture admin seulement)
DROP POLICY IF EXISTS "Giveaways: Public read access" ON giveaways;
CREATE POLICY "Giveaways: Public read access" ON giveaways
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Giveaways: Admin insert" ON giveaways;
CREATE POLICY "Giveaways: Admin insert" ON giveaways
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Giveaways: Admin update" ON giveaways;
CREATE POLICY "Giveaways: Admin update" ON giveaways
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Giveaways: Admin delete" ON giveaways;
CREATE POLICY "Giveaways: Admin delete" ON giveaways
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy pour participants (lecture publique, insertion publique, modification admin)
DROP POLICY IF EXISTS "Participants: Public read access" ON giveaway_participants;
CREATE POLICY "Participants: Public read access" ON giveaway_participants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Participants: Public insert" ON giveaway_participants;
CREATE POLICY "Participants: Public insert" ON giveaway_participants
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Participants: Admin update" ON giveaway_participants;
CREATE POLICY "Participants: Admin update" ON giveaway_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Participants: Admin delete" ON giveaway_participants;
CREATE POLICY "Participants: Admin delete" ON giveaway_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy pour votes (lecture publique, insertion publique)
DROP POLICY IF EXISTS "Votes: Public read access" ON giveaway_votes;
CREATE POLICY "Votes: Public read access" ON giveaway_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Votes: Public insert" ON giveaway_votes;
CREATE POLICY "Votes: Public insert" ON giveaway_votes
  FOR INSERT WITH CHECK (true);

-- Function pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_giveaway_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER trigger_giveaways_updated
  BEFORE UPDATE ON giveaways
  FOR EACH ROW
  EXECUTE FUNCTION update_giveaway_timestamp();

CREATE TRIGGER trigger_participants_updated
  BEFORE UPDATE ON giveaway_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_giveaway_timestamp();

-- Insertion d'un concours exemple
INSERT INTO giveaways (title, description, rules, start_date, end_date, is_active)
VALUES (
  'Concours DALIGHT - Gagnez un soin Head Spa!',
  'Participez à notre concours et gagnez un soin Head Spa gratuit. Abonnez-vous à nos réseaux sociaux et taggez vos amis!',
  '1. Abonnez-vous à notre page Instagram @dalightbeauty
2. Taggez au moins 3 amis dans les commentaires
3. Partagez le post sur votre story
4. Un seul vote par personne',
  NOW(),
  NOW() + INTERVAL '30 days',
  false
) ON CONFLICT DO NOTHING;
