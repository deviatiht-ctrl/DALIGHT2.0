-- ============================================================
-- DALIGHT — Feuille de diagnostic Head Spa
-- Fichier: 25_head_spa_diagnostic_form.sql
-- SAFE: idempotent, depends on 23_consent_forms.sql
-- ============================================================

-- Make sure the generic consent form tables exist first
-- (run 23_consent_forms.sql before this file)

-- Upsert the Head Spa diagnostic form template (idempotent without requiring a UNIQUE constraint)
-- The fields array is FLAT because consent-forms.js renders each item sequentially.
-- Sections are rendered as "type": "section" headers.
DO $$
DECLARE
  v_form_title TEXT := 'FEUILLE DE DIAGNOSTIC - HEAD SPA';
  v_fields JSONB := '[
    { "type": "section", "label": "1. Informations du Client" },
    { "type": "text",     "label": "Nom",                 "required": true },
    { "type": "text",     "label": "Prénom",              "required": true },
    { "type": "date",     "label": "Date de naissance",   "required": true },
    { "type": "textarea", "label": "Adresse",             "required": false },
    { "type": "text",     "label": "Téléphone",           "required": true },
    { "type": "text",     "label": "E-mail",              "required": false },

    { "type": "section", "label": "2. Habitudes capillaires" },
    { "type": "checkbox", "label": "Fréquence de lavage", "options": ["2-3 fois / semaine", "1 fois / semaine", "Autres"], "required": false },
    { "type": "checkbox", "label": "Produits utilisés",   "options": ["Shampooing naturel", "Après-shampooing", "Bain de crème", "Sérum", "Autres"], "required": false },

    { "type": "section", "label": "3. Type de cuir chevelu" },
    { "type": "checkbox", "label": "Type de cuir chevelu", "options": ["Normal", "Sec", "Gras", "Sensible", "Mixte"], "required": false },
    { "type": "text",     "label": "Précisions (Mixte)",  "required": false },
    { "type": "textarea", "label": "Problèmes observés",  "required": false },

    { "type": "section", "label": "4. État des cheveux" },
    { "type": "checkbox", "label": "Type de cheveux",     "options": ["Dreadlocks", "Défrisés", "Crépus", "Tresses", "Autres"], "required": false },
    { "type": "checkbox", "label": "Longueur",            "options": ["Courts", "Mi-longs", "Longs"], "required": false },

    { "type": "section", "label": "5. Objectifs du client" },
    { "type": "checkbox", "label": "Objectifs du client", "options": ["Relaxation", "Hydratation", "Détox du cuir chevelu", "Stimuler la pousse", "Régulation du sébum", "Réduction de la chute", "Autre"], "required": false },

    { "type": "section", "label": "6. Consentement Média" },
    { "type": "textarea", "label": "Dans le cadre de nos services Head Spa Japonais, nous pouvons prendre des photos ou vidéos avant, pendant et après le soin à des fins de communication et de promotion sur nos réseaux sociaux.", "required": false },
    { "type": "radio",    "label": "J’autorise l’utilisation de mes photos / vidéos", "options": ["Oui, j’autorise l’utilisation de mes photos / vidéos.", "Non."], "required": true },

    { "type": "section", "label": "7. Diagnostic du praticien" },
    { "type": "textarea", "label": "Analyse du cuir chevelu",  "required": false },
    { "type": "textarea", "label": "Type de soin recommandé",  "required": false },
    { "type": "textarea", "label": "Fréquence des séances",    "required": false },

    { "type": "section", "label": "8. Plan de traitement" },
    { "type": "textarea", "label": "Soin effectué",            "required": false },
    { "type": "text",     "label": "Durée",                    "required": false },
    { "type": "checkbox", "label": "Techniques utilisées",     "options": ["Massage", "Gommage", "Sérum", "Autre"], "required": false },

    { "type": "section", "label": "9. Conseils après soin / recommandations" },
    { "type": "textarea", "label": "Conseils après soin / recommandations", "required": false }
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
      description = 'Formulaire de diagnostic et consentement média à remplir avant chaque soin Head Spa.',
      form_type = 'diagnostic-head-spa',
      service_category = 'head spa',
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
      'Formulaire de diagnostic et consentement média à remplir avant chaque soin Head Spa.',
      'diagnostic-head-spa',
      'head spa',
      false,
      v_fields,
      true
    );
  END IF;
END $$;

-- ============================================================
-- DONE
-- ============================================================
SELECT '✅ 25_head_spa_diagnostic_form.sql appliqué avec succès' AS status;
