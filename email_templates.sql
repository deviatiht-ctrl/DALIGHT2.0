-- =============================================
-- DALIGHT Head Spa — Email Templates Table
-- Run this in Supabase SQL Editor
-- =============================================

-- ─── STEP 1: Create the email_templates table ───
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  header_title TEXT NOT NULL DEFAULT 'DALIGHT Head Spa',
  header_subtitle TEXT DEFAULT '',
  greeting TEXT DEFAULT 'Cher(e) {{client_name}},',
  body_html TEXT NOT NULL DEFAULT '',
  footer_text TEXT DEFAULT '© {{year}} DALIGHT Head Spa. Tous droits réservés.',
  logo_url TEXT DEFAULT 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.png',
  header_bg TEXT DEFAULT 'linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%)',
  accent_color TEXT DEFAULT '#D4AF37',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STEP 2: RLS ───
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon can read active email_templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated can insert email_templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated can update email_templates" ON email_templates;
DROP POLICY IF EXISTS "Authenticated can delete email_templates" ON email_templates;

-- Anon can read active templates (needed for public reservation/follow email sends)
CREATE POLICY "Anon can read active email_templates"
  ON email_templates FOR SELECT TO anon USING (is_active = true);

-- Authenticated can read ALL templates (active & inactive, for admin editor)
CREATE POLICY "Authenticated can read email_templates"
  ON email_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert email_templates"
  ON email_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update email_templates"
  ON email_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete email_templates"
  ON email_templates FOR DELETE TO authenticated USING (true);

-- ─── STEP 3: Auto-update trigger ───
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- ─── STEP 4: Seed default templates ───
INSERT INTO email_templates (template_key, label, subject, header_title, header_subtitle, greeting, body_html, footer_text) VALUES

-- Reservation received (client)
('reservation_client', 'Réservation reçue (Client)', '📋 Réservation Reçue - En attente de confirmation · DALIGHT Head Spa',
 'DALIGHT Head Spa', 'Réservation Reçue · En attente de confirmation',
 'Cher(e) {{client_name}},',
 '<p class="message">Nous vous remercions pour votre réservation. Elle a été enregistrée avec succès et est actuellement en attente de confirmation.</p>
<div class="detail-box">
  <div class="detail-row"><span class="label">Service:</span><span class="value">{{service}}</span></div>
  <div class="detail-row"><span class="label">Date:</span><span class="value">{{date}}</span></div>
  <div class="detail-row"><span class="label">Heure:</span><span class="value">{{time}}</span></div>
  <div class="detail-row"><span class="label">Lieu:</span><span class="value">{{location}}</span></div>
  {{#notes}}<div class="detail-row"><span class="label">Notes:</span><span class="value">{{notes}}</span></div>{{/notes}}
</div>
<div class="info-box"><strong>ℹ️ Prochaine étape:</strong> Notre équipe examinera votre demande et vous contactera sous peu pour confirmer votre rendez-vous.</div>',
 '© {{year}} DALIGHT Head Spa. Tous droits réservés.'),

-- Reservation received (admin)
('reservation_admin', 'Nouvelle réservation (Admin)', '🔔 Nouvelle Réservation Reçue',
 '🔔 Nouvelle Réservation', 'DALIGHT Head Spa - Administration',
 '',
 '<div class="alert-box"><strong>⚡ Une nouvelle réservation vient d''être soumise!</strong><p style="margin:10px 0 0 0;color:#666;">Veuillez examiner les détails ci-dessous.</p></div>
<h3 class="section-title">👤 Client</h3>
<div class="detail-box">
  <div class="detail-row"><span class="label">Nom:</span><span class="value">{{client_name}}</span></div>
  <div class="detail-row"><span class="label">Email:</span><span class="value">{{client_email}}</span></div>
</div>
<h3 class="section-title">📋 Réservation</h3>
<div class="detail-box">
  <div class="detail-row"><span class="label">Service:</span><span class="value">{{service}}</span></div>
  <div class="detail-row"><span class="label">Date:</span><span class="value">{{date}}</span></div>
  <div class="detail-row"><span class="label">Heure:</span><span class="value">{{time}}</span></div>
  <div class="detail-row"><span class="label">Lieu:</span><span class="value">{{location}}</span></div>
</div>
<div class="action-box"><strong>✅ Action requise:</strong> Connectez-vous au panneau d''administration pour confirmer cette réservation.</div>',
 '© {{year}} DALIGHT Head Spa - Système de Gestion'),

-- Status: Confirmed
('status_confirmed', 'Réservation confirmée', '✓ Votre réservation est confirmée - DALIGHT Head Spa',
 'DALIGHT Head Spa', 'Mise à jour de votre réservation',
 'Cher(e) {{client_name}},',
 '<div class="status-banner" style="background:#e8f5e9;border-left:4px solid #4CAF50;padding:30px;border-radius:8px;text-align:center;margin-bottom:25px;">
  <div style="font-size:48px;color:#4CAF50;margin-bottom:15px;">✓</div>
  <h2 style="font-size:24px;font-weight:600;color:#4CAF50;margin:0 0 10px 0;">Réservation Confirmée</h2>
  <p style="color:#666;font-size:16px;margin:0;">Bonne nouvelle! Votre réservation a été confirmée par notre équipe.</p>
</div>
<div class="detail-box">
  <div class="detail-row"><span class="label">Service:</span><span class="value">{{service}}</span></div>
  <div class="detail-row"><span class="label">Date:</span><span class="value">{{date}}</span></div>
  <div class="detail-row"><span class="label">Heure:</span><span class="value">{{time}}</span></div>
  <div class="detail-row"><span class="label">Lieu:</span><span class="value">{{location}}</span></div>
</div>
<div class="info-box"><strong>ℹ️ Informations importantes:</strong>
<ul style="margin:10px 0 0 0;color:#666;padding-left:20px;">
  <li>Arrivez 10 minutes avant votre rendez-vous</li>
  <li>Apportez une pièce d''identité valide</li>
  <li>En cas d''empêchement, prévenez-nous 24h à l''avance</li>
</ul></div>',
 '© {{year}} DALIGHT Head Spa. Tous droits réservés.'),

-- Status: Cancelled
('status_cancelled', 'Réservation annulée', '✗ Votre réservation a été annulée - DALIGHT Head Spa',
 'DALIGHT Head Spa', 'Mise à jour de votre réservation',
 'Cher(e) {{client_name}},',
 '<div class="status-banner" style="background:#ffebee;border-left:4px solid #f44336;padding:30px;border-radius:8px;text-align:center;margin-bottom:25px;">
  <div style="font-size:48px;color:#f44336;margin-bottom:15px;">✗</div>
  <h2 style="font-size:24px;font-weight:600;color:#f44336;margin:0 0 10px 0;">Réservation Annulée</h2>
  <p style="color:#666;font-size:16px;margin:0;">Votre réservation a été annulée. N''hésitez pas à faire une nouvelle réservation.</p>
</div>
<div class="detail-box">
  <div class="detail-row"><span class="label">Service:</span><span class="value">{{service}}</span></div>
  <div class="detail-row"><span class="label">Date:</span><span class="value">{{date}}</span></div>
  <div class="detail-row"><span class="label">Heure:</span><span class="value">{{time}}</span></div>
</div>',
 '© {{year}} DALIGHT Head Spa. Tous droits réservés.'),

-- Status: Completed
('status_completed', 'Visite terminée', '★ Merci pour votre visite - DALIGHT Head Spa',
 'DALIGHT Head Spa', 'Mise à jour de votre réservation',
 'Cher(e) {{client_name}},',
 '<div class="status-banner" style="background:#e3f2fd;border-left:4px solid #2196F3;padding:30px;border-radius:8px;text-align:center;margin-bottom:25px;">
  <div style="font-size:48px;color:#2196F3;margin-bottom:15px;">★</div>
  <h2 style="font-size:24px;font-weight:600;color:#2196F3;margin:0 0 10px 0;">Merci pour votre visite!</h2>
  <p style="color:#666;font-size:16px;margin:0;">Nous espérons que vous avez apprécié votre expérience chez DALIGHT Head Spa.</p>
</div>
<div class="info-box"><strong>⭐ Votre avis compte!</strong><p style="margin:10px 0 0 0;color:#666;">N''hésitez pas à nous laisser un avis ou à recommander DALIGHT à vos proches.</p></div>',
 '© {{year}} DALIGHT Head Spa. Tous droits réservés.'),

-- Order confirmation (client)
('order_client', 'Commande confirmée (Client)', '✓ Confirmation de Commande - DALIGHT Head Spa',
 'DALIGHT Head Spa', 'Commande Confirmée',
 'Cher(e) {{client_name}},',
 '<p class="message">Nous vous remercions pour votre commande. Elle a été enregistrée avec succès et est en cours de traitement.</p>
<div class="order-number"><div style="color:#666;font-size:14px;margin-bottom:5px;">Numéro de Commande</div><strong>{{order_number}}</strong></div>
<div class="info-box"><strong>ℹ️ Prochaine étape:</strong> Notre équipe préparera votre commande et vous contactera pour organiser la livraison.</div>',
 '© {{year}} DALIGHT Head Spa. Tous droits réservés.'),

-- Order notification (admin)
('order_admin', 'Nouvelle commande (Admin)', '🔔 Nouvelle Commande Reçue',
 '🔔 Nouvelle Commande', 'DALIGHT Head Spa - Administration',
 '',
 '<div class="alert-box"><strong>⚡ Une nouvelle commande vient d''être soumise!</strong></div>
<div class="order-number"><div style="color:#666;font-size:14px;margin-bottom:5px;">Numéro de Commande</div><strong>{{order_number}}</strong></div>
<h3 class="section-title">👤 Client</h3>
<div class="detail-box">
  <div class="detail-row"><span class="label">Nom:</span><span class="value">{{client_name}}</span></div>
  <div class="detail-row"><span class="label">Email:</span><span class="value">{{client_email}}</span></div>
</div>
<div class="action-box"><strong>✅ Action requise:</strong> Connectez-vous pour traiter cette commande.</div>',
 '© {{year}} DALIGHT Head Spa - Système de Gestion'),

-- Follow/subscription welcome
('follow_welcome', 'Bienvenue abonné', '🌟 Merci de suivre DALIGHT Head Spa!',
 'DALIGHT Head Spa', 'Bienvenue dans notre communauté!',
 'Cher(e) membre DALIGHT,',
 '<div class="welcome-banner" style="background:linear-gradient(135deg,#fff3cd,#f9f7f5);padding:30px;border-radius:8px;text-align:center;border-left:4px solid #D4AF37;margin-bottom:25px;">
  <div style="font-size:48px;margin-bottom:15px;">🌟</div>
  <h2 style="font-size:24px;font-weight:600;color:#4A3728;margin:0 0 10px 0;">Merci de suivre DALIGHT Head Spa!</h2>
  <p style="color:#666;font-size:16px;margin:0;">Vous faites maintenant partie de notre communauté bien-être exclusive.</p>
</div>
<p style="color:#666;line-height:1.8;margin-bottom:25px;">En suivant DALIGHT, vous avez accès à du contenu exclusif et restez informé de nos dernières actualités, promotions et rituels.</p>',
 '© {{year}} DALIGHT Head Spa. Tous droits réservés.')

ON CONFLICT (template_key) DO NOTHING;
