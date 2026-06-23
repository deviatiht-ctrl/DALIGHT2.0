-- ============================================
-- SPECIALS/PROMOS SYSTEM
-- ============================================
-- Allows admin to create special offers with flyers
-- Clients can view specials and book services with discounts

-- Table: dl_specials (main special offers)
CREATE TABLE IF NOT EXISTS public.dl_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  flyer_url TEXT, -- Path to uploaded flyer image
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- NULL = no expiration
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: dl_special_services (services included in special with discounts)
CREATE TABLE IF NOT EXISTS public.dl_special_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_id UUID NOT NULL REFERENCES public.dl_specials(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(special_id, service_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dl_specials_active ON public.dl_specials(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dl_special_services_special ON public.dl_special_services(special_id);
CREATE INDEX IF NOT EXISTS idx_dl_special_services_service ON public.dl_special_services(service_id);

-- RLS Policies
ALTER TABLE public.dl_specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dl_special_services ENABLE ROW LEVEL SECURITY;

-- dl_specials: Authenticated users can do everything (admin check via app logic), public can read active specials
CREATE POLICY "Authenticated full access to dl_specials"
  ON public.dl_specials FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public read active dl_specials"
  ON public.dl_specials FOR SELECT
  TO public
  USING (is_active = true);

-- dl_special_services: Authenticated full access, public read via active specials
CREATE POLICY "Authenticated full access to dl_special_services"
  ON public.dl_special_services FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public read dl_special_services via active specials"
  ON public.dl_special_services FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.dl_specials
      WHERE dl_specials.id = dl_special_services.special_id
      AND dl_specials.is_active = true
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dl_specials_updated_at
  BEFORE UPDATE ON public.dl_specials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- View: dl_specials_with_services (for easy frontend queries)
CREATE OR REPLACE VIEW public.dl_specials_with_services AS
SELECT
  s.id,
  s.title,
  s.description,
  s.flyer_url,
  s.start_date,
  s.end_date,
  s.is_active,
  s.created_at,
  s.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'service_id', ss.service_id,
        'service_name', svc.name,
        'service_price', svc.price_htg,
        'discount_type', ss.discount_type,
        'discount_value', ss.discount_value
      )
      ORDER BY svc.name
    ) FILTER (WHERE ss.service_id IS NOT NULL),
    '[]'::json
  ) AS services
FROM public.dl_specials s
LEFT JOIN public.dl_special_services ss ON ss.special_id = s.id
LEFT JOIN public.services svc ON svc.id = ss.service_id
GROUP BY s.id
ORDER BY s.created_at DESC;
