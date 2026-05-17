-- =============================================
-- DALIGHT — Check existing reservations
-- =============================================

-- 1. We tout rezèvasyon ki la
SELECT id, reservation_number, user_id, user_email, user_name, status, payment_status, created_at
FROM reservations
ORDER BY created_at DESC;

-- 2. We si user_id yo NULL
SELECT COUNT(*) as total,
       COUNT(user_id) as with_user_id,
       COUNT(*) - COUNT(user_id) as without_user_id
FROM reservations;

-- 3. We user_id ki konekte kounye a (si ou konekte)
SELECT auth.uid();
