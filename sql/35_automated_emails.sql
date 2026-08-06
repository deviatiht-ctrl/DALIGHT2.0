-- ============================================================
-- DALIGHT — Emails otomatik (pg_cron + pg_net)
-- Fichye: 35_automated_emails.sql
-- Kouri sa APRE 34_auto_program_and_employee_block.sql
--
-- SA FICHYE SA FÈ (san okenn intervansyon manyèl):
-- 1) Email OTOMATIK bay anplwaye (massage/estheticienne) lè yo
--    asiyen sou yon reservation (staff_notifications trigger).
-- 2) Email OTOMATIK bay client chak fwa yon seance mache/konplete
--    (pwogre, estatistik) — client_program_sessions trigger.
-- 3) Rapèl OTOMATIK CHAK JOU (cron 09h00) bay client ki gen
--    seans ki rete pou yo vinn fini (client_reminders).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ------------------------------------------------------------
-- 0. Helper: rele Edge Function send-email (Brevo) san expoze kle a
--    nan kliyan an — tout rete sekirize sou sèvè Supabase.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dalight_send_email(
  p_to TEXT,
  p_subject TEXT,
  p_html TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_to IS NULL OR p_to = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://rbwoiejztrkghfkpxquo.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U'
    ),
    body := jsonb_build_object('to', p_to, 'subject', p_subject, 'html', p_html)
  );
END;
$$;

-- ------------------------------------------------------------
-- 1. Email otomatik bay anplwaye lè yo asiyen sou yon reservation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_employee_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_html TEXT;
BEGIN
  IF NEW.type <> 'assignment' THEN
    RETURN NEW;
  END IF;

  SELECT email, full_name INTO v_email, v_name
  FROM presence_employees WHERE id = NEW.employee_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  v_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">' ||
    '<h2 style="color:#4A3728;">Nouvelle réservation assignée</h2>' ||
    '<p>Bonjour ' || COALESCE(v_name, '') || ',</p>' ||
    '<p>' || COALESCE(NEW.body, 'Vous avez une nouvelle réservation assignée.') || '</p>' ||
    '<p>Connectez-vous à votre portail employé pour voir tous les détails et démarrer le chronomètre de service.</p>' ||
    '<p style="color:#888;font-size:12px;">DALIGHT — Notification automatique</p></div>';

  PERFORM public.dalight_send_email(v_email, '🔔 Nouvelle réservation assignée — DALIGHT', v_html);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_employee_assignment_email ON staff_notifications;
CREATE TRIGGER trg_notify_employee_assignment_email
  AFTER INSERT ON staff_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employee_assignment_email();

-- ------------------------------------------------------------
-- 2. Email otomatik bay client lè yon seance konplete (pwogre)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_session_progress_email()
RETURNS TRIGGER AS $$
DECLARE
  v_program RECORD;
  v_completed INTEGER;
  v_remaining INTEGER;
  v_html TEXT;
BEGIN
  IF NEW.completed IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_program FROM client_programs WHERE id = NEW.program_id;
  IF NOT FOUND OR v_program.client_email IS NULL OR v_program.client_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_completed FROM client_program_sessions
    WHERE program_id = NEW.program_id AND completed = true;
  v_remaining := GREATEST(v_program.total_sessions - v_completed, 0);

  v_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">' ||
    '<h2 style="color:#4A3728;">Votre progression — ' || COALESCE(v_program.service_name, 'Suivi') || '</h2>' ||
    '<p>Bonjour ' || COALESCE(v_program.client_name, '') || ',</p>' ||
    '<p>Séance n°' || NEW.session_number || ' enregistrée avec succès. Voici votre progression :</p>' ||
    '<div style="background:#f9f7f5;border-left:4px solid #D4AF37;padding:16px;border-radius:8px;">' ||
      '<p><strong>Séances complétées :</strong> ' || v_completed || ' / ' || v_program.total_sessions || '</p>' ||
      '<p><strong>Séances restantes :</strong> ' || v_remaining || '</p>' ||
      COALESCE('<p><strong>Observations :</strong> ' || NULLIF(NEW.observations, '') || '</p>', '') ||
      COALESCE('<p><strong>Notes diététiques :</strong> ' || NULLIF(NEW.diet_notes, '') || '</p>', '') ||
    '</div>' ||
    CASE WHEN v_remaining = 0 THEN
      '<p style="color:#2e7d32;font-weight:600;">🎉 Félicitations, vous avez terminé toutes vos séances !</p>'
    ELSE
      '<p>Continuez comme ça ! Notre équipe vous recontactera pour votre prochaine séance.</p>'
    END ||
    '<p style="color:#888;font-size:12px;">DALIGHT — Suivi automatique de votre programme</p></div>';

  PERFORM public.dalight_send_email(v_program.client_email, '📈 Votre progression DALIGHT', v_html);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_client_session_progress ON client_program_sessions;
CREATE TRIGGER trg_notify_client_session_progress
  AFTER INSERT OR UPDATE OF completed ON client_program_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_session_progress_email();

-- ------------------------------------------------------------
-- 2b. Otomatikman kreye/deplase pwochen rapèl la pou pwogram aktif
--     (lè pwogram kreye, epi chak fwa yon seance konplete)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_next_client_reminder(p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_program RECORD;
  v_completed INTEGER;
  v_next_date DATE;
BEGIN
  SELECT * INTO v_program FROM client_programs WHERE id = p_program_id;
  IF NOT FOUND OR v_program.status <> 'active' THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_completed FROM client_program_sessions
    WHERE program_id = p_program_id AND completed = true;

  IF v_completed >= v_program.total_sessions THEN
    RETURN; -- Pwogram fini, pa gen rapèl ankò
  END IF;

  v_next_date := v_program.start_date + (v_completed * COALESCE(v_program.session_interval_days, 1));

  -- Retire ansyen rapèl pending pou pwogram sa a, mete youn nouvo
  DELETE FROM client_reminders WHERE program_id = p_program_id AND status = 'pending';

  INSERT INTO client_reminders (
    employee_id, program_id, reservation_id, client_name, client_email,
    service_name, note, remind_at, status
  ) VALUES (
    v_program.assigned_employee_id, v_program.id, v_program.reservation_id,
    v_program.client_name, v_program.client_email, v_program.service_name,
    'Séance ' || (v_completed + 1) || ' / ' || v_program.total_sessions,
    v_next_date, 'pending'
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_reminder_on_program_create ON client_programs;
CREATE OR REPLACE FUNCTION public.trg_fn_schedule_reminder_on_program_create()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.schedule_next_client_reminder(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_schedule_reminder_on_program_create
  AFTER INSERT ON client_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_schedule_reminder_on_program_create();

DROP TRIGGER IF EXISTS trg_schedule_reminder_on_session_complete ON client_program_sessions;
CREATE OR REPLACE FUNCTION public.trg_fn_schedule_reminder_on_session_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed IS TRUE THEN
    PERFORM public.schedule_next_client_reminder(NEW.program_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_schedule_reminder_on_session_complete
  AFTER INSERT OR UPDATE OF completed ON client_program_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_schedule_reminder_on_session_complete();

-- ------------------------------------------------------------
-- 3. Rapèl chak jou bay client ki gen seans k ap tann yo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_daily_client_reminders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_html TEXT;
BEGIN
  FOR r IN
    SELECT * FROM client_reminders
    WHERE status = 'pending' AND remind_at <= CURRENT_DATE
  LOOP
    v_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">' ||
      '<h2 style="color:#4A3728;">Rappel — ' || COALESCE(r.service_name, 'Votre soin') || '</h2>' ||
      '<p>Bonjour ' || COALESCE(r.client_name, '') || ',</p>' ||
      '<p>Ceci est un rappel amical : il vous reste des séances à compléter pour votre programme.</p>' ||
      COALESCE('<p><strong>Note :</strong> ' || NULLIF(r.note, '') || '</p>', '') ||
      '<p>Contactez-nous pour planifier votre prochaine visite.</p>' ||
      '<p style="color:#888;font-size:12px;">DALIGHT — Rappel automatique</p></div>';

    PERFORM public.dalight_send_email(r.client_email, '⏰ Rappel de votre séance — DALIGHT', v_html);

    UPDATE client_reminders SET status = 'sent', sent_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;

-- Pwograme travay la pou l kouri chak jou 9h AM (UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dalight-daily-client-reminders') THEN
    PERFORM cron.unschedule('dalight-daily-client-reminders');
  END IF;

  PERFORM cron.schedule(
    'dalight-daily-client-reminders',
    '0 9 * * *',
    $cron$SELECT public.process_daily_client_reminders();$cron$
  );
END;
$$;

SELECT 'Emails otomatik: notifications anplwaye, pwogre client, rapèl chak jou konfigire' AS info;
