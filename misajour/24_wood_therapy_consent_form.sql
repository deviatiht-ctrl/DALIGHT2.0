-- ============================================================
-- DALIGHT — Feuille de consentement pour Wood Therapy / Maderothérapie
-- Fichier: 24_wood_therapy_consent_form.sql
-- SAFE: idempotent, depends on 23_consent_forms.sql
-- Ne modifie AUCUN formulaire déjà rempli (form_submissions reste intact).
-- IMPORTANT: changer v_service_category ci-dessous si la catégorie du service
--            dans la table `services` utilise un autre slug.
-- ============================================================

DO $$
DECLARE
  v_form_title TEXT := 'FEUILLE DE CONSENTEMENT POUR WOOD THERAPY / MADEROTHÉRAPIE';
  v_service_category TEXT := 'wood-therapy';
  v_fields JSONB := '[
    { "type": "section", "label": "1. Informations du Client" },
    { "type": "text",     "label": "Nom",                    "required": true },
    { "type": "text",     "label": "Prénom",               "required": true },
    { "type": "date",     "label": "Date de naissance",    "required": true },
    { "type": "textarea", "label": "Adresse",               "required": false },
    { "type": "text",     "label": "Téléphone",            "required": true },
    { "type": "text",     "label": "E-mail",               "required": false },
    { "type": "text",     "label": "Personne à contacter en cas d'urgence", "required": true },
    { "type": "text",     "label": "Téléphone de la personne à contacter", "required": true },

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
    { "type": "radio",    "label": "Problèmes cardiaques, tension artérielle, phlébite ou thrombose", "options": ["Oui", "Non"], "required": true },
    { "type": "radio",    "label": "Ostéoporose, cancer ou maladie chronique", "options": ["Oui", "Non"], "required": true },
    { "type": "radio",    "label": "Problèmes de peau, infections ou plaies ouvertes", "options": ["Oui", "Non"], "required": true },
    { "type": "radio",    "label": "Varices importantes ou insuffisance veineuse", "options": ["Oui", "Non"], "required": true },
    { "type": "radio",    "label": "Implants médicaux (pacemaker, prothèse, stents…)", "options": ["Oui", "Non"], "required": true },
    { "type": "textarea", "label": "Si oui, préciser (implants / détails)", "required": false },
    { "type": "radio",    "label": "Traitements esthétiques récents (Botox, fillers, chirurgie…)", "options": ["Oui", "Non"], "required": true },
    { "type": "textarea", "label": "Si oui, préciser",     "required": false },
    { "type": "radio",    "label": "Sensibilité à la douleur ou aux ecchymoses", "options": ["Oui", "Non"], "required": true },
    { "type": "radio",    "label": "Prenez-vous des anticoagulants ou des anti-inflammatoires ?", "options": ["Oui", "Non"], "required": true },

    { "type": "section", "label": "3. Objectifs et Zones de Traitement" },
    { "type": "checkbox", "label": "Objectif(s) du soin", "options": ["Réduction de la cellulite", "Amincissement / contouring", "Drainage / détox", "Fermeté de la peau", "Détente musculaire", "Autre"], "required": true },
    { "type": "text",     "label": "Autre (préciser)",     "required": false },
    { "type": "checkbox", "label": "Zone(s) à traiter", "options": ["Ventre", "Cuisses", "Fesses", "Bras", "Dos", "Flancs", "Autre"], "required": true },
    { "type": "text",     "label": "Autre zone (préciser)", "required": false },
    { "type": "text",     "label": "Nombre de séances de wood therapy déjà réalisées", "required": false },
    { "type": "radio",    "label": "Tolérance souhaitée à la pression", "options": ["Légère", "Modérée", "Intense"], "required": true },

    { "type": "section", "label": "4. Consentement du Client" },
    { "type": "text",     "label": "Je soussigné(e)",      "required": true },
    { "type": "checkbox", "label": "J’ai fourni des informations véridiques concernant mon état de santé.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "J’ai été informé(e) de la nature du soin, des techniques et des contre-indications de la maderothérapie.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "Je comprends que le wood therapy n’est pas un traitement médical et ne remplace pas un avis médical.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "J’accepte que des rougeurs, marques ou ecchymoses temporaires puissent apparaître après la séance.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "Je donne mon consentement libre et éclairé pour recevoir ce soin.", "options": ["Je confirme"], "required": true },
    { "type": "checkbox", "label": "Je peux arrêter la séance à tout moment si je ressens une gêne ou un inconfort.", "options": ["Je confirme"], "required": true },
    { "type": "signature", "label": "Signature du client", "required": true },
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
      description = 'Formulaire de consentement complet à remplir par le client avant toute séance de wood therapy / maderothérapie.',
      form_type = 'consentement-wood-therapy',
      service_category = v_service_category,
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
      'Formulaire de consentement complet à remplir par le client avant toute séance de wood therapy / maderothérapie.',
      'consentement-wood-therapy',
      v_service_category,
      false,
      v_fields,
      true
    );
  END IF;
END $$;

-- ============================================================
-- DONE
-- ============================================================
SELECT '✅ 24_wood_therapy_consent_form.sql appliqué avec succès' AS status;
