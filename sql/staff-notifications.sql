-- ============================================
-- DALIGHT - STAFF NOTIFICATIONS
-- Notifs push pour les employés (assignation RDV, messages admin, etc.)
-- ============================================

DROP TABLE IF EXISTS staff_notifications;
CREATE TABLE staff_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES presence_employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'assignment',
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_employee ON staff_notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_unread ON staff_notifications(employee_id, read) WHERE read = false;

-- For realtime (optional)
ALTER TABLE staff_notifications REPLICA IDENTITY FULL;

-- Portal (anon) can read/insert/update only its own notifications
DROP POLICY IF EXISTS "portal_select_notifications" ON staff_notifications;
CREATE POLICY "portal_select_notifications" ON staff_notifications
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "portal_update_notifications" ON staff_notifications;
CREATE POLICY "portal_update_notifications" ON staff_notifications
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "portal_insert_notifications" ON staff_notifications;
CREATE POLICY "portal_insert_notifications" ON staff_notifications
  FOR INSERT TO anon WITH CHECK (true);

SELECT 'Table staff_notifications créée' AS info;
