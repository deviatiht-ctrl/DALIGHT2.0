-- DALIGHT — Create page_views table for visitor tracking
-- =============================================

-- Create page_views table
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);

-- Create index on page_url
CREATE INDEX IF NOT EXISTS idx_page_views_url ON page_views(page_url);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for public tracking)
CREATE POLICY IF NOT EXISTS "Allow insert page_views" 
ON page_views FOR INSERT 
WITH CHECK (true);

-- Allow admin to read
CREATE POLICY IF NOT EXISTS "Allow admin read page_views" 
ON page_views FOR SELECT 
USING (auth.role() = 'authenticated');

-- Verify table created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'page_views' 
ORDER BY ordinal_position;
