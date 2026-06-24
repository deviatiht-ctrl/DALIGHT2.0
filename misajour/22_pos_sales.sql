-- Migration: POS Sales History
-- Kreye tab pou stoer istorik vent POS
-- Date: 2026-06-24

CREATE TABLE IF NOT EXISTS pos_sales (
  id BIGSERIAL PRIMARY KEY,
  receipt_no VARCHAR(50) UNIQUE NOT NULL,
  date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Client info
  client_name VARCHAR(255),
  client_phone VARCHAR(50),
  
  -- Items (JSON array with service/product/formation details)
  items JSONB NOT NULL,
  
  -- Totals
  subtotal_htg INTEGER NOT NULL,
  deposit_htg INTEGER NOT NULL DEFAULT 0,
  amount_due_htg INTEGER NOT NULL,
  balance_htg INTEGER NOT NULL DEFAULT 0,
  
  -- Payment
  payment_method VARCHAR(50) NOT NULL, -- cash, moncash, natcash, bank
  payment_choice VARCHAR(50) NOT NULL, -- full, deposit
  
  -- Admin who made the sale
  admin_id UUID REFERENCES auth.users(id),
  admin_email VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'completed', -- completed, cancelled, refunded
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pos_sales_date ON pos_sales(date_time DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_admin ON pos_sales(admin_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_status ON pos_sales(status);
CREATE INDEX IF NOT EXISTS idx_pos_sales_receipt ON pos_sales(receipt_no);

-- RLS Policies
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

-- Admins can read all sales
CREATE POLICY "Admins can read all pos_sales"
  ON pos_sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert sales
CREATE POLICY "Admins can insert pos_sales"
  ON pos_sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update sales (for refunds/cancellations)
CREATE POLICY "Admins can update pos_sales"
  ON pos_sales FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_pos_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER pos_sales_updated_at_trigger
  BEFORE UPDATE ON pos_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_sales_updated_at();

COMMENT ON TABLE pos_sales IS 'Historique des ventes POS (Point of Sale)';
COMMENT ON COLUMN pos_sales.receipt_no IS 'Numéro unique du reçu (ex: REC-20260624-0001)';
COMMENT ON COLUMN pos_sales.items IS 'JSON array des articles vendus avec détails';
COMMENT ON COLUMN pos_sales.payment_method IS 'Méthode de paiement: cash, moncash, natcash, bank';
COMMENT ON COLUMN pos_sales.payment_choice IS 'Type de paiement: full, deposit';
