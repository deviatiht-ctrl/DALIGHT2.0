// ============================================
// DALIGHT - GESTION DU PERSONNEL & MOTEUR IA
// Assignation RDV, Moteur IA, WhatsApp Staff, Sessions, Rapports
// ============================================

const ROLE_LABELS = {
  estheticienne: 'Esthéticienne',
  masseuse: 'Masseur/Masseuse',
  coiffure: 'Coiffure',
  onglerie: 'Onglerie',
  cadreur_video: 'Cadreur Vidéo CVISUAL',
  cadreur_cvisual: 'Cadreur CVISUAL',
  community_manager: 'Community Manager',
  adm_manager: 'ADM / Manager',
  receptionniste: 'Réceptionniste',
  caissier: 'Caissier/Caisse',
  formateur: 'Formateur',
};
const PROVIDER_ROLES = ['estheticienne', 'masseuse', 'coiffure', 'onglerie', 'cadreur_video', 'cadreur_cvisual'];

let allEmployees = [];
let allPostes = [];
let assignReservations = [];
let staffLiveOnlineState = {};
let sessionsData = [];
let reportsData = [];
let evalsData = [];
let assignModalState = null;
let countdownTimerInterval = null;
let currentSmartRecommendations = [];

function isEmployeeLiveOnline(empId) {
  return !!(staffLiveOnlineState && staffLiveOnlineState[empId] && staffLiveOnlineState[empId].is_online);
}

async function loadLiveOnlineState() {
  try {
    const { data } = await sb()
      .from('settings')
      .select('value')
      .eq('key', 'staff_live_online_state')
      .maybeSingle();

    if (data && data.value && typeof data.value === 'object') {
      staffLiveOnlineState = data.value;
    }
    updateOnlineBadgeCount();
  } catch(e) {
    console.warn('loadLiveOnlineState warning:', e);
  }
}

function updateOnlineBadgeCount() {
  const countEl = document.getElementById('live-online-staff-count');
  if (countEl && allEmployees.length) {
    const onlineCount = allEmployees.filter(e => isEmployeeLiveOnline(e.id)).length;
    countEl.textContent = onlineCount;
  }
}

function sb() {
  return window.adminCore?.supabase || window.dalightAdminSupabase || window.supabaseClient;
}
function esc(s) { if (s == null) return ''; const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(s).replace(/[&<>"']/g, c => m[c]); }
function getInitials(name) { if (!name) return '?'; return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
function toast(msg, type = 'success') { if (window.showToast) window.showToast(msg, type); else if (window.adminCore?.showToast) window.adminCore.showToast(msg, type); else console.log(msg); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtTime(t) { return t ? String(t).slice(0, 5) : '—'; }
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, dd] = String(d).split('-').map(Number);
  const date = new Date(y, m - 1, dd);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function normalizeRoles(e) { let r = e?.roles || []; if (typeof r === 'string') { try { r = JSON.parse(r); } catch { r = []; } } return Array.isArray(r) ? r : []; }

function getPortalBaseUrl() {
  return 'https://dalightbeauty.com/staff.html';
}

// --------------------------------------------
// SCHEDULE & TIME HELPERS
// --------------------------------------------
function getEmployeeSchedule(emp) {
  let s = {
    work_start: '08:00',
    work_end: '18:00',
    lunch_break: '12:00 - 13:00',
    days_off: ['dimanche'],
    leave_start: '',
    leave_end: '',
    leave_reason: '',
    is_on_leave: false
  };
  if (emp && emp.bio) {
    try {
      const p = JSON.parse(emp.bio);
      if (typeof p === 'object' && p !== null) s = { ...s, ...p };
    } catch(err){}
  }
  return s;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

function calculateEndTime(startTime, durationMinutes = 60) {
  if (!startTime) return '—';
  const dur = Number(durationMinutes) || 60;
  const startM = timeToMinutes(startTime);
  return minutesToTime(startM + dur);
}

function getDayOfWeekName(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return days[dt.getDay()];
}

// --------------------------------------------
// LIVE COUNTDOWN & STATUS BADGE
// --------------------------------------------
function getLiveCountdownBadge(r) {
  if (!r.date || !r.time) return '<span class="badge badge-secondary">—</span>';
  
  const now = new Date();
  const dur = Number(r.duration_minutes) || 60;
  
  const [y, m, d] = r.date.split('-').map(Number);
  const [h, min] = r.time.split(':').map(Number);
  const apptDate = new Date(y, m - 1, d, h, min, 0);
  
  const diffMs = apptDate.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / (60 * 1000));
  
  if (r.status === 'COMPLETED') {
    return '<span class="badge badge-secondary" style="font-size:0.75rem;">Soin terminé</span>';
  }
  
  // Future / upcoming
  if (diffMin > 0) {
    if (diffMin <= 60) {
      return '<span class="badge badge-warning" style="background:rgba(245,158,11,0.18);color:#f59e0b;font-weight:700;font-size:0.75rem;border:1px solid #f59e0b50;">Dans ' + diffMin + 'm</span>';
    } else if (diffMin <= 1440) {
      const hours = Math.floor(diffMin / 60);
      const remMin = diffMin % 60;
      return '<span class="badge badge-secondary" style="background:rgba(212,175,55,0.12);color:#d4af37;font-weight:600;font-size:0.75rem;border:1px solid #d4af3740;">Dans ' + hours + 'h ' + (remMin > 0 ? remMin + 'm' : '') + '</span>';
    } else {
      const days = Math.round(diffMin / 1440);
      return '<span class="badge badge-secondary" style="font-size:0.75rem;">Dans ' + days + 'j</span>';
    }
  }
  
  // In progress (within start and start + duration)
  if (diffMin <= 0 && diffMin >= -dur) {
    const remaining = dur + diffMin;
    return '<span class="badge badge-success" style="background:rgba(34,197,94,0.18);color:#22c55e;font-weight:700;font-size:0.75rem;border:1px solid #22c55e50;"><span class="live-dot" style="margin-right:4px;"></span>En cours (reste ' + remaining + 'm)</span>';
  }
  
  // Passed duration without completion
  const pastMin = Math.abs(diffMin) - dur;
  return '<span class="badge badge-secondary" style="font-size:0.75rem;color:var(--admin-text-muted);">Passé (+' + pastMin + 'm)</span>';
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(r => setTimeout(r, 100));
  const session = await window.adminCore?.checkAdminAuth?.();
  if (!session) return;

  const today = todayStr();
  const sessDate = document.getElementById('sessions-date');
  if (sessDate) sessDate.value = today;

  await loadPostes();
  await loadEmployees();
  await loadAssignments();
  await loadStats();

  // Start live countdown ticker every 30s
  if (countdownTimerInterval) clearInterval(countdownTimerInterval);
  countdownTimerInterval = setInterval(() => {
    updateCountdownBadges();
  }, 30000);
});

function updateCountdownBadges() {
  document.querySelectorAll('[data-countdown-res-id]').forEach(el => {
    const resId = el.getAttribute('data-countdown-res-id');
    const r = assignReservations.find(x => x.id === resId);
    if (r) el.innerHTML = getLiveCountdownBadge(r);
  });
}

window.switchTab = function (tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
  if (tab === 'assign') loadAssignments();
  if (tab === 'team') renderTeam();
  if (tab === 'sessions') loadSessions();
  if (tab === 'reports') loadReports();
  if (tab === 'evals') loadEvals();
};

async function loadPostes() {
  try {
    const { data } = await sb().from('settings').select('value').eq('key', 'employee_postes').maybeSingle();
    if (data && Array.isArray(data.value)) {
      allPostes = data.value;
    } else {
      allPostes = [
        { id: 'poste-headspa', color: '#d4af37', title: 'Praticienne Head Spa Japonais', category: 'headspa', services: ['Head Spa Japonais Signature', 'Head Spa Sérénité Royale', 'Rituel Renaissance Express', 'Head Spa'] },
        { id: 'poste-massage', color: '#4ade80', title: 'Massothérapeute Thérapeutique', category: 'massage', services: ['Massage relaxant Silver package', 'Massage aux pierres chaudes', 'Massage shiatsu', 'Massage'] },
        { id: 'poste-esthetique', color: '#a855f7', title: 'Esthéticienne & Soin Visage', category: 'esthetique', services: ['Soin visage éclat', 'Hydrafacial', 'Gommage corps', 'Soin visage'] },
        { id: 'poste-coiffure', color: '#38bdf8', title: 'Spécialiste Capillaire & Coiffure', category: 'coiffure', services: ['Diagnostic capillaire', 'Brushing haute définition', 'Masque nourrissant profond', 'Coiffure'] },
        { id: 'poste-reception', color: '#fbbf24', title: 'Accueil & Conciergerie', category: 'administration', services: [] }
      ];
    }
  } catch(err) {
    console.warn('Postes load error:', err);
  }
}

window.openPostesModal = function() {
  const modal = document.getElementById('postes-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderPostesList();
};

window.closePostesModal = function() {
  const modal = document.getElementById('postes-modal');
  if (modal) modal.style.display = 'none';
};

window.renderPostesList = function() {
  const container = document.getElementById('postes-list-container');
  if (!container) return;
  if (!allPostes.length) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Aucun poste enregistré.</p>';
    return;
  }
  const categoryColors = {
    headspa: '#d4af37',
    massage: '#4ade80',
    esthetique: '#a855f7',
    coiffure: '#38bdf8',
    administration: '#fbbf24',
    autre: '#94a3b8'
  };
  container.innerHTML = allPostes.map((p, idx) => {
    const col = p.color || categoryColors[p.category] || '#d4af37';
    const srvs = (p.services || []).map(s => '<span style="display:inline-block; background:rgba(255,255,255,0.06); padding:0.15rem 0.4rem; border-radius:4px; font-size:0.7rem; margin-right:0.25rem; margin-top:0.25rem;">' + esc(s) + '</span>').join('');
    return '<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:0.75rem; display:flex; justify-content:space-between; align-items:flex-start;">' +
      '<div>' +
        '<div style="display:flex; align-items:center; gap:0.5rem;">' +
          '<span style="width:10px; height:10px; border-radius:50%; background:' + col + '; display:inline-block;"></span>' +
          '<strong style="font-size:0.9rem; color:#FAF8F5;">' + esc(p.title) + '</strong>' +
          '<span style="font-size:0.7rem; color:' + col + '; text-transform:uppercase; letter-spacing:0.04em; background:rgba(255,255,255,0.05); padding:0.1rem 0.4rem; border-radius:4px;">' + esc(p.category) + '</span>' +
        '</div>' +
        (srvs ? '<div style="margin-top:0.4rem;">' + srvs + '</div>' : '') +
      '</div>' +
      '<button type="button" class="btn btn-icon btn-danger btn-sm" onclick="deletePoste(\'' + (p.id || idx) + '\')" title="Supprimer">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
      '</button>' +
    '</div>';
  }).join('');
};

window.submitCreatePoste = async function() {
  const title = document.getElementById('new-poste-title')?.value.trim();
  const category = document.getElementById('new-poste-category')?.value || 'autre';
  const servicesRaw = document.getElementById('new-poste-services')?.value.trim() || '';
  if (!title) {
    toast('Veuillez indiquer un intitulé pour ce poste.', 'warning');
    return;
  }
  const services = servicesRaw ? servicesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const categoryColors = {
    headspa: '#d4af37',
    massage: '#4ade80',
    esthetique: '#a855f7',
    coiffure: '#38bdf8',
    administration: '#fbbf24',
    autre: '#94a3b8'
  };
  const newPoste = {
    id: 'poste-' + Date.now(),
    title,
    category,
    color: categoryColors[category] || '#d4af37',
    services
  };
  allPostes.push(newPoste);
  try {
    await sb().from('settings').upsert({
      key: 'employee_postes',
      value: allPostes,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    document.getElementById('new-poste-title').value = '';
    document.getElementById('new-poste-services').value = '';
    renderPostesList();
    renderAssignments();
    toast('Nouveau poste créé avec succès !', 'success');
  } catch(err) {
    console.error(err);
    toast('Erreur lors de la sauvegarde : ' + (err.message || err), 'error');
  }
};

window.deletePoste = async function(posteId) {
  if (!confirm('Supprimer ce poste ?')) return;
  allPostes = allPostes.filter(p => p.id !== posteId);
  try {
    await sb().from('settings').upsert({
      key: 'employee_postes',
      value: allPostes,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    renderPostesList();
    renderAssignments();
    toast('Poste supprimé.', 'info');
  } catch(err) {
    console.error(err);
    toast('Erreur lors de la suppression.', 'error');
  }
};

// ---- Employees ----
async function loadEmployees() {
  const { data, error } = await sb().from('presence_employees').select('*').order('full_name', { ascending: true });
  if (error) { console.error(error); return; }
  allEmployees = data || [];
  await loadLiveOnlineState();

  const sel = document.getElementById('assign-filter-emp');
  if (sel) {
    sel.innerHTML = '<option value="">Tous les employés</option>' +
      allEmployees.map(e => '<option value="' + e.id + '">' + (isEmployeeLiveOnline(e.id) ? '[En Ligne] ' : '[Hors Ligne] ') + esc(e.full_name) + '</option>').join('');
  }
  updateOnlineBadgeCount();
}

async function loadStats() {
  const active = allEmployees.filter(e => e.is_active).length;
  const portals = allEmployees.filter(e => e.portal_enabled && e.username).length;
  document.getElementById('stat-employees').textContent = active;
  document.getElementById('stat-portals').textContent = portals;

  const { data: sess } = await sb().from('service_sessions').select('id').eq('status', 'in_progress');
  document.getElementById('stat-active').textContent = (sess || []).length;

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: reps } = await sb().from('staff_reports').select('id').gte('created_at', weekAgo.toISOString());
  document.getElementById('stat-reports').textContent = (reps || []).length;
  updateOnlineBadgeCount();
}

// ============================================
// ASSIGNATION RDV
// ============================================
async function loadAssignments() {
  const date = document.getElementById('assign-date').value;
  const tbody = document.getElementById('assign-table');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Chargement...</td></tr>';

  await loadLiveOnlineState();

  let query = sb().from('reservations').select('*, reservation_employees(*)');
  if (date) {
    query = query.eq('date', date);
  } else {
    query = query.gte('date', todayStr()).order('date', { ascending: true });
  }
  const { data, error } = await query.order('time', { ascending: true });
  if (error) { tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Erreur: ' + esc(error.message) + '</td></tr>'; return; }

  assignReservations = (data || []).filter(r => r.status !== 'CANCELLED');
  renderAssignments();
}

window.renderAssignments = function () {
  const tbody = document.getElementById('assign-table');
  const search = (document.getElementById('assign-search').value || '').toLowerCase();
  const filterEmp = document.getElementById('assign-filter-emp').value;
  const filterState = document.getElementById('assign-filter-state').value;

  let list = assignReservations;
  if (search) list = list.filter(r => (r.user_name || '').toLowerCase().includes(search) || (r.service || '').toLowerCase().includes(search));
  if (filterEmp) list = list.filter(r =>
    r.assigned_employee_id === filterEmp ||
    (r.reservation_employees || []).some(re => re.employee_id === filterEmp)
  );
  if (filterState === 'assigned') list = list.filter(r => !!(r.assigned_employee_id || (r.reservation_employees || []).length));
  if (filterState === 'unassigned') list = list.filter(r => !(r.assigned_employee_id || (r.reservation_employees || []).length));

  if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Aucun rendez-vous.</td></tr>'; return; }

  const statusBadge = s => ({ CONFIRMED: 'badge-success', PENDING: 'badge-warning', AWAITING_PAYMENT: 'badge-warning', COMPLETED: 'badge-secondary', NO_SHOW: 'badge-secondary' }[s] || 'badge-secondary');

  tbody.innerHTML = list.map(r => {
    const duration = Number(r.duration_minutes) || (r.service && r.service.includes('Royale') ? 90 : (r.service && r.service.includes('Express') ? 45 : 60));
    const endTime = calculateEndTime(r.time, duration);
    const emps = (r.reservation_employees || []).length
      ? r.reservation_employees.map(e => esc(e.employee_name || e.employee_id)).join(', ')
      : (r.assigned_employee_name ? esc(r.assigned_employee_name) : '<span class="text-muted" style="font-size:0.8rem;">Non assigné</span>');

    const primaryEmpId = r.assigned_employee_id || ((r.reservation_employees || [])[0]?.employee_id);
    const primaryEmp = allEmployees.find(e => e.id === primaryEmpId);

    // Matching Poste Tag
    const matchedPoste = allPostes.find(p => (p.services || []).some(s => (r.service || '').toLowerCase().includes(s.toLowerCase())));
    const posteBadge = matchedPoste
      ? '<span style="display:inline-block;background:rgba(212,175,55,0.1);color:#d4af37;padding:0.1rem 0.35rem;border-radius:4px;font-size:0.65rem;font-weight:600;margin-top:0.2rem;">' + esc(matchedPoste.title) + '</span>'
      : '';

    // WhatsApp Action Button
    const waButton = primaryEmp
      ? '<button class="btn btn-icon btn-secondary btn-sm" onclick="openWhatsAppNotifyModal(\'' + r.id + '\', \'' + primaryEmp.id + '\')" title="Envoyer notification WhatsApp à ' + esc(primaryEmp.full_name) + '" style="color:#22c55e;"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="16" height="16"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.771.848 2.791.848 3.18 0 5.767-2.587 5.767-5.766.001-3.182-2.585-5.634-5.767-5.634zm3.385 8.163c-.145.408-.847.781-1.182.831-.334.05-.765.074-2.222-.519-1.859-.757-3.048-2.656-3.14-2.78-.093-.124-.755-1.004-.755-1.916 0-.912.476-1.36.647-1.547.171-.186.373-.233.498-.233.124 0 .248.002.358.007.116.006.273-.044.427.327.156.377.531 1.299.578 1.393.047.093.078.202.016.326-.062.124-.093.202-.186.311-.093.109-.196.244-.28.328-.093.093-.191.196-.082.383.109.187.484.798 1.038 1.292.713.636 1.314.833 1.501.926.186.093.296.078.405-.047.109-.125.467-.544.591-.731.125-.187.249-.156.419-.093.171.062 1.082.51 1.269.603.187.093.311.14.358.218.046.078.046.452-.099.86z"/></svg></button>'
      : '<span class="text-muted" style="font-size:0.75rem;">—</span>';

    return '<tr>' +
      '<td>' +
        '<div style="font-weight:600;">' + fmtDate(r.date) + '</div>' +
        '<div style="font-size:0.82rem; color:var(--admin-accent); font-weight:700;">' + fmtTime(r.time) + '</div>' +
      '</td>' +
      '<td>' +
        '<div style="font-weight:600; color:#FAF8F5;">' + endTime + '</div>' +
        '<div class="text-muted" style="font-size:0.72rem;">' + duration + ' min</div>' +
      '</td>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:.5rem;">' +
          '<div class="staff-avatar">' + getInitials(r.user_name || 'C') + '</div>' +
          '<div>' +
            '<div style="font-weight:500;">' + esc(r.user_name || 'Client') + '</div>' +
            (r.phone ? '<div class="text-muted" style="font-size:.72rem;">' + esc(r.phone) + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' +
        '<div style="font-weight:500;">' + esc(r.service || '—') + '</div>' +
        posteBadge +
      '</td>' +
      '<td data-countdown-res-id="' + r.id + '">' + getLiveCountdownBadge(r) + '</td>' +
      '<td><span class="badge ' + statusBadge(r.status) + '">' + esc(r.status) + '</span></td>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">' +
          '<span style="font-size:.85rem; font-weight:500;">' + emps + '</span>' +
          '<button class="btn btn-secondary btn-sm" onclick="openAssignModal(\'' + r.id + '\')">' + (r.assigned_employee_id || (r.reservation_employees || []).length ? 'Modifier' : 'Assigner') + '</button>' +
        '</div>' +
      '</td>' +
      '<td style="text-align:center;">' + waButton + '</td>' +
    '</tr>';
  }).join('');
};

// ============================================
// MODAL ASSIGNATION MANUELLE
// ============================================
function renderAssignModal() {
  const { resId, step, required_employees, duration_minutes, selections } = assignModalState;
  const r = assignReservations.find(x => x.id === resId);
  if (!r) return;
  let overlay = document.getElementById('assign-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'assign-modal-overlay';
    overlay.style = 'position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  const providers = allEmployees.filter(e => e.is_active);
  const empOptions = (sel = '') => '<option value="">— Choisir —</option>' + providers.map(e => '<option value="' + e.id + '" ' + (sel === e.id ? 'selected' : '') + '>' + esc(e.full_name) + ' (' + esc(e.position || 'Général') + ')</option>').join('');
  let body = '';
  if (step === 1) {
    body = '<div class="card-title" style="margin-bottom:1rem;">Assigner le rendez-vous</div>' +
      '<div style="margin-bottom:1rem;font-size:.9rem;color:var(--admin-text-muted);">' +
        '<strong>' + esc(r.service) + '</strong> · ' + esc(r.user_name) + ' · ' + fmtDate(r.date) + ' à ' + fmtTime(r.time) +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem;">' +
        '<label>Nombre d\'employés requis</label>' +
        '<select id="am-required" class="form-input">' + [1,2,3,4,5,6].map(n => '<option value="' + n + '" ' + (n == required_employees ? 'selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1.5rem;">' +
        '<label>Durée du service (minutes)</label>' +
        '<input type="number" id="am-duration" class="form-input" value="' + (duration_minutes === 0 ? 0 : (duration_minutes || '')) + '" placeholder="Ex: 60" min="5">' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:.6rem;">' +
        '<button class="btn btn-ghost" onclick="closeAssignModal()">Annuler</button>' +
        '<button class="btn btn-primary" onclick="assignModalGoStep(2)">Suivant</button>' +
      '</div>';
  } else {
    const slots = Array.from({ length: required_employees }, (_, i) => i);
    body = '<div class="card-title" style="margin-bottom:1rem;">Sélectionner les employés</div>' +
      '<div style="margin-bottom:1rem;font-size:.9rem;color:var(--admin-text-muted);">' +
        esc(r.service) + ' · ' + required_employees + ' employé(s) · ' + (duration_minutes || '—') + ' min' +
      '</div>' +
      slots.map(i => '<div class="form-group" style="margin-bottom:.75rem;">' +
          '<label>Employé ' + (i + 1) + (i === 0 ? ' (principal)' : '') + '</label>' +
          '<select id="am-emp-' + i + '" class="form-input">' + empOptions(selections[i] || '') + '</select>' +
        '</div>').join('') +
      '<div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem;">' +
        '<button class="btn btn-ghost" onclick="assignModalGoStep(1)">Retour</button>' +
        '<button class="btn btn-primary" onclick="saveAssignModal()">Enregistrer</button>' +
      '</div>';
  }
  overlay.innerHTML = '<div class="glass-card" style="max-width:420px;width:100%;margin:0;">' + body + '</div>';
}

window.openAssignModal = function (resId) {
  const r = assignReservations.find(x => x.id === resId);
  if (!r) return;
  const existing = (r.reservation_employees || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  assignModalState = {
    resId,
    step: 1,
    required_employees: r.required_employees || existing.length || 1,
    duration_minutes: r.duration_minutes === 0 ? 0 : (r.duration_minutes || ''),
    selections: existing.map(re => re.employee_id)
  };
  renderAssignModal();
};

window.closeAssignModal = function () {
  const overlay = document.getElementById('assign-modal-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
  assignModalState = null;
};

window.assignModalGoStep = function (step) {
  if (!assignModalState) return;
  const max = assignModalState.required_employees;
  const current = [];
  for (let i = 0; i < max; i++) {
    const el = document.getElementById('am-emp-' + i);
    current.push(el ? el.value : (assignModalState.selections[i] || ''));
  }
  assignModalState.selections = current;
  if (step === 2) {
    assignModalState.required_employees = Number(document.getElementById('am-required').value) || 1;
    assignModalState.duration_minutes = document.getElementById('am-duration').value;
  }
  assignModalState.step = step;
  renderAssignModal();
};

window.saveAssignModal = async function () {
  if (!assignModalState) return;
  const { resId, required_employees, duration_minutes } = assignModalState;
  const selections = [];
  for (let i = 0; i < required_employees; i++) {
    const el = document.getElementById('am-emp-' + i);
    selections.push(el ? el.value : '');
  }
  assignModalState.selections = selections;
  const empIds = selections.filter(id => id);
  if (empIds.length < required_employees) { toast('Veuillez sélectionner tous les employés.', 'warning'); return; }
  if (new Set(empIds).size !== empIds.length) { toast("Chaque employé ne peut être sélectionné qu'une fois.", 'warning'); return; }

  const r = assignReservations.find(x => x.id === resId);
  const emps = empIds.map(id => allEmployees.find(e => e.id === id)).filter(Boolean);
  const primary = emps[0];
  const prevIds = new Set((r.reservation_employees || []).map(re => re.employee_id));

  try {
    const { error: updErr } = await sb().from('reservations').update({
      duration_minutes: duration_minutes === '' ? null : Number(duration_minutes),
      required_employees: Number(required_employees) || 1,
      assigned_employee_id: primary ? primary.id : null,
      assigned_employee_name: primary ? primary.full_name : null,
      assigned_at: primary ? new Date().toISOString() : null,
    }).eq('id', resId);
    if (updErr) throw updErr;

    const { error: delErr } = await sb().from('reservation_employees').delete().eq('reservation_id', resId);
    if (delErr) throw delErr;

    if (emps.length) {
      const { error: insErr } = await sb().from('reservation_employees').insert(
        emps.map((e, i) => ({ reservation_id: resId, employee_id: e.id, employee_name: e.full_name, is_primary: i === 0 }))
      );
      if (insErr) throw insErr;
    }

    for (const e of emps) {
      if (!prevIds.has(e.id)) {
        await sb().from('staff_notifications').insert({
          employee_id: e.id,
          type: 'assignment',
          title: 'Nouveau rendez-vous assigné',
          body: 'Vous avez un rendez-vous le ' + r.date + ' à ' + fmtTime(r.time) + ' — ' + (r.user_name || 'Client') + ' (' + (r.service || 'Service') + ').',
          data: { reservation_id: resId },
          read: false,
        });
      }
    }

    r.duration_minutes = duration_minutes === '' ? null : Number(duration_minutes);
    r.required_employees = Number(required_employees) || 1;
    r.assigned_employee_id = primary ? primary.id : null;
    r.assigned_employee_name = primary ? primary.full_name : null;
    r.reservation_employees = emps.map((e, i) => ({ employee_id: e.id, employee_name: e.full_name, is_primary: i === 0 }));
    closeAssignModal();
    renderAssignments();
    toast('Assignation enregistrée', 'success');
  } catch (err) {
    console.error(err);
    toast('Erreur: ' + (err?.message || err), 'error');
  }
};

// ============================================
// MOTEUR D'ASSIGNATION INTELLIGENTE IA
// ============================================

// Helper to parse Video Metadata from reservation notes
function parseReservationVideoMeta(r) {
  let meta = {};
  if (r && r.notes) {
    const match = r.notes.match(/\[VIDEO_META:\s*({[^\]]+})\]/i);
    if (match) {
      try { meta = JSON.parse(match[1]); } catch(e){}
    }
  }
  return meta;
}

function isMediaStaffMember(emp) {
  if (!emp) return false;
  const pos = (emp.position || '').toLowerCase();
  const roles = normalizeRoles(emp);
  return roles.includes('cadreur_video') || roles.includes('cadreur_cvisual') || roles.includes('community_manager') ||
    pos.includes('cadreur') || pos.includes('community') || pos.includes('cvisual') || pos.includes('média');
}

function isCarePractitionerMember(emp) {
  if (!emp) return false;
  const pos = (emp.position || '').toLowerCase();
  const roles = normalizeRoles(emp);
  return roles.includes('masseuse') || roles.includes('estheticienne') || roles.includes('coiffure') || roles.includes('onglerie') ||
    pos.includes('mass') || pos.includes('head spa') || pos.includes('praticienne') || pos.includes('esthét') || pos.includes('thérapeute') || pos.includes('coiff') || pos.includes('ongl') || pos.includes('manucure') || pos.includes('pédicure');
}

/**
 * Calcule l'éligibilité et le score d'un employé pour une réservation donnée.
 * Règle DALIGHT & CVISUAL :
 * 1. La disponibilité est conditionnée par le statut "En Ligne" de l'employé (présence au salon en direct).
 * 2. Un Community Manager / Cadreur CVISUAL qui n'a pas de formation de praticienne NE PEUT JAMAIS être assigné à un soin corporel (Massage, Head Spa, Onglerie, etc.).
 * 3. Les soins physiques exigent impérativement la spécialité requise (Massothérapeute pour massage, Esthéticienne pour Head Spa/Facial, Onglerie pour manucure).
 * 4. Les réservations avec option vidéo 4K attribuent la captation vidéo au Cadreur / Community Manager En Ligne.
 * 5. Équilibrage équitable de la charge en fonction du nombre de soins déjà planifiés aujourd'hui.
 */
function evaluateEmployeeForReservation(emp, res, allDayReservations) {
  if (!emp.is_active) {
    return { eligible: false, score: 0, reason: 'Employé inactif' };
  }

  // 1. STATUT EN LIGNE (PRÉSENCE AU SALON EN DIRECT)
  const isOnline = isEmployeeLiveOnline(emp.id);
  if (!isOnline) {
    return { eligible: false, score: -100, reason: 'Hors Ligne (Pas au salon actuellement)' };
  }

  const sched = getEmployeeSchedule(emp);

  // 2. Vérification des congés exceptionnels marqués
  if (sched.is_on_leave) {
    return { eligible: false, score: -100, reason: 'En congé exceptionnel (' + (sched.leave_reason || 'Absent') + ')' };
  }
  if (sched.leave_start && sched.leave_end) {
    if (res.date >= sched.leave_start && res.date <= sched.leave_end) {
      return { eligible: false, score: -100, reason: 'En congé planifié du ' + sched.leave_start + ' au ' + sched.leave_end };
    }
  }

  // 3. VÉRIFICATION DES CONFLITS HORAIRES / CHEVAUCHEMENT (EN FONCTION DE L'HEURE)
  const resDuration = Number(res.duration_minutes) || (res.service && res.service.includes('Royale') ? 90 : (res.service && res.service.includes('Express') ? 45 : 60));
  const resStartMin = timeToMinutes(res.time);
  const resEndMin = resStartMin + resDuration;

  const existingEmpReservations = allDayReservations.filter(r => 
    r.id !== res.id &&
    (r.assigned_employee_id === emp.id || (r.reservation_employees || []).some(re => re.employee_id === emp.id))
  );

  for (const other of existingEmpReservations) {
    const oDuration = Number(other.duration_minutes) || 60;
    const oStartMin = timeToMinutes(other.time);
    const oEndMin = oStartMin + oDuration;

    // Check overlap
    if (!(resEndMin <= oStartMin || resStartMin >= oEndMin)) {
      return { eligible: false, score: -80, reason: 'Chevauchement horaire (' + other.time + ' - ' + minutesToTime(oEndMin) + ')' };
    }
  }

  // 4. ANALYSE DU SERVICE ET DES QUALIFICATIONS (RÈGLES MÉTIER DALIGHT & CVISUAL)
  const empPos = (emp.position || '').toLowerCase();
  const empRoles = normalizeRoles(emp);
  const resSrv = (res.service || '').toLowerCase();

  const isVideoRes = res.wants_video === true || res.video_requested === true || (Number(res.video_price) > 0) || resSrv.includes('vidéo') || resSrv.includes('video') || (res.notes || '').includes('[VIDEO_META:');
  const isHeadSpaService = resSrv.includes('head spa') || resSrv.includes('cascade') || resSrv.includes('rituel') || resSrv.includes('cuir chevelu');
  const isMassageService = resSrv.includes('massage') || resSrv.includes('shiatsu') || resSrv.includes('pierres');
  const isFacialService = resSrv.includes('visage') || resSrv.includes('soin') || resSrv.includes('éclat') || resSrv.includes('hydrafacial');
  const isHairService = resSrv.includes('coiffure') || resSrv.includes('brushing') || resSrv.includes('capillaire');
  const isNailService = resSrv.includes('ongle') || resSrv.includes('manucure') || resSrv.includes('pedicure') || resSrv.includes('pédicure') || resSrv.includes('gel') || resSrv.includes('vernis');
  const isPureVideoService = (resSrv.includes('vidéo') || resSrv.includes('video') || resSrv.includes('cvisual') || resSrv.includes('shooting')) && !isMassageService && !isHeadSpaService && !isFacialService && !isHairService && !isNailService;

  const isMedia = isMediaStaffMember(emp);
  const isCare = isCarePractitionerMember(emp);

  // RÈGLE DALIGHT : Gestion du Personnel dédiée UNIQUEMENT aux soins du salon (Massage, Head Spa, Visage, Ongles, Coiffure)
  // Les profils Média / Community Managers sont gérés exclusivement dans Contenu Vidéo CVISUAL
  if (isMedia && !isCare) {
    return {
      eligible: false,
      score: -100,
      reason: 'Rôle Média / Community Manager — Non qualifié(e) pour les soins physiques du salon'
    };
  }

  // RÈGLE STRICTE : Spécialités obligatoires pour chaque soin physique
  if (isMassageService) {
    const canMassage = empRoles.includes('masseuse') || empPos.includes('mass') || empPos.includes('thérapeute');
    if (!canMassage) {
      return { eligible: false, score: -80, reason: 'Non qualifié(e) en massothérapie corporelle' };
    }
  } else if (isHeadSpaService) {
    const canHeadSpa = empRoles.includes('estheticienne') || empRoles.includes('masseuse') || empPos.includes('head spa') || empPos.includes('praticienne');
    if (!canHeadSpa) {
      return { eligible: false, score: -80, reason: 'Non qualifié(e) pour le rituel Head Spa Japonais' };
    }
  } else if (isFacialService) {
    const canFacial = empRoles.includes('estheticienne') || empPos.includes('esthét');
    if (!canFacial) {
      return { eligible: false, score: -80, reason: 'Non qualifié(e) pour les soins du visage / esthétique' };
    }
  } else if (isHairService) {
    const canHair = empRoles.includes('coiffure') || empPos.includes('coiff');
    if (!canHair) {
      return { eligible: false, score: -80, reason: 'Non qualifié(e) en coiffure & capillaire' };
    }
  } else if (isNailService) {
    const canNails = empRoles.includes('onglerie') || empPos.includes('ongl') || empPos.includes('manucure') || empPos.includes('pédicure');
    if (!canNails) {
      return { eligible: false, score: -80, reason: 'Non qualifié(e) en onglerie & manucure' };
    }
  }

  // 5. CALCUL DU SCORE D'AFFINITÉ & COMPÉTENCE POUR LES SOINS
  let score = 25; // score de base pour une praticienne en ligne sans conflit
  let matchFactors = ['En Ligne au salon'];

  if (isMassageService && (empRoles.includes('masseuse') || empPos.includes('mass') || empPos.includes('thérapeute'))) {
    score += 50;
    matchFactors.push('Massothérapeute certifiée');
  } else if (isHeadSpaService && (empPos.includes('head spa') || empPos.includes('praticienne'))) {
    score += 50;
    matchFactors.push('Spécialiste Head Spa certifiée');
  } else if (isFacialService && (empRoles.includes('estheticienne') || empPos.includes('esthét'))) {
    score += 50;
    matchFactors.push('Esthéticienne soins visage');
  } else if (isHairService && (empRoles.includes('coiffure') || empPos.includes('coiff'))) {
    score += 50;
    matchFactors.push('Experte coiffure & capillaire');
  } else if (isNailService && (empRoles.includes('onglerie') || empPos.includes('ongl') || empPos.includes('manucure') || empPos.includes('pédicure'))) {
    score += 50;
    matchFactors.push('Prothésiste ongulaire qualifiée');
  } else if (empRoles.includes('estheticienne') || empRoles.includes('masseuse')) {
    score += 30;
    matchFactors.push('Polyvalente Soins');
  } else {
    score += 10;
    matchFactors.push('Compétences générales');
  }

  // 6. ÉQUILIBRAGE DE CHARGE (EN FONCTION DE COMBIEN SERVICES LI GEN BAY DÉJÀ)
  const currentCount = existingEmpReservations.length;
  if (currentCount === 0) {
    score += 35;
    matchFactors.push('Priorité maximale : 0 soin aujourd\'hui');
  } else if (currentCount === 1) {
    score += 20;
    matchFactors.push('1 soin déjà planifié');
  } else if (currentCount === 2) {
    score += 10;
    matchFactors.push('2 soins déjà planifiés');
  } else if (currentCount === 3) {
    score += 5;
    matchFactors.push('3 soins déjà planifiés');
  } else {
    score += 0;
    matchFactors.push(currentCount + ' soins déjà planifiés (charge saturée)');
  }

  return {
    eligible: true,
    score: Math.min(score, 100),
    reason: matchFactors.join(' · ')
  };
}

// Auto-assignation rapide en 1 clic pour les soins du salon aux praticiennes actuellement En Ligne
window.executeAutoAssignOnlineStaff = async function() {
  const date = document.getElementById('assign-date')?.value || todayStr();
  await loadLiveOnlineState();

  const onlineEmps = allEmployees.filter(e => e.is_active && isEmployeeLiveOnline(e.id) && isCarePractitionerMember(e));
  if (!onlineEmps.length) {
    toast('Aucune praticienne/masseuse n\'est actuellement EN LIGNE au salon. Demandez à l\'équipe de se connecter sur staff.html', 'warning');
    return;
  }

  // Réservations de soins physiques non assignées
  const unassignedCare = assignReservations.filter(r => !r.assigned_employee_id && !(r.reservation_employees && r.reservation_employees.length));

  if (!unassignedCare.length) {
    toast('Toutes les réservations de soins du ' + date + ' sont déjà assignées !', 'info');
    return;
  }

  toast('Auto-assignation des soins aux praticiennes En Ligne...', 'info');
  let assignedCareCount = 0;

  for (const r of unassignedCare) {
    const sameDay = assignReservations.filter(x => x.date === r.date);
    let bestScore = -1;
    let bestCandidate = null;

    for (const emp of onlineEmps) {
      const evalRes = evaluateEmployeeForReservation(emp, r, sameDay);
      if (evalRes.eligible && evalRes.score > bestScore) {
        bestScore = evalRes.score;
        bestCandidate = emp;
      }
    }

    if (bestCandidate) {
      await assignEmployeeToReservation(r.id, bestCandidate, r.duration_minutes || 60);
      r.assigned_employee_id = bestCandidate.id;
      r.assigned_employee_name = bestCandidate.full_name;
      assignedCareCount++;
    }
  }

  if (assignedCareCount > 0) {
    toast(`${assignedCareCount} soin(s) assigné(s) avec succès aux praticiennes En Ligne !`, 'success');
    await loadAssignments();
  } else {
    toast('Impossible d\'assigner automatiquement : les praticiennes en ligne ne correspondent pas aux spécialités requises pour ces soins.', 'warning');
  }
};

window.openSmartAssignModal = async function() {
  const modal = document.getElementById('smart-assign-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const unassigned = assignReservations.filter(r => !r.assigned_employee_id && !(r.reservation_employees || []).length);
  const summaryBox = document.getElementById('smart-assign-summary');
  const listBox = document.getElementById('smart-assign-list');

  summaryBox.innerHTML = 
    '<div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:10px;padding:0.75rem;">' +
      '<div style="font-size:0.75rem;color:var(--admin-text-muted);">RDV à planifier</div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:#d4af37;">' + unassigned.length + '</div>' +
    '</div>' +
    '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:0.75rem;">' +
      '<div style="font-size:0.75rem;color:var(--admin-text-muted);">Employés actifs</div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:#22c55e;">' + allEmployees.filter(e => e.is_active).length + '</div>' +
    '</div>' +
    '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:0.75rem;">' +
      '<div style="font-size:0.75rem;color:var(--admin-text-muted);">Postes configurés</div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:#3b82f6;">' + allPostes.length + '</div>' +
    '</div>';

  if (!unassigned.length) {
    listBox.innerHTML = 
      '<div style="text-align:center;padding:3rem 1rem;color:var(--admin-text-muted);">' +
        '<div style="display:flex;justify-content:center;margin-bottom:0.75rem;"><svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>' +
        '<div style="font-size:1rem;font-weight:600;color:#FAF8F5;">Toutes les réservations sont déjà assignées !</div>' +
        '<div style="font-size:0.82rem;margin-top:0.25rem;">Aucun rendez-vous en attente de personnel pour le moment.</div>' +
      '</div>';
    document.getElementById('btn-apply-all-smart').style.display = 'none';
    currentSmartRecommendations = [];
    return;
  }

  document.getElementById('btn-apply-all-smart').style.display = 'block';

  // Compute recommendations for each unassigned reservation
  currentSmartRecommendations = [];

  unassigned.forEach(r => {
    // Find all reservations on the same date for context
    const sameDayReservations = assignReservations.filter(x => x.date === r.date);
    
    const candidates = allEmployees.map(emp => {
      const evalResult = evaluateEmployeeForReservation(emp, r, sameDayReservations);
      return { employee: emp, ...evalResult };
    }).sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const duration = Number(r.duration_minutes) || (r.service && r.service.includes('Royale') ? 90 : (r.service && r.service.includes('Express') ? 45 : 60));
    const endTime = calculateEndTime(r.time, duration);

    currentSmartRecommendations.push({
      reservation: r,
      duration,
      endTime,
      bestCandidate: (best && best.eligible) ? best : null,
      allCandidates: candidates
    });
  });

  // Render cards
  listBox.innerHTML = currentSmartRecommendations.map((item, idx) => {
    const r = item.reservation;
    const best = item.bestCandidate;

    const candidateHtml = best
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:0.6rem 0.85rem;margin-top:0.5rem;">' +
          '<div style="display:flex;align-items:center;gap:0.6rem;">' +
            '<div class="staff-avatar">' + getInitials(best.employee.full_name) + '</div>' +
            '<div>' +
              '<div style="font-weight:600;font-size:0.88rem;color:#FAF8F5;">' + esc(best.employee.full_name) + ' <span class="badge badge-success" style="font-size:0.65rem;">Score ' + best.score + '%</span></div>' +
              '<div style="font-size:0.75rem;color:var(--admin-text-muted);">' + esc(best.reason) + '</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm" onclick="applySingleSmartAssignment(' + idx + ')" style="background:#22c55e;border-color:#22c55e;color:#04210f;font-weight:600;font-size:0.78rem;">' +
            'Valider & Assigner' +
          '</button>' +
        '</div>'
      : '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:0.6rem 0.85rem;color:#f87171;font-size:0.8rem;margin-top:0.5rem;">' +
          'Aucun employé disponible sans conflit sur ce créneau horaire.' +
        '</div>';

    const isVid = r.wants_video === true || r.video_requested === true || (Number(r.video_price) > 0) || (r.notes || '').includes('[VIDEO_META:');
    return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.85rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">' +
        '<div>' +
          '<div style="font-weight:600;font-size:0.92rem;color:#FAF8F5;display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
            esc(r.service) +
            (isVid ? '<span class="badge badge-purple" style="font-size:0.68rem;padding:0.15rem 0.45rem;">Option Vidéo 4K CVISUAL</span>' : '') +
          '</div>' +
          '<div style="font-size:0.78rem;color:var(--admin-text-muted);margin-top:0.15rem;">' +
            'Client : <strong>' + esc(r.user_name || 'Client') + '</strong> · Date : ' + fmtDate(r.date) + ' · Horaire : <strong>' + fmtTime(r.time) + ' → ' + item.endTime + '</strong> (' + item.duration + ' min)' +
          '</div>' +
        '</div>' +
        '<span class="badge badge-warning" style="font-size:0.7rem;">Non assigné</span>' +
      '</div>' +
      candidateHtml +
    '</div>';
  }).join('');
};

window.closeSmartAssignModal = function() {
  const modal = document.getElementById('smart-assign-modal');
  if (modal) modal.style.display = 'none';
};

window.applySingleSmartAssignment = async function(recIndex) {
  const item = currentSmartRecommendations[recIndex];
  if (!item || !item.bestCandidate) return;

  const r = item.reservation;
  const emp = item.bestCandidate.employee;
  const shouldNotify = document.getElementById('smart-notify-whatsapp')?.checked;

  try {
    await assignEmployeeToReservation(r.id, emp, item.duration);
    if (shouldNotify) {
      await sendWhatsAppNotificationToEmployee(r, emp);
    }
    toast('Assignation validée pour ' + emp.full_name, 'success');
    await loadAssignments();
    openSmartAssignModal(); // refresh smart modal
  } catch(err) {
    console.error(err);
    toast('Erreur: ' + (err.message || err), 'error');
  }
};

window.applyAllSmartAssignments = async function() {
  if (!currentSmartRecommendations.length) return;
  const valid = currentSmartRecommendations.filter(item => item.bestCandidate);
  if (!valid.length) {
    toast('Aucune recommandation valide à appliquer', 'warning');
    return;
  }

  const shouldNotify = document.getElementById('smart-notify-whatsapp')?.checked;
  const btn = document.getElementById('btn-apply-all-smart');
  btn.disabled = true;
  btn.textContent = 'Application en cours...';

  let successCount = 0;
  for (const item of valid) {
    try {
      await assignEmployeeToReservation(item.reservation.id, item.bestCandidate.employee, item.duration);
      if (shouldNotify) {
        await sendWhatsAppNotificationToEmployee(item.reservation, item.bestCandidate.employee);
      }
      successCount++;
    } catch(err) {
      console.error('Error assigning reservation:', item.reservation.id, err);
    }
  }

  btn.disabled = false;
  btn.textContent = 'Appliquer toutes les assignations IA';
  closeSmartAssignModal();
  await loadAssignments();
  toast(successCount + ' réservations assignées intelligemment !', 'success');
};

async function assignEmployeeToReservation(resId, employee, durationMinutes) {
  const { error: updErr } = await sb().from('reservations').update({
    duration_minutes: Number(durationMinutes) || 60,
    required_employees: 1,
    assigned_employee_id: employee.id,
    assigned_employee_name: employee.full_name,
    assigned_at: new Date().toISOString()
  }).eq('id', resId);
  if (updErr) throw updErr;

  await sb().from('reservation_employees').delete().eq('reservation_id', resId);
  await sb().from('reservation_employees').insert([{
    reservation_id: resId,
    employee_id: employee.id,
    employee_name: employee.full_name,
    is_primary: true
  }]);

  await sb().from('staff_notifications').insert({
    employee_id: employee.id,
    type: 'assignment',
    title: "Nouveau soin assigné par l'IA",
    body: 'Soin attribué le ' + new Date().toISOString().split('T')[0] + ' à ' + employee.full_name,
    data: { reservation_id: resId },
    read: false
  });
}

// ============================================
// NOTIFICATIONS WHATSAPP STAFF (LIGNE 3)
// ============================================

function buildEmployeeWhatsAppMessage(r, emp) {
  const duration = Number(r.duration_minutes) || 60;
  const endTime = calculateEndTime(r.time, duration);

  const now = new Date();
  const [y, m, d] = (r.date || todayStr()).split('-').map(Number);
  const [h, min] = (r.time || '10:00').split(':').map(Number);
  const apptDate = new Date(y, m - 1, d, h, min, 0);
  const diffMs = apptDate.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  let countdownStr = '';
  if (diffMin > 0) {
    if (diffMin <= 60) countdownStr = 'Commence dans ' + diffMin + ' minutes';
    else {
      const hours = Math.floor(diffMin / 60);
      const rem = diffMin % 60;
      countdownStr = 'Commence dans ' + hours + 'h ' + (rem > 0 ? rem + 'm' : '');
    }
  } else if (diffMin <= 0 && diffMin >= -duration) {
    countdownStr = 'EN COURS ACTUELLEMENT';
  } else {
    countdownStr = 'Rendez-vous passé';
  }

  const meta = parseReservationVideoMeta(r);
  const isVideoMsg = isMediaStaffMember(emp) && (
    meta.cadreur_id === emp.id ||
    (meta.cadreur_name && meta.cadreur_name.toLowerCase() === (emp.full_name || '').toLowerCase()) ||
    !isCarePractitionerMember(emp)
  );

  if (isVideoMsg) {
    const isPrivate = (r.video_consent === 'private' || r.video_consent === 'oui_prive' || meta.consent === 'private');
    return (
      '*DALIGHT & CVISUAL — TOURNAGE VIDÉO 4K ASSIGNÉ*\n\n' +
      'Bonjour *' + emp.full_name + '*,\n' +
      'Une captation vidéo 4K vous a été attribuée sur votre planning :\n\n' +
      '*Client(e) :* ' + (r.user_name || 'Client') + '\n' +
      (r.phone ? ('*Téléphone :* ' + r.phone + '\n') : '') +
      '*Prestation filmée :* ' + (r.service || 'Head Spa / Massage') + '\n' +
      '*Praticien(ne) du soin :* ' + (r.assigned_employee_name || 'Équipe Soins') + '\n' +
      '*Date :* ' + fmtDate(r.date) + '\n' +
      '*Horaire :* ' + fmtTime(r.time) + ' → ' + endTime + ' (' + duration + ' min)\n' +
      '*Compte à rebours :* ' + countdownStr + '\n' +
      '*Type d\'usage :* ' + (isPrivate ? 'Usage Privé (Floutage client)' : 'DALIGHT & CVISUAL (Public)') + '\n' +
      (r.notes ? ('*Notes :* ' + r.notes.replace(/\[VIDEO_META:[^\]]+\]/g, '').trim() + '\n') : '') +
      '*Lieu :* Sanctuaire DALIGHT, Delmas 65 #10\n\n' +
      '*Accéder à votre espace cadrage & upload 4K :*\n' +
      getPortalBaseUrl() + '\n\n' +
      '_Préparez votre matériel et stabilisateurs 10 min avant le début du tournage._'
    );
  }

  return (
    '*DALIGHT — NOUVEAU SOIN ASSIGNÉ*\n\n' +
    'Bonjour *' + emp.full_name + '*,\n' +
    'Un nouveau rendez-vous vous a été attribué sur votre planning :\n\n' +
    '*Client :* ' + (r.user_name || 'Client') + '\n' +
    (r.phone ? ('*Téléphone :* ' + r.phone + '\n') : '') +
    '*Soin / Service :* ' + (r.service || 'Head Spa Japonais') + '\n' +
    '*Date :* ' + fmtDate(r.date) + '\n' +
    '*Début :* ' + fmtTime(r.time) + ' | *Fin estimée :* ' + endTime + ' (' + duration + ' min)\n' +
    '*Compte à rebours :* ' + countdownStr + '\n' +
    (r.notes ? ('*Notes / Préférences :* ' + r.notes.replace(/\[VIDEO_META:[^\]]+\]/g, '').trim() + '\n') : '') +
    '*Lieu :* Sanctuaire DALIGHT, Delmas 65 #10\n\n' +
    '*Accéder à votre espace employé :*\n' +
    getPortalBaseUrl() + '\n\n' +
    '_Merci de vous préparer 10 min avant le début du soin pour accueillir votre client(e) dans les meilleures conditions._'
  );
}

async function sendWhatsAppNotificationToEmployee(reservation, employee) {
  if (!employee.phone) return { ok: false, error: 'Numéro de téléphone non renseigné' };

  let rawPhone = String(employee.phone).replace(/\D/g, '');
  if (rawPhone.length === 8) rawPhone = '509' + rawPhone;

  const msgText = buildEmployeeWhatsAppMessage(reservation, employee);

  try {
    const res = await fetch('https://cvisual-whatsapp-gateway-e79p.onrender.com/api/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_index: 3,
        to: rawPhone,
        message: msgText,
        mode: 'sync',
        kind: 'manual_direct'
      })
    });
    return { ok: true, status: res.status };
  } catch(err) {
    console.warn('WhatsApp gateway send failed, fallback available:', err);
    return { ok: false, error: err.message };
  }
}

window.openWhatsAppNotifyModal = function(resId, empId) {
  const r = assignReservations.find(x => x.id === resId);
  const emp = allEmployees.find(x => x.id === empId);
  if (!r || !emp) return;

  const modal = document.getElementById('whatsapp-notify-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  document.getElementById('wa-notify-emp-name').textContent = emp.full_name;
  document.getElementById('wa-notify-emp-phone').textContent = emp.phone || 'Non renseigné';
  document.getElementById('wa-notify-res-id').value = resId;
  document.getElementById('wa-notify-emp-id').value = empId;
  document.getElementById('wa-notify-message').value = buildEmployeeWhatsAppMessage(r, emp);
};

window.closeWhatsAppNotifyModal = function() {
  const modal = document.getElementById('whatsapp-notify-modal');
  if (modal) modal.style.display = 'none';
};

window.dispatchDirectWhatsAppNotification = async function() {
  const resId = document.getElementById('wa-notify-res-id').value;
  const empId = document.getElementById('wa-notify-emp-id').value;
  const customMessage = document.getElementById('wa-notify-message').value;

  const r = assignReservations.find(x => x.id === resId);
  const emp = allEmployees.find(x => x.id === empId);
  if (!r || !emp) return;

  const btn = document.getElementById('btn-send-wa-direct');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours...';

  let rawPhone = String(emp.phone || '').replace(/\D/g, '');
  if (rawPhone.length === 8) rawPhone = '509' + rawPhone;

  try {
    const res = await fetch('https://cvisual-whatsapp-gateway-e79p.onrender.com/api/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_index: 3,
        to: rawPhone,
        message: customMessage,
        mode: 'sync',
        kind: 'manual_direct'
      })
    });

    closeWhatsAppNotifyModal();
    toast('Message WhatsApp envoyé avec succès à ' + emp.full_name, 'success');
  } catch(err) {
    console.error('Direct WhatsApp send failed:', err);
    toast('Passerelle en attente, ouverture de WhatsApp Web...', 'warning');
    openInWhatsAppWeb();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Envoyer via Passerelle DALIGHT';
  }
};

window.openInWhatsAppWeb = function() {
  const empId = document.getElementById('wa-notify-emp-id').value;
  const emp = allEmployees.find(x => x.id === empId);
  const msg = document.getElementById('wa-notify-message').value;

  let rawPhone = String(emp?.phone || '').replace(/\D/g, '');
  if (rawPhone.length === 8) rawPhone = '509' + rawPhone;

  const waUrl = 'https://wa.me/' + rawPhone + '?text=' + encodeURIComponent(msg);
  window.open(waUrl, '_blank');
};

window.sendWhatsAppScheduleSummaryToAll = async function() {
  const today = todayStr();
  const todayRes = assignReservations.filter(r => r.date === today && r.assigned_employee_id);
  if (!todayRes.length) {
    toast('Aucun employé assigné pour la journée du ' + today, 'info');
    return;
  }

  if (!confirm('Envoyer à chaque employé son récapitulatif WhatsApp pour aujourd\'hui (' + todayRes.length + ' RDV) ?')) return;

  toast('Envoi des récapitulatifs en cours...', 'info');
  let sent = 0;

  for (const r of todayRes) {
    const emp = allEmployees.find(e => e.id === r.assigned_employee_id);
    if (emp && emp.phone) {
      await sendWhatsAppNotificationToEmployee(r, emp);
      sent++;
    }
  }

  toast(sent + ' rappels WhatsApp envoyés !', 'success');
};

// ============================================
// ÉQUIPE & ACCÈS
// ============================================
window.renderTeam = function () {
  const tbody = document.getElementById('team-table');
  const search = (document.getElementById('team-search')?.value || '').toLowerCase();
  let list = allEmployees;
  if (search) list = list.filter(e => (e.full_name || '').toLowerCase().includes(search) || (e.position || '').toLowerCase().includes(search));

  if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Aucun employé.</td></tr>'; return; }

  tbody.innerHTML = list.map(e => {
    const roles = normalizeRoles(e);
    const rolePills = roles.map(r => '<span class="role-pill">' + esc(ROLE_LABELS[r] || r) + '</span>').join('') || '<span class="text-muted" style="font-size:.8rem;">—</span>';
    const portalStatus = e.portal_enabled && e.username
      ? '<span class="badge badge-success">Activé</span>'
      : '<span class="badge badge-secondary">Désactivé</span>';
    const link = e.username ? getPortalBaseUrl() : '';

    const sched = getEmployeeSchedule(e);
    const daysOffList = (sched.days_off || ['dimanche']).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');

    return '<tr>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:.5rem;">' +
          '<div class="staff-avatar">' + (e.photo_url ? '<img src="' + esc(e.photo_url) + '">' : getInitials(e.full_name)) + '</div>' +
          '<div>' +
            '<div style="font-weight:600;">' + esc(e.full_name) + '</div>' +
            '<div class="text-muted" style="font-size:.75rem;">' + esc(e.position || '') + ' • Repos: ' + daysOffList + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' + rolePills + '</td>' +
      '<td>' + portalStatus + '</td>' +
      '<td>' + (e.username ? '<strong style="letter-spacing:1px;">' + esc(e.username) + '</strong>' : '—') + '</td>' +
      '<td>' + (link ? '<button class="btn btn-secondary btn-sm" onclick="copyLink(\'' + link + '\')">Copier le lien</button>' : '<span class="text-muted" style="font-size:.8rem;">—</span>') + '</td>' +
    '</tr>';
  }).join('');
};

window.copyLink = function (link) {
  navigator.clipboard.writeText(link).then(() => toast('Lien copié', 'success'), () => toast('Impossible de copier', 'error'));
};

// ============================================
// SESSIONS DE SERVICE
// ============================================
async function loadSessions() {
  const date = document.getElementById('sessions-date').value || todayStr();
  const tbody = document.getElementById('sessions-table');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Chargement...</td></tr>';

  const { data, error } = await sb().from('service_sessions')
    .select('*, presence_employees(full_name, photo_url)')
    .gte('started_at', date + 'T00:00:00').lte('started_at', date + 'T23:59:59')
    .order('started_at', { ascending: false });
  if (error) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Erreur: ' + esc(error.message) + '</td></tr>'; return; }

  sessionsData = data || [];
  if (!sessionsData.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Aucune session ce jour.</td></tr>'; return; }

  tbody.innerHTML = sessionsData.map(s => {
    const emp = s.presence_employees || {};
    const statusMap = { in_progress: '<span class="badge badge-warning"><span class="live-dot"></span> En cours</span>', completed: '<span class="badge badge-success">Terminé</span>', cancelled: '<span class="badge badge-secondary">Annulé</span>' };
    return '<tr>' +
      '<td><div style="display:flex;align-items:center;gap:.5rem;"><div class="staff-avatar">' + (emp.photo_url ? '<img src="' + esc(emp.photo_url) + '">' : getInitials(emp.full_name)) + '</div>' + esc(emp.full_name || '—') + '</div></td>' +
      '<td>' + esc(s.service_name) + '</td>' +
      '<td>' + esc(s.client_name || '—') + '</td>' +
      '<td>' + new Date(s.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</td>' +
      '<td>' + fmtDuration(s.duration_seconds) + '</td>' +
      '<td>' + (statusMap[s.status] || esc(s.status)) + '</td>' +
    '</tr>';
  }).join('');
}
function fmtDuration(secs) {
  if (secs == null) return '—';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return (h ? h + 'h' : '') + String(m).padStart(2, '0') + 'm';
}

// ============================================
// RAPPORTS
// ============================================
async function loadReports() {
  const box = document.getElementById('reports-list');
  box.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Chargement...</div>';
  const { data, error } = await sb().from('staff_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { box.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Erreur: ' + esc(error.message) + '</div>'; return; }
  reportsData = data || [];
  renderReports();
}
window.renderReports = function () {
  const box = document.getElementById('reports-list');
  const search = (document.getElementById('reports-search')?.value || '').toLowerCase();
  let list = reportsData;
  if (search) list = list.filter(r => (r.employee_name || '').toLowerCase().includes(search) || (r.title || '').toLowerCase().includes(search) || (r.content || '').toLowerCase().includes(search));
  if (!list.length) { box.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Aucun rapport.</div>'; return; }
  box.innerHTML = list.map(r => {
    const metrics = r.metrics && typeof r.metrics === 'object' ? r.metrics : {};
    const mstr = Object.entries(metrics).map(([k, v]) => k + ': ' + v).join(' · ');
    return '<div style="border:1px solid var(--admin-border);border-radius:12px;padding:1rem;margin-bottom:.75rem;">' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">' +
        '<div><strong>' + esc(r.title) + '</strong> <span class="badge badge-secondary">' + esc(r.report_type) + '</span></div>' +
        '<div class="text-muted" style="font-size:.8rem;">' + esc(r.employee_name) + ' · ' + new Date(r.created_at).toLocaleString('fr-FR') + '</div>' +
      '</div>' +
      (r.content ? '<div style="font-size:.88rem;line-height:1.5;margin-top:.4rem;">' + esc(r.content) + '</div>' : '') +
      (mstr ? '<div class="text-muted" style="font-size:.8rem;margin-top:.3rem;display:flex;align-items:center;gap:0.35rem;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> <span>' + esc(mstr) + '</span></div>' : '') +
      '<div style="margin-top:.6rem;display:flex;gap:.4rem;">' +
        '<input type="text" class="form-input" id="mfb-' + r.id + '" placeholder="Retour à l\'employé..." value="' + esc(r.admin_feedback || '') + '" style="font-size:.82rem;">' +
        '<button class="btn btn-secondary btn-sm" onclick="saveReportFeedback(\'' + r.id + '\')">Envoyer</button>' +
      '</div>' +
    '</div>';
  }).join('');
};
window.saveReportFeedback = async function (id) {
  const fb = document.getElementById('mfb-' + id).value.trim();
  try {
    const { error } = await sb().from('staff_reports').update({ admin_feedback: fb || null, status: 'reviewed' }).eq('id', id);
    if (error) throw error;
    toast('Retour enregistré', 'success');
  } catch (err) { toast('Erreur: ' + (err?.message || err), 'error'); }
};

// ============================================
// ÉVALUATIONS
// ============================================
async function loadEvals() {
  const box = document.getElementById('evals-list');
  box.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Chargement...</div>';
  const { data, error } = await sb().from('staff_evaluations').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { box.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Erreur: ' + esc(error.message) + '</div>'; return; }
  evalsData = data || [];
  renderEvals();
}
window.renderEvals = function () {
  const box = document.getElementById('evals-list');
  const search = (document.getElementById('evals-search')?.value || '').toLowerCase();
  let list = evalsData;
  if (search) list = list.filter(e => (e.employee_name || '').toLowerCase().includes(search) || (e.evaluator || '').toLowerCase().includes(search));
  if (!list.length) { box.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Aucune évaluation.</div>'; return; }
  box.innerHTML = list.map(ev => {
    const ratings = ev.ratings && typeof ev.ratings === 'object' ? ev.ratings : {};
    const rstr = Object.entries(ratings).map(([k, v]) => k + ': ' + v + '/5').join(' · ');
    return '<div style="border:1px solid var(--admin-border);border-radius:12px;padding:1rem;margin-bottom:.75rem;">' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">' +
        '<div><strong>' + esc(ev.employee_name) + '</strong> <span class="badge badge-success">' + (ev.overall_score ?? '—') + '/5</span></div>' +
        '<div class="text-muted" style="font-size:.8rem;">' + esc(ev.period || '') + ' · par ' + esc(ev.evaluator) + ' · ' + new Date(ev.created_at).toLocaleDateString('fr-FR') + '</div>' +
      '</div>' +
      (rstr ? '<div style="font-size:.85rem;margin-top:.3rem;">' + esc(rstr) + '</div>' : '') +
      (ev.strengths ? '<div style="font-size:.85rem;margin-top:.2rem;"><strong>Forts:</strong> ' + esc(ev.strengths) + '</div>' : '') +
      (ev.improvements ? '<div style="font-size:.85rem;"><strong>À améliorer:</strong> ' + esc(ev.improvements) + '</div>' : '') +
      (ev.comments ? '<div style="font-size:.85rem;color:var(--admin-text-muted);margin-top:.2rem;">' + esc(ev.comments) + '</div>' : '') +
    '</div>';
  }).join('');
};
