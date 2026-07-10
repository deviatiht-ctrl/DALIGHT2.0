-- ============================================================
-- DALIGHT — Feuille de consentement pour Massage Thérapeutique / Bien-être
-- Fichier: 24_massage_consent_form.sql
-- SAFE: idempotent, depends on 23_consent_forms.sql
-- ============================================================

-- Make sure the generic consent form tables exist first
-- (run 23_consent_forms.sql before this file)

-- Upsert the massage consent form template (idempotent without requiring a UNIQUE constraint)
DO $$
DECLARE
  v_form_title TEXT := 'FEUILLE DE CONSENTEMENT POUR MASSAGE THÉRAPEUTIQUE / BIEN-ÊTRE';
  v_fields JSONB := '[
    {
      "section": "1. Informations du Client",
      "fields": [
        { "name": "nom", "label": "Nom", "type": "text", "required": true },
        { "name": "prenom", "label": "Prénom", "type": "text", "required": true },
        { "name": "date_naissance", "label": "Date de naissance", "type": "date", "required": true },
        { "name": "adresse", "label": "Adresse", "type": "textarea", "required": false },
        { "name": "telephone", "label": "Téléphone", "type": "tel", "required": true },
        { "name": "email", "label": "E-mail", "type": "email", "required": false }
      ]
    },
    {
      "section": "2. Informations Médicales (confidentielles)",
      "fields": [
        {
          "name": "douleurs_actuelles",
          "label": "Avez-vous actuellement des douleurs ou inconforts ?",
          "type": "radio",
          "options": ["Oui", "Non"],
          "required": true
        },
        { "name": "douleurs_localisation", "label": "Si oui, où ?", "type": "text", "required": false },
        {
          "name": "maladies_conditions",
          "label": "Avez-vous des maladies ou conditions médicales connues ?",
          "type": "radio",
          "options": ["Oui", "Non"],
          "required": true
        },
        { "name": "maladies_details", "label": "Si oui, préciser", "type": "textarea", "required": false },
        { "name": "medicaments", "label": "Médicaments en cours", "type": "textarea", "required": false },
        { "name": "allergies", "label": "Allergies connues (produits, huiles, lotions…)", "type": "textarea", "required": false },
        {
          "name": "antecedents_chirurgicaux",
          "label": "Antécédents chirurgicaux",
          "type": "radio",
          "options": ["Oui", "Non"],
          "required": true
        },
        { "name": "chirurgicaux_details", "label": "Si oui, préciser", "type": "textarea", "required": false },
        {
          "name": "enceinte",
          "label": "Êtes-vous enceinte ?",
          "type": "radio",
          "options": ["Oui", "Non"],
          "required": true
        },
        { "name": "mois_grossesse", "label": "Mois", "type": "number", "required": false }
      ]
    },
    {
      "section": "3. Type de Massage Choisi",
      "fields": [
        {
          "name": "type_massage",
          "label": "Type de massage",
          "type": "checkbox",
          "options": ["Relaxation", "Thérapeutique", "Drainage lymphatique", "Pierres chaudes", "Autre"],
          "required": true
        },
        { "name": "type_massage_autre", "label": "Autre (préciser)", "type": "text", "required": false },
        { "name": "zones_a_traiter", "label": "Zone(s) à traiter", "type": "textarea", "required": false },
        { "name": "zones_a_eviter", "label": "Zone(s) à éviter", "type": "textarea", "required": false }
      ]
    },
    {
      "section": "4. Consentement du Client",
      "fields": [
        { "name": "consentement_nom", "label": "Je soussigné(e)", "type": "text", "required": true },
        {
          "name": "consentement_infos_veridiques",
          "label": "J’ai fourni des informations véridiques concernant mon état de santé.",
          "type": "checkbox",
          "options": ["Je confirme"],
          "required": true
        },
        {
          "name": "consentement_informe",
          "label": "J’ai été informé(e) de la nature du massage et de ses objectifs.",
          "type": "checkbox",
          "options": ["Je confirme"],
          "required": true
        },
        {
          "name": "consentement_non_medical",
          "label": "Je comprends que le massage ne remplace pas un avis ou traitement médical.",
          "type": "checkbox",
          "options": ["Je confirme"],
          "required": true
        },
        {
          "name": "consentement_eclaire",
          "label": "Je donne mon consentement libre et éclairé pour recevoir ce soin.",
          "type": "checkbox",
          "options": ["Je confirme"],
          "required": true
        },
        {
          "name": "consentement_arret",
          "label": "Je peux arrêter la séance à tout moment si je ressens une gêne ou un inconfort.",
          "type": "checkbox",
          "options": ["Je confirme"],
          "required": true
        },
        { "name": "signature_client", "label": "Signature du client", "type": "signature", "required": true },
        { "name": "date_signature_client", "label": "Date", "type": "date", "required": true }
      ]
    },
    {
      "section": "5. Praticien(ne) – Déclaration et Engagement",
      "fields": [
        { "name": "nom_praticien", "label": "Nom du praticien", "type": "text", "required": true },
        { "name": "signature_praticien", "label": "Signature du praticien", "type": "signature", "required": true },
        { "name": "date_signature_praticien", "label": "Date", "type": "date", "required": true }
      ]
    }
  ]'::jsonb;
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_existing_id
  FROM form_templates
  WHERE title = v_form_title
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE form_templates
    SET
      description = 'Formulaire de consentement complet à remplir par le client avant tout massage thérapeutique ou de bien-être.',
      form_type = 'consentement-massage',
      service_category = 'massage',
      applies_to_all = false,
      fields = v_fields,
      is_active = true,
      updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO form_templates (
      title,
      description,
      form_type,
      service_category,
      applies_to_all,
      fields,
      is_active
    ) VALUES (
      v_form_title,
      'Formulaire de consentement complet à remplir par le client avant tout massage thérapeutique ou de bien-être.',
      'consentement-massage',
      'massage',
      false,
      v_fields,
      true
    );
  END IF;
END $$;

-- ============================================================
-- DONE
-- ============================================================
SELECT '✅ 24_massage_consent_form.sql appliqué avec succès' AS status;
