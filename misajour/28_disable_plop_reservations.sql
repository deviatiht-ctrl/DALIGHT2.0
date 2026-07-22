-- DALIGHT — Retire PLOP PLOP automatic payment from reservations
-- Switch MonCash/NatCash/KashPaw to manual proof-of-payment flow.
-- Admin already configures account numbers in Paramètres > Modes de Paiement.
-- Run in Supabase SQL Editor.

-- Ensure columns needed for gateway/manual mode exist
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'manual';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway_method TEXT DEFAULT NULL;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT true;

-- 1. Set mobile wallets to manual proof-of-payment
UPDATE payment_methods
SET gateway = 'manual',
    gateway_method = NULL,
    is_manual = true,
    requires_proof = true
WHERE slug IN ('moncash', 'natcash', 'kashpaw');

-- 2. The generic "all" card was PLOP-only; disable it online
UPDATE payment_methods
SET is_active = false
WHERE slug = 'all';

-- 3. Ensure the manual mobile methods stay active
UPDATE payment_methods
SET is_active = true
WHERE slug IN ('moncash', 'natcash', 'kashpaw');

SELECT 'PLOP PLOP removed from reservation flow' AS info;
