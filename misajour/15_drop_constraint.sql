-- =============================================
-- DALIGHT — Drop payment_status constraint
-- =============================================

-- DROP constraint ki bloke valè yo
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_payment_status_check;

-- Verify constraint a retire
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'reservations'::regclass
  AND conname LIKE '%payment_status%';
