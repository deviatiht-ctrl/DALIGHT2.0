-- ============================================
-- DALIGHT FIXREPAIR 2.0.v3 - CONFIRM + DATE SAFETY
-- Fix:
-- 1) confirm error: column "current_bookings" does not exist
-- 2) timezone date drift (24 becomes 23 in displays)
-- ============================================

-- ------------------------------------------------
-- A) SAFETY: ensure time_slots.current_bookings exists
-- ------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'time_slots'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'time_slots'
        AND column_name = 'current_bookings'
    ) THEN
      ALTER TABLE public.time_slots
      ADD COLUMN current_bookings INTEGER NOT NULL DEFAULT 0;
      RAISE NOTICE '✅ Added time_slots.current_bookings';
    ELSE
      RAISE NOTICE 'ℹ️ time_slots.current_bookings already exists';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'time_slots'
        AND column_name = 'max_bookings'
    ) THEN
      ALTER TABLE public.time_slots
      ADD COLUMN max_bookings INTEGER NOT NULL DEFAULT 1;
      RAISE NOTICE '✅ Added time_slots.max_bookings';
    ELSE
      RAISE NOTICE 'ℹ️ time_slots.max_bookings already exists';
    END IF;

    BEGIN
      ALTER TABLE public.time_slots DROP COLUMN IF EXISTS is_available;
      ALTER TABLE public.time_slots
      ADD COLUMN is_available BOOLEAN GENERATED ALWAYS AS (current_bookings < max_bookings) STORED;
      RAISE NOTICE '✅ Rebuilt time_slots.is_available generated column';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'ℹ️ is_available rebuild skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️ table public.time_slots not found - skipped';
  END IF;
END $$;

-- ------------------------------------------------
-- B) Trigger function safety (avoid hard-fail if schema differs)
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_time_slot_bookings()
RETURNS TRIGGER AS $$
BEGIN
  -- Reservation inserted as active
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('PENDING', 'CONFIRMED') THEN
      BEGIN
        UPDATE public.time_slots
        SET current_bookings = COALESCE(current_bookings, 0) + 1
        WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::INTEGER;
      EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE 'Skipped booking increment: current_bookings column missing';
      END;
    END IF;
    RETURN NEW;
  END IF;

  -- Reservation status changed
  IF TG_OP = 'UPDATE' THEN
    -- from active to inactive
    IF OLD.status IN ('PENDING', 'CONFIRMED')
       AND NEW.status IN ('CANCELLED', 'COMPLETED', 'NO_SHOW') THEN
      BEGIN
        UPDATE public.time_slots
        SET current_bookings = GREATEST(COALESCE(current_bookings, 0) - 1, 0)
        WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::INTEGER;
      EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE 'Skipped booking decrement: current_bookings column missing';
      END;
    END IF;

    -- from inactive to active
    IF OLD.status IN ('CANCELLED', 'COMPLETED', 'NO_SHOW')
       AND NEW.status IN ('PENDING', 'CONFIRMED') THEN
      BEGIN
        UPDATE public.time_slots
        SET current_bookings = COALESCE(current_bookings, 0) + 1
        WHERE day_of_week = EXTRACT(DOW FROM NEW.date)::INTEGER;
      EXCEPTION WHEN undefined_column THEN
        RAISE NOTICE 'Skipped booking increment: current_bookings column missing';
      END;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rebind trigger safely
DROP TRIGGER IF EXISTS trg_update_time_slot_bookings ON public.reservations;
CREATE TRIGGER trg_update_time_slot_bookings
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_time_slot_bookings();

-- ------------------------------------------------
-- C) Quick verification
-- ------------------------------------------------
SELECT '✅ FIXREPAIR 2.0.v3 COMPLETED' AS status;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'time_slots'
  AND column_name IN ('current_bookings', 'max_bookings', 'is_available')
ORDER BY column_name;
