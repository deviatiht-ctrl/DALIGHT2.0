-- ADD MISSING COLUMN TO EXISTING PRODUCTS TABLE
-- Run this ONLY if products table exists but is missing category_id column

-- ── Add payment columns to reservations ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'pay_timing'
  ) THEN
    ALTER TABLE reservations ADD COLUMN pay_timing TEXT DEFAULT 'onsite';
    RAISE NOTICE 'Added pay_timing to reservations';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE reservations ADD COLUMN payment_method TEXT;
    RAISE NOTICE 'Added payment_method to reservations';
  END IF;
END $$;

-- Check if column exists, add it if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products ADD COLUMN category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added category_id column to products table';
  ELSE
    RAISE NOTICE 'category_id column already exists';
  END IF;
END $$;

-- Add other missing columns if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'sale_price'
  ) THEN
    ALTER TABLE products ADD COLUMN sale_price DECIMAL(10,2);
    RAISE NOTICE 'Added sale_price column to products table';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'stock_quantity'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
    RAISE NOTICE 'Added stock_quantity column to products table';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE products ADD COLUMN image_urls TEXT[];
    RAISE NOTICE 'Added image_urls column to products table';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added is_featured column to products table';
  END IF;
END $$;
