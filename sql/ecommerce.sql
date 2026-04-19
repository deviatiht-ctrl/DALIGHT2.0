-- E-Commerce Database Schema for DALIGHT
-- Run this SQL in Supabase SQL Editor
-- This script will drop and recreate all tables

-- ============================================
-- STEP 1: DROP EXISTING TABLES (in reverse order due to foreign keys)
-- ============================================

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP FUNCTION IF EXISTS generate_order_number CASCADE;

-- Note: Policies are automatically dropped when tables are dropped
-- No need to drop them separately

-- ============================================
-- PRODUCT CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  sku TEXT,
  image_urls TEXT[],
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2),
  shipping_address TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PRODUCT CATEGORIES POLICIES
-- ============================================

-- Admin: full access
CREATE POLICY "admin_all_product_categories"
ON product_categories
FOR ALL
USING (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
);

-- Client: read only active categories
CREATE POLICY "client_read_product_categories"
ON product_categories
FOR SELECT
USING (is_active = true);

-- ============================================
-- PRODUCTS POLICIES
-- ============================================

-- Admin: full access
CREATE POLICY "admin_all_products"
ON products
FOR ALL
USING (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
);

-- Client: read only active products
CREATE POLICY "client_read_products"
ON products
FOR SELECT
USING (is_active = true);

-- ============================================
-- ORDERS POLICIES
-- ============================================

-- Admin: full access
CREATE POLICY "admin_all_orders"
ON orders
FOR ALL
USING (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
);

-- Client: read/write own orders
CREATE POLICY "client_own_orders"
ON orders
FOR ALL
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- ============================================
-- ORDER ITEMS POLICIES
-- ============================================

-- Admin: full access
CREATE POLICY "admin_all_order_items"
ON order_items
FOR ALL
USING (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'email' IN (
    'laurorejeanclarens0@gmail.com'
  )
);

-- Client: read/write own order items (via orders)
CREATE POLICY "client_own_order_items"
ON order_items
FOR ALL
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  )
);

-- ============================================
-- SEED DATA - Sample Categories
-- ============================================
INSERT INTO product_categories (name, slug, description, display_order) VALUES
  ('Huiles de Massage', 'huiles-massage', 'Huiles essentielles et huiles de massage premium', 1),
  ('Produits de Spa', 'produits-spa', 'Produits de soin et relaxation pour spa', 2),
  ('Accessoires', 'accessoires', 'Accessoires pour massage et bien-être', 3),
  ('Coffrets Cadeaux', 'coffrets-cadeaux', 'Coffrets cadeaux pour occasions spéciales', 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FUNCTION TO GENERATE ORDER NUMBER
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  order_num TEXT;
  exists_bool BOOLEAN;
BEGIN
  LOOP
    order_num := 'DL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = order_num) INTO exists_bool;
    EXIT WHEN NOT exists_bool;
  END LOOP;
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;
