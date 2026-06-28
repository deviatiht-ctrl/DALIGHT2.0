// =====================================================
// DALIGHT SCHOOL — school-core.js
// Shared Supabase client + auth helpers (code_acces)
// =====================================================

const SUPABASE_URL     = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBIXBdsVHSgTUDO4OTTi6fSxdxu_U';

const schoolSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.schoolSb = schoolSb;

const SESSION_KEY = 'dalightschool_session';

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Login with a code_acces for a given role ('student' | 'professor')
 * Returns the record from DB or null
 */
async function schoolLogin(code, role) {
  code = code.toUpperCase().trim();
  const table = role === 'student' ? 'dalightschool_students' : 'dalightschool_professors';

  try {
    const { data, error } = await schoolSb
      .from(table)
      .select('*')
      .eq('code_acces', code)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    // For professor, also load their course
    let courseData = null;
    if (role === 'professor' && data.course_id) {
      const { data: c } = await schoolSb
        .from('dalightschool_courses')
        .select('*')
        .eq('id', data.course_id)
        .single();
      courseData = c;
    }

    const session = {
      role,
      id:         data.id,
      name:       data.name,
      email:      data.email || null,
      code:       data.code_acces,
      avatar_url: data.avatar_url || null,
      course_id:  data.course_id || null,
      course:     courseData || null,
      login_at:   new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (e) {
    console.error('schoolLogin error:', e);
    return null;
  }
}

function getSchoolSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (_) {
    return null;
  }
}

/**
 * Require a valid session, redirect to login if missing.
 * Pass role='student' or 'professor' to enforce role check.
 */
function requireSchoolSession(role = null) {
  const session = getSchoolSession();
  if (!session) {
    const base = document.location.pathname.includes('/professor/') || document.location.pathname.includes('/student/')
      ? '../index.html' : 'index.html';
    window.location.href = base;
    return null;
  }
  if (role && session.role !== role) {
    window.location.href = '../index.html';
    return null;
  }
  return session;
}

function schoolLogout() {
  localStorage.removeItem(SESSION_KEY);
  const base = document.location.pathname.includes('/professor/') || document.location.pathname.includes('/student/')
    ? '../index.html' : 'index.html';
  window.location.href = base;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateFull(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `il y a ${hrs}h`;
  return fmtDate(d);
}

function scoreColor(score, max = 100) {
  const pct = (score / max) * 100;
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

function average(grades = []) {
  if (!grades.length) return 0;
  return grades.reduce((s, g) => s + (g.grade / g.max_grade) * 100, 0) / grades.length;
}

function showToast(msg, type = 'success') {
  let host = document.getElementById('school-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'school-toast-host';
    host.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;max-width:340px;';
    document.body.appendChild(host);
  }
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#4f46e5' };
  const toast = document.createElement('div');
  toast.style.cssText = `background:#fff;border-left:4px solid ${colors[type]||colors.info};padding:.75rem 1rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.12);font-size:.875rem;color:#1e1b4b;animation:slideInRight .3s ease;`;
  toast.textContent = msg;
  host.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'fadeOut .3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Avatar component ──────────────────────────────────────────────────────────

function avatarHTML(name, url, size = 40, color = '#4f46e5') {
  if (url) return `<img src="${url}" alt="${name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${Math.round(size*0.35)}px;">${initials(name)}</div>`;
}

// ── Expose globals ────────────────────────────────────────────────────────────
window.schoolLogin        = schoolLogin;
window.getSchoolSession   = getSchoolSession;
window.requireSchoolSession = requireSchoolSession;
window.schoolLogout       = schoolLogout;
window.schoolInitials     = initials;
window.schoolFmtDate      = fmtDate;
window.schoolFmtDateFull  = fmtDateFull;
window.schoolTimeAgo      = timeAgo;
window.schoolScoreColor   = scoreColor;
window.schoolAverage      = average;
window.showSchoolToast    = showToast;
window.schoolAvatarHTML   = avatarHTML;
