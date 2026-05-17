-- =============================================
-- DALIGHT — Drop UNIQUE constraint on head_spa_pricing.type
-- Fichye: 19_drop_head_spa_pricing_type_unique.sql
-- Kouri nan Supabase SQL Editor
-- =============================================
-- REZOUD: duplicate key value violates unique constraint "head_spa_pricing_type_key"
-- Pèmet plizyè entri pou menm type de cheveux (dreadlocks, defrises, naturels)
-- =============================================

-- Étape 1: Drop the UNIQUE constraint on type column
ALTER TABLE head_spa_pricing DROP CONSTRAINT IF EXISTS head_spa_pricing_type_key;

-- Étape 2: Verify constraint is removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'head_spa_pricing'
      AND constraint_name = 'head_spa_pricing_type_key'
  ) THEN
    RAISE NOTICE 'Constraint still exists - manual intervention required';
  ELSE
    RAISE NOTICE 'UNIQUE constraint on type column successfully removed';
  END IF;
END $$;
