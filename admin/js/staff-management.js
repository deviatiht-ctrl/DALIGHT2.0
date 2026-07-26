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
let assignModalState = null;

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
  // Pòtay anplwaye sou sit ki deplwaye a
  return 'https://dalightbeauty.com/staff.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(r => setTimeout(r, 100));
  const session = await window.adminCore?.checkAdminAuth?.();
  if (!session) return;

  const today = todayStr();
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
  const portals = allEmployees.filter(e => e.portal_enabled && e.username).length;
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
  const date = document.getElementById('assign-date').value;
  const tbody = document.getElementById('assign-table');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">Chargement...</td></tr>';

  let query = sb().from('reservations').select('*, reservation_employees(*)');
  if (date) {
    query = query.eq('date', date);
  } else {
    // upcoming reservations: today and future, not cancelled
    query = query.gte('date', todayStr()).order('date', { ascending: true });
  }
  const { data, error } = await query.order('time', { ascending: true });
  if (error) { tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">Erreur: ${esc(error.message)}</td></tr>`; return; }

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

  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">Aucun rendez-vous.</td></tr>'; return; }

  const statusBadge = s => ({ CONFIRMED: 'badge-success', PENDING: 'badge-warning', AWAITING_PAYMENT: 'badge-warning', COMPLETED: 'badge-secondary', NO_SHOW: 'badge-secondary' }[s] || 'badge-secondary');

  tbody.innerHTML = list.map(r => {
    const emps = (r.reservation_employees || []).length
      ? r.reservation_employees.map(e => esc(e.employee_name || e.employee_id)).join(', ')
      : (r.assigned_employee_name ? esc(r.assigned_employee_name) : '<span class="text-muted">Non assigné</span>');
    return `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td style="font-weight:600;">${fmtTime(r.time)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <div class="staff-avatar">${getInitials(r.user_name || 'C')}</div>
          <div><div style="font-weight:500;">${esc(r.user_name || 'Client')}</div>
          ${r.phone ? `<div class="text-muted" style="font-size:.75rem;">${esc(r.phone)}</div>` : ''}</div>
        </div>
      </td>
      <td>${esc(r.service || '—')}</td>
      <td>${esc(r.location || '—')}</td>
      <td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
          <span style="font-size:.85rem;">${emps}</span>
          ${r.duration_minutes ? `<span class="badge badge-secondary" style="font-size:.7rem;">${r.duration_minutes} min</span>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="openAssignModal('${r.id}')">${r.assigned_employee_id || (r.reservation_employees || []).length ? 'Modifier' : 'Assigner'}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

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
  const providers = allEmployees.filter(e => e.is_active && normalizeRoles(e).some(role => PROVIDER_ROLES.includes(role)));
  const empOptions = (sel = '') => `<option value="">— Choisir —</option>` + providers.map(e => `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${esc(e.full_name)}</option>`).join('');
  let body = '';
  if (step === 1) {
    body = `
      <div class="card-title" style="margin-bottom:1rem;">Assigner le rendez-vous</div>
      <div style="margin-bottom:1rem;font-size:.9rem;color:var(--admin-text-muted);">
        <strong>${esc(r.service)}</strong> · ${esc(r.user_name)} · ${fmtDate(r.date)} à ${fmtTime(r.time)}
      </div>
      <div class="form-group" style="margin-bottom:1rem;">
        <label>Nombre d'employés requis</label>
        <select id="am-required" class="form-input">${[1,2,3,4,5,6].map(n => `<option value="${n}" ${n == required_employees ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="margin-bottom:1.5rem;">
        <label>Durée du service (minutes)</label>
        <input type="number" id="am-duration" class="form-input" value="${duration_minutes === 0 ? 0 : (duration_minutes || '')}" placeholder="Ex: 60" min="5">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:.6rem;">
        <button class="btn btn-ghost" onclick="closeAssignModal()">Annuler</button>
        <button class="btn btn-primary" onclick="assignModalGoStep(2)">Suivant</button>
      </div>`;
  } else {
    const slots = Array.from({ length: required_employees }, (_, i) => i);
    body = `
      <div class="card-title" style="margin-bottom:1rem;">Sélectionner les employés</div>
      <div style="margin-bottom:1rem;font-size:.9rem;color:var(--admin-text-muted);">
        ${esc(r.service)} · ${required_employees} employé(s) · ${duration_minutes || '—'} min
      </div>
      ${slots.map(i => `
        <div class="form-group" style="margin-bottom:.75rem;">
          <label>Employé ${i + 1}${i === 0 ? ' (principal)' : ''}</label>
          <select id="am-emp-${i}" class="form-input">${empOptions(selections[i] || '')}</select>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem;">
        <button class="btn btn-ghost" onclick="assignModalGoStep(1)">Retour</button>
        <button class="btn btn-primary" onclick="saveAssignModal()">Enregistrer</button>
      </div>`;
  }
  overlay.innerHTML = `<div class="glass-card" style="max-width:420px;width:100%;margin:0;">${body}</div>`;
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
  const max = step === 2 ? assignModalState.required_employees : assignModalState.required_employees;
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
  if (new Set(empIds).size !== empIds.length) { toast('Chaque employé ne peut être sélectionné qu\'une fois.', 'warning'); return; }

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
          body: `Vous avez un rendez-vous le ${r.date} à ${fmtTime(r.time)} — ${r.user_name || 'Client'} (${r.service || 'Service'}).`,
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
    const portalStatus = e.portal_enabled && e.username
      ? '<span class="badge badge-success">Activé</span>'
      : '<span class="badge badge-secondary">Désactivé</span>';
    const link = e.username ? getPortalBaseUrl() : '';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <div class="staff-avatar">${e.photo_url ? `<img src="${esc(e.photo_url)}">` : getInitials(e.full_name)}</div>
          <div><div style="font-weight:500;">${esc(e.full_name)}</div><div class="text-muted" style="font-size:.75rem;">${esc(e.position || '')}</div></div>
        </div>
      </td>
      <td>${rolePills}</td>
      <td>${portalStatus}</td>
      <td>${e.username ? `<strong style="letter-spacing:1px;">${esc(e.username)}</strong>` : '—'}</td>
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
