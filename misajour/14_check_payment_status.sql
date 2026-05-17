-- =============================================
-- DALIGHT — Check payment_status constraint
-- =============================================

-- We CHECK constraint la
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'reservations'::regclass
  AND conname LIKE '%payment_status%';

-- We tout valè payment_status ki egziste deja
SELECT DISTINCT payment_status, COUNT(*)
FROM reservations
GROUP BY payment_status;
