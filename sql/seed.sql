-- ============================================
-- DALIGHT HEAD SPA - DONNÉES INITIALES
-- Exécuter EN DERNIER après tous les autres scripts
-- ============================================

-- ============================================
-- SERVICES DE MASSAGE
-- ============================================

INSERT INTO services (name, description, price_usd, price_htg, duration, category, sort_order) VALUES
('Head Spa Signature', 'Expérience immersive combinant massage crânien traditionnel, bain de vapeur et soin profond du cuir chevelu.', 85, 10000, '60 min', 'headspa', 1),
('Rituel Zen Impérial', 'Soin complet incluant massage des cervicales, réflexologie crânienne et traitement capillaire haute performance.', 125, 15000, '90 min', 'headspa', 2),
('Soin Détox & Équilibre', 'Purification profonde du cuir chevelu par la vapeur botanique et massage relaxant pour rééquilibrer les énergies.', 100, 12000, '75 min', 'headspa', 3),
('Head Spa & Éclat Visage', 'Le rituel ultime alliant soin capillaire ancestral et massage facial liftant japonais.', 150, 18000, '105 min', 'headspa', 4),
('Duo Sérénité', 'Partagez un rituel de Head Spa simultané en cabine double pour une déconnexion totale à deux.', 160, 19000, '60 min', 'package', 5),
('Rituel Renaissance 4', 'Cure de 4 rituels personnalisés pour restaurer la vitalité du cuir chevelu et la splendeur des cheveux.', 300, 35000, '4 rituels', 'cure', 6),
('Love & Zen Package', 'Rituel Signature accompagné d''une dégustation de thé précieux et douceurs japonaises.', 100, 12000, '90 min', 'package', 7),
('Cure Vitalité Intense (6)', 'Cure de 6 soins hebdomadaires pour un cuir chevelu assaini et une fibre capillaire renforcée durablement.', 420, 50000, '6 rituels', 'cure', 8)
ON CONFLICT DO NOTHING;

-- ============================================
-- CRÉNEAUX HORAIRES - SPA
-- ============================================

INSERT INTO time_slots (location, day_of_week, start_time, end_time, max_bookings) VALUES
-- Lundi à Vendredi (1-5)
('Spa', 1, '08:00', '20:00', 2),
('Spa', 2, '08:00', '20:00', 2),
('Spa', 3, '08:00', '20:00', 2),
('Spa', 4, '08:00', '20:00', 2),
('Spa', 5, '08:00', '20:00', 2),
-- Samedi (6)
('Spa', 6, '08:00', '18:00', 2),
-- Dimanche (0) - Fermé par défaut
('Spa', 0, '10:00', '16:00', 1)
ON CONFLICT DO NOTHING;

-- ============================================
-- CRÉNEAUX HORAIRES - SERVICE À DOMICILE
-- ============================================

INSERT INTO time_slots (location, day_of_week, start_time, end_time, max_bookings) VALUES
-- Lundi à Vendredi (1-5)
('Home', 1, '09:00', '19:00', 1),
('Home', 2, '09:00', '19:00', 1),
('Home', 3, '09:00', '19:00', 1),
('Home', 4, '09:00', '19:00', 1),
('Home', 5, '09:00', '19:00', 1),
-- Samedi (6)
('Home', 6, '09:00', '17:00', 1)
-- Dimanche fermé pour service à domicile
ON CONFLICT DO NOTHING;

-- ============================================
-- JOURS FÉRIÉS HAÏTI 2024-2025
-- ============================================

INSERT INTO blocked_dates (date, location, reason) VALUES
-- 2024
('2024-12-25', NULL, 'Noël'),
('2024-12-26', NULL, 'Lendemain de Noël'),
-- 2025
('2025-01-01', NULL, 'Jour de l''An'),
('2025-01-02', NULL, 'Jour des Aïeux'),
('2025-02-03', NULL, 'Carnaval'),
('2025-02-04', NULL, 'Mardi Gras'),
('2025-04-18', NULL, 'Vendredi Saint'),
('2025-05-01', NULL, 'Fête du Travail'),
('2025-05-18', NULL, 'Fête du Drapeau'),
('2025-08-15', NULL, 'Assomption'),
('2025-10-17', NULL, 'Anniversaire de la mort de Dessalines'),
('2025-11-01', NULL, 'Toussaint'),
('2025-11-02', NULL, 'Jour des Morts'),
('2025-11-18', NULL, 'Vertières'),
('2025-12-25', NULL, 'Noël')
ON CONFLICT DO NOTHING;

-- ============================================
-- CODE PROMO DE BIENVENUE
-- ============================================

INSERT INTO promo_codes (code, discount_type, discount_value, min_purchase_usd, max_uses, valid_until, is_active) VALUES
('BIENVENUE10', 'percentage', 10, 50, 100, '2025-12-31 23:59:59', TRUE),
('FIRSTVISIT', 'fixed_usd', 10, 60, 50, '2025-12-31 23:59:59', TRUE),
('COUPLE25', 'percentage', 25, 100, 30, '2025-06-30 23:59:59', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTE: CONFIGURATION ADMIN
-- ============================================
-- Après l'inscription d'un utilisateur admin, exécutez:
-- UPDATE profiles SET role = 'admin' WHERE email = 'laurorejeanclarens0@gmail.com';
-- ============================================
