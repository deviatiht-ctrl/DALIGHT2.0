// ============================================
// DALIGHT — Suivi clients (pòtal anplwaye)
// Sesyon suivi, mezi pèsonalize, evolisyon, rapò email reyèl, rapèl relance
// Depann de staff-portal.js: window.staffSb, window.getCurrentEmployee(),
// window.staffToast, window.staffEsc, window.staffFmtDate
// ============================================
(function () {
  const sb = window.staffSb;
  function esc(s) { return window.staffEsc ? window.staffEsc(s) : (s == null ? '' : String(s)); }
  function toast(msg, type) { if (window.staffToast) window.staffToast(msg, type); }
  function fmtDate(d) { return window.staffFmtDate ? window.staffFmtDate(d) : (d || '—'); }
  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function getMeas(s, key) { return s && s.measurements ? (s.measurements[key] || null) : null; }

  let ctView = 'list';           // 'list' | 'new' | 'detail'
  let ctPrograms = [];
  let ctAvailableReservations = [];
  let ctSelected = null;
  let ctSessions = [];
  let ctReminders = [];
  let ctChart = null;
  let ctEditingSessionId = null;

  async function renderClientTracking(container) {
    const emp = window.getCurrentEmployee();
    if (!emp) { container.innerHTML = '<div class="empty">Session expirée.</div>'; return; }

    const [progRes, apptRes] = await Promise.all([
      sb.from('client_programs').select('*').eq('assigned_employee_id', emp.id).order('updated_at', { ascending: false }),
      sb.from('reservations').select('*').eq('assigned_employee_id', emp.id).neq('status', 'CANCELLED').order('date', { ascending: false }),
    ]);
    ctPrograms = progRes.data || [];
    const usedResIds = new Set(ctPrograms.map(p => p.reservation_id).filter(Boolean));
    ctAvailableReservations = (apptRes.data || []).filter(r => !usedResIds.has(r.id));

    if (ctView === 'detail' && ctSelected) {
      await loadDetail(ctSelected.id);
      renderDetail(container);
      return;
    }
    renderList(container);
  }

  function renderStats() {
    const active = ctPrograms.filter(p => p.status === 'active').length;
    const completed = ctPrograms.filter(p => p.status === 'completed').length;
    const todayCount = ctSessions.filter(s => s.session_date === todayStr()).length;
    return `<div class="grid cards-4" style="margin-bottom:1.2rem;">
      <div class="card stat-card"><div class="stat-icon" style="background:rgba(59,130,246,.14);color:#3b82f6;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div><div><div class="stat-value">${active}</div><div class="stat-label">Programmes actifs</div></div></div>
      <div class="card stat-card"><div class="stat-icon" style="background:rgba(34,197,94,.14);color:#22c55e;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><div class="stat-value">${completed}</div><div class="stat-label">Terminés</div></div></div>
      <div class="card stat-card"><div class="stat-icon" style="background:rgba(201,162,39,.14);color:#c9a227;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><div class="stat-value">${todayCount}</div><div class="stat-label">Séances aujourd'hui</div></div></div>
      <div class="card stat-card"><div class="stat-icon" style="background:rgba(139,92,246,.14);color:#8b5cf6;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div><div><div class="stat-value">${ctPrograms.length}</div><div class="stat-label">Total clients</div></div></div>
    </div>`;
  }

  function renderList(c) {
    c.innerHTML = `
      ${renderStats()}
      <div class="card" style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:1.2rem;">
        <input type="text" class="input" id="ct-search" placeholder="Rechercher un client..." style="max-width:280px;" oninput="window.__ctFilter(this.value)">
        <button class="btn btn-gold btn-sm" style="width:auto;margin:0;" onclick="window.__ctShowNew()">+ Nouveau suivi</button>
        <span style="color:var(--admin-text-muted,var(--muted));font-size:.85rem;">${ctPrograms.length} programme(s)</span>
      </div>
      <div id="ct-new-panel" style="display:none;" class="card">
        <div class="card-title">Démarrer un suivi depuis un rendez-vous</div>
        <div id="ct-appt-list"></div>
      </div>
      <div id="ct-list-panel">${renderProgramCards(ctPrograms)}</div>
    `;
    // build appt list separately (template literal can't call helper inline cleanly)
    const apptListEl = c.querySelector('#ct-appt-list');
    if (apptListEl) {
      apptListEl.innerHTML = ctAvailableReservations.length
        ? ctAvailableReservations.map(apptRow).join('')
        : '<div class="empty">Aucun rendez-vous disponible pour démarrer un suivi.</div>';
    }
    window.__ctFilter = (q) => {
      q = (q || '').toLowerCase().trim();
      const filtered = !q ? ctPrograms : ctPrograms.filter(p =>
        (p.client_name || '').toLowerCase().includes(q) || (p.client_email || '').toLowerCase().includes(q) || (p.service_name || '').toLowerCase().includes(q));
      document.getElementById('ct-list-panel').innerHTML = renderProgramCards(filtered);
    };
    window.__ctShowNew = () => {
      const panel = document.getElementById('ct-new-panel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };
  }

  function apptRow(r) {
    return `<div class="list-item">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;">${esc(r.user_name || 'Client')}</div>
        <div style="color:var(--admin-text-muted,var(--muted));font-size:.85rem;">${esc(r.service || '')} · ${fmtDate(r.date)}</div>
      </div>
      <input type="number" min="1" max="50" value="4" class="input" id="ct-sess-${r.id}" style="width:70px;padding:.5rem;">
      <button class="btn btn-green btn-sm" onclick="window.__ctCreateProgram('${r.id}')">Démarrer</button>
    </div>`;
  }

  function renderProgramCards(list) {
    if (!list.length) return '<div class="empty">Aucun suivi client pour le moment.</div>';
    return list.map(p => {
      const st = p.status === 'active' ? 'badge-green' : (p.status === 'completed' ? 'badge-blue' : 'badge-muted');
      return `<div class="list-item" style="cursor:pointer;" onclick="window.__ctOpen('${p.id}')">
        <div class="avatar">${esc((p.client_name || 'C')[0] || 'C')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;">${esc(p.client_name)} <span class="badge ${st}" style="margin-left:.3rem;">${esc(p.status)}</span></div>
          <div style="color:var(--admin-text-muted,var(--muted));font-size:.85rem;">${esc(p.service_name)} · ${p.total_sessions} séance(s)</div>
        </div>
      </div>`;
    }).join('');
  }

  window.__ctCreateProgram = async function (reservationId) {
    const emp = window.getCurrentEmployee();
    const totalSessions = parseInt(document.getElementById('ct-sess-' + reservationId)?.value, 10) || 1;
    try {
      const { data, error } = await sb.rpc('create_program_from_reservation', {
        p_reservation_id: reservationId,
        p_total_sessions: totalSessions,
        p_employee_id: emp.id,
      });
      if (error) throw error;
      toast('Suivi démarré', 'success');
      ctSelected = { id: data };
      ctView = 'detail';
      window.showSection('clients');
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  };

  window.__ctOpen = async function (id) {
    ctSelected = { id };
    ctView = 'detail';
    window.showSection('clients');
  };

  window.__ctBackToList = function () {
    ctView = 'list';
    ctSelected = null;
    window.showSection('clients');
  };

  async function loadDetail(id) {
    const [pRes, sRes, rRes] = await Promise.all([
      sb.from('client_programs').select('*').eq('id', id).single(),
      sb.from('client_program_sessions').select('*').eq('program_id', id).order('session_number', { ascending: true }),
      sb.from('client_reminders').select('*').eq('program_id', id).order('remind_at', { ascending: true }),
    ]);
    ctSelected = pRes.data || ctSelected;
    ctSessions = sRes.data || [];
    ctReminders = rRes.data || [];
  }

  function renderDetail(c) {
    const p = ctSelected;
    if (!p || !p.id) { c.innerHTML = '<div class="empty">Programme introuvable.</div>'; return; }
    const completed = ctSessions.filter(s => s.completed).length;
    const remaining = Math.max(p.total_sessions - completed, 0);
    const nextNum = Math.min(completed + 1, p.total_sessions);
    const first = ctSessions[0], last = ctSessions[ctSessions.length - 1];
    const weightDiff = (first && last && first.weight_kg && last.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
    const progressPct = p.total_sessions > 0 ? Math.round((completed / p.total_sessions) * 100) : 0;
    ctEditingSessionId = null;

    c.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:1rem;" onclick="window.__ctBackToList()">&larr; Retour</button>
      <div class="card">
        <div class="card-title" style="flex-wrap:wrap;gap:.5rem;">
          ${esc(p.client_name)}
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" style="width:auto;margin:0;" onclick="window.__ctPrintReport()">🖨 Imprimer</button>
            <button class="btn btn-blue btn-sm" style="width:auto;margin:0;" onclick="window.__ctEmailReport()">✉ Envoyer le bilan</button>
            <button class="btn btn-gold btn-sm" style="width:auto;margin:0;" onclick="window.__ctToggleStatus()">${p.status === 'active' ? 'Terminer' : 'Réactiver'}</button>
          </div>
        </div>
        <div style="color:var(--admin-text-muted,var(--muted));font-size:.88rem;">${esc(p.service_name)} · ${esc(p.client_email)}</div>
        <div style="margin-top:.8rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
          <span style="font-size:.85rem;color:var(--admin-text-muted,var(--muted));">Total séances:</span>
          <input type="number" id="ct-total-sessions" value="${p.total_sessions}" min="1" max="100" style="width:70px;padding:.4rem;border-radius:6px;border:1px solid var(--admin-border,var(--border));background:var(--admin-input-bg,var(--surface-2));color:var(--admin-text,var(--text));">
          <button class="btn btn-ghost btn-sm" style="width:auto;margin:0;" onclick="window.__ctUpdateTotal()">💾 Mettre à jour</button>
        </div>
        <div style="height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;margin-top:.8rem;"><div style="height:100%;width:${progressPct}%;background:var(--admin-accent,#c9a227);border-radius:4px;transition:width .3s;"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:.4rem;font-size:.82rem;color:var(--admin-text-muted,var(--muted));">
          <span>${completed} / ${p.total_sessions} séances</span>
          <span>${remaining} restante(s)</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem;">
        <div class="card-title">Analyse de progression</div>
        <div id="ct-analysis-grid" style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin:1rem 0;"></div>
        <div class="chart-wrap"><canvas id="ct-chart"></canvas></div>
      </div>

      <div class="grid cards-2">
        <div class="card">
          <div class="card-title" id="ct-session-form-title">Ajouter la séance ${nextNum}</div>
          <input type="hidden" id="ct-edit-id" value="">
          <div class="form-group"><label>Date</label><input type="date" class="input" id="ct-s-date" value="${todayStr()}"></div>
          <div class="form-group"><label>Poids (kg)</label><input type="number" step="0.1" class="input" id="ct-s-weight" placeholder="ex: 72.5"></div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:.6rem;">
            <div class="form-group"><label>Ventre (cm)</label><input type="number" step="0.1" class="input" id="ct-s-waist"></div>
            <div class="form-group"><label>Hanches (cm)</label><input type="number" step="0.1" class="input" id="ct-s-hips"></div>
            <div class="form-group"><label>Cuisse (cm)</label><input type="number" step="0.1" class="input" id="ct-s-thigh"></div>
            <div class="form-group"><label>Bras (cm)</label><input type="number" step="0.1" class="input" id="ct-s-arm"></div>
            <div class="form-group"><label>N° de séance</label><input type="number" class="input" id="ct-s-number" value="${nextNum}" min="1" max="${p.total_sessions}"></div>
          </div>
          <div class="form-group">
            <label>Autres mesures (nom + valeur + unité — ex: contour ventre)</label>
            <div id="ct-custom-list" style="display:flex;flex-direction:column;gap:.5rem;"></div>
            <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.5rem;" onclick="window.__ctAddCustomRow()">+ Ajouter une mesure</button>
          </div>
          <div class="form-group"><label>Notes du soin</label><textarea class="textarea" id="ct-s-notes"></textarea></div>
          <div class="form-group"><label>Alimentation / régime suivi</label><textarea class="textarea" id="ct-s-diet"></textarea></div>
          <div class="form-group"><label>Observations générales</label><textarea class="textarea" id="ct-s-obs"></textarea></div>
          <div style="display:flex;gap:.5rem;">
            <button class="btn btn-gold" style="width:auto;margin:0;" onclick="window.__ctSaveSession()">💾 Enregistrer</button>
            <button class="btn btn-ghost" style="width:auto;margin:0;" onclick="window.__ctClearForm()">Nouvelle saisie</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Rappel / relance client</div>
          <div class="grid" style="grid-template-columns:1fr auto;gap:.6rem;align-items:end;">
            <div class="form-group" style="margin:0;"><label>Date du rappel</label><input type="date" class="input" id="ct-rem-date"></div>
            <button class="btn btn-blue" style="margin:0;width:auto;" onclick="window.__ctAddReminder()">Planifier</button>
          </div>
          <div class="form-group" style="margin-top:.6rem;"><label>Message (optionnel)</label><input type="text" class="input" id="ct-rem-note" placeholder="Ex: Demander si elle veut reprendre le soin"></div>
          <div id="ct-reminders-list" style="margin-top:1rem;">${ctReminders.length ? ctReminders.map(reminderRow).join('') : '<div class="empty">Aucun rappel planifié.</div>'}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Historique des séances</div>
        ${ctSessions.length ? ctSessions.map(sessionRow).join('') : '<div class="empty">Aucune séance enregistrée.</div>'}
      </div>
    `;
    renderCustomRows([]);
    renderAnalysis();
    drawChart();
  }

  function renderAnalysis() {
    const grid = document.getElementById('ct-analysis-grid');
    if (!grid) return;
    if (ctSessions.length < 1) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:1rem;">Aucune séance enregistrée.</div>';
      return;
    }
    const first = ctSessions[0];
    const last = ctSessions[ctSessions.length - 1];
    const wDiff = (first.weight_kg && last.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
    const waDiff = (getMeas(first, 'waist') && getMeas(last, 'waist')) ? (getMeas(last, 'waist') - getMeas(first, 'waist')).toFixed(1) : null;
    const thDiff = (getMeas(first, 'thigh') && getMeas(last, 'thigh')) ? (getMeas(last, 'thigh') - getMeas(first, 'thigh')).toFixed(1) : null;
    const items = [
      { label: 'Poids début', value: first.weight_kg ? first.weight_kg + ' kg' : '—' },
      { label: 'Poids actuel', value: last.weight_kg ? last.weight_kg + ' kg' : '—' },
      { label: 'Variation poids', value: wDiff !== null ? (wDiff > 0 ? '+' : '') + wDiff + ' kg' : '—', color: wDiff < 0 ? '#22c55e' : (wDiff > 0 ? '#ef4444' : '') },
      { label: 'Variation ventre', value: waDiff !== null ? (waDiff > 0 ? '+' : '') + waDiff + ' cm' : '—' },
      { label: 'Variation cuisse', value: thDiff !== null ? (thDiff > 0 ? '+' : '') + thDiff + ' cm' : '—' },
      { label: 'Séances complétées', value: ctSessions.filter(s => s.completed).length + ' / ' + ctSelected.total_sessions },
    ];
    grid.innerHTML = items.map(it => `
      <div style="text-align:center;padding:1rem;border-radius:10px;background:rgba(255,255,255,.04);">
        <div style="font-size:1.4rem;font-weight:700;color:${it.color || 'var(--admin-accent,#c9a227)'};">${it.value}</div>
        <div style="font-size:.78rem;color:var(--admin-text-muted,var(--muted));text-transform:uppercase;">${it.label}</div>
      </div>`).join('');
  }

  function sessionRow(s) {
    const m = s.measurements || {};
    const chips = [];
    if (s.weight_kg) chips.push(`Poids: ${s.weight_kg} kg`);
    if (m.waist) chips.push(`Ventre: ${m.waist} cm`);
    if (m.hips) chips.push(`Hanches: ${m.hips} cm`);
    if (m.thigh) chips.push(`Cuisse: ${m.thigh} cm`);
    if (m.arm) chips.push(`Bras: ${m.arm} cm`);
    (m.custom || []).forEach(x => { if (x && x.value != null) chips.push(`${x.label}: ${x.value}${x.unit ? ' ' + x.unit : ''}`); });
    return `<div class="list-item" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;align-items:center;"><strong>Séance #${s.session_number}</strong><span style="color:var(--admin-text-muted,var(--muted));font-size:.82rem;">${fmtDate(s.session_date)}</span></div>
      ${chips.length ? `<div style="margin-top:.4rem;font-size:.85rem;color:var(--admin-text-muted,var(--muted));">${chips.join(' · ')}</div>` : ''}
      ${s.massage_notes ? `<div style="margin-top:.3rem;font-size:.85rem;"><strong>Soin:</strong> ${esc(s.massage_notes)}</div>` : ''}
      ${s.diet_notes ? `<div style="font-size:.85rem;"><strong>Alimentation:</strong> ${esc(s.diet_notes)}</div>` : ''}
      ${s.observations ? `<div style="font-size:.85rem;"><strong>Observations:</strong> ${esc(s.observations)}</div>` : ''}
      <div style="margin-top:.5rem;display:flex;gap:.5rem;">
        <button class="btn btn-ghost btn-sm" style="width:auto;margin:0;" onclick="window.__ctEditSession('${s.id}')">Modifier</button>
        <button class="btn btn-red btn-sm" style="width:auto;margin:0;" onclick="window.__ctDeleteSession('${s.id}')" title="Supprimer cette séance">❌</button>
      </div>
    </div>`;
  }

  function reminderRow(r) {
    const badge = r.status === 'sent' ? 'badge-blue' : (r.status === 'dismissed' ? 'badge-muted' : 'badge-gold');
    return `<div class="list-item">
      <div style="flex:1;min-width:0;">
        <div>${fmtDate(r.remind_at)} <span class="badge ${badge}" style="margin-left:.3rem;">${esc(r.status)}</span></div>
        ${r.note ? `<div style="font-size:.82rem;color:var(--admin-text-muted,var(--muted));">${esc(r.note)}</div>` : ''}
      </div>
      ${r.status === 'pending' ? `<button class="btn btn-green btn-sm" onclick="window.__ctSendReminder('${r.id}')">Envoyer maintenant</button>` : ''}
    </div>`;
  }

  window.__ctAddCustomRow = function (label, value, unit) {
    const list = document.getElementById('ct-custom-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'ct-custom-row';
    row.style = 'display:flex;gap:.5rem;';
    row.innerHTML = `
      <input type="text" class="input ct-c-label" placeholder="Nom (ex: contour ventre)" value="${esc(label || '')}" style="flex:1;">
      <input type="number" step="0.1" class="input ct-c-value" placeholder="Valeur" value="${value != null ? value : ''}" style="width:100px;">
      <input type="text" class="input ct-c-unit" placeholder="Unité (cm, kg...)" value="${esc(unit || 'cm')}" style="width:100px;">
      <button type="button" class="btn btn-red btn-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    list.appendChild(row);
  };

  function renderCustomRows(rows) {
    const list = document.getElementById('ct-custom-list');
    if (!list) return;
    list.innerHTML = '';
    (rows || []).forEach(r => window.__ctAddCustomRow(r.label, r.value, r.unit));
    if (!rows || !rows.length) window.__ctAddCustomRow();
  }

  function getCustomRows() {
    return Array.from(document.querySelectorAll('.ct-custom-row')).map(row => {
      const label = row.querySelector('.ct-c-label')?.value?.trim();
      const value = parseFloat(row.querySelector('.ct-c-value')?.value);
      const unit = row.querySelector('.ct-c-unit')?.value?.trim() || 'cm';
      return label ? { label, value: isNaN(value) ? null : value, unit } : null;
    }).filter(Boolean);
  }

  function drawChart() {
    const canvas = document.getElementById('ct-chart');
    if (!canvas || !window.Chart) return;
    if (ctChart) ctChart.destroy();
    if (ctSessions.length < 1) return;
    ctChart = new Chart(canvas, {
      type: 'line',
      data: { labels: ctSessions.map(s => '#' + s.session_number), datasets: [{ label: 'Poids (kg)', data: ctSessions.map(s => s.weight_kg || null), borderColor: '#c9a227', backgroundColor: 'rgba(201,162,39,.15)', fill: true, tension: .3 }] },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  window.__ctSaveSession = async function () {
    const editId = document.getElementById('ct-edit-id')?.value || null;
    const sessionNumber = parseInt(document.getElementById('ct-s-number')?.value || '1', 10) || 1;
    const measurements = {
      waist: parseFloat(document.getElementById('ct-s-waist').value) || null,
      hips: parseFloat(document.getElementById('ct-s-hips').value) || null,
      thigh: parseFloat(document.getElementById('ct-s-thigh').value) || null,
      arm: parseFloat(document.getElementById('ct-s-arm').value) || null,
      custom: getCustomRows(),
    };
    const payload = {
      program_id: ctSelected.id,
      session_number: sessionNumber,
      session_date: document.getElementById('ct-s-date').value || todayStr(),
      weight_kg: parseFloat(document.getElementById('ct-s-weight').value) || null,
      measurements,
      massage_notes: document.getElementById('ct-s-notes').value,
      diet_notes: document.getElementById('ct-s-diet').value,
      observations: document.getElementById('ct-s-obs').value,
      therapist_id: null,
      completed: true,
    };
    try {
      let error;
      if (editId) {
        const res = await sb.from('client_program_sessions').update(payload).eq('id', editId);
        error = res.error;
      } else {
        const res = await sb.from('client_program_sessions').upsert(payload, { onConflict: 'program_id,session_number' });
        error = res.error;
      }
      if (error) throw error;
      toast('Séance enregistrée', 'success');
      await loadDetail(ctSelected.id);
      const c = document.getElementById('section-content');
      renderDetail(c);
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  };

  window.__ctEditSession = function (id) {
    const s = ctSessions.find(x => x.id === id);
    if (!s) return;
    document.getElementById('ct-edit-id').value = s.id;
    document.getElementById('ct-s-date').value = s.session_date || todayStr();
    document.getElementById('ct-s-weight').value = s.weight_kg || '';
    document.getElementById('ct-s-notes').value = s.massage_notes || '';
    document.getElementById('ct-s-diet').value = s.diet_notes || '';
    document.getElementById('ct-s-obs').value = s.observations || '';
    document.getElementById('ct-s-number').value = s.session_number;
    const m = s.measurements || {};
    document.getElementById('ct-s-waist').value = m.waist || '';
    document.getElementById('ct-s-hips').value = m.hips || '';
    document.getElementById('ct-s-thigh').value = m.thigh || '';
    document.getElementById('ct-s-arm').value = m.arm || '';
    renderCustomRows(m.custom || []);
    const titleEl = document.getElementById('ct-session-form-title');
    if (titleEl) titleEl.textContent = 'Modifier la séance ' + s.session_number;
    document.getElementById('ct-s-date').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  window.__ctClearForm = function () {
    const completed = ctSessions.filter(s => s.completed).length;
    const nextNum = Math.min(completed + 1, ctSelected.total_sessions);
    document.getElementById('ct-edit-id').value = '';
    document.getElementById('ct-s-date').value = todayStr();
    document.getElementById('ct-s-weight').value = '';
    document.getElementById('ct-s-waist').value = '';
    document.getElementById('ct-s-hips').value = '';
    document.getElementById('ct-s-thigh').value = '';
    document.getElementById('ct-s-arm').value = '';
    document.getElementById('ct-s-notes').value = '';
    document.getElementById('ct-s-diet').value = '';
    document.getElementById('ct-s-obs').value = '';
    document.getElementById('ct-s-number').value = nextNum;
    renderCustomRows([]);
    const titleEl = document.getElementById('ct-session-form-title');
    if (titleEl) titleEl.textContent = 'Ajouter la séance ' + nextNum;
  };

  window.__ctDeleteSession = async function (id) {
    if (!confirm('Supprimer cette séance ?')) return;
    try {
      const { error } = await sb.from('client_program_sessions').delete().eq('id', id);
      if (error) throw error;
      toast('Séance supprimée', 'success');
      await loadDetail(ctSelected.id);
      const c = document.getElementById('section-content');
      renderDetail(c);
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  };

  window.__ctToggleStatus = async function () {
    if (!ctSelected) return;
    const newStatus = ctSelected.status === 'active' ? 'completed' : 'active';
    try {
      const { error } = await sb.from('client_programs').update({ status: newStatus }).eq('id', ctSelected.id);
      if (error) throw error;
      ctSelected.status = newStatus;
      const idx = ctPrograms.findIndex(p => p.id === ctSelected.id);
      if (idx >= 0) ctPrograms[idx].status = newStatus;
      toast('Statut mis à jour: ' + newStatus, 'success');
      const c = document.getElementById('section-content');
      renderDetail(c);
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  };

  window.__ctUpdateTotal = async function () {
    if (!ctSelected) return;
    const newTotal = parseInt(document.getElementById('ct-total-sessions')?.value, 10) || ctSelected.total_sessions;
    if (newTotal < 1) { toast('Le total doit être au moins 1', 'error'); return; }
    try {
      const { error } = await sb.from('client_programs').update({ total_sessions: newTotal }).eq('id', ctSelected.id);
      if (error) throw error;
      ctSelected.total_sessions = newTotal;
      const idx = ctPrograms.findIndex(p => p.id === ctSelected.id);
      if (idx >= 0) ctPrograms[idx].total_sessions = newTotal;
      toast('Total séances mis à jour', 'success');
      const c = document.getElementById('section-content');
      renderDetail(c);
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  };

  window.__ctPrintReport = function () {
    if (!ctSelected) return;
    const first = ctSessions[0];
    const last = ctSessions[ctSessions.length - 1];
    const wDiff = (first && last && first.weight_kg && last.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
    const rows = ctSessions.map(s => `<tr><td>#${s.session_number}</td><td>${fmtDate(s.session_date)}</td><td>${s.weight_kg || '—'}</td><td>${getMeas(s, 'waist') || '—'}</td><td>${getMeas(s, 'thigh') || '—'}</td><td>${esc(s.massage_notes || '—')}</td><td>${esc(s.diet_notes || '—')}</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<html><head><title>Rapport de suivi — ${esc(ctSelected.client_name)}</title><style>body{font-family:Arial,sans-serif;padding:2rem;}h2{text-align:center;}table{width:100%;border-collapse:collapse;margin-top:1rem;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background:#f3f3f3;}.info{margin-bottom:1rem;}</style></head><body>
      <h2>DALIGHT — Rapport de suivi</h2>
      <p style="text-align:center;color:#555;">${esc(ctSelected.service_name)}</p>
      <div class="info">
        <p><strong>Client:</strong> ${esc(ctSelected.client_name)}</p>
        <p><strong>Email:</strong> ${esc(ctSelected.client_email)}</p>
        <p><strong>Séances:</strong> ${ctSessions.length} / ${ctSelected.total_sessions}</p>
        ${wDiff !== null ? `<p><strong>Variation poids:</strong> ${wDiff > 0 ? '+' : ''}${wDiff} kg</p>` : ''}
      </div>
      <table border="1" cellpadding="8"><thead><tr><th>Séance</th><th>Date</th><th>Poids</th><th>Ventre</th><th>Cuisse</th><th>Soin</th><th>Alimentation</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:1.5rem;text-align:center;font-size:.85rem;color:#777;">Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    </body></html>`);
    w.document.close();
    setTimeout(function() { w.print(); }, 300);
  };

  window.__ctAddReminder = async function () {
    const emp = window.getCurrentEmployee();
    const remindAt = document.getElementById('ct-rem-date').value;
    const note = document.getElementById('ct-rem-note').value.trim();
    if (!remindAt) { toast('Choisissez une date', 'warning'); return; }
    const { error } = await sb.from('client_reminders').insert({
      employee_id: emp.id, program_id: ctSelected.id, reservation_id: ctSelected.reservation_id || null,
      client_name: ctSelected.client_name, client_email: ctSelected.client_email,
      service_name: ctSelected.service_name, note, remind_at: remindAt,
    });
    if (error) { toast('Erreur: ' + error.message, 'error'); return; }
    toast('Rappel planifié', 'success');
    window.showSection('clients');
  };

  window.__ctSendReminder = async function (reminderId) {
    const r = ctReminders.find(x => x.id === reminderId);
    if (!r) return;
    const subject = `${r.service_name || 'Votre soin'} — DALIGHT vous recontacte`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#b8941f;">Bonjour ${esc(r.client_name)},</h2>
        <p>Cela fait un moment depuis votre dernière visite pour <strong>${esc(r.service_name || 'votre soin')}</strong> chez DALIGHT.</p>
        <p>${r.note ? esc(r.note) : 'Souhaitez-vous reprendre un rendez-vous prochainement ?'}</p>
        <p>Répondez simplement à cet email ou appelez-nous pour réserver votre prochaine séance.</p>
        <p style="margin-top:2rem;color:#777;">— L'équipe DALIGHT</p>
      </div>`;
    try {
      const { error } = await sb.functions.invoke('send-email', { body: { to: r.client_email, subject, html, isAdmin: false } });
      if (error) throw error;
      await sb.from('client_reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', reminderId);
      toast('Email de relance envoyé', 'success');
      window.showSection('clients');
    } catch (err) {
      toast('Erreur envoi: ' + err.message, 'error');
    }
  };

  window.__ctEmailReport = async function () {
    const p = ctSelected;
    const completed = ctSessions.filter(s => s.completed).length;
    const first = ctSessions[0], last = ctSessions[ctSessions.length - 1];
    const weightDiff = (first && last && first.weight_kg && last.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
    const rows = ctSessions.map(s => `<tr><td style="padding:6px;border:1px solid #ddd;">#${s.session_number}</td><td style="padding:6px;border:1px solid #ddd;">${fmtDate(s.session_date)}</td><td style="padding:6px;border:1px solid #ddd;">${s.weight_kg || '—'}</td><td style="padding:6px;border:1px solid #ddd;">${(s.measurements && s.measurements.waist) || '—'}</td></tr>`).join('');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#b8941f;">Votre bilan de progression — DALIGHT</h2>
        <p>Bonjour ${esc(p.client_name)},</p>
        <p>Voici votre rapport de suivi pour <strong>${esc(p.service_name)}</strong> (${completed} / ${p.total_sessions} séances).</p>
        ${weightDiff !== null ? `<p><strong>Variation de poids:</strong> ${weightDiff > 0 ? '+' : ''}${weightDiff} kg</p>` : ''}
        <table style="border-collapse:collapse;width:100%;margin-top:1rem;">
          <thead><tr><th style="padding:6px;border:1px solid #ddd;background:#f7f7f7;">Séance</th><th style="padding:6px;border:1px solid #ddd;background:#f7f7f7;">Date</th><th style="padding:6px;border:1px solid #ddd;background:#f7f7f7;">Poids</th><th style="padding:6px;border:1px solid #ddd;background:#f7f7f7;">Ventre</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:1.5rem;">Merci de votre confiance.<br>L'équipe DALIGHT</p>
      </div>`;
    try {
      const { error } = await sb.functions.invoke('send-email', { body: { to: p.client_email, subject: 'Votre bilan de progression — DALIGHT', html, isAdmin: false } });
      if (error) throw error;
      toast('Bilan envoyé par email', 'success');
    } catch (err) {
      toast('Erreur envoi: ' + err.message, 'error');
    }
  };

  window.renderClientTracking = renderClientTracking;
})();
