-- ============================================
-- DALIGHT SPA - ADD AWAITING_PAYMENT STATUS TO RESERVATIONS
-- Add AWAITING_PAYMENT to the status check constraint and update active status logic
-- ============================================

-- 1. Drop and recreate the status check constraint to include AWAITING_PAYMENT
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS "réservations_status_check";
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'));

-- 2. Update the trigger function to treat AWAITING_PAYMENT as active
CREATE OR REPLACE FUNCTION public.update_time_slot_bookings()
RETURNS TRIGGER AS $$
BEGIN
  -- Reservation inserted as active
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('PENDING', 'CONFIRMED', 'AWAITING_PAYMENT') THEN
      BEGIN
        UPDATE public.time_slots
        SET current_bookings = COALESCE(current_bookings, 0) + 1
        WHERE date = NEW.date AND time = NEW.time;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
    RETURN NEW;
  END IF;

  -- Reservation status changed
  IF TG_OP = 'UPDATE' THEN
    -- from active to inactive
    IF OLD.status IN ('PENDING', 'CONFIRMED', 'AWAITING_PAYMENT')
       AND NEW.status IN ('CANCELLED', 'COMPLETED', 'NO_SHOW') THEN
      BEGIN
        UPDATE public.time_slots
        SET current_bookings = GREATEST(COALESCE(current_bookings, 0) - 1, 0)
        WHERE date = NEW.date AND time = NEW.time;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    -- from inactive to active
    IF OLD.status IN ('CANCELLED', 'COMPLETED', 'NO_SHOW')
       AND NEW.status IN ('PENDING', 'CONFIRMED', 'AWAITING_PAYMENT') THEN
      BEGIN
        UPDATE public.time_slots
        SET current_bookings = COALESCE(current_bookings, 0) + 1
        WHERE date = NEW.date AND time = NEW.time;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Rebind trigger safely
DROP TRIGGER IF EXISTS trg_update_time_slot_bookings ON public.reservations;
CREATE TRIGGER trg_update_time_slot_bookings
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_time_slot_bookings();

-- 4. Verify constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'reservations'::regclass
  AND conname = 'reservations_status_check';
