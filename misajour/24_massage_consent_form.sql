-- ============================================================
-- DALIGHT — Feuille de consentement pour Massage Thérapeutique / Bien-être
-- Fichier: 24_massage_consent_form.sql
-- SAFE: idempotent, depends on 23_consent_forms.sql
-- ============================================================

-- Make sure the generic consent form tables exist first
-- (run 23_consent_forms.sql before this file)

-- Upsert the massage consent form template (idempotent without requiring a UNIQUE constraint)
-- The fields array is FLAT because consent-forms.js renders each item sequentially.
-- Sections are rendered as "type": "section" headers.
DO $$
DECLARE
  v_form_title TEXT := 'FEUILLE DE CONSENTEMENT POUR MASSAGE THÉRAPEUTIQUE / BIEN-ÊTRE';
  v_fields JSONB := '[
    { "type": "section", "label": "1. Informations du Client" },
    { "type": "text",     "label": "Nom",                    "required": true },
    { "type": "text",     "label": "Prénom",               "required": true },
    { "type": "date",     "label": "Date de naissance",    "required": true },
    { "type": "textarea", "label": "Adresse",               "required": false },
    { "type": "text",     "label": "Téléphone",            "required": true },
    { "type": "text",     "label": "E-mail",               "required": false },

    { "type": "section", "label": "2. Informations Médicales (confidentielles)" },
    { "type": "radio",    "label": "Avez-vous actuellement des douleurs ou inconforts ?", "options": ["Oui", "Non"], "required": true },
    { "type": "text",     "label": "Si oui, où ?",          "required": false },
    { "type": "radio",    "label": "Avez-vous des maladies ou conditions médicales connues ?", "options": ["Oui", "Non"], "required": true },
    { "type": "textarea", "label": "Si oui, préciser",     "required": false },
    { "type": "textarea", "label": "Médicaments en cours",   "required": false },
    { "type": "textarea", "label": "Allergies connues (produits, huiles, lotions…)", "required": false },
    { "type": "radio",    "label": "Antécédents chirurgicaux", "options": ["Oui", "Non"], "required": true },
    { "type": "textarea", "label": "Si oui, préciser",     "required": false },
    { "type": "radio",    "label": "Êtes-vous enceinte ?", "options": ["Oui", "Non"], "required": true },
    { "type": "text",     "label": "Mois",                 "required": false },

    { "type": "section", "label": "3. Type de Massage Choisi" },
    { "type": "checkbox", "label": "Type de massage",      "options": ["Relaxation", "Thérapeutique", "Drainage lymphatique", "Pierres chaudes", "Autre"], "required": true },
    { "type": "text",     "label": "Autre (préciser)",     "required": false },
    { "type": "textarea", "label": "Zone(s) à traiter",    "required": false },
    { "type": "textarea", "label": "Zone(s) à éviter",     "required": false },

    { "type": "section", "label": "4. Consentement du Client" },
    { "type": "text",     "label": "Je soussigné(e)",      "required": true },
    { "type": "checkbox", "label": "J’ai fourni des informations véridiques concernant mon état de santé.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "J’ai été informé(e) de la nature du massage et de ses objectifs.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "Je comprends que le massage ne remplace pas un avis ou traitement médical.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "Je donne mon consentement libre et éclairé pour recevoir ce soin.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "Je peux arrêter la séance à tout moment si je ressens une gêne ou un inconfort.", "options": ["Je confirme"], "required": true },
    { "type": "signature", "label": "Signature du client", "required": true },
    { "type": "date",      "label": "Date",                "required": true },

    { "type": "section", "label": "5. Praticien(ne) – Déclaration et Engagement" },
    { "type": "checkbox", "label": "Je certifie avoir expliqué clairement le déroulement du soin, les techniques utilisées ainsi que les contre-indications du massage.", "options": ["Je confirme"], "required": true },
    { "type": "text",      "label": "Nom du praticien",    "required": true },
    { "type": "signature", "label": "Signature du praticien", "required": true },
    { "type": "date",      "label": "Date",                "required": true }
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
