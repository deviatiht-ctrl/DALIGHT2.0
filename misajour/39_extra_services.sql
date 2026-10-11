-- ============================================
-- DALIGHT — Sèvis "extra" kache sou sit piblik la
-- Sèvis admin kreye a la vole (rezèvasyon manyèl)
-- ki pa parèt nan paj sèvis piblik la.
-- ============================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_services_visible ON services(is_active, is_visible);

-- Sèvis kache yo pa soti nan API a ditou (pa sèlman nan UI la)
DROP POLICY IF EXISTS "services_public_read" ON services;
CREATE POLICY "services_public_read" ON services
    FOR SELECT USING (is_active = TRUE AND is_visible = TRUE);

DROP POLICY IF EXISTS "services_admin_all" ON services;
CREATE POLICY "services_admin_all" ON services
    FOR ALL USING (public.is_admin());

SELECT '✅ Kolòn sèvis extra pare!' AS status;
