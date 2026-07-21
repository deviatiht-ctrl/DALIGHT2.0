// ============================================
// DALIGHT - STAFF PORTAL
// Interface personnelle employé (accès par code)
// ============================================

const SB_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
const sb = supabase.createClient(SB_URL, SB_KEY);

// ---- Role catalogue -------------------------------------------------
const ROLE_META = {
  estheticienne:     { label: 'Esthéticienne',     icon: '✨', provider: true },
  masseuse:          { label: 'Masseur/Masseuse',  icon: '💆', provider: true },
  coiffure:          { label: 'Coiffure',          icon: '💇', provider: true },
  onglerie:          { label: 'Onglerie',          icon: '💅', provider: true },
  community_manager: { label: 'Community Manager',  icon: '📱', provider: false },
  adm_manager:       { label: 'ADM / Manager',      icon: '🗂️', provider: false },
  receptionniste:    { label: 'Réceptionniste',     icon: '📞', provider: false },
  caissier:          { label: 'Caissier/Caisse',   icon: '💵', provider: false },
  formateur:         { label: 'Formateur',          icon: '🎓', provider: false },
};
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

// ---- Auth (code) ----------------------------------------------------
async function staffLogin() {
  const input = document.getElementById('code-input');
  const errEl = document.getElementById('login-error');
  const code = (input.value || '').trim().toUpperCase();
  errEl.textContent = '';
  if (code.length < 4) { errEl.textContent = 'Entrez votre code d\'accès.'; return; }

  try {
    const { data, error } = await sb
      .from('presence_employees')
      .select('*')
      .eq('access_code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) { errEl.textContent = 'Code invalide.'; return; }
    if (data.portal_enabled === false) { errEl.textContent = 'Accès désactivé. Contactez l\'administration.'; return; }

    currentEmployee = data;
    sessionStorage.setItem('dalight_staff_code', code);
    enterPortal();
  } catch (err) {
    console.error(err);
    errEl.textContent = 'Erreur: ' + (err?.message || err);
  }
}

function staffLogout() {
  sessionStorage.removeItem('dalight_staff_code');
  currentEmployee = null;
  if (chronoTimer) clearInterval(chronoTimer);
  document.getElementById('portal-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('code-input').value = '';
}

async function tryAutoLogin() {
  const url = new URLSearchParams(location.search);
  const codeFromUrl = url.get('code');
  const stored = sessionStorage.getItem('dalight_staff_code');
  const code = (codeFromUrl || stored || '').toUpperCase();
  if (!code) return;
  document.getElementById('code-input').value = code;
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
  (map[id] || renderHome)(c);
}

// ---- HOME -----------------------------------------------------------
async function renderHome(c) {
  const roles = employeeRoles();
  const empId = currentEmployee.id;
  const today = todayStr();

  const [sessRes, apptRes, evalRes, attRes] = await Promise.all([
    sb.from('service_sessions').select('*').eq('employee_id', empId).gte('started_at', today + 'T00:00:00'),
    roles.some(isProviderRole) || roles.includes('receptionniste') || roles.includes('adm_manager')
      ? sb.from('reservations').select('id,status').eq('date', today)
      : Promise.resolve({ data: [] }),
    sb.from('staff_evaluations').select('overall_score').eq('employee_id', empId).eq('visible_to_employee', true),
    sb.from('attendance_logs').select('*').eq('employee_id', empId).eq('log_date', today).maybeSingle(),
  ]);

  const sessions = sessRes.data || [];
  const completed = sessions.filter(s => s.status === 'completed');
  const appts = (apptRes.data || []).filter(r => r.status !== 'CANCELLED');
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
    ? `<span class="badge ${att.exit_time ? 'badge-blue' : 'badge-green'}">${att.exit_time ? 'Journée terminée' : 'Présent(e)'}</span> · Entrée ${fmtTime(att.entry_time)} ${att.exit_time ? '· Sortie ' + fmtTime(att.exit_time) : ''}`
    : '<span class="badge badge-muted">Aucune présence enregistrée aujourd\'hui</span>';

  c.innerHTML = `
    <div class="grid cards-4" style="margin-bottom:1.3rem;">${cards.join('')}</div>
    <div class="card" style="margin-bottom:1.3rem;">
      <div class="card-title">Bonjour, ${esc((currentEmployee.full_name || '').split(' ')[0] || 'vous')} 👋</div>
      <div style="color:var(--muted);font-size:.9rem;line-height:1.6;">
        Rôles: ${roles.map(r => `<span class="badge badge-gold" style="margin-right:.3rem;">${ROLE_META[r]?.icon || ''} ${esc(roleLabel(r))}</span>`).join('') || '—'}<br>
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
async function renderAppointments(c) {
  const date = c._date || todayStr();
  const { data, error } = await sb.from('reservations')
    .select('*').eq('date', date).order('time', { ascending: true });

  const list = (data || []).filter(r => r.status !== 'CANCELLED');
  loadedAppointments = list;

  c.innerHTML = `
    <div class="card" style="margin-bottom:1rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <div class="form-group" style="margin:0;">
        <label>Date</label>
        <input type="date" class="input" id="appt-date" value="${date}" onchange="reloadAppointments(this.value)">
      </div>
      <div style="color:var(--muted);font-size:.85rem;">${list.length} rendez-vous</div>
    </div>
    <div id="appt-list">
      ${error ? `<div class="empty">Erreur: ${esc(error.message)}</div>` :
        list.length === 0 ? '<div class="empty">Aucun rendez-vous pour cette date.</div>' :
        list.map(apptCard).join('')}
    </div>
  `;
}
window.reloadAppointments = function (date) {
  const c = document.getElementById('section-content');
  c._date = date;
  renderAppointments(c);
};

function apptCard(r) {
  const statusBadge = {
    CONFIRMED: 'badge-green', PENDING: 'badge-gold', AWAITING_PAYMENT: 'badge-gold',
    COMPLETED: 'badge-blue', NO_SHOW: 'badge-muted'
  }[r.status] || 'badge-muted';
  const clientName = esc(r.user_name || 'Client');
  const svc = esc(r.service || 'Service');
  return `<div class="list-item">
    <div class="avatar">${getInitials(r.user_name || 'C')}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:600;">${clientName} <span class="badge ${statusBadge}" style="margin-left:.3rem;">${esc(r.status)}</span></div>
      <div style="color:var(--muted);font-size:.85rem;">${svc} · ${fmtTime(r.time)} · ${esc(r.location || '')}</div>
      ${r.user_phone ? `<div style="color:var(--muted);font-size:.8rem;">📞 ${esc(r.user_phone)}</div>` : ''}
      ${r.notes ? `<div style="color:var(--muted);font-size:.8rem;margin-top:.2rem;">📝 ${esc(r.notes)}</div>` : ''}
    </div>
    <button class="btn btn-green btn-sm" onclick="startServiceFromAppt('${r.id}')">Démarrer</button>
  </div>`;
}

window.startServiceFromAppt = async function (reservationId) {
  const r = loadedAppointments.find(a => a.id === reservationId);
  if (!r) { toast('Rendez-vous introuvable', 'error'); return; }
  await createSession({
    reservation_id: r.id, client_name: r.user_name || 'Client', client_phone: r.user_phone || null,
    service_name: r.service || 'Service', location: r.location || 'Spa',
  });
  showSection('service');
};

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
      <div class="chrono-time" id="chrono-display">00:00:00</div>
      <div class="chrono-service">${esc(activeSession.service_name)}</div>
      <div class="chrono-client">${esc(activeSession.client_name || 'Client')}${activeSession.client_phone ? ' · ' + esc(activeSession.client_phone) : ''}</div>
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
  const start = new Date(activeSession.started_at).getTime();
  const update = () => {
    const diff = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
    const el = document.getElementById('chrono-display');
    if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  update();
  chronoTimer = setInterval(update, 1000);
}

async function createSession(payload) {
  const { data: existing } = await sb.from('service_sessions')
    .select('id').eq('employee_id', currentEmployee.id).eq('status', 'in_progress').maybeSingle();
  if (existing) { toast('Vous avez déjà un service en cours', 'warning'); return; }

  const { error } = await sb.from('service_sessions').insert({
    employee_id: currentEmployee.id, status: 'in_progress', started_at: new Date().toISOString(), ...payload,
  });
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  toast('Service démarré', 'success');
}

window.startManualSession = async function () {
  const svc = document.getElementById('new-svc').value.trim();
  const client = document.getElementById('new-client').value.trim();
  if (!svc) { toast('Indiquez le service', 'warning'); return; }
  await createSession({ service_name: svc, client_name: client || null, location: 'Spa' });
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

  const gridColor = 'rgba(255,255,255,.06)', tickColor = '#9aa3b2';
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
    ${metricStr ? `<div style="color:var(--muted);font-size:.8rem;margin-top:.3rem;">📊 ${esc(metricStr)}</div>` : ''}
    ${r.admin_feedback ? `<div style="margin-top:.4rem;padding:.5rem .7rem;background:var(--gold-soft);border-radius:8px;font-size:.83rem;">💬 <strong>Admin:</strong> ${esc(r.admin_feedback)}</div>` : ''}
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
    const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));
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

// expose globally
window.staffLogin = staffLogin;
window.staffLogout = staffLogout;
window.showSection = showSection;

// boot
tryAutoLogin();
