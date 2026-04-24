-- ADD ALL MISSING COLUMNS TO RESERVATIONS TABLE
-- This adds all columns needed for the new reservation system

-- ── Add all columns to reservations ──

-- reservation_number: unique identifier like DL12345678
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'reservation_number'
  ) THEN
    ALTER TABLE reservations ADD COLUMN reservation_number TEXT UNIQUE;
    RAISE NOTICE 'Added reservation_number to reservations';
  END IF;
END $$;

-- user_name: full name of client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'user_name'
  ) THEN
    ALTER TABLE reservations ADD COLUMN user_name TEXT;
    RAISE NOTICE 'Added user_name to reservations';
  END IF;
END $$;

-- phone: client phone number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'phone'
  ) THEN
    ALTER TABLE reservations ADD COLUMN phone TEXT;
    RAISE NOTICE 'Added phone to reservations';
  END IF;
END $$;

-- services: JSON array of cart services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'services'
  ) THEN
    ALTER TABLE reservations ADD COLUMN services JSONB;
    RAISE NOTICE 'Added services (JSONB) to reservations';
  END IF;
END $$;

-- payment_method: moncash, natcash, bank
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

-- deposit_amount: fixed 1000 HTG deposit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE reservations ADD COLUMN deposit_amount INTEGER DEFAULT 1000;
    RAISE NOTICE 'Added deposit_amount to reservations';
  END IF;
END $$;

-- payment_proof_url: URL to uploaded screenshot
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_proof_url'
  ) THEN
    ALTER TABLE reservations ADD COLUMN payment_proof_url TEXT;
    RAISE NOTICE 'Added payment_proof_url to reservations';
  END IF;
END $$;

-- updated_at: timestamp for last update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reservations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added updated_at to reservations';
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
