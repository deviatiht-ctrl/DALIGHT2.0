// ============================================
// DALIGHT - STAFF PORTAL
// Interface personnelle employé (accès par code)
// ============================================

const SB_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
const sb = supabase.createClient(SB_URL, SB_KEY);

// ---- Role catalogue -------------------------------------------------
const ROLE_META = {
  estheticienne:     { label: 'Esthéticienne',     icon: 'sparkles', provider: true },
  masseuse:          { label: 'Masseur/Masseuse',  icon: 'hand', provider: true },
  coiffure:          { label: 'Coiffure',          icon: 'scissors', provider: true },
  onglerie:          { label: 'Onglerie',          icon: 'gem', provider: true },
  community_manager: { label: 'Community Manager',  icon: 'smartphone', provider: false },
  adm_manager:       { label: 'ADM / Manager',      icon: 'briefcase', provider: false },
  receptionniste:    { label: 'Réceptionniste',     icon: 'phone', provider: false },
  caissier:          { label: 'Caissier/Caisse',   icon: 'banknote', provider: false },
  formateur:         { label: 'Formateur',          icon: 'graduation-cap', provider: false },
};
function lucideIcon(name, size = 16) { return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;vertical-align:-3px;"></i>`; }
function roleLabel(r) { return ROLE_META[r]?.label || r; }
function isProviderRole(r) { return !!ROLE_META[r]?.provider; }

let currentEmployee = null;
let chronoTimer = null;
let activeSession = null;

// ---- Utilities ------------------------------------------------------
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function getInitials(name) { if (!name) return '?'; return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) { if (!d) return '—'; const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtTime(t) { return t ? String(t).slice(0, 5) : '—'; }

function toast(msg, type = 'success') {
  const box = document.getElementById('toast-box');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

// ---- Auth (username / password) --------------------------------------
async function staffLogin() {
  const userInput = document.getElementById('username-input');
  const passInput = document.getElementById('password-input');
  const errEl = document.getElementById('login-error');
  const username = (userInput.value || '').trim().toLowerCase();
  const password = (passInput.value || '').trim();
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Entrez votre nom d\'utilisateur et votre mot de passe.'; return; }

  try {
    const { data, error } = await sb
      .from('presence_employees')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.password !== password) { errEl.textContent = 'Identifiants invalides.'; return; }
    if (data.portal_enabled === false) { errEl.textContent = 'Accès désactivé. Contactez l\'administration.'; return; }

    currentEmployee = data;
    sessionStorage.setItem('dalight_staff_username', username);
    sessionStorage.setItem('dalight_staff_password', password);
    enterPortal();
  } catch (err) {
    console.error(err);
    errEl.textContent = 'Erreur: ' + (err?.message || err);
  }
}

function staffLogout() {
  sessionStorage.removeItem('dalight_staff_username');
  sessionStorage.removeItem('dalight_staff_password');
  currentEmployee = null;
  if (chronoTimer) clearInterval(chronoTimer);
  document.getElementById('portal-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username-input').value = '';
  document.getElementById('password-input').value = '';
}

async function tryAutoLogin() {
  const username = sessionStorage.getItem('dalight_staff_username');
  const password = sessionStorage.getItem('dalight_staff_password');
  if (!username || !password) return;
  document.getElementById('username-input').value = username;
  document.getElementById('password-input').value = password;
  await staffLogin();
}

// ---- Portal shell ---------------------------------------------------
function employeeRoles() {
  let roles = currentEmployee.roles || [];
  if (typeof roles === 'string') { try { roles = JSON.parse(roles); } catch { roles = []; } }
  if (!Array.isArray(roles)) roles = [];
  return roles;
}

function buildNav() {
  const roles = employeeRoles();
  const hasProvider = roles.some(isProviderRole);
  const isCM = roles.includes('community_manager');
  const isManager = roles.includes('adm_manager');

  const items = [
    { id: 'home', label: 'Accueil', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  ];
  if (hasProvider || isManager || roles.includes('receptionniste')) {
    items.push({ id: 'appointments', label: 'Rendez-vous', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' });
  }
  if (hasProvider) {
    items.push({ id: 'service', label: 'Service en cours', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' });
  }
  if (isCM || isManager) {
    items.push({ id: 'stats', label: 'Statistiques', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' });
  }
  items.push({ id: 'reports', label: 'Mes rapports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' });
  items.push({ id: 'attendance', label: 'Mes présences', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' });
  items.push({ id: 'evaluations', label: 'Mes évaluations', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' });
  items.push({ id: 'profile', label: 'Mon profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' });

  const nav = document.getElementById('nav-menu');
  nav.innerHTML = items.map(it => `
    <button class="nav-item" data-section="${it.id}" onclick="showSection('${it.id}')">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${it.icon}"/></svg>
      ${it.label}
    </button>
  `).join('');
}

function enterPortal() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('portal-shell').classList.remove('hidden');

  const roles = employeeRoles();
  document.getElementById('side-name').textContent = currentEmployee.full_name || 'Employé';
  document.getElementById('side-role').textContent = roles.length ? roles.map(roleLabel).join(', ') : (currentEmployee.position || '');
  const av = document.getElementById('side-avatar');
  av.innerHTML = currentEmployee.photo_url ? `<img src="${esc(currentEmployee.photo_url)}" alt="">` : getInitials(currentEmployee.full_name);

  buildNav();
  showSection('home');
  loadNotifications();
  setInterval(loadNotifications, 30000);
}

const SECTION_META = {
  home:        { title: 'Accueil', sub: 'Vue d\'ensemble de votre journée' },
  appointments:{ title: 'Rendez-vous', sub: 'Vos clients et prestations' },
  service:     { title: 'Service en cours', sub: 'Chronomètre de prestation' },
  stats:       { title: 'Statistiques', sub: 'Performance et engagement' },
  reports:     { title: 'Mes rapports', sub: 'Soumettre et consulter vos rapports' },
  attendance:  { title: 'Mes présences', sub: 'Historique de vos entrées / sorties' },
  evaluations: { title: 'Mes évaluations', sub: 'Retours de l\'administration' },
  profile:     { title: 'Mon profil', sub: 'Vos informations personnelles' },
};

function showSection(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id));
  document.getElementById('sidebar').classList.remove('open');
  const meta = SECTION_META[id] || { title: '', sub: '' };
  document.getElementById('section-title').textContent = meta.title;
  document.getElementById('section-sub').textContent = meta.sub;
  const c = document.getElementById('section-content');
  c.innerHTML = '<div class="empty">Chargement…</div>';

  const map = {
    home: renderHome, appointments: renderAppointments, service: renderService,
    stats: renderStats, reports: renderReports, attendance: renderAttendance,
    evaluations: renderEvaluations, profile: renderProfile,
  };
  Promise.resolve((map[id] || renderHome)(c)).then(() => { if (window.lucide) lucide.createIcons(); });
}

// ---- HOME -----------------------------------------------------------
async function renderHome(c) {
  const roles = employeeRoles();
  const empId = currentEmployee.id;
  const today = todayStr();

  const [sessRes, apptRes, evalRes, attRes] = await Promise.all([
    sb.from('service_sessions').select('*').eq('employee_id', empId).gte('started_at', today + 'T00:00:00'),
    roles.some(isProviderRole) || roles.includes('receptionniste') || roles.includes('adm_manager')
      ? sb.from('reservations').select('id,status,assigned_employee_id').eq('date', today)
      : Promise.resolve({ data: [] }),
    sb.from('staff_evaluations').select('overall_score').eq('employee_id', empId).eq('visible_to_employee', true),
    sb.from('attendance_logs').select('*').eq('employee_id', empId).eq('log_date', today).maybeSingle(),
  ]);

  const sessions = sessRes.data || [];
  const completed = sessions.filter(s => s.status === 'completed');
  const seesAll = roles.includes('adm_manager') || roles.includes('receptionniste');
  const appts = (apptRes.data || []).filter(r => r.status !== 'CANCELLED' && (seesAll || r.assigned_employee_id === empId));
  const evals = evalRes.data || [];
  const avgScore = evals.length ? (evals.reduce((s, e) => s + (Number(e.overall_score) || 0), 0) / evals.length).toFixed(1) : '—';
  const att = attRes.data;

  const totalSecs = completed.reduce((s, x) => s + (x.duration_seconds || 0), 0);
  const hrs = Math.floor(totalSecs / 3600), mins = Math.floor((totalSecs % 3600) / 60);

  const cards = [];
  if (roles.some(isProviderRole)) {
    cards.push(statCard('#22c55e', 'rgba(34,197,94,.16)', appts.length, 'RDV aujourd\'hui', 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'));
    cards.push(statCard('#3b82f6', 'rgba(59,130,246,.16)', completed.length, 'Services terminés', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'));
    cards.push(statCard('#8b5cf6', 'rgba(139,92,246,.16)', `${hrs}h${String(mins).padStart(2, '0')}`, 'Temps de service', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'));
  } else {
    cards.push(statCard('#22c55e', 'rgba(34,197,94,.16)', appts.length, 'RDV aujourd\'hui', 'M8 7V3m8 4V3'));
  }
  cards.push(statCard('#c9a227', 'rgba(201,162,39,.16)', avgScore, 'Note moyenne /5', 'M11 3.049c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915'));

  const presence = att
    ? `<span class="badge ${att.exit_time ? 'badge-blue' : 'badge-green'}">${att.exit_time ? 'Journée terminée' : 'Présent(e)'}</span> · ${fmtDate(att.log_date)} · Entrée ${fmtTime(att.entry_time)} · Sortie ${att.exit_time ? fmtTime(att.exit_time) : '—'}`
    : '<span class="badge badge-red">Al scanner</span>';

  c.innerHTML = `
    <div class="grid cards-4" style="margin-bottom:1.3rem;">${cards.join('')}</div>
    <div class="card" style="margin-bottom:1.3rem;">
      <div class="card-title">Bonjour, ${esc((currentEmployee.full_name || '').split(' ')[0] || 'vous')}</div>
      <div style="color:var(--muted);font-size:.9rem;line-height:1.6;">
        Rôles: ${roles.map(r => `<span class="badge badge-gold" style="margin-right:.3rem;">${ROLE_META[r]?.icon ? lucideIcon(ROLE_META[r].icon, 14) : ''} ${esc(roleLabel(r))}</span>`).join('') || '—'}<br>
        Présence: ${presence}
      </div>
    </div>
    <div class="grid cards-2">
      ${roles.some(isProviderRole) ? `<div class="card"><div class="card-title">Accès rapide</div>
        <div class="row-actions" style="justify-content:flex-start;">
          <button class="btn btn-gold btn-sm" style="width:auto;margin:0;" onclick="showSection('appointments')">Voir mes RDV</button>
          <button class="btn btn-green btn-sm" onclick="showSection('service')">Démarrer un service</button>
        </div></div>` : ''}
      <div class="card"><div class="card-title">Rapports</div>
        <div style="color:var(--muted);font-size:.88rem;margin-bottom:.8rem;">Soumettez votre rapport d'activité.</div>
        <button class="btn btn-blue btn-sm" onclick="showSection('reports')">Nouveau rapport</button>
      </div>
    </div>
  `;
}

function statCard(color, bg, value, label, icon) {
  return `<div class="card stat-card">
    <div class="stat-icon" style="background:${bg};color:${color};">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="${icon}"/></svg>
    </div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

// ---- APPOINTMENTS ---------------------------------------------------
let loadedAppointments = [];
let cfModule = null;
let loadedConsent = null;
function seesAllAppointments() {
  const roles = employeeRoles();
  return roles.includes('adm_manager') || roles.includes('receptionniste');
}
async function renderAppointments(c) {
  const date = c._date || '';
  const seesAll = seesAllAppointments();
  let data = [], error = null;
  if (seesAll) {
    let q = sb.from('reservations').select('*, reservation_employees(*)').neq('status', 'CANCELLED');
    if (date) q = q.eq('date', date); else q = q.gte('date', todayStr());
    const res = await q.order('date', { ascending: true }).order('time', { ascending: true });
    data = res.data; error = res.error;
  } else {
    const empId = currentEmployee.id;
    const [primaryRes, empRes] = await Promise.all([
      sb.from('reservations').select('*, reservation_employees(*)').eq('assigned_employee_id', empId).neq('status', 'CANCELLED'),
      sb.from('reservation_employees').select('reservation_id').eq('employee_id', empId),
    ]);
    const ids = new Set((empRes.data || []).map(re => re.reservation_id));
    (primaryRes.data || []).forEach(r => ids.add(r.id));
    if (ids.size) {
      const res = await sb.from('reservations').select('*, reservation_employees(*)').in('id', Array.from(ids)).neq('status', 'CANCELLED').order('date', { ascending: true }).order('time', { ascending: true });
      data = res.data; error = res.error;
    } else {
      data = [];
    }
  }

  let list = (data || []).filter(r => r.status !== 'CANCELLED');
  if (date) list = list.filter(r => r.date === date);
  loadedAppointments = list;

  try {
    if (!cfModule) cfModule = await import('./consent-forms.js');
    const ids = list.map(r => r.id);
    const [subRes, tplRes, svcRes] = await Promise.all([
      ids.length ? sb.from('form_submissions').select('*').in('reservation_id', ids) : Promise.resolve({ data: [] }),
      sb.from('form_templates').select('*').eq('is_active', true),
      sb.from('services').select('id, category'),
    ]);
    loadedConsent = {
      submissions: subRes.data || [],
      templates: tplRes.data || [],
      serviceMap: Object.fromEntries((svcRes.data || []).map(s => [s.id, s.category])),
    };
  } catch (err) {
    console.warn('consent forms load error:', err);
    cfModule = null;
    loadedConsent = null;
  }

  c.innerHTML = `
    <div class="card" style="margin-bottom:1rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <div class="form-group" style="margin:0;">
        <label>Filtrer par date</label>
        <input type="date" class="input" id="appt-date" value="${date}" onchange="reloadAppointments(this.value)">
      </div>
      <button class="btn btn-ghost btn-sm" onclick="reloadAppointments('')">Toutes les dates</button>
      <div style="color:var(--admin-text-muted);font-size:.85rem;">${list.length} rendez-vous</div>
    </div>
    <div id="appt-list">
      ${error ? `<div class="empty">Erreur: ${esc(error.message)}</div>` :
        list.length === 0 ? '<div class="empty">Aucun rendez-vous assigné.</div>' :
        list.map(apptCard).join('')}
    </div>
  `;
}
window.reloadAppointments = function (date) {
  const c = document.getElementById('section-content');
  c._date = date;
  renderAppointments(c);
};

function getConsentInfo(r) {
  if (!cfModule || !loadedConsent) return '';
  const submission = cfModule.findSubmission(r, loadedConsent.submissions);
  if (submission) {
    return `<span class="badge badge-green">Formulaire reçu</span>
      <button class="btn btn-sm btn-secondary" style="margin-left:.3rem;" onclick="openConsentForAppt('${r.id}')">Voir</button>`;
  }
  const template = cfModule.matchTemplate(r, loadedConsent.templates, loadedConsent.serviceMap);
  if (template) {
    return `<span class="badge badge-gold">Formulaire requis</span>
      <button class="btn btn-sm btn-primary" style="margin-left:.3rem;" onclick="openConsentForAppt('${r.id}')">Remplir</button>`;
  }
  return '<span class="badge badge-muted">Aucun formulaire</span>';
}

function apptCard(r) {
  const statusBadge = {
    CONFIRMED: 'badge-green', PENDING: 'badge-gold', AWAITING_PAYMENT: 'badge-gold',
    COMPLETED: 'badge-blue', NO_SHOW: 'badge-muted'
  }[r.status] || 'badge-muted';
  const clientName = esc(r.user_name || 'Client');
  const svc = esc(r.service || 'Service');
  return `<div class="list-item" style="cursor:pointer;" onclick="openApptDetail('${r.id}')">
    <div class="avatar">${getInitials(r.user_name || 'C')}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:600;">${clientName} <span class="badge ${statusBadge}" style="margin-left:.3rem;">${esc(r.status)}</span></div>
      <div style="color:var(--admin-text-muted);font-size:.85rem;">${svc} · ${fmtDate(r.date)} · ${fmtTime(r.time)} · ${esc(r.location || '')}</div>
    </div>
    <div style="display:flex;gap:.4rem;align-items:center;" onclick="event.stopPropagation()">
      <button class="btn btn-green btn-sm" onclick="startServiceFromAppt('${r.id}')">Démarrer</button>
    </div>
  </div>`;
}

window.openApptDetail = function (reservationId) {
  const r = loadedAppointments.find(a => a.id === reservationId);
  if (!r) return;
  const email = esc(r.user_email || r.email || '');
  const consentInfo = getConsentInfo(r);
  const statusBadge = {
    CONFIRMED: 'badge-green', PENDING: 'badge-gold', AWAITING_PAYMENT: 'badge-gold',
    COMPLETED: 'badge-blue', NO_SHOW: 'badge-muted'
  }[r.status] || 'badge-muted';

  const overlay = document.createElement('div');
  overlay.id = 'appt-detail-overlay';
  overlay.style = 'position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  overlay.innerHTML = `
    <div class="card" style="max-width:480px;width:100%;margin:0;max-height:85vh;overflow-y:auto;">
      <div class="card-title">
        Rendez-vous
        <button class="btn btn-ghost btn-sm" onclick="closeApptDetail()">${lucideIcon('x', 16)}</button>
      </div>
      <div style="display:flex;align-items:center;gap:.9rem;margin-bottom:1rem;">
        <div class="avatar" style="width:56px;height:56px;font-size:1.1rem;">${getInitials(r.user_name || 'C')}</div>
        <div>
          <div style="font-weight:700;font-size:1.05rem;">${esc(r.user_name || 'Client')}</div>
          <span class="badge ${statusBadge}">${esc(r.status)}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem;font-size:.9rem;color:var(--admin-text);">
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('sparkles')} <span>${esc(r.service || 'Service')}</span></div>
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('calendar')} <span>${fmtDate(r.date)}</span></div>
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('clock')} <span>${fmtTime(r.time)}</span></div>
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('map-pin')} <span>${esc(r.location || '—')}</span></div>
        ${r.phone ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('phone')} <span>${esc(r.phone)}</span></div>` : ''}
        ${email ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('mail')} <span>${email}</span></div>` : ''}
        ${r.notes ? `<div style="display:flex;align-items:flex-start;gap:.6rem;">${lucideIcon('file-text')} <span>${esc(r.notes)}</span></div>` : ''}
        ${r.duration_minutes ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('hourglass')} <span>Durée prévue: ${r.duration_minutes} min</span></div>` : ''}
        ${(r.reservation_employees || []).length ? `<div style="display:flex;align-items:flex-start;gap:.6rem;">${lucideIcon('users')} <span>Équipe: ${r.reservation_employees.map(e => esc(e.employee_name || e.employee_id)).join(', ')}</span></div>` : ''}
      </div>
      <div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--admin-border);">
        <div style="font-size:.8rem;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">Formulaire de consentement</div>
        <div>${consentInfo}</div>
      </div>
      <div style="margin-top:1.2rem;display:flex;gap:.6rem;flex-wrap:wrap;">
        <button class="btn btn-green" onclick="closeApptDetail();startServiceFromAppt('${r.id}')">${lucideIcon('play')} Démarrer le service</button>
        <button class="btn btn-ghost" onclick="closeApptDetail()">Fermer</button>
      </div>
    </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeApptDetail(); });
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
};
window.closeApptDetail = function () {
  document.getElementById('appt-detail-overlay')?.remove();
};

window.startServiceFromAppt = function (reservationId) {
  const r = loadedAppointments.find(a => a.id === reservationId);
  if (!r) { toast('Rendez-vous introuvable', 'error'); return; }
  openTimerModal(r.duration_minutes, async (minutes) => {
    await createSession({
      reservation_id: r.id, client_name: r.user_name || 'Client', client_phone: r.phone || null,
      service_name: r.service || 'Service', location: r.location || 'Spa', planned_duration_minutes: minutes,
    });
    showSection('service');
  });
};

window.openConsentForAppt = async function (reservationId) {
  const r = loadedAppointments.find(a => a.id === reservationId);
  if (!r || !cfModule || !loadedConsent) return;
  const submission = cfModule.findSubmission(r, loadedConsent.submissions);
  const template = submission ? null : cfModule.matchTemplate(r, loadedConsent.templates, loadedConsent.serviceMap);
  if (!submission && !template) { toast('Aucun formulaire pour ce rendez-vous', 'warning'); return; }
  r.user_email = r.user_email || r.email || '';
  cfModule.openConsentModal({
    supabase: sb,
    reservation: r,
    template: template || null,
    submission: submission || null,
    onSubmitted: () => renderAppointments(document.getElementById('section-content')),
  });
};

// ---- SERVICE helpers -----------------------------------------
function playFinishSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
    setTimeout(() => { try { ctx.close(); } catch {} }, 600);
  } catch (e) { console.warn('sound error', e); }
}

function openTimerModal(defaultMinutes, onConfirm) {
  const overlay = document.createElement('div');
  overlay.id = 'timer-modal-overlay';
  overlay.style = 'position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  overlay.innerHTML = `
    <div class="card" style="max-width:360px;width:100%;margin:0;">
      <div class="card-title">Choisir la durée du minuteur</div>
      <div class="form-group" style="margin-bottom:1.2rem;">
        <label>Durée (minutes)</label>
        <input type="number" id="timer-minutes" class="form-input" value="${defaultMinutes || 60}" min="1">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:.6rem;">
        <button class="btn btn-ghost" onclick="document.getElementById('timer-modal-overlay')?.remove()">Annuler</button>
        <button class="btn btn-green" id="timer-confirm">Démarrer</button>
      </div>
    </div>`;
  overlay.querySelector('#timer-confirm').addEventListener('click', () => {
    const minutes = Number(document.getElementById('timer-minutes').value) || 0;
    if (minutes < 1) return;
    overlay.remove();
    onConfirm(minutes);
  });
  document.body.appendChild(overlay);
}

// ---- SERVICE (chronometer) -----------------------------------------
async function renderService(c) {
  const empId = currentEmployee.id;
  const { data: active } = await sb.from('service_sessions')
    .select('*').eq('employee_id', empId).eq('status', 'in_progress')
    .order('started_at', { ascending: false }).limit(1).maybeSingle();

  activeSession = active || null;
  const today = todayStr();
  const { data: history } = await sb.from('service_sessions')
    .select('*').eq('employee_id', empId).eq('status', 'completed')
    .gte('started_at', today + 'T00:00:00').order('started_at', { ascending: false });

  let activeHtml;
  if (activeSession) {
    activeHtml = `<div class="chrono-box">
      <div id="chrono-label" style="font-size:.85rem;color:var(--admin-text-muted);margin-bottom:.4rem;">${activeSession.planned_end_at ? 'Temps restant' : 'Chronomètre'}</div>
      <div class="chrono-time" id="chrono-display">00:00:00</div>
      <div class="chrono-service">${esc(activeSession.service_name)}</div>
      <div class="chrono-client">${esc(activeSession.client_name || 'Client')}${activeSession.client_phone ? ' · ' + esc(activeSession.client_phone) : ''}</div>
      ${activeSession.planned_duration_minutes ? `<div class="chrono-client" style="font-size:.85rem;color:var(--admin-text-muted);">Durée: ${activeSession.planned_duration_minutes} min</div>` : ''}
      <div class="row-actions">
        <button class="btn btn-red" onclick="stopSession()">Terminer le service</button>
        <button class="btn btn-ghost btn-sm" onclick="cancelSession()">Annuler</button>
      </div>
    </div>`;
  } else {
    activeHtml = `<div class="chrono-box">
      <div style="color:var(--muted);margin-bottom:1rem;">Aucun service en cours</div>
      <div class="form-group" style="text-align:left;"><label>Service</label><input class="input" id="new-svc" placeholder="Ex: Massage relaxant"></div>
      <div class="form-group" style="text-align:left;"><label>Client (optionnel)</label><input class="input" id="new-client" placeholder="Nom du client"></div>
      <div class="form-group" style="text-align:left;"><label>Durée (min)</label><input class="input" type="number" id="new-minutes" placeholder="Optionnel — ex: 60" min="1"></div>
      <button class="btn btn-green" onclick="startManualSession()">Démarrer le chronomètre</button>
    </div>`;
  }

  c.innerHTML = `
    <div class="card" style="margin-bottom:1.3rem;">${activeHtml}</div>
    <div class="card">
      <div class="card-title">Services terminés aujourd'hui</div>
      ${(history && history.length) ? `<table class="table"><thead><tr><th>Service</th><th>Client</th><th>Début</th><th>Durée</th></tr></thead><tbody>
        ${history.map(s => `<tr><td>${esc(s.service_name)}</td><td>${esc(s.client_name || '—')}</td><td>${new Date(s.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td><td>${fmtDuration(s.duration_seconds)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Aucun service terminé aujourd\'hui.</div>'}
    </div>
  `;

  if (activeSession) startChronoDisplay();
}

function fmtDuration(secs) {
  if (!secs && secs !== 0) return '—';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return (h ? h + 'h' : '') + String(m).padStart(2, '0') + 'm' + String(s).padStart(2, '0') + 's';
}

function startChronoDisplay() {
  if (chronoTimer) clearInterval(chronoTimer);
  const el = document.getElementById('chrono-display');
  const labelEl = document.getElementById('chrono-label');
  if (activeSession.planned_end_at) {
    activeSession._soundPlayed = false;
    const planned = new Date(activeSession.planned_end_at).getTime();
    const update = () => {
      const remaining = Math.max(0, Math.ceil((planned - Date.now()) / 1000));
      const h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
      if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (labelEl) labelEl.textContent = 'Temps restant';
      if (remaining <= 1 && !activeSession._soundPlayed) { activeSession._soundPlayed = true; playFinishSound(); }
    };
    update();
    chronoTimer = setInterval(update, 1000);
  } else {
    const start = new Date(activeSession.started_at).getTime();
    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
      if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (labelEl) labelEl.textContent = 'Chronomètre';
    };
    update();
    chronoTimer = setInterval(update, 1000);
  }
}

async function createSession(payload) {
  const { data: existing } = await sb.from('service_sessions')
    .select('id').eq('employee_id', currentEmployee.id).eq('status', 'in_progress').maybeSingle();
  if (existing) { toast('Vous avez déjà un service en cours', 'warning'); return; }

  const minutes = payload.planned_duration_minutes;
  const planned_end_at = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
  const insertPayload = {
    employee_id: currentEmployee.id, status: 'in_progress', started_at: new Date().toISOString(),
    ...payload, planned_duration_minutes: minutes || null, planned_end_at,
  };
  const { error } = await sb.from('service_sessions').insert(insertPayload);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  toast('Service démarré', 'success');
}

window.startManualSession = async function () {
  const svc = document.getElementById('new-svc').value.trim();
  const client = document.getElementById('new-client').value.trim();
  const minutes = Number(document.getElementById('new-minutes').value) || 0;
  if (!svc) { toast('Indiquez le service', 'warning'); return; }
  await createSession({ service_name: svc, client_name: client || null, location: 'Spa', planned_duration_minutes: minutes || undefined });
  showSection('service');
};

window.stopSession = async function () {
  if (!activeSession) return;
  const secs = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
  const { error } = await sb.from('service_sessions').update({
    status: 'completed', ended_at: new Date().toISOString(), duration_seconds: secs,
  }).eq('id', activeSession.id);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  if (chronoTimer) clearInterval(chronoTimer);
  toast('Service terminé (' + fmtDuration(secs) + ')', 'success');
  showSection('service');
};

window.cancelSession = async function () {
  if (!activeSession) return;
  if (!confirm('Annuler ce service en cours ?')) return;
  await sb.from('service_sessions').update({ status: 'cancelled', ended_at: new Date().toISOString() }).eq('id', activeSession.id);
  if (chronoTimer) clearInterval(chronoTimer);
  toast('Service annulé', 'warning');
  showSection('service');
};

// ---- STATS (community manager / manager) ----------------------------
async function renderStats(c) {
  const [postsRes, subsRes] = await Promise.all([
    sb.from('posts').select('*').order('created_at', { ascending: false }),
    sb.from('subscribers').select('id', { count: 'exact' }),
  ]);
  const posts = postsRes.data || [];
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const subs = subsRes.count || (subsRes.data ? subsRes.data.length : 0);

  // group posts per month (last 6)
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }), count: 0, likes: 0 }); }
  posts.forEach(p => { if (!p.created_at) return; const d = new Date(p.created_at); const k = `${d.getFullYear()}-${d.getMonth()}`; const m = months.find(x => x.key === k); if (m) { m.count++; m.likes += (p.likes || 0); } });

  c.innerHTML = `
    <div class="grid cards-4" style="margin-bottom:1.3rem;">
      ${statCard('#8b5cf6', 'rgba(139,92,246,.16)', posts.length, 'Publications', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z')}
      ${statCard('#ef4444', 'rgba(239,68,68,.16)', totalLikes, 'J\'aime total', 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z')}
      ${statCard('#22c55e', 'rgba(34,197,94,.16)', subs, 'Abonnés', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z')}
      ${statCard('#c9a227', 'rgba(201,162,39,.16)', posts.length ? Math.round(totalLikes / posts.length) : 0, 'Moy. j\'aime/post', 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6')}
    </div>
    <div class="grid cards-2">
      <div class="card"><div class="card-title">Publications (6 mois)</div><div class="chart-wrap"><canvas id="chart-posts"></canvas></div></div>
      <div class="card"><div class="card-title">Engagement (j'aime)</div><div class="chart-wrap"><canvas id="chart-likes"></canvas></div></div>
    </div>
  `;

  const gridColor = '#e8ebf2', tickColor = '#64748b';
  new Chart(document.getElementById('chart-posts'), {
    type: 'bar',
    data: { labels: months.map(m => m.label), datasets: [{ label: 'Posts', data: months.map(m => m.count), backgroundColor: 'rgba(139,92,246,.6)', borderRadius: 6 }] },
    options: chartOpts(gridColor, tickColor),
  });
  new Chart(document.getElementById('chart-likes'), {
    type: 'line',
    data: { labels: months.map(m => m.label), datasets: [{ label: 'J\'aime', data: months.map(m => m.likes), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.15)', fill: true, tension: .35 }] },
    options: chartOpts(gridColor, tickColor),
  });
}
function chartOpts(grid, tick) {
  return { responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: tick } } },
    scales: { x: { grid: { color: grid }, ticks: { color: tick } }, y: { grid: { color: grid }, ticks: { color: tick }, beginAtZero: true } } };
}

// ---- REPORTS --------------------------------------------------------
async function renderReports(c) {
  const roles = employeeRoles();
  const isCM = roles.includes('community_manager');
  const { data } = await sb.from('staff_reports').select('*').eq('employee_id', currentEmployee.id).order('created_at', { ascending: false });
  const reports = data || [];

  c.innerHTML = `
    <div class="grid cards-2">
      <div class="card">
        <div class="card-title">Nouveau rapport</div>
        <div class="form-group"><label>Titre *</label><input class="input" id="rep-title" placeholder="Ex: Rapport hebdomadaire"></div>
        <div class="form-group"><label>Type</label>
          <select class="select" id="rep-type">
            <option value="daily">Journalier</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
            <option value="content">Contenu / Social</option>
            <option value="general">Général</option>
          </select>
        </div>
        ${isCM ? `<div class="grid" style="grid-template-columns:1fr 1fr;gap:.6rem;">
          <div class="form-group"><label>Posts publiés</label><input class="input" type="number" id="rep-posts" placeholder="0"></div>
          <div class="form-group"><label>J'aime générés</label><input class="input" type="number" id="rep-likes" placeholder="0"></div>
        </div>` : ''}
        <div class="form-group"><label>Contenu *</label><textarea class="textarea" id="rep-content" placeholder="Décrivez votre activité, résultats, difficultés..."></textarea></div>
        <button class="btn btn-gold" style="width:auto;margin:0;" onclick="submitReport()">Envoyer le rapport</button>
      </div>
      <div class="card">
        <div class="card-title">Historique (${reports.length})</div>
        ${reports.length ? reports.map(reportCard).join('') : '<div class="empty">Aucun rapport soumis.</div>'}
      </div>
    </div>
  `;
}
function reportCard(r) {
  const metrics = r.metrics && typeof r.metrics === 'object' ? r.metrics : {};
  const metricStr = Object.keys(metrics).length ? Object.entries(metrics).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
  return `<div class="list-item" style="flex-direction:column;align-items:stretch;">
    <div style="display:flex;justify-content:space-between;gap:.5rem;">
      <div style="font-weight:600;">${esc(r.title)}</div>
      <span class="badge badge-gold">${esc(r.report_type)}</span>
    </div>
    <div style="color:var(--muted);font-size:.82rem;margin:.3rem 0;">${new Date(r.created_at).toLocaleString('fr-FR')}</div>
    ${r.content ? `<div style="font-size:.86rem;line-height:1.5;">${esc(r.content)}</div>` : ''}
    ${metricStr ? `<div style="color:var(--muted);font-size:.8rem;margin-top:.3rem;display:flex;align-items:center;gap:.4rem;">${lucideIcon('bar-chart-2', 14)} ${esc(metricStr)}</div>` : ''}
    ${r.admin_feedback ? `<div style="margin-top:.4rem;padding:.5rem .7rem;background:var(--gold-soft);border-radius:8px;font-size:.83rem;display:flex;align-items:flex-start;gap:.4rem;">${lucideIcon('message-circle', 14)} <span><strong>Admin:</strong> ${esc(r.admin_feedback)}</span></div>` : ''}
  </div>`;
}
window.submitReport = async function () {
  const title = document.getElementById('rep-title').value.trim();
  const content = document.getElementById('rep-content').value.trim();
  const type = document.getElementById('rep-type').value;
  if (!title || !content) { toast('Titre et contenu requis', 'warning'); return; }

  const metrics = {};
  const pEl = document.getElementById('rep-posts'), lEl = document.getElementById('rep-likes');
  if (pEl && pEl.value) metrics.posts = Number(pEl.value);
  if (lEl && lEl.value) metrics.likes = Number(lEl.value);

  const roles = employeeRoles();
  const { error } = await sb.from('staff_reports').insert({
    employee_id: currentEmployee.id, employee_name: currentEmployee.full_name,
    role: roles[0] || null, report_type: type, title, content, metrics,
  });
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  toast('Rapport envoyé', 'success');
  showSection('reports');
};

// ---- ATTENDANCE -----------------------------------------------------
async function renderAttendance(c) {
  const since = new Date(); since.setDate(since.getDate() - 30);
  const { data } = await sb.from('attendance_logs')
    .select('*').eq('employee_id', currentEmployee.id)
    .gte('log_date', since.toISOString().split('T')[0]).order('log_date', { ascending: false });
  const logs = data || [];

  c.innerHTML = `<div class="card">
    <div class="card-title">30 derniers jours</div>
    ${logs.length ? `<table class="table"><thead><tr><th>Date</th><th>Entrée</th><th>Sortie</th><th>Durée</th><th>Statut</th></tr></thead><tbody>
      ${logs.map(l => {
        let dur = '—';
        if (l.entry_time && l.exit_time) { const [a, b] = l.entry_time.split(':').map(Number); const [c2, d] = l.exit_time.split(':').map(Number); let m = (c2 * 60 + d) - (a * 60 + b); if (m < 0) m = 0; dur = Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }
        const st = l.entry_time && l.exit_time ? '<span class="badge badge-blue">Complète</span>' : l.entry_time ? '<span class="badge badge-green">Présent</span>' : '<span class="badge badge-muted">—</span>';
        return `<tr><td>${fmtDate(l.log_date)}</td><td>${fmtTime(l.entry_time)}</td><td>${fmtTime(l.exit_time)}</td><td>${dur}</td><td>${st}</td></tr>`;
      }).join('')}
    </tbody></table>` : '<div class="empty">Aucune présence enregistrée.</div>'}
  </div>`;
}

// ---- EVALUATIONS ----------------------------------------------------
async function renderEvaluations(c) {
  const { data } = await sb.from('staff_evaluations')
    .select('*').eq('employee_id', currentEmployee.id).eq('visible_to_employee', true)
    .order('created_at', { ascending: false });
  const evals = data || [];

  c.innerHTML = evals.length ? evals.map(e => {
    const ratings = e.ratings && typeof e.ratings === 'object' ? e.ratings : {};
    const filledStar = '<i data-lucide="star" style="width:14px;height:14px;vertical-align:-2px;fill:currentColor;"></i>';
    const emptyStar = '<i data-lucide="star" style="width:14px;height:14px;vertical-align:-2px;opacity:.25;"></i>';
    const stars = n => filledStar.repeat(Math.round(n)) + emptyStar.repeat(Math.max(0, 5 - Math.round(n)));
    return `<div class="card" style="margin-bottom:1rem;">
      <div class="card-title">${esc(e.period || 'Évaluation')} <span class="badge badge-gold">Note ${e.overall_score ?? '—'}/5</span></div>
      <div style="color:var(--muted);font-size:.82rem;margin-bottom:.8rem;">Par ${esc(e.evaluator)} · ${new Date(e.created_at).toLocaleDateString('fr-FR')}</div>
      ${Object.keys(ratings).length ? `<div style="display:grid;gap:.4rem;margin-bottom:.8rem;">${Object.entries(ratings).map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:.86rem;"><span style="color:var(--muted);text-transform:capitalize;">${esc(k)}</span><span class="rating-stars">${stars(v)}</span></div>`).join('')}</div>` : ''}
      ${e.strengths ? `<div style="font-size:.86rem;margin-bottom:.4rem;"><strong style="color:var(--green);">Points forts:</strong> ${esc(e.strengths)}</div>` : ''}
      ${e.improvements ? `<div style="font-size:.86rem;margin-bottom:.4rem;"><strong style="color:var(--gold);">À améliorer:</strong> ${esc(e.improvements)}</div>` : ''}
      ${e.comments ? `<div style="font-size:.86rem;color:var(--muted);">${esc(e.comments)}</div>` : ''}
    </div>`;
  }).join('') : '<div class="empty">Aucune évaluation pour le moment.</div>';
}

// ---- PROFILE --------------------------------------------------------
async function renderProfile(c) {
  const e = currentEmployee;
  const roles = employeeRoles();
  c.innerHTML = `
    <div class="card" style="margin-bottom:1.2rem;display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;">
      <div class="avatar" style="width:80px;height:80px;font-size:1.6rem;">${e.photo_url ? `<img src="${esc(e.photo_url)}">` : getInitials(e.full_name)}</div>
      <div>
        <div style="font-size:1.3rem;font-weight:700;">${esc(e.full_name)}</div>
        <div style="color:var(--muted);">${esc(e.position || '')} ${e.employee_number ? '· #' + esc(e.employee_number) : ''}</div>
        <div style="margin-top:.5rem;">${roles.map(r => `<span class="badge badge-gold" style="margin-right:.3rem;">${ROLE_META[r]?.icon || ''} ${esc(roleLabel(r))}</span>`).join('') || ''}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Informations</div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:.8rem;">
        <div class="form-group"><label>Téléphone</label><input class="input" id="prof-phone" value="${esc(e.phone || '')}"></div>
        <div class="form-group"><label>Email</label><input class="input" id="prof-email" value="${esc(e.email || '')}"></div>
      </div>
      <div class="form-group"><label>Bio / À propos</label><textarea class="textarea" id="prof-bio" placeholder="Présentez-vous...">${esc(e.bio || '')}</textarea></div>
      <button class="btn btn-gold" style="width:auto;margin:0;" onclick="saveProfile()">Enregistrer</button>
    </div>
  `;
}
window.saveProfile = async function () {
  const phone = document.getElementById('prof-phone').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const bio = document.getElementById('prof-bio').value.trim();
  const { error } = await sb.from('presence_employees').update({ phone, email, bio }).eq('id', currentEmployee.id);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  Object.assign(currentEmployee, { phone, email, bio });
  toast('Profil mis à jour', 'success');
};

// ---- NOTIFICATIONS --------------------------------------------------
let notifList = [];
let notifPoller = null;

async function loadNotifications() {
  if (!currentEmployee) return;
  const { data, error } = await sb.from('staff_notifications')
    .select('*')
    .eq('employee_id', currentEmployee.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.error(error); return; }
  notifList = data || [];
  updateBellBadge();
  renderBellPanel();
}

function updateBellBadge() {
  const count = notifList.filter(n => !n.read).length;
  const badge = document.getElementById('bell-count');
  if (!badge) return;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.classList.toggle('hidden', count === 0);
}

function renderBellPanel() {
  const panel = document.getElementById('bell-panel');
  if (!panel || !panel.classList.contains('open')) return;
  if (!notifList.length) { panel.innerHTML = '<div class="empty" style="padding:1rem;">Aucune notification.</div>'; return; }
  panel.innerHTML = notifList.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-title">${esc(n.title)}</div>
      <div class="notif-body">${esc(n.body || '')}</div>
      <div class="notif-time">${new Date(n.created_at).toLocaleString('fr-FR')}</div>
    </div>
  `).join('');
}

window.toggleBellPanel = async function () {
  const panel = document.getElementById('bell-panel');
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (!isOpen) {
    await loadNotifications();
    const unreadIds = notifList.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length) {
      const { error } = await sb.from('staff_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);
      if (!error) notifList.forEach(n => { if (!n.read) { n.read = true; n.read_at = new Date().toISOString(); } });
      updateBellBadge();
      renderBellPanel();
    }
  }
};

// expose globally
window.staffLogin = staffLogin;
window.staffLogout = staffLogout;
window.showSection = showSection;
window.toggleBellPanel = toggleBellPanel;

// boot
tryAutoLogin();
