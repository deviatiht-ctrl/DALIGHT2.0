-- =============================================
-- DALIGHT — Retire "Head Spa" nan tout email templates
-- Fichye: 20_rename_dalight_emails.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- REZOUD: Chanje "DALIGHT Head Spa" -> "DALIGHT" nan titre, subject, footer
-- =============================================

-- Update tout templates ki gen "DALIGHT Head Spa" -> "DALIGHT"
UPDATE email_templates
SET
  subject = REPLACE(subject, 'DALIGHT Head Spa', 'DALIGHT'),
  header_title = REPLACE(header_title, 'DALIGHT Head Spa', 'DALIGHT'),
  header_subtitle = REPLACE(header_subtitle, 'DALIGHT Head Spa', 'DALIGHT'),
  body_html = REPLACE(body_html, 'DALIGHT Head Spa', 'DALIGHT'),
  footer_text = REPLACE(footer_text, 'DALIGHT Head Spa', 'DALIGHT')
WHERE
  subject LIKE '%DALIGHT Head Spa%'
  OR header_title LIKE '%DALIGHT Head Spa%'
  OR header_subtitle LIKE '%DALIGHT Head Spa%'
  OR body_html LIKE '%DALIGHT Head Spa%'
  OR footer_text LIKE '%DALIGHT Head Spa%';

-- Update default values tou
ALTER TABLE email_templates
  ALTER COLUMN header_title SET DEFAULT 'DALIGHT',
  ALTER COLUMN footer_text SET DEFAULT '© {{year}} DALIGHT. Tous droits réservés.';

-- Konfirmasyon
SELECT template_key, subject, header_title, footer_text
FROM email_templates
ORDER BY template_key;
