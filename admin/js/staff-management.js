// ============================================
// DALIGHT - GESTION DU PERSONNEL (control center)
// Assignation RDV, équipe/accès, sessions, rapports, évaluations
// ============================================

const ROLE_LABELS = {
  estheticienne: 'Esthéticienne',
  masseuse: 'Masseur/Masseuse',
  coiffure: 'Coiffure',
  onglerie: 'Onglerie',
  community_manager: 'Community Manager',
  adm_manager: 'ADM / Manager',
  receptionniste: 'Réceptionniste',
  caissier: 'Caissier/Caisse',
  formateur: 'Formateur',
};
const PROVIDER_ROLES = ['estheticienne', 'masseuse', 'coiffure', 'onglerie'];

let allEmployees = [];
let assignReservations = [];
let sessionsData = [];
let reportsData = [];
let evalsData = [];

function sb() {
  return window.adminCore?.supabase || window.dalightAdminSupabase || window.supabaseClient;
}
function esc(s) { if (s == null) return ''; const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(s).replace(/[&<>"']/g, c => m[c]); }
function getInitials(name) { if (!name) return '?'; return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
function toast(msg, type = 'success') { if (window.showToast) window.showToast(msg, type); else if (window.adminCore?.showToast) window.adminCore.showToast(msg, type); else console.log(msg); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtTime(t) { return t ? String(t).slice(0, 5) : '—'; }
function normalizeRoles(e) { let r = e?.roles || []; if (typeof r === 'string') { try { r = JSON.parse(r); } catch { r = []; } } return Array.isArray(r) ? r : []; }

function getPortalBaseUrl() {
  const origin = window.location.origin;
  const path = window.location.pathname;
  const adminIdx = path.indexOf('/admin/');
  const base = adminIdx >= 0 ? path.slice(0, adminIdx) : '';
  return `${origin}${base}/staff.html`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(r => setTimeout(r, 100));
  const session = await window.adminCore?.checkAdminAuth?.();
  if (!session) return;

  const today = todayStr();
  document.getElementById('assign-date').value = today;
  document.getElementById('sessions-date').value = today;

  await loadEmployees();
  await loadAssignments();
  await loadStats();
});

window.switchTab = function (tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
  if (tab === 'assign') loadAssignments();
  if (tab === 'team') renderTeam();
  if (tab === 'sessions') loadSessions();
  if (tab === 'reports') loadReports();
  if (tab === 'evals') loadEvals();
};

// ---- Employees ----
async function loadEmployees() {
  const { data, error } = await sb().from('presence_employees').select('*').order('full_name', { ascending: true });
  if (error) { console.error(error); return; }
  allEmployees = data || [];

  // populate filter dropdown
  const sel = document.getElementById('assign-filter-emp');
  if (sel) {
    sel.innerHTML = '<option value="">Tous les employés</option>' +
      allEmployees.map(e => `<option value="${e.id}">${esc(e.full_name)}</option>`).join('');
  }
}

async function loadStats() {
  const active = allEmployees.filter(e => e.is_active).length;
  const portals = allEmployees.filter(e => e.portal_enabled && e.access_code).length;
  document.getElementById('stat-employees').textContent = active;
  document.getElementById('stat-portals').textContent = portals;

  const { data: sess } = await sb().from('service_sessions').select('id').eq('status', 'in_progress');
  document.getElementById('stat-active').textContent = (sess || []).length;

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: reps } = await sb().from('staff_reports').select('id').gte('created_at', weekAgo.toISOString());
  document.getElementById('stat-reports').textContent = (reps || []).length;
}

// ============================================
// ASSIGNATION RDV
// ============================================
async function loadAssignments() {
  const date = document.getElementById('assign-date').value || todayStr();
  const tbody = document.getElementById('assign-table');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Chargement...</td></tr>';

  const { data, error } = await sb().from('reservations')
    .select('*').eq('date', date).order('time', { ascending: true });
  if (error) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Erreur: ${esc(error.message)}</td></tr>`; return; }

  assignReservations = (data || []).filter(r => r.status !== 'CANCELLED');
  renderAssignments();
}

window.renderAssignments = function () {
  const tbody = document.getElementById('assign-table');
  const search = (document.getElementById('assign-search').value || '').toLowerCase();
  const filterEmp = document.getElementById('assign-filter-emp').value;

  let list = assignReservations;
  if (search) list = list.filter(r => (r.user_name || '').toLowerCase().includes(search) || (r.service || '').toLowerCase().includes(search));
  if (filterEmp) list = list.filter(r => r.assigned_employee_id === filterEmp);

  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Aucun rendez-vous.</td></tr>'; return; }

  // provider employees for the dropdown (fallback: all active)
  const providers = allEmployees.filter(e => e.is_active && (normalizeRoles(e).some(r => PROVIDER_ROLES.includes(r))));
  const dropdownEmps = providers.length ? providers : allEmployees.filter(e => e.is_active);

  const statusBadge = s => ({ CONFIRMED: 'badge-success', PENDING: 'badge-warning', AWAITING_PAYMENT: 'badge-warning', COMPLETED: 'badge-secondary', NO_SHOW: 'badge-secondary' }[s] || 'badge-secondary');

  tbody.innerHTML = list.map(r => `
    <tr>
      <td style="font-weight:600;">${fmtTime(r.time)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <div class="staff-avatar">${getInitials(r.user_name || 'C')}</div>
          <div><div style="font-weight:500;">${esc(r.user_name || 'Client')}</div>
          ${r.user_phone ? `<div class="text-muted" style="font-size:.75rem;">${esc(r.user_phone)}</div>` : ''}</div>
        </div>
      </td>
      <td>${esc(r.service || '—')}</td>
      <td>${esc(r.location || '—')}</td>
      <td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
      <td>
        <select class="form-input assign-select" onchange="assignReservation('${r.id}', this.value)">
          <option value="">— Non assigné —</option>
          ${dropdownEmps.map(e => `<option value="${e.id}" ${r.assigned_employee_id === e.id ? 'selected' : ''}>${esc(e.full_name)}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('');
};

window.assignReservation = async function (resId, empId) {
  const emp = allEmployees.find(e => e.id === empId);
  try {
    const { error } = await sb().from('reservations').update({
      assigned_employee_id: empId || null,
      assigned_employee_name: emp ? emp.full_name : null,
      assigned_at: empId ? new Date().toISOString() : null,
    }).eq('id', resId);
    if (error) throw error;
    const r = assignReservations.find(x => x.id === resId);
    if (r) { r.assigned_employee_id = empId || null; r.assigned_employee_name = emp ? emp.full_name : null; }
    toast(empId ? `Assigné à ${emp.full_name}` : 'Assignation retirée', 'success');
  } catch (err) {
    console.error(err);
    toast('Erreur: ' + (err?.message || err), 'error');
  }
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
    const rolePills = roles.map(r => `<span class="role-pill">${esc(ROLE_LABELS[r] || r)}</span>`).join('') || '<span class="text-muted" style="font-size:.8rem;">—</span>';
    const portalStatus = e.portal_enabled && e.access_code
      ? '<span class="badge badge-success">Activé</span>'
      : '<span class="badge badge-secondary">Désactivé</span>';
    const link = e.access_code ? `${getPortalBaseUrl()}?code=${e.access_code}` : '';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <div class="staff-avatar">${e.photo_url ? `<img src="${esc(e.photo_url)}">` : getInitials(e.full_name)}</div>
          <div><div style="font-weight:500;">${esc(e.full_name)}</div><div class="text-muted" style="font-size:.75rem;">${esc(e.position || '')}</div></div>
        </div>
      </td>
      <td>${rolePills}</td>
      <td>${portalStatus}</td>
      <td>${e.access_code ? `<strong style="letter-spacing:1px;">${esc(e.access_code)}</strong>` : '—'}</td>
      <td>${link ? `<button class="btn btn-secondary btn-sm" onclick="copyLink('${link}')">Copier le lien</button>` : '<span class="text-muted" style="font-size:.8rem;">—</span>'}</td>
    </tr>`;
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
  if (error) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Erreur: ${esc(error.message)}</td></tr>`; return; }

  sessionsData = data || [];
  if (!sessionsData.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Aucune session ce jour.</td></tr>'; return; }

  tbody.innerHTML = sessionsData.map(s => {
    const emp = s.presence_employees || {};
    const statusMap = { in_progress: '<span class="badge badge-warning"><span class="live-dot"></span> En cours</span>', completed: '<span class="badge badge-success">Terminé</span>', cancelled: '<span class="badge badge-secondary">Annulé</span>' };
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:.5rem;"><div class="staff-avatar">${emp.photo_url ? `<img src="${esc(emp.photo_url)}">` : getInitials(emp.full_name)}</div>${esc(emp.full_name || '—')}</div></td>
      <td>${esc(s.service_name)}</td>
      <td>${esc(s.client_name || '—')}</td>
      <td>${new Date(s.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${fmtDuration(s.duration_seconds)}</td>
      <td>${statusMap[s.status] || esc(s.status)}</td>
    </tr>`;
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
  if (error) { box.innerHTML = `<div class="text-center text-muted" style="padding:2rem;">Erreur: ${esc(error.message)}</div>`; return; }
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
    const mstr = Object.entries(metrics).map(([k, v]) => `${k}: ${v}`).join(' · ');
    return `<div style="border:1px solid var(--admin-border);border-radius:12px;padding:1rem;margin-bottom:.75rem;">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
        <div><strong>${esc(r.title)}</strong> <span class="badge badge-secondary">${esc(r.report_type)}</span></div>
        <div class="text-muted" style="font-size:.8rem;">${esc(r.employee_name)} · ${new Date(r.created_at).toLocaleString('fr-FR')}</div>
      </div>
      ${r.content ? `<div style="font-size:.88rem;line-height:1.5;margin-top:.4rem;">${esc(r.content)}</div>` : ''}
      ${mstr ? `<div class="text-muted" style="font-size:.8rem;margin-top:.3rem;">📊 ${esc(mstr)}</div>` : ''}
      <div style="margin-top:.6rem;display:flex;gap:.4rem;">
        <input type="text" class="form-input" id="mfb-${r.id}" placeholder="Retour à l'employé..." value="${esc(r.admin_feedback || '')}" style="font-size:.82rem;">
        <button class="btn btn-secondary btn-sm" onclick="saveReportFeedback('${r.id}')">Envoyer</button>
      </div>
    </div>`;
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
  if (error) { box.innerHTML = `<div class="text-center text-muted" style="padding:2rem;">Erreur: ${esc(error.message)}</div>`; return; }
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
    const rstr = Object.entries(ratings).map(([k, v]) => `${k}: ${v}/5`).join(' · ');
    return `<div style="border:1px solid var(--admin-border);border-radius:12px;padding:1rem;margin-bottom:.75rem;">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
        <div><strong>${esc(ev.employee_name)}</strong> <span class="badge badge-success">${ev.overall_score ?? '—'}/5</span></div>
        <div class="text-muted" style="font-size:.8rem;">${esc(ev.period || '')} · par ${esc(ev.evaluator)} · ${new Date(ev.created_at).toLocaleDateString('fr-FR')}</div>
      </div>
      ${rstr ? `<div style="font-size:.85rem;margin-top:.3rem;">${esc(rstr)}</div>` : ''}
      ${ev.strengths ? `<div style="font-size:.85rem;margin-top:.2rem;"><strong>Forts:</strong> ${esc(ev.strengths)}</div>` : ''}
      ${ev.improvements ? `<div style="font-size:.85rem;"><strong>À améliorer:</strong> ${esc(ev.improvements)}</div>` : ''}
      ${ev.comments ? `<div style="font-size:.85rem;color:var(--admin-text-muted);margin-top:.2rem;">${esc(ev.comments)}</div>` : ''}
    </div>`;
  }).join('');
};
