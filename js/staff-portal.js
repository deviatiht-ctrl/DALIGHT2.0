
function calculatePortalEndTime(startTime, durationMinutes = 60) {
  if (!startTime) return '—';
  const [h, m] = String(startTime).split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0) + (Number(durationMinutes) || 60);
  const endH = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const endM = String(total % 60).padStart(2, '0');
  return endH + ':' + endM;
}

function getPortalCountdownBadge(r) {
  if (!r.date || !r.time) return '';
  const now = new Date();
  const dur = Number(r.duration_minutes) || (r.service && r.service.includes('Royale') ? 90 : (r.service && r.service.includes('Express') ? 45 : 60));
  const [y, m, d] = r.date.split('-').map(Number);
  const [h, min] = r.time.split(':').map(Number);
  const apptDate = new Date(y, m - 1, d, h, min, 0);
  const diffMs = apptDate.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (r.status === 'COMPLETED') return '<span class="badge badge-muted">Terminé</span>';
  if (diffMin > 0) {
    if (diffMin <= 60) return '<span class="badge badge-gold" style="font-weight:700;border:1px solid #d4af3760;">Dans ' + diffMin + 'm</span>';
    if (diffMin <= 1440) {
      const hrs = Math.floor(diffMin / 60);
      const rem = diffMin % 60;
      return '<span class="badge badge-gold" style="border:1px solid #d4af3740;">Dans ' + hrs + 'h ' + (rem > 0 ? rem + 'm' : '') + '</span>';
    }
    return '<span class="badge badge-muted">Dans ' + Math.round(diffMin / 1440) + 'j</span>';
  }
  if (diffMin <= 0 && diffMin >= -dur) {
    const rem = dur + diffMin;
    return '<span class="badge badge-green" style="font-weight:700;border:1px solid #22c55e60;"><span class="live-dot" style="margin-right:4px;"></span>En cours (' + rem + 'm restantes)</span>';
  }
  return '<span class="badge badge-muted">Passé (+' + (Math.abs(diffMin) - dur) + 'm)</span>';
}

// ============================================
// DALIGHT - STAFF PORTAL
// Interface personnelle employé (accès par code)
// ============================================

const SB_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
const sb = supabase.createClient(SB_URL, SB_KEY);
window.staffSb = sb;

// ---- Role catalogue -------------------------------------------------
const ROLE_META = {
  estheticienne:     { label: 'Esthéticienne',     icon: 'sparkles', provider: true },
  masseuse:          { label: 'Masseur/Masseuse',  icon: 'hand', provider: true },
  coiffure:          { label: 'Coiffure',          icon: 'scissors', provider: true },
  onglerie:          { label: 'Onglerie',          icon: 'gem', provider: true },
  cadreur_video:     { label: 'Cadreur Vidéo CVISUAL', icon: 'video', provider: false, isCadreur: true },
  cadreur_cvisual:   { label: 'Cadreur CVISUAL',   icon: 'video', provider: false, isCadreur: true },
  community_manager: { label: 'Community Manager & Vidéo', icon: 'camera', provider: false, isCadreur: true },
  adm_manager:       { label: 'ADM / Manager',      icon: 'briefcase', provider: false },
  receptionniste:    { label: 'Réceptionniste',     icon: 'phone', provider: false },
  caissier:          { label: 'Caissier/Caisse',   icon: 'banknote', provider: false },
  formateur:         { label: 'Formateur',          icon: 'graduation-cap', provider: false },
};
function lucideIcon(name, size = 16) { return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;vertical-align:-3px;"></i>`; }
function roleLabel(r) { return ROLE_META[r]?.label || r; }
function isProviderRole(r) { return typeof r === 'string' ? !!ROLE_META[r]?.provider : (Array.isArray(r?.roles) && r.roles.some(x => !!ROLE_META[x]?.provider)); }
function isCadreurRole(r) { return !!ROLE_META[r]?.isCadreur || r === 'cadreur_video' || r === 'cadreur_cvisual' || r === 'community_manager'; }
function checkIsCadreur(emp) {
  if (!emp) return false;
  const roles = Array.isArray(emp.roles) ? emp.roles : [];
  const pos = (emp.position || '').toLowerCase();
  return roles.some(isCadreurRole) || pos.includes('cadreur') || pos.includes('community') || pos.includes('cvisual') || roles.includes('community_manager');
}

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
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

// ---- Auth & Modes ----------------------------------------------------
window.switchLoginMode = function(mode) {
  const isCode = mode === 'code';
  const tabCode = document.getElementById('tab-btn-code');
  const tabUser = document.getElementById('tab-btn-user');
  const paneCode = document.getElementById('login-mode-code');
  const paneUser = document.getElementById('login-mode-user');
  const errEl = document.getElementById('login-error');
  if (tabCode) tabCode.classList.toggle('active', isCode);
  if (tabUser) tabUser.classList.toggle('active', !isCode);
  if (paneCode) paneCode.style.display = isCode ? 'block' : 'none';
  if (paneUser) paneUser.style.display = !isCode ? 'block' : 'none';
  if (errEl) errEl.textContent = '';
  if (isCode) {
    document.getElementById('access-code-input')?.focus();
  } else {
    document.getElementById('username-input')?.focus();
  }
};

async function staffLoginWithCode(optionalCode) {
  const inputEl = document.getElementById('access-code-input');
  const errEl = document.getElementById('login-error');
  const rawCode = (optionalCode || (inputEl ? inputEl.value : '')).trim();
  if (errEl) errEl.textContent = '';
  if (!rawCode) {
    if (errEl) errEl.textContent = 'Veuillez saisir votre code d\'accès.';
    return;
  }
  const cleanCode = rawCode.toUpperCase();
  try {
    const { data, error } = await sb
      .from('presence_employees')
      .select('*')
      .or(`access_code.eq.${cleanCode},employee_number.eq.${cleanCode},username.eq.${rawCode.toLowerCase()}`)
      .limit(1);

    if (error) throw error;
    const emp = data && data[0];
    if (!emp) {
      if (errEl) errEl.textContent = 'Code d\'accès introuvable (' + cleanCode + '). Vérifiez avec l\'administration.';
      return;
    }
    if (emp.portal_enabled === false) {
      if (errEl) errEl.textContent = 'Accès à ce portail désactivé. Contactez l\'administration.';
      return;
    }

    currentEmployee = emp;
    sessionStorage.setItem('dalight_staff_code', cleanCode);
    localStorage.setItem('dalight_staff_code', cleanCode);
    if (emp.username) sessionStorage.setItem('dalight_staff_username', emp.username);
    if (emp.password) sessionStorage.setItem('dalight_staff_password', emp.password);

    enterPortal();
  } catch (err) {
    console.error('Error in staffLoginWithCode:', err);
    if (errEl) errEl.textContent = 'Erreur: ' + (err?.message || err);
  }
}

async function staffLoginWithUser() {
  const userInput = document.getElementById('username-input');
  const passInput = document.getElementById('password-input');
  const errEl = document.getElementById('login-error');
  const username = (userInput ? userInput.value : '').trim().toLowerCase();
  const password = (passInput ? passInput.value : '').trim();
  if (errEl) errEl.textContent = '';
  if (!username || !password) {
    if (errEl) errEl.textContent = 'Entrez votre nom d\'utilisateur et votre mot de passe.';
    return;
  }

  try {
    const { data, error } = await sb
      .from('presence_employees')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.password !== password) {
      if (errEl) errEl.textContent = 'Identifiants invalides.';
      return;
    }
    if (data.portal_enabled === false) {
      if (errEl) errEl.textContent = 'Accès désactivé. Contactez l\'administration.';
      return;
    }

    currentEmployee = data;
    sessionStorage.setItem('dalight_staff_username', username);
    sessionStorage.setItem('dalight_staff_password', password);
    if (data.access_code) {
      sessionStorage.setItem('dalight_staff_code', data.access_code);
      localStorage.setItem('dalight_staff_code', data.access_code);
    }
    enterPortal();
  } catch (err) {
    console.error(err);
    if (errEl) errEl.textContent = 'Erreur: ' + (err?.message || err);
  }
}

async function staffLogin() {
  const codeVal = (document.getElementById('access-code-input')?.value || '').trim();
  const userVal = (document.getElementById('username-input')?.value || '').trim();
  if (codeVal) return staffLoginWithCode(codeVal);
  if (userVal) return staffLoginWithUser();
  const paneCode = document.getElementById('login-mode-code');
  if (paneCode && paneCode.style.display !== 'none') {
    return staffLoginWithCode();
  }
  return staffLoginWithUser();
}

function staffLogout() {
  sessionStorage.removeItem('dalight_staff_username');
  sessionStorage.removeItem('dalight_staff_password');
  sessionStorage.removeItem('dalight_staff_code');
  localStorage.removeItem('dalight_staff_code');
  currentEmployee = null;
  if (chronoTimer) clearInterval(chronoTimer);
  document.getElementById('portal-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  if (document.getElementById('username-input')) document.getElementById('username-input').value = '';
  if (document.getElementById('password-input')) document.getElementById('password-input').value = '';
  if (document.getElementById('access-code-input')) document.getElementById('access-code-input').value = '';
}

async function tryAutoLogin() {
  // 1. URL Query param ?code=XXXXXX
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  if (codeParam) {
    if (document.getElementById('access-code-input')) document.getElementById('access-code-input').value = codeParam;
    await staffLoginWithCode(codeParam);
    return;
  }

  // 2. Stored Code
  const savedCode = sessionStorage.getItem('dalight_staff_code') || localStorage.getItem('dalight_staff_code');
  if (savedCode) {
    if (document.getElementById('access-code-input')) document.getElementById('access-code-input').value = savedCode;
    await staffLoginWithCode(savedCode);
    return;
  }

  // 3. Stored username & password
  const username = sessionStorage.getItem('dalight_staff_username');
  const password = sessionStorage.getItem('dalight_staff_password');
  if (username && password) {
    if (document.getElementById('username-input')) document.getElementById('username-input').value = username;
    if (document.getElementById('password-input')) document.getElementById('password-input').value = password;
    await staffLoginWithUser();
  }
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
  const isCadreur = checkIsCadreur(currentEmployee);
  const isCM = roles.includes('community_manager');
  const isManager = roles.includes('adm_manager');

  const items = [
    { id: 'home', label: 'Accueil', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  ];
  if (hasProvider || isManager || roles.includes('receptionniste') || isCadreur || isCM) {
    items.push({ id: 'appointments', label: 'Rendez-vous', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' });
  }
  if (hasProvider) {
    items.push({ id: 'service', label: 'Service en cours', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' });
    items.push({ id: 'clients', label: 'Suivi clients', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' });
  }
  if (isCadreur || isCM || isManager) {
    items.push({ id: 'video_shoots', label: 'Mes Tournages Vidéo', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' });
    items.push({ id: 'video_earnings', label: 'Mes Revenus Vidéo', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' });
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

  // Sync Live Online State
  syncOnlineStatus();
  setInterval(syncOnlineStatus, 20000);
}

const SECTION_META = {
  home:          { title: 'Accueil', sub: 'Vue d\'ensemble de votre journée' },
  appointments:  { title: 'Rendez-vous', sub: 'Vos clients et prestations' },
  service:       { title: 'Service en cours', sub: 'Chronomètre de prestation' },
  clients:       { title: 'Suivi clients', sub: 'Historique, mesures et progression de vos clients' },
  video_shoots:  { title: 'Mes Tournages Vidéo', sub: 'Planning des captations, statut & consentements image' },
  video_earnings:{ title: 'Mes Revenus Vidéo', sub: 'Kalkil Kòb ou — Total gagné, payé et en attente' },
  stats:         { title: 'Statistiques', sub: 'Performance et engagement' },
  reports:       { title: 'Mes rapports', sub: 'Soumettre et consulter vos rapports' },
  attendance:    { title: 'Mes présences', sub: 'Historique de vos entrées / sorties' },
  evaluations:   { title: 'Mes évaluations', sub: 'Retours de l\'administration' },
  profile:       { title: 'Mon profil', sub: 'Vos informations personnelles' },
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
    home: renderHome,
    appointments: renderAppointments,
    service: renderService,
    clients: (el) => (window.renderClientTracking ? window.renderClientTracking(el) : (el.innerHTML = '<div class="empty">Module suivi clients non chargé.</div>')),
    video_shoots: renderVideoShoots,
    video_earnings: renderVideoEarnings,
    stats: renderStats,
    reports: renderReports,
    attendance: renderAttendance,
    evaluations: renderEvaluations,
    profile: renderProfile,
  };
  Promise.resolve((map[id] || renderHome)(c)).then(() => { if (window.lucide) lucide.createIcons(); });
}

// ---- LIVE ONLINE PRESENCE --------------------------------------------
let currentLiveOnline = false;

async function syncOnlineStatus() {
  if (!currentEmployee) return;
  try {
    const { data, error } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'staff_live_online_state')
      .maybeSingle();

    if (!error && data && data.value) {
      const stateObj = data.value[currentEmployee.id];
      currentLiveOnline = !!(stateObj && stateObj.is_online);
    } else {
      currentLiveOnline = false;
    }
    updateOnlineUI(currentLiveOnline);
  } catch (e) {
    console.warn('syncOnlineStatus warning:', e);
  }
}

function updateOnlineUI(isOnline) {
  const dot = document.getElementById('staff-online-dot');
  const label = document.getElementById('staff-online-label');
  const toggleWrap = document.getElementById('staff-online-toggle-wrap');
  if (dot) {
    dot.className = isOnline ? 'live-status-dot online' : 'live-status-dot offline';
  }
  if (label) {
    label.textContent = isOnline ? 'EN LIGNE (Au salon)' : 'HORS LIGNE';
    label.style.color = isOnline ? '#4ade80' : '#94a3b8';
  }
  if (toggleWrap) {
    toggleWrap.style.borderColor = isOnline ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)';
    toggleWrap.style.background = isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)';
  }

  const homeBanner = document.getElementById('home-online-status-banner');
  if (homeBanner) {
    homeBanner.innerHTML = renderOnlineBannerContent(isOnline);
  }
}

function renderOnlineBannerContent(isOnline) {
  if (isOnline) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span class="live-status-dot online" style="width:14px; height:14px;"></span>
          <div>
            <div style="font-weight:700; color:#4ade80; font-size:1rem;">Vous êtes actuellement EN LIGNE (Au salon)</div>
            <div style="color:var(--muted); font-size:0.82rem;">Le système d'assignation intelligent de DALIGHT peut vous attribuer des rendez-vous &amp; captations vidéo.</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="toggleMyOnlineStatus(false)" style="border-color:rgba(239,68,68,0.4); color:#fca5a5; display:inline-flex; align-items:center; gap:0.4rem;">
          Passer Hors Ligne
        </button>
      </div>
    `;
  } else {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span class="live-status-dot offline" style="width:14px; height:14px;"></span>
          <div>
            <div style="font-weight:700; color:#cbd5e1; font-size:1rem;">Vous êtes actuellement HORS LIGNE</div>
            <div style="color:var(--muted); font-size:0.82rem;">Vous n'êtes pas marqué(e) présent(e) au salon. Activez votre présence dès votre arrivée pour recevoir vos assignations.</div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="toggleMyOnlineStatus(true)" style="background:linear-gradient(135deg,#22c55e,#15803d); border:none; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
          <span class="live-status-dot online"></span> Me mettre EN LIGNE (Je suis au salon)
        </button>
      </div>
    `;
  }
}

async function toggleMyOnlineStatus(forceState) {
  if (!currentEmployee) return;
  const newState = forceState !== undefined ? Boolean(forceState) : !currentLiveOnline;

  try {
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'staff_live_online_state')
      .maybeSingle();

    let currentMap = (data && data.value && typeof data.value === 'object') ? data.value : {};
    currentMap[currentEmployee.id] = {
      is_online: newState,
      name: currentEmployee.full_name || '',
      updated_at: new Date().toISOString()
    };

    const { error: upsertErr } = await sb
      .from('settings')
      .upsert({
        id: 'staff_live_online_state',
        key: 'staff_live_online_state',
        value: currentMap,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (upsertErr) {
      await sb.from('settings').update({
        value: currentMap,
        updated_at: new Date().toISOString()
      }).eq('key', 'staff_live_online_state');
    }

    currentLiveOnline = newState;
    updateOnlineUI(newState);
    toast(
      newState
        ? 'Vous êtes maintenant EN LIGNE. Vos assignations sont activées !'
        : 'Vous êtes maintenant HORS LIGNE.',
      newState ? 'success' : 'warning'
    );
  } catch (err) {
    console.error('toggleMyOnlineStatus error:', err);
    toast('Erreur mise à jour statut: ' + (err?.message || err), 'error');
  }
}

// ---- HOME -----------------------------------------------------------
async function renderHome(c) {
  const roles = employeeRoles();
  const empId = currentEmployee.id;
  const today = todayStr();
  const isCadreur = checkIsCadreur(currentEmployee);

  const [sessRes, apptRes, evalRes, attRes, videoRes] = await Promise.all([
    sb.from('service_sessions').select('*').eq('employee_id', empId).gte('started_at', today + 'T00:00:00'),
    roles.some(isProviderRole) || roles.includes('receptionniste') || roles.includes('adm_manager')
      ? sb.from('reservations').select('id,status,assigned_employee_id').eq('date', today)
      : Promise.resolve({ data: [] }),
    sb.from('staff_evaluations').select('overall_score').eq('employee_id', empId).eq('visible_to_employee', true),
    sb.from('attendance_logs').select('*').eq('employee_id', empId).eq('log_date', today).maybeSingle(),
    isCadreur || roles.includes('adm_manager') || roles.includes('community_manager')
      ? sb.from('reservations').select('id,user_name,phone,service,date,time,status,notes,wants_video,video_requested,video_price,video_status,video_consent,assigned_employee_id,assigned_employee_name').eq('date', today)
      : Promise.resolve({ data: [] }),
  ]);

  const sessions = sessRes.data || [];
  const completed = sessions.filter(s => s.status === 'completed');
  const seesAll = roles.includes('adm_manager') || roles.includes('receptionniste');
  const appts = (apptRes.data || []).filter(r => r.status !== 'CANCELLED' && (seesAll || r.assigned_employee_id === empId));
  const evals = evalRes.data || [];
  const avgScore = evals.length ? (evals.reduce((s, e) => s + (Number(e.overall_score) || 0), 0) / evals.length).toFixed(1) : '—';
  const att = attRes.data;

  // Video shoots today
  const myVideoToday = (videoRes.data || []).filter(r => {
    const isVid = r.wants_video || r.video_requested || (Number(r.video_price) > 0) || (r.notes || '').includes('[VIDEO_META:') || (r.service || '').toLowerCase().includes('vidéo');
    if (!isVid) return false;
    if (seesAll) return true;
    const meta = parseReservationVideoMeta(r);
    return r.assigned_employee_id === empId ||
           meta.cadreur_id === empId ||
           (meta.cadreur_name && meta.cadreur_name.toLowerCase() === (currentEmployee.full_name || '').toLowerCase()) ||
           (r.notes && r.notes.includes(empId));
  });

  const totalSecs = completed.reduce((s, x) => s + (x.duration_seconds || 0), 0);
  const hrs = Math.floor(totalSecs / 3600), mins = Math.floor((totalSecs % 3600) / 60);

  const cards = [];
  if (roles.some(isProviderRole)) {
    cards.push(statCard('#22c55e', 'rgba(34,197,94,.16)', appts.length, 'RDV aujourd\'hui', 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'));
    cards.push(statCard('#3b82f6', 'rgba(59,130,246,.16)', completed.length, 'Services terminés', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'));
    cards.push(statCard('#8b5cf6', 'rgba(139,92,246,.16)', `${hrs}h${String(mins).padStart(2, '0')}`, 'Temps de service', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'));
  } else if (isCadreur) {
    cards.push(statCard('#d4af37', 'rgba(212,175,55,.16)', myVideoToday.length, 'Tournages aujourd\'hui', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'));
    cards.push(statCard('#22c55e', 'rgba(34,197,94,.16)', 'CVISUAL', 'Studio Vidéo DALIGHT', 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'));
  } else {
    cards.push(statCard('#22c55e', 'rgba(34,197,94,.16)', appts.length, 'RDV aujourd\'hui', 'M8 7V3m8 4V3'));
  }
  cards.push(statCard('#c9a227', 'rgba(201,162,39,.16)', avgScore, 'Note moyenne /5', 'M11 3.049c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915'));

  const presence = att
    ? `<span class="badge ${att.exit_time ? 'badge-blue' : 'badge-green'}">${att.exit_time ? 'Journée terminée' : 'Présent(e)'}</span> · ${fmtDate(att.log_date)} · Entrée ${fmtTime(att.entry_time)} · Sortie ${att.exit_time ? fmtTime(att.exit_time) : '—'}`
    : '<span class="badge badge-red">Al scanner</span>';

  c.innerHTML = `
    <!-- Live Status Banner -->
    <div id="home-online-status-banner" class="card" style="margin-bottom:1.3rem; border:1px solid rgba(212,175,55,0.3); background:rgba(20,28,20,0.85); box-shadow:0 4px 20px rgba(0,0,0,0.3);">
      ${renderOnlineBannerContent(currentLiveOnline)}
    </div>

    ${isCadreur ? `
      <!-- Section Tournages Vidéo 4K CVISUAL assignés au Cadreur / Community Manager -->
      <div class="card" style="margin-bottom:1.3rem; border:1px solid rgba(212,175,55,0.35); background:linear-gradient(135deg, rgba(20,24,18,0.95), rgba(12,15,10,0.98)); box-shadow:0 6px 24px rgba(0,0,0,0.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.9rem;padding-bottom:0.6rem;border-bottom:1px solid rgba(212,175,55,0.2);">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <div style="width:34px;height:34px;border-radius:8px;background:rgba(212,175,55,0.12);display:flex;align-items:center;justify-content:center;color:#d4af37;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            </div>
            <div>
              <div style="font-weight:700;font-size:1.05rem;color:#FAF8F5;">Vos Tournages Vidéo 4K à Réaliser</div>
              <div style="font-size:0.75rem;color:var(--muted);">Studio CVISUAL & Sanctuaire DALIGHT</div>
            </div>
          </div>
          <span class="badge ${myVideoToday.length > 0 ? 'badge-green' : 'badge-muted'}" style="font-weight:700;">
            ${myVideoToday.length} tournage${myVideoToday.length > 1 ? 's' : ''} aujourd'hui
          </span>
        </div>

        ${myVideoToday.length === 0 ? `
          <div style="text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:0.86rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.4)" stroke-width="1.6" style="margin-bottom:0.5rem;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div style="color:#FAF8F5;font-weight:600;margin-bottom:0.25rem;">Aucun tournage vidéo 4K à réaliser pour l'instant aujourd'hui</div>
            <div style="font-size:0.78rem;">Dès qu'un client réserve avec l'option vidéo 4K et que vous êtes En Ligne, la captation vous sera attribuée ici.</div>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            ${myVideoToday.map(r => {
              const meta = parseReservationVideoMeta(r);
              const isPrivate = (r.video_consent === 'private' || r.video_consent === 'oui_prive' || meta.consent === 'private');
              const vStatus = meta.video_status || r.video_status || 'assigned';
              let vBadge = '<span class="badge badge-gold">En attente de tournage</span>';
              if (vStatus === 'shot') vBadge = '<span class="badge badge-blue">Tourné - En montage</span>';
              if (vStatus === 'delivered') vBadge = '<span class="badge badge-green">Vidéo 4K Livrée</span>';

              const cleanPhone = (r.phone || '').replace(/\D/g, '');
              const waLink = cleanPhone ? 'https://wa.me/' + (cleanPhone.startsWith('509') ? cleanPhone : '509' + cleanPhone) : '';

              return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;padding:0.85rem 1rem;background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.2);border-radius:10px;flex-wrap:wrap;">
                  <div>
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                      <strong style="color:#FAF8F5;font-size:0.95rem;">${esc(r.user_name || 'Client')}</strong>
                      <span class="badge badge-gold" style="font-size:0.7rem;">${fmtTime(r.time)}</span>
                      ${vBadge}
                      ${isPrivate
                        ? '<span class="badge badge-purple" style="font-size:0.7rem;"><i data-lucide="lock" style="width:11px;height:11px;vertical-align:-1px;"></i> Privé</span>'
                        : '<span class="badge badge-green" style="font-size:0.7rem;"><i data-lucide="globe" style="width:11px;height:11px;vertical-align:-1px;"></i> Public CVISUAL</span>'}
                    </div>
                    <div style="font-size:0.82rem;color:var(--admin-text-muted);margin-top:0.25rem;">
                      Service filmé : <strong style="color:#d4af37;">${esc(r.service || 'Soin')}</strong> · Praticien(ne) : ${esc(r.assigned_employee_name || 'Équipe')}
                    </div>
                  </div>
                  <div style="display:flex;gap:0.4rem;align-items:center;">
                    ${waLink ? `<a href="${waLink}" target="_blank" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:0.3rem;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp</a>` : ''}
                    <button class="btn btn-gold btn-sm" onclick="openStaffVideoModal('${r.id}')" style="display:inline-flex;align-items:center;gap:0.35rem;font-weight:700;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      ${vStatus === 'delivered' ? 'Mettre à jour la vidéo' : 'Uploader Vidéo 4K'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    ` : ''}

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
      ${isCadreur ? `<div class="card"><div class="card-title">Espace CVISUAL Studio</div>
        <div style="color:var(--muted);font-size:.88rem;margin-bottom:.8rem;">Gérez vos captations vidéo 4K et suivez vos gains.</div>
        <div class="row-actions" style="justify-content:flex-start;">
          <button class="btn btn-gold btn-sm" onclick="showSection('video_shoots')" style="display:inline-flex;align-items:center;gap:0.4rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            Voir mes tournages
          </button>
          <button class="btn btn-green btn-sm" onclick="showSection('video_earnings')" style="display:inline-flex;align-items:center;gap:0.4rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
            Mes revenus (Kòb)
          </button>
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
    const empName = (currentEmployee.full_name || '').toLowerCase();
    const isCadreur = checkIsCadreur(currentEmployee);

    const [primaryRes, empRes, videoShootsRes] = await Promise.all([
      sb.from('reservations').select('*, reservation_employees(*)').eq('assigned_employee_id', empId).neq('status', 'CANCELLED'),
      sb.from('reservation_employees').select('reservation_id').eq('employee_id', empId),
      isCadreur ? sb.from('reservations').select('*, reservation_employees(*)').neq('status', 'CANCELLED') : Promise.resolve({ data: [] })
    ]);
    const ids = new Set((empRes.data || []).map(re => re.reservation_id));
    (primaryRes.data || []).forEach(r => ids.add(r.id));

    if (isCadreur && videoShootsRes.data) {
      videoShootsRes.data.forEach(r => {
        const isVid = r.wants_video === true || r.video_requested === true || (Number(r.video_price) > 0) || (r.notes || '').includes('[VIDEO_META:') || (r.service || '').toLowerCase().includes('vidéo');
        if (isVid) {
          const meta = parseReservationVideoMeta(r);
          if (meta.cadreur_id === empId || (meta.cadreur_name && meta.cadreur_name.toLowerCase() === empName) || (r.notes && r.notes.includes(empId))) {
            ids.add(r.id);
          }
        }
      });
    }

    if (ids.size) {
      let q = sb.from('reservations').select('*, reservation_employees(*)').in('id', Array.from(ids)).neq('status', 'CANCELLED');
      if (date) q = q.eq('date', date); else q = q.gte('date', todayStr());
      const res = await q.order('date', { ascending: true }).order('time', { ascending: true });
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
  const isCadreur = checkIsCadreur(currentEmployee);
  const empId = currentEmployee?.id;
  const empName = (currentEmployee?.full_name || '').toLowerCase();
  const meta = parseReservationVideoMeta(r);

  const isVideoShoot = isCadreur && (
    meta.cadreur_id === empId ||
    (meta.cadreur_name && meta.cadreur_name.toLowerCase() === empName) ||
    (!isProviderRole(currentEmployee) && (r.wants_video === true || r.video_requested === true || (Number(r.video_price) > 0) || (r.notes || '').includes('[VIDEO_META:')))
  );

  const statusBadge = {
    CONFIRMED: 'badge-green', PENDING: 'badge-gold', AWAITING_PAYMENT: 'badge-gold',
    COMPLETED: 'badge-blue', NO_SHOW: 'badge-muted'
  }[r.status] || 'badge-muted';
  const clientName = esc(r.user_name || 'Client');
  const svc = esc(r.service || 'Service');
  const dur = Number(r.duration_minutes) || (r.service && r.service.includes('Royale') ? 90 : (r.service && r.service.includes('Express') ? 45 : 60));
  const endTime = calculatePortalEndTime(r.time, dur);
  const countdown = getPortalCountdownBadge(r);

  if (isVideoShoot) {
    const isPrivate = (r.video_consent === 'private' || r.video_consent === 'oui_prive' || meta.consent === 'private');
    const vStatus = meta.video_status || r.video_status || 'assigned';

    return `<div class="list-item" style="cursor:pointer;display:flex;align-items:center;gap:.75rem;padding:.85rem;border-radius:12px;background:var(--surface-2);border:1px solid rgba(212,175,55,0.35);margin-bottom:.6rem;" onclick="openApptDetail('${r.id}')">
      <div class="avatar" style="width:44px;height:44px;font-size:.9rem;flex-shrink:0;background:rgba(212,175,55,0.15);color:#d4af37;border:1px solid rgba(212,175,55,0.4);display:flex;align-items:center;justify-content:center;">
        <i data-lucide="video" style="width:20px;height:20px;"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:.95rem;color:#FAF8F5;">${clientName}</span>
          <span class="badge badge-purple" style="font-weight:700;"><i data-lucide="video" style="width:11px;height:11px;vertical-align:-1px;"></i> Tournage Vidéo 4K CVISUAL</span>
          <span class="badge ${statusBadge}">${esc(r.status)}</span>
          ${isPrivate ? '<span class="badge badge-muted" style="font-size:0.7rem;">🔒 Privé</span>' : '<span class="badge badge-green" style="font-size:0.7rem;">✨ Public</span>'}
          ${countdown}
        </div>
        <div style="color:var(--admin-text);font-size:.86rem;margin-top:.2rem;">
          Service filmé : <strong style="color:#d4af37;">${svc}</strong> · Praticien(ne) : ${esc(r.assigned_employee_name || 'Équipe Soins')}
        </div>
        <div style="color:var(--admin-text-muted);font-size:.78rem;margin-top:.1rem;">
          Date : ${fmtDate(r.date)} · Horaire : <strong>${fmtTime(r.time)} → ${endTime}</strong> (${dur} min)
        </div>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center;" onclick="event.stopPropagation()">
        <button class="btn btn-gold btn-sm" onclick="openStaffVideoModal('${r.id}')" style="display:inline-flex;align-items:center;gap:0.3rem;font-weight:700;">
          <i data-lucide="upload" style="width:13px;height:13px;"></i>
          ${vStatus === 'delivered' ? 'Màj Vidéo' : 'Uploader Vidéo 4K'}
        </button>
      </div>
    </div>`;
  }

  return `<div class="list-item" style="cursor:pointer;display:flex;align-items:center;gap:.75rem;padding:.85rem;border-radius:12px;background:var(--surface-2);border:1px solid var(--admin-border);margin-bottom:.6rem;" onclick="openApptDetail('${r.id}')">
    <div class="avatar" style="width:44px;height:44px;font-size:.9rem;flex-shrink:0;">${getInitials(r.user_name || 'C')}</div>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
        <span style="font-weight:700;font-size:.95rem;">${clientName}</span>
        <span class="badge ${statusBadge}">${esc(r.status)}</span>
        ${countdown}
      </div>
      <div style="color:var(--admin-text);font-size:.86rem;margin-top:.15rem;font-weight:500;">${svc}</div>
      <div style="color:var(--admin-text-muted);font-size:.78rem;margin-top:.1rem;">
        Date : ${fmtDate(r.date)} · Horaire : <strong>${fmtTime(r.time)} → ${endTime}</strong> (${dur} min)
      </div>
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

  const isCadreur = checkIsCadreur(currentEmployee);
  const meta = parseReservationVideoMeta(r);
  const isVideoShoot = isCadreur && (
    meta.cadreur_id === currentEmployee?.id ||
    (meta.cadreur_name && meta.cadreur_name.toLowerCase() === (currentEmployee?.full_name || '').toLowerCase()) ||
    (!isProviderRole(currentEmployee) && (r.wants_video === true || r.video_requested === true || (Number(r.video_price) > 0) || (r.notes || '').includes('[VIDEO_META:')))
  );

  const overlay = document.createElement('div');
  overlay.id = 'appt-detail-overlay';
  overlay.style = 'position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  overlay.innerHTML = `
    <div class="card" style="max-width:480px;width:100%;margin:0;max-height:85vh;overflow-y:auto;">
      <div class="card-title">
        ${isVideoShoot ? 'Tournage Vidéo 4K CVISUAL' : 'Rendez-vous'}
        <button class="btn btn-ghost btn-sm" onclick="closeApptDetail()">${lucideIcon('x', 16)}</button>
      </div>
      <div style="display:flex;align-items:center;gap:.9rem;margin-bottom:1rem;">
        <div class="avatar" style="width:56px;height:56px;font-size:1.1rem;${isVideoShoot ? 'background:rgba(212,175,55,0.15);color:#d4af37;border:1px solid rgba(212,175,55,0.4);display:flex;align-items:center;justify-content:center;' : ''}">${isVideoShoot ? lucideIcon('video', 24) : getInitials(r.user_name || 'C')}</div>
        <div>
          <div style="font-weight:700;font-size:1.05rem;">${esc(r.user_name || 'Client')}</div>
          <div style="display:flex;gap:0.3rem;margin-top:0.2rem;flex-wrap:wrap;">
            <span class="badge ${statusBadge}">${esc(r.status)}</span>
            ${isVideoShoot ? '<span class="badge badge-purple">Cadreur CVISUAL</span>' : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem;font-size:.9rem;color:var(--admin-text);">
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('sparkles')} <span>Prestation: <strong>${esc(r.service || 'Service')}</strong></span></div>
        ${isVideoShoot && r.assigned_employee_name ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('user')} <span>Praticienne du soin: <strong>${esc(r.assigned_employee_name)}</strong></span></div>` : ''}
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('calendar')} <span>${fmtDate(r.date)}</span></div>
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('clock')} <span>${fmtTime(r.time)} → ${calculatePortalEndTime(r.time, r.duration_minutes || 60)} (${r.duration_minutes || 60} min)</span></div>
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('hourglass')} <span>${getPortalCountdownBadge(r)}</span></div>
        <div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('map-pin')} <span>${esc(r.location || 'Sanctuaire DALIGHT')}</span></div>
        ${r.phone ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('phone')} <span>${esc(r.phone)}</span></div>` : ''}
        ${email ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('mail')} <span>${email}</span></div>` : ''}
        ${r.notes ? `<div style="display:flex;align-items:flex-start;gap:.6rem;">${lucideIcon('file-text')} <span>${esc(r.notes.replace(/\[VIDEO_META:[^\]]+\]/g, '').trim())}</span></div>` : ''}
        ${r.duration_minutes ? `<div style="display:flex;align-items:center;gap:.6rem;">${lucideIcon('hourglass')} <span>Durée prévue: ${r.duration_minutes} min</span></div>` : ''}
        ${(r.reservation_employees || []).length ? `<div style="display:flex;align-items:flex-start;gap:.6rem;">${lucideIcon('users')} <span>Équipe: ${r.reservation_employees.map(e => esc(e.employee_name || e.employee_id)).join(', ')}</span></div>` : ''}
      </div>
      <div style="margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--admin-border);">
        <div style="font-size:.8rem;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">Formulaire de consentement</div>
        <div>${consentInfo}</div>
      </div>
      <div style="margin-top:1.2rem;display:flex;gap:.6rem;flex-wrap:wrap;">
        ${isVideoShoot ? `
          <button class="btn btn-gold" onclick="closeApptDetail();openStaffVideoModal('${r.id}')" style="font-weight:700;">${lucideIcon('upload')} Uploader la Vidéo 4K (CVISUAL)</button>
        ` : `
          <button class="btn btn-green" onclick="closeApptDetail();startServiceFromAppt('${r.id}')">${lucideIcon('play')} Démarrer le service</button>
        `}
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
  const finished = activeSession;
  const { error } = await sb.from('service_sessions').update({
    status: 'completed', ended_at: new Date().toISOString(), duration_seconds: secs,
  }).eq('id', finished.id);
  if (error) { toast('Erreur: ' + error.message, 'error'); return; }
  if (chronoTimer) clearInterval(chronoTimer);
  toast('Service terminé (' + fmtDuration(secs) + ')', 'success');
  showSection('service');
  if (employeeRoles().some(isProviderRole)) openPostServiceTask(finished);
};

// ---- Tâche après le service (suivi client) --------------------------
function openPostServiceTask(session) {
  const overlay = document.createElement('div');
  overlay.id = 'post-service-overlay';
  overlay.style = 'position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  overlay.innerHTML = `
    <div class="card" style="max-width:400px;width:100%;margin:0;">
      <div class="card-title">Service terminé</div>
      <p style="color:var(--admin-text-muted);font-size:.9rem;margin-bottom:1.2rem;">
        Voulez-vous enregistrer une séance de suivi (mesures, notes, rappel) pour ${esc(session.client_name || 'ce client')} ?
      </p>
      <div style="display:flex;justify-content:flex-end;gap:.6rem;">
        <button class="btn btn-ghost" id="pst-skip">Plus tard</button>
        <button class="btn btn-gold" id="pst-go">Ouvrir Suivi clients</button>
      </div>
    </div>`;
  overlay.querySelector('#pst-skip').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#pst-go').addEventListener('click', () => { overlay.remove(); showSection('clients'); });
  document.body.appendChild(overlay);
}

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

// ---- CADREUR CVISUAL VIDEO MODULE -----------------------------------
function parseReservationVideoMeta(r) {
  let meta = {};
  if (r.notes) {
    const match = r.notes.match(/\[VIDEO_META:\s*({[^\]]+})\]/i);
    if (match) {
      try { meta = JSON.parse(match[1]); } catch(e){}
    }
  }
  return meta;
}

async function renderVideoShoots(c) {
  const roles = employeeRoles();
  const empId = currentEmployee.id;
  const empName = (currentEmployee.full_name || '').toLowerCase();
  const seesAll = roles.includes('adm_manager') || roles.includes('community_manager');

  c.innerHTML = '<div class="empty">Chargement des tournages vidéo...</div>';

  try {
    const { data, error } = await sb
      .from('reservations')
      .select('*')
      .neq('status', 'CANCELLED')
      .order('date', { ascending: false });

    if (error) throw error;

    // Filter video reservations
    const allVideo = (data || []).filter(r => {
      const isVideoFlag = r.wants_video === true || r.video_requested === true || (Number(r.video_price) > 0);
      const isVideoService = (r.service || '').toLowerCase().includes('vidéo') || (r.service || '').toLowerCase().includes('video');
      const hasMeta = (r.notes || '').includes('[VIDEO_META:');
      return isVideoFlag || isVideoService || hasMeta;
    });

    // Filter for current cadreur
    const myShoots = allVideo.filter(r => {
      if (seesAll) return true;
      const meta = parseReservationVideoMeta(r);
      return (
        r.assigned_employee_id === empId ||
        meta.cadreur_id === empId ||
        (meta.cadreur_name && meta.cadreur_name.toLowerCase() === empName) ||
        (r.cadreur_id && r.cadreur_id === empId)
      );
    });

    if (myShoots.length === 0) {
      c.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1.5rem;">
          <div style="display:flex;justify-content:center;margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg></div>
          <div style="font-size:1.2rem; font-weight:700; color:#FAF8F5; margin-bottom:0.5rem;">Aucun tournage assigné pour le moment</div>
          <p style="color:var(--muted); font-size:0.88rem; max-width:440px; margin:0 auto 1.5rem;">
            Assurez-vous d'être <strong>EN LIGNE</strong> afin que le PDG de CVISUAL ou le système d'assignation puisse vous attribuer les captations vidéo au salon.
          </p>
          <button class="btn btn-primary btn-sm" onclick="toggleMyOnlineStatus(true)" style="background:linear-gradient(135deg,#22c55e,#15803d); border:none; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
            <span class="live-status-dot online"></span> Me mettre EN LIGNE
          </button>
        </div>
      `;
      return;
    }

    const cardsHtml = myShoots.map(r => {
      const meta = parseReservationVideoMeta(r);
      const isPrivate = (r.video_consent === 'private' || r.video_consent === 'oui_prive' || meta.consent === 'private');
      const clientName = r.user_name || 'Client DALIGHT';
      const phone = r.phone || '—';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('509') ? cleanPhone : '509' + cleanPhone}` : '#';

      // Status calculation
      const videoStatus = meta.video_status || r.video_status || 'assigned';
      let statusBadge = '<span class="badge badge-gold">En attente de tournage</span>';
      if (videoStatus === 'shot') statusBadge = '<span class="badge badge-blue">Tourné - En montage</span>';
      if (videoStatus === 'delivered') statusBadge = '<span class="badge badge-green">Vidéo 4K Livrée</span>';

      const consentBadge = isPrivate
        ? '<span class="badge badge-purple" style="border:1px solid rgba(168,85,247,0.4);"><i data-lucide="lock" style="width:12px;height:12px;margin-right:3px;"></i> Usage Privé (Floutage requis)</span>'
        : '<span class="badge badge-green" style="border:1px solid rgba(34,197,94,0.4);"><i data-lucide="globe" style="width:12px;height:12px;margin-right:3px;"></i> DALIGHT & CVISUAL (Public)</span>';

      // Payout cut
      const totalPrice = Number(r.video_price) || (isPrivate ? 1000 : 500);
      const splitPct = Number(meta.cadreur_rate_pct !== undefined ? meta.cadreur_rate_pct : 50);
      const cadreurCut = Math.round(totalPrice * (splitPct / 100));

      const isPaid = meta.cadreur_paid === true;
      const paymentBadge = isPaid
        ? '<span class="badge badge-green" style="font-size:0.75rem;">Payé par CVISUAL</span>'
        : '<span class="badge badge-gold" style="font-size:0.75rem;">Paiement en attente</span>';

      return `
        <div class="card" style="border:1px solid rgba(212,175,55,0.25); background:rgba(20,28,20,0.7); position:relative; overflow:hidden; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.8rem;">
            <div>
              <div style="font-size:1.1rem; font-weight:700; color:#FAF8F5;">${esc(clientName)}</div>
              <div style="font-size:0.8rem; color:var(--muted);">${esc(r.service || 'Soin DALIGHT')}</div>
            </div>
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
              ${statusBadge}
              ${consentBadge}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:0.6rem; padding:0.75rem; background:rgba(0,0,0,0.25); border-radius:10px; margin-bottom:1rem; font-size:0.82rem;">
            <div><span style="color:var(--muted);">Date & Heure :</span><br><strong>${fmtDate(r.date)} à ${fmtTime(r.time)}</strong></div>
            <div><span style="color:var(--muted);">Téléphone :</span><br><strong>${esc(phone)}</strong></div>
            <div><span style="color:var(--muted);">Votre Part (Kòb ou) :</span><br><strong style="color:#4ade80; font-size:0.95rem;">${cadreurCut.toLocaleString()} HTG</strong> (${splitPct}%)</div>
            <div><span style="color:var(--muted);">Statut Paiement :</span><br>${paymentBadge}</div>
          </div>

          ${meta.video_url ? `
            <div style="padding:0.55rem 0.75rem; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); border-radius:8px; margin-bottom:0.9rem; font-size:0.8rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
              <span style="color:#4ade80;"><strong>Vidéo Livrée :</strong> ${esc(meta.video_url).slice(0, 40)}...</span>
              <a href="${esc(meta.video_url)}" target="_blank" class="btn btn-secondary btn-sm" style="padding:0.2rem 0.6rem; font-size:0.75rem;">Voir la vidéo</a>
            </div>
          ` : ''}

          <div class="row-actions" style="justify-content:flex-end;">
            ${cleanPhone ? `
              <a href="${waLink}" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                WhatsApp Client
              </a>
            ` : ''}
            <button class="btn btn-primary btn-sm" onclick="openStaffVideoModal('${r.id}')" style="background:linear-gradient(135deg,#d4af37,#996515); border:none; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              ${meta.video_url ? 'Re-livrer / Màj Vidéo 4K' : 'Uploader & Livrer Vidéo 4K'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    c.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; flex-wrap:wrap; gap:0.8rem;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:700; color:#FAF8F5; margin:0;">Vos Tournages Vidéo CVISUAL</h2>
          <div style="color:var(--muted); font-size:0.82rem;">${myShoots.length} captation${myShoots.length > 1 ? 's' : ''} assignée${myShoots.length > 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="renderVideoShoots(document.getElementById('section-content'))" style="display:inline-flex;align-items:center;gap:0.35rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          Actualiser
        </button>
      </div>
      <div>
        ${cardsHtml}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('renderVideoShoots error:', err);
    c.innerHTML = '<div class="card alert alert-danger">Erreur chargement des tournages: ' + esc(err.message || err) + '</div>';
  }
}

async function renderVideoEarnings(c) {
  const roles = employeeRoles();
  const empId = currentEmployee.id;
  const empName = (currentEmployee.full_name || '').toLowerCase();
  const seesAll = roles.includes('adm_manager') || roles.includes('community_manager');

  c.innerHTML = '<div class="empty">Calcul de vos revenus en cours...</div>';

  try {
    const { data, error } = await sb
      .from('reservations')
      .select('*')
      .neq('status', 'CANCELLED')
      .order('date', { ascending: false });

    if (error) throw error;

    const allVideo = (data || []).filter(r => {
      const isVideoFlag = r.wants_video === true || r.video_requested === true || (Number(r.video_price) > 0);
      const isVideoService = (r.service || '').toLowerCase().includes('vidéo') || (r.service || '').toLowerCase().includes('video');
      const hasMeta = (r.notes || '').includes('[VIDEO_META:');
      return isVideoFlag || isVideoService || hasMeta;
    });

    const myShoots = allVideo.filter(r => {
      if (seesAll) return true;
      const meta = parseReservationVideoMeta(r);
      return (
        r.assigned_employee_id === empId ||
        meta.cadreur_id === empId ||
        (meta.cadreur_name && meta.cadreur_name.toLowerCase() === empName) ||
        (r.cadreur_id && r.cadreur_id === empId)
      );
    });

    let totalShoots = myShoots.length;
    let totalEarned = 0;
    let totalPaid = 0;
    let totalPending = 0;

    const rows = myShoots.map(r => {
      const meta = parseReservationVideoMeta(r);
      const isPrivate = (r.video_consent === 'private' || r.video_consent === 'oui_prive' || meta.consent === 'private');
      const totalPrice = Number(r.video_price) || (isPrivate ? 1000 : 500);
      const splitPct = Number(meta.cadreur_rate_pct !== undefined ? meta.cadreur_rate_pct : 50);
      const cut = Math.round(totalPrice * (splitPct / 100));

      totalEarned += cut;
      if (meta.cadreur_paid === true) {
        totalPaid += cut;
      } else {
        totalPending += cut;
      }

      return `
        <tr>
          <td><strong>${fmtDate(r.date)}</strong></td>
          <td>${esc(r.user_name || 'Client')}</td>
          <td><span style="font-size:0.8rem; color:var(--muted);">${esc(r.service || 'Prestation')}</span></td>
          <td><strong style="color:#FAF8F5;">${totalPrice.toLocaleString()} HTG</strong></td>
          <td><strong style="color:#4ade80;">${cut.toLocaleString()} HTG</strong> (${splitPct}%)</td>
          <td>
            ${meta.cadreur_paid === true 
              ? '<span class="badge badge-green">Payé</span>' 
              : '<span class="badge badge-gold">En attente</span>'}
          </td>
        </tr>
      `;
    }).join('');

    c.innerHTML = `
      <div class="grid cards-4" style="margin-bottom:1.5rem;">
        <div class="card stat-card">
          <div class="stat-icon" style="background:rgba(212,175,55,0.15);color:#d4af37;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </div>
          <div class="stat-value">${totalShoots}</div>
          <div class="stat-label">Tournages Vidéo</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon" style="background:rgba(34,197,94,0.15);color:#22c55e;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="stat-value" style="color:#4ade80;">${totalEarned.toLocaleString()} <span style="font-size:1rem;">HTG</span></div>
          <div class="stat-label">Total Gains (Kòb ou)</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon" style="background:rgba(59,130,246,0.15);color:#3b82f6;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="stat-value" style="color:#60a5fa;">${totalPaid.toLocaleString()} <span style="font-size:1rem;">HTG</span></div>
          <div class="stat-label">Déjà Payé par CVISUAL</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon" style="background:rgba(234,179,8,0.15);color:#eab308;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="stat-value" style="color:#fde047;">${totalPending.toLocaleString()} <span style="font-size:1rem;">HTG</span></div>
          <div class="stat-label">En Attente de Versement</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Historique détaillé de vos rémunérations</span>
          <span style="font-size:0.8rem; font-weight:normal; color:var(--muted);">Géré par la direction CVISUAL</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Prestation</th>
                <th>Prix Total</th>
                <th>Votre Part</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows : '<tr><td colspan="6" class="empty">Aucune prestation vidéo enregistrée pour le moment.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('renderVideoEarnings error:', err);
    c.innerHTML = '<div class="card alert alert-danger">Erreur calcul revenus: ' + esc(err.message || err) + '</div>';
  }
}

// Video Modal upload & delivery handler
let currentUploadFile = null;

window.openStaffVideoModal = async function(resId) {
  try {
    const { data: r, error } = await sb.from('reservations').select('*').eq('id', resId).single();
    if (error || !r) throw new Error('Réservation introuvable');

    document.getElementById('staff-video-res-id').value = r.id;
    document.getElementById('staff-video-res-phone').value = r.phone || '';
    document.getElementById('staff-video-res-name').value = r.user_name || 'Client';

    const meta = parseReservationVideoMeta(r);
    const clientInfoBox = document.getElementById('staff-video-client-info');
    if (clientInfoBox) {
      clientInfoBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
          <strong style="color:#FAF8F5;">${esc(r.user_name || 'Client')}</strong>
          <span style="color:var(--gold);">${fmtDate(r.date)} à ${fmtTime(r.time)}</span>
        </div>
        <div style="color:var(--muted); font-size:0.8rem;">
          Prestation : ${esc(r.service || '—')} • Tél : ${esc(r.phone || '—')}
        </div>
      `;
    }

    const directUrlInput = document.getElementById('staff-video-direct-url');
    if (directUrlInput) directUrlInput.value = meta.video_url || r.video_url || '';

    currentUploadFile = null;
    const filenameBox = document.getElementById('staff-selected-filename');
    if (filenameBox) { filenameBox.style.display = 'none'; filenameBox.textContent = ''; }
    const progressWrapper = document.getElementById('staff-upload-progress-wrapper');
    if (progressWrapper) progressWrapper.style.display = 'none';

    updateStaffWhatsAppPreview();

    const modal = document.getElementById('staff-video-upload-modal');
    if (modal) modal.style.display = 'flex';
  } catch (err) {
    toast('Erreur: ' + (err.message || err), 'error');
  }
};

window.closeStaffVideoModal = function() {
  const modal = document.getElementById('staff-video-upload-modal');
  if (modal) modal.style.display = 'none';
};

window.handleStaffVideoFileSelected = function(input) {
  if (input.files && input.files[0]) {
    currentUploadFile = input.files[0];
    const filenameBox = document.getElementById('staff-selected-filename');
    if (filenameBox) {
      filenameBox.textContent = `Fichier sélectionné : ${currentUploadFile.name} (${(currentUploadFile.size / (1024 * 1024)).toFixed(1)} MB)`;
      filenameBox.style.display = 'block';
    }
  }
};

window.updateStaffWhatsAppPreview = function() {
  const name = document.getElementById('staff-video-res-name')?.value || 'Client';
  const urlVal = document.getElementById('staff-video-direct-url')?.value || '{LIEN_VIDEO}';
  const cadreurName = currentEmployee ? currentEmployee.full_name : 'Équipe CVISUAL';

  const defaultMsg = `Bonjour ${name} !\n\nVotre souvenir vidéo exclusif 4K chez DALIGHT Beauty Bar est fin prêt !\n\nCliquez sur le lien ci-dessous pour visionner et télécharger votre vidéo en haute définition :\n${urlVal}\n\nMerci de votre confiance et à très bientôt pour un nouveau moment de détente chez DALIGHT !\n\n— Réalisé par ${cadreurName} (CVISUAL Studio)`;

  const msgBox = document.getElementById('staff-video-whatsapp-msg');
  if (msgBox) msgBox.value = defaultMsg;
};

window.startStaffVideoUploadAndDispatch = async function() {
  const resId = document.getElementById('staff-video-res-id')?.value;
  const rawPhone = document.getElementById('staff-video-res-phone')?.value;
  const directUrl = (document.getElementById('staff-video-direct-url')?.value || '').trim();
  const whatsappMsg = (document.getElementById('staff-video-whatsapp-msg')?.value || '').trim();
  const btn = document.getElementById('btn-staff-start-upload');

  if (!resId) return;

  if (!currentUploadFile && !directUrl) {
    toast('Veuillez sélectionner un fichier vidéo ou coller un lien direct.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Téléversement & Traitement...';

  const progressWrapper = document.getElementById('staff-upload-progress-wrapper');
  const progressBar = document.getElementById('staff-upload-progress-bar');
  const progressPct = document.getElementById('staff-upload-progress-pct');

  let finalVideoUrl = directUrl;

  try {
    if (currentUploadFile) {
      if (progressWrapper) progressWrapper.style.display = 'block';
      if (progressBar) progressBar.style.width = '25%';
      if (progressPct) progressPct.textContent = '25%';

      const fileExt = currentUploadFile.name.split('.').pop() || 'mp4';
      const fileName = `shoot_${resId}_${Date.now()}.${fileExt}`;
      const filePath = `shoots/${fileName}`;

      const { data: uploadData, error: uploadErr } = await sb.storage
        .from('service-videos')
        .upload(filePath, currentUploadFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) {
        console.warn('Storage upload error, trying fallback:', uploadErr);
        const { data: fallbackData, error: fbErr } = await sb.storage
          .from('videos')
          .upload(filePath, currentUploadFile, { cacheControl: '3600', upsert: true });

        if (fbErr) {
          throw new Error('Échec upload stockage cloud (' + (fbErr.message || uploadErr.message) + '). Vous pouvez héberger la vidéo (Drive/Cloudinary) et coller le lien direct ci-dessus.');
        }
        const { data: pUrl } = sb.storage.from('videos').getPublicUrl(filePath);
        finalVideoUrl = pUrl?.publicUrl || '';
      } else {
        const { data: pUrl } = sb.storage.from('service-videos').getPublicUrl(filePath);
        finalVideoUrl = pUrl?.publicUrl || '';
      }

      if (progressBar) progressBar.style.width = '70%';
      if (progressPct) progressPct.textContent = '70%';
    }

    if (!finalVideoUrl) throw new Error('Aucun lien vidéo valide');

    // 1. Update reservation in Supabase
    const { data: rData } = await sb.from('reservations').select('notes').eq('id', resId).single();
    let notes = (rData?.notes || '');
    let existingMeta = {};
    const match = notes.match(/\[VIDEO_META:\s*({[^\]]+})\]/i);
    if (match) { try { existingMeta = JSON.parse(match[1]); } catch(e){} }

    const updatedMeta = {
      ...existingMeta,
      video_url: finalVideoUrl,
      video_status: 'delivered',
      delivered_by: currentEmployee?.full_name || 'Cadreur',
      delivered_at: new Date().toISOString()
    };

    notes = notes.replace(/\[VIDEO_META:\s*{[^\]]+}\]/gi, '').trim();
    notes = notes ? `${notes}\n[VIDEO_META: ${JSON.stringify(updatedMeta)}]` : `[VIDEO_META: ${JSON.stringify(updatedMeta)}]`;

    await sb.from('reservations').update({
      notes: notes,
      video_status: 'delivered'
    }).eq('id', resId);

    if (progressBar) progressBar.style.width = '85%';
    if (progressPct) progressPct.textContent = '85%';

    // 2. Dispatch WhatsApp message to client if phone is valid
    const cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    let waSent = false;
    if (cleanPhone) {
      const targetPhone = cleanPhone.startsWith('509') ? cleanPhone : ('509' + cleanPhone);
      const msgToSend = whatsappMsg.replace('{LIEN_VIDEO}', finalVideoUrl);

      try {
        const res = await fetch('https://cvisual-whatsapp-gateway.onrender.com/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c'
          },
          body: JSON.stringify({
            to: targetPhone,
            message: msgToSend,
            priority: 'fast'
          })
        });
        const resJson = await res.json().catch(() => ({}));
        if (resJson.success) waSent = true;
      } catch (waErr) {
        console.warn('WhatsApp gateway send warning:', waErr);
      }
    }

    if (progressBar) progressBar.style.width = '100%';
    if (progressPct) progressPct.textContent = '100%';

    closeStaffVideoModal();
    toast(
      waSent
        ? 'Vidéo 4K livrée et message WhatsApp envoyé au client !'
        : 'Vidéo 4K enregistrée dans le système !',
      'success'
    );

    const sectionContent = document.getElementById('section-content');
    if (sectionContent) renderVideoShoots(sectionContent);

  } catch (err) {
    console.error('startStaffVideoUploadAndDispatch error:', err);
    toast('Erreur: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Uploader & Livrer 4K';
  }
};

// expose globally
window.staffLogin = staffLogin;
window.staffLoginWithCode = staffLoginWithCode;
window.staffLoginWithUser = staffLoginWithUser;
window.staffLogout = staffLogout;
window.toggleMyOnlineStatus = toggleMyOnlineStatus;
window.syncOnlineStatus = syncOnlineStatus;
window.showSection = showSection;
window.toggleBellPanel = toggleBellPanel;
window.openStaffVideoModal = openStaffVideoModal;
window.openStaffVideoUploadModal = openStaffVideoModal;
window.getCurrentEmployee = function () { return currentEmployee; };
window.staffToast = toast;
window.staffEsc = esc;
window.staffFmtDate = fmtDate;

// boot
tryAutoLogin();
