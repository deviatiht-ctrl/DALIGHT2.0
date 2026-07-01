-- ============================================
-- DALIGHT SPA - UPDATE RLS FOR AWAITING_PAYMENT STATUS
-- Allow users to update their own reservations while status is PENDING or AWAITING_PAYMENT
-- ============================================

-- Drop existing user update policy
DROP POLICY IF EXISTS "Users can update their own reservations" ON reservations;

-- Recreate policy allowing update for PENDING and AWAITING_PAYMENT
CREATE POLICY "Users can update their own reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status IN ('PENDING', 'AWAITING_PAYMENT'))
  WITH CHECK (user_id = auth.uid());
