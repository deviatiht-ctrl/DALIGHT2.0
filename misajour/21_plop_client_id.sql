-- Migration 21: Add Plop Plop client_id columns to reservations
-- Stores the Plop Plop client identifier returned by paiement-verify
-- Used to match who paid in the Plop Plop merchant portal

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS plop_client_id        TEXT,
  ADD COLUMN IF NOT EXISTS balance_plop_client_id TEXT;

COMMENT ON COLUMN reservations.plop_client_id IS 'ID client Plop Plop retourné par paiement-verify (acompte ou paiement complet)';
COMMENT ON COLUMN reservations.balance_plop_client_id IS 'ID client Plop Plop retourné par paiement-verify (solde)';
