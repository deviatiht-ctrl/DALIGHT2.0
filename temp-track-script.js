
    const { supabase: sb } = window.adminCore || {};
    let currentPrograms = [];
    let currentReservations = [];
    let selectedProgram = null;
    let sessionsCache = [];
    let weightChart = null;

    document.addEventListener('DOMContentLoaded', async () => {
      await new Promise(r => setTimeout(r, 120));
      const session = await window.adminCore?.checkAdminAuth?.();
      if (!session) return;
      loadPrograms();
      loadConfirmedReservations();
    });

    function switchTab(tab) {
      document.querySelectorAll('.tracking-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      document.getElementById('programs-view').style.display = tab === 'programs' ? 'block' : 'none';
      document.getElementById('reservations-view').style.display = tab === 'reservations' ? 'block' : 'none';
    }

    async function loadPrograms() {
      try {
        const { data, error } = await sb.from('client_programs').select('*').order('updated_at', { ascending: false });
        if (error) throw error;
        currentPrograms = data || [];
        renderProgramsList();
        updateStats();
      } catch (err) {
        console.error(err);
        window.adminCore?.showToast?.('Erreur chargement programmes', 'error');
      }
    }

    async function loadConfirmedReservations() {
      try {
        const { data: reservations, error: rErr } = await sb.from('reservations').select('*').eq('status', 'CONFIRMED').order('date', { ascending: true });
        if (rErr) throw rErr;
        const { data: programs, error: pErr } = await sb.from('client_programs').select('reservation_id');
        if (pErr) throw pErr;
        const usedIds = new Set((programs || []).map(p => p.reservation_id));
        currentReservations = (reservations || []).filter(r => !usedIds.has(r.id));
        renderReservationsList();
      } catch (err) {
        console.error(err);
        document.getElementById('reservations-list').innerHTML = '<div class="empty-state">Erreur chargement réservations.</div>';
      }
    }

    function renderProgramsList(filtered = currentPrograms) {
      const list = document.getElementById('programs-list');
      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">Aucun programme trouvé.</div>';
        return;
      }
      list.innerHTML = filtered.map(p => `
        <div class="program-card ${selectedProgram?.id === p.id ? 'active' : ''}" onclick="selectProgram('${p.id}')">
          <h4>${escapeHtml(p.client_name)}</h4>
          <div class="meta">${escapeHtml(p.service_name)} · ${p.start_date || '—'}</div>
          <div class="badge-row">
            <span class="status-badge ${p.status}">${p.status}</span>
            <span class="status-badge completed">${p.total_sessions} séance(s)</span>
          </div>
        </div>
      `).join('');
    }

    function filterPrograms() {
      const q = (document.getElementById('program-search')?.value || '').toLowerCase().trim();
      if (!q) { renderProgramsList(currentPrograms); return; }
      const filtered = currentPrograms.filter(p =>
        (p.client_name && p.client_name.toLowerCase().includes(q)) ||
        (p.client_email && p.client_email.toLowerCase().includes(q)) ||
        (p.service_name && p.service_name.toLowerCase().includes(q))
      );
      renderProgramsList(filtered);
    }

    async function selectProgram(id) {
      selectedProgram = currentPrograms.find(p => p.id === id) || null;
      if (!selectedProgram) return;
      renderProgramsList();
      await loadProgramSessions(id);
      renderProgramDetail();
    }

    async function loadProgramSessions(programId) {
      const { data, error } = await sb.from('client_program_sessions').select('*').eq('program_id', programId).order('session_number', { ascending: true });
      if (error) { console.error(error); return; }
      sessionsCache = data || [];
    }

    function renderProgramDetail() {
      const container = document.getElementById('program-detail');
      if (!selectedProgram) {
        container.innerHTML = '<div class="empty-state">Sélectionnez un programme.</div>';
        return;
      }
      const completed = sessionsCache.filter(s => s.completed).length;
      const remaining = Math.max(selectedProgram.total_sessions - completed, 0);
      const nextSession = Math.min(completed + 1, selectedProgram.total_sessions);
      container.innerHTML = `
        <div class="glass-card" style="margin-bottom:1rem;">
          <div class="card-header" style="justify-content:space-between; flex-wrap:wrap; gap:.5rem;">
            <div>
              <h3 class="card-title">${escapeHtml(selectedProgram.client_name)}</h3>
              <p class="card-subtitle">${escapeHtml(selectedProgram.service_name)} · ${selectedProgram.client_email}</p>
            </div>
            <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" onclick="printProgramReport()">🖨️ Imprimer</button>
              <button class="btn btn-secondary btn-sm" onclick="emailProgramReport()">✉️ Envoyer au client</button>
              <button class="btn btn-primary btn-sm" onclick="toggleStatus()">${selectedProgram.status === 'active' ? 'Terminer' : 'Réactiver'}</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.75rem;flex-wrap:wrap;">
            <span style="font-size:.85rem;color:var(--admin-text-muted);">Total séances:</span>
            <input type="number" id="program-total-sessions" value="${selectedProgram.total_sessions}" min="1" max="100" style="width:70px;padding:.4rem;border-radius:6px;border:1px solid var(--admin-border);background:var(--admin-input-bg);color:var(--admin-text);">
            <button class="btn btn-secondary btn-sm" onclick="updateTotalSessions()">💾 Mettre à jour</button>
          </div>
          <div class="progress-bar"><div style="width:${(completed / selectedProgram.total_sessions) * 100}%"></div></div>
          <div style="display:flex; justify-content:space-between; margin-top:.5rem; font-size:.85rem; color:var(--admin-text-muted);">
            <span>${completed} / ${selectedProgram.total_sessions} séances</span>
            <span>${remaining} restante(s)</span>
          </div>
        </div>
        <div style="margin-top:.5rem; font-size:.78rem; color:var(--admin-text-muted);">
          Pour ajouter une séance, remplissez le formulaire ci-dessous avec un N° non utilisé. Pour supprimer, utilisez le bouton ❌ dans l’historique.
        </div>
        <div class="analysis-card" style="margin-bottom:1rem;">
          <h3 class="card-title">Analyse de progression</h3>
          <div class="analysis-grid" id="analysis-grid"></div>
          <div style="height:220px; margin-top:1rem;"><canvas id="weightChart"></canvas></div>
        </div>
        <div class="session-form" style="margin-bottom:1rem;">
          <h3>Ajouter / modifier la séance ${nextSession}</h3>
          <form id="session-form" onsubmit="saveSession(event)">
            <input type="hidden" id="session-id" value="">
            <div class="form-grid">
              <div class="form-group"><label>Date</label><input type="date" id="session-date" required value="${new Date().toISOString().split('T')[0]}"></div>
              <div class="form-group"><label>Poids (kg)</label><input type="number" step="0.1" id="weight-kg" placeholder="ex: 72.5"></div>
              <div class="form-group"><label>Cuisse (cm)</label><input type="number" step="0.1" id="thigh-cm" placeholder="cm"></div>
              <div class="form-group"><label>Ventre (cm)</label><input type="number" step="0.1" id="waist-cm" placeholder="cm"></div>
              <div class="form-group"><label>Hanches (cm)</label><input type="number" step="0.1" id="hips-cm" placeholder="cm"></div>
              <div class="form-group"><label>Bras (cm)</label><input type="number" step="0.1" id="arm-cm" placeholder="cm"></div>
              <div class="form-group"><label>N° de séance</label><input type="number" id="session-count-input" value="${nextSession}" min="1" max="${selectedProgram.total_sessions}"></div>
            </div>
            <div style="margin-top:1rem;">
              <h4 style="margin:.5rem 0; font-size:.95rem; color:var(--admin-text-muted);">Autres mesures / contours</h4>
              <div id="custom-measurements-list" style="display:flex; flex-direction:column; gap:.5rem;"></div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="addCustomMeasurementRow()" style="margin-top:.5rem;">+ Ajouter une mesure</button>
            </div>
            <div class="form-grid" style="margin-top:1rem; grid-template-columns:1fr;">
              <div class="form-group"><label>Notes massage / soin</label><textarea id="massage-notes" rows="2"></textarea></div>
              <div class="form-group"><label>Alimentation / régime suivi</label><textarea id="diet-notes" rows="2"></textarea></div>
              <div class="form-group"><label>Observations générales</label><textarea id="observations" rows="2"></textarea></div>
            </div>
            <div style="margin-top:1rem; display:flex; gap:.5rem;">
              <button type="submit" class="btn btn-primary">💾 Enregistrer la séance</button>
              <button type="button" class="btn btn-secondary" onclick="clearSessionForm()">Nouvelle saisie</button>
            </div>
          </form>
        </div>
        <div class="glass-card">
          <div class="card-header"><h3 class="card-title">Historique des séances</h3></div>
          <div class="sessions-timeline" id="sessions-timeline"></div>
        </div>
      `;
      renderCustomMeasurements();
      renderAnalysis();
      renderSessionsTimeline();
    }

    function renderAnalysis() {
      const grid = document.getElementById('analysis-grid');
      if (!grid) return;
      if (sessionsCache.length < 1) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1; padding:1rem;">Aucune séance enregistrée.</div>';
        return;
      }
      const first = sessionsCache[0];
      const last = sessionsCache[sessionsCache.length - 1];
      const weightDiff = (first.weight_kg && last.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
      const waistDiff = (getMeas(first, 'waist') && getMeas(last, 'waist')) ? (getMeas(last, 'waist') - getMeas(first, 'waist')).toFixed(1) : null;
      const thighDiff = (getMeas(first, 'thigh') && getMeas(last, 'thigh')) ? (getMeas(last, 'thigh') - getMeas(first, 'thigh')).toFixed(1) : null;
      grid.innerHTML = [
        { label: 'Poids début', value: first.weight_kg ? first.weight_kg + ' kg' : '—' },
        { label: 'Poids actuel', value: last.weight_kg ? last.weight_kg + ' kg' : '—' },
        { label: 'Variation poids', value: weightDiff !== null ? (weightDiff > 0 ? '+' : '') + weightDiff + ' kg' : '—', color: weightDiff < 0 ? '#22c55e' : (weightDiff > 0 ? '#ef4444' : '') },
        { label: 'Variation ventre', value: waistDiff !== null ? (waistDiff > 0 ? '+' : '') + waistDiff + ' cm' : '—' },
        { label: 'Variation cuisse', value: thighDiff !== null ? (thighDiff > 0 ? '+' : '') + thighDiff + ' cm' : '—' },
        { label: 'Séances complétées', value: sessionsCache.filter(s => s.completed).length + ' / ' + selectedProgram.total_sessions },
      ].map(item => `
        <div class="analysis-item">
          <div class="value" style="${item.color ? 'color:'+item.color : ''}">${item.value}</div>
          <div class="label">${item.label}</div>
        </div>
      `).join('');
      drawWeightChart();
    }

    function renderSessionsTimeline() {
      const timeline = document.getElementById('sessions-timeline');
      if (!timeline) return;
      if (!sessionsCache.length) {
        timeline.innerHTML = '<div class="empty-state">Aucune séance pour l’instant.</div>';
        return;
      }
      timeline.innerHTML = sessionsCache.map(s => {
        const m = s.measurements || {};
        const metrics = [];
        if (s.weight_kg) metrics.push({ label: 'Poids', value: s.weight_kg + ' kg' });
        if (m.waist) metrics.push({ label: 'Ventre', value: m.waist + ' cm' });
        if (m.hips) metrics.push({ label: 'Hanches', value: m.hips + ' cm' });
        if (m.thigh) metrics.push({ label: 'Cuisse', value: m.thigh + ' cm' });
        if (m.arm) metrics.push({ label: 'Bras', value: m.arm + ' cm' });
        if (Array.isArray(m.custom)) {
          m.custom.forEach(c => {
            if (c.value != null) metrics.push({ label: c.label || 'Mesure', value: c.value + ' cm' });
          });
        }
        return `
          <div class="session-item">
            <div><div class="session-number">#${s.session_number}</div><div style="font-size:.8rem; color:var(--admin-text-muted);">${window.adminCore?.formatDate?.(s.session_date) || s.session_date}</div></div>
            <div>
              <div class="metrics-grid">${metrics.map(m => `<div class="metric-box"><div class="value">${m.value}</div><div class="label">${m.label}</div></div>`).join('')}</div>
              ${s.massage_notes ? `<p><strong>Massage/soin:</strong> ${escapeHtml(s.massage_notes)}</p>` : ''}
              ${s.diet_notes ? `<p><strong>Alimentation:</strong> ${escapeHtml(s.diet_notes)}</p>` : ''}
              ${s.observations ? `<p><strong>Observations:</strong> ${escapeHtml(s.observations)}</p>` : ''}
              <div style="margin-top:.5rem; display:flex; gap:.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="editSession('${s.id}')">Modifier</button>
                <button class="btn btn-sm" onclick="deleteSession('${s.id}')" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;" title="Supprimer cette séance">❌</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function drawWeightChart() {
      const canvas = document.getElementById('weightChart');
      if (!canvas || sessionsCache.length < 2) return;
      const ctx = canvas.getContext('2d');
      if (weightChart) weightChart.destroy();
      weightChart = new Chart(ctx, {
        type: 'line',
        data: { labels: sessionsCache.map(s => '#'+s.session_number), datasets: [{ label: 'Poids (kg)', data: sessionsCache.map(s => s.weight_kg || null), borderColor: '#B89327', backgroundColor: 'rgba(184,147,39,.15)', fill: true, tension: 0.3, pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: false } } }
      });
    }

    function renderCustomMeasurements(custom = []) {
      const list = document.getElementById('custom-measurements-list');
      if (!list) return;
      list.innerHTML = '';
      custom.forEach(m => addCustomMeasurementRow(m.label, m.value));
      if (!custom.length) addCustomMeasurementRow();
    }

    function addCustomMeasurementRow(label = '', value = '') {
      const list = document.getElementById('custom-measurements-list');
      if (!list) return;
      const row = document.createElement('div');
      row.className = 'custom-measurement-row';
      row.style = 'display:flex; gap:.5rem; align-items:center;';
      row.innerHTML = `
        <input type="text" class="cm-label form-control" placeholder="Nom (ex: contour ventre)" value="${escapeHtml(label)}" style="flex:1;">
        <input type="number" step="0.1" class="cm-value form-control" placeholder="cm" value="${value !== '' ? value : ''}" style="width:100px;">
        <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;">❌</button>
      `;
      list.appendChild(row);
    }

    function getCustomMeasurements() {
      const rows = document.querySelectorAll('#custom-measurements-list .custom-measurement-row');
      return Array.from(rows).map(row => {
        const label = row.querySelector('.cm-label')?.value?.trim() || '';
        const value = parseFloat(row.querySelector('.cm-value')?.value);
        return label ? { label, value: isNaN(value) ? null : value } : null;
      }).filter(Boolean);
    }

    function getMeas(session, key) { return session?.measurements?.[key] || null; }

    function editSession(id) {
      const s = sessionsCache.find(x => x.id === id);
      if (!s) return;
      document.getElementById('session-id').value = s.id;
      document.getElementById('session-date').value = s.session_date;
      document.getElementById('weight-kg').value = s.weight_kg || '';
      document.getElementById('massage-notes').value = s.massage_notes || '';
      document.getElementById('diet-notes').value = s.diet_notes || '';
      document.getElementById('observations').value = s.observations || '';
      document.getElementById('session-count-input').value = s.session_number;
      const m = s.measurements || {};
      document.getElementById('waist-cm').value = m.waist || '';
      document.getElementById('hips-cm').value = m.hips || '';
      document.getElementById('thigh-cm').value = m.thigh || '';
      document.getElementById('arm-cm').value = m.arm || '';
      renderCustomMeasurements(m.custom || []);
      window.scrollTo({ top: document.getElementById('session-form').offsetTop - 20, behavior: 'smooth' });
    }

    function clearSessionForm() {
      const next = (sessionsCache.filter(s => s.completed).length) + 1;
      document.getElementById('session-form').reset();
      document.getElementById('session-id').value = '';
      document.getElementById('session-count-input').value = Math.min(next, selectedProgram.total_sessions);
      document.getElementById('session-date').value = new Date().toISOString().split('T')[0];
      renderCustomMeasurements();
    }

    async function saveSession(e) {
      e.preventDefault();
      if (!selectedProgram) return;
      const sessionId = document.getElementById('session-id').value;
      const sessionNumber = parseInt(document.getElementById('session-count-input').value, 10) || 1;
      const measurements = {
        waist: parseFloat(document.getElementById('waist-cm').value) || null,
        hips: parseFloat(document.getElementById('hips-cm').value) || null,
        thigh: parseFloat(document.getElementById('thigh-cm').value) || null,
        arm: parseFloat(document.getElementById('arm-cm').value) || null,
        custom: getCustomMeasurements(),
      };
      const payload = {
        program_id: selectedProgram.id,
        session_number: sessionNumber,
        session_date: document.getElementById('session-date').value,
        weight_kg: parseFloat(document.getElementById('weight-kg').value) || null,
        measurements,
        massage_notes: document.getElementById('massage-notes').value,
        diet_notes: document.getElementById('diet-notes').value,
        observations: document.getElementById('observations').value,
        completed: true
      };
      try {
        let error;
        if (sessionId) {
          const res = await sb.from('client_program_sessions').update(payload).eq('id', sessionId);
          error = res.error;
        } else {
          const res = await sb.from('client_program_sessions').upsert(payload, { onConflict: 'program_id,session_number' });
          error = res.error;
        }
        if (error) throw error;
        window.adminCore?.showToast?.('Séance enregistrée', 'success');
        await loadProgramSessions(selectedProgram.id);
        renderProgramDetail();
      } catch (err) {
        console.error(err);
        window.adminCore?.showToast?.('Erreur: ' + err.message, 'error');
      }
    }

    async function updateTotalSessions() {
      if (!selectedProgram) return;
      const newTotal = parseInt(document.getElementById('program-total-sessions')?.value, 10) || selectedProgram.total_sessions;
      if (newTotal < 1) { window.adminCore?.showToast?.('Le total doit être au moins 1.', 'error'); return; }
      try {
        const { error } = await sb.from('client_programs').update({ total_sessions: newTotal }).eq('id', selectedProgram.id);
        if (error) throw error;
        selectedProgram.total_sessions = newTotal;
        const idx = currentPrograms.findIndex(p => p.id === selectedProgram.id);
        if (idx >= 0) currentPrograms[idx].total_sessions = newTotal;
        renderProgramsList();
        renderProgramDetail();
        window.adminCore?.showToast?.('Total séances mis à jour', 'success');
      } catch (err) {
        console.error(err);
        window.adminCore?.showToast?.('Erreur: ' + err.message, 'error');
      }
    }

    async function deleteSession(id) {
      if (!confirm('Supprimer cette séance ?')) return;
      try {
        const { error } = await sb.from('client_program_sessions').delete().eq('id', id);
        if (error) throw error;
        window.adminCore?.showToast?.('Séance supprimée', 'success');
        await loadProgramSessions(selectedProgram.id);
        renderProgramDetail();
      } catch (err) {
        console.error(err);
        window.adminCore?.showToast?.('Erreur: ' + err.message, 'error');
      }
    }

    async function toggleStatus() {
      if (!selectedProgram) return;
      const newStatus = selectedProgram.status === 'active' ? 'completed' : 'active';
      try {
        const { error } = await sb.from('client_programs').update({ status: newStatus }).eq('id', selectedProgram.id);
        if (error) throw error;
        selectedProgram.status = newStatus;
        const idx = currentPrograms.findIndex(p => p.id === selectedProgram.id);
        if (idx >= 0) currentPrograms[idx].status = newStatus;
        renderProgramsList();
        renderProgramDetail();
        updateStats();
        window.adminCore?.showToast?.('Statut mis à jour', 'success');
      } catch (err) {
        console.error(err);
      }
    }

    async function createProgramFromReservation(reservationId, totalSessions) {
      totalSessions = parseInt(totalSessions, 10) || 1;
      try {
        const { data, error } = await sb.rpc('create_program_from_reservation', {
          p_reservation_id: reservationId,
          p_total_sessions: totalSessions
        });
        if (error) throw error;
        window.adminCore?.showToast?.('Programme créé', 'success');
        switchTab('programs');
        await loadPrograms();
        await loadConfirmedReservations();
        selectProgram(data);
      } catch (err) {
        console.error(err);
        window.adminCore?.showToast?.('Erreur création: ' + err.message, 'error');
      }
    }

    function renderReservationsList(filtered = currentReservations) {
      const list = document.getElementById('reservations-list');
      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">Aucune réservation confirmée disponible pour un suivi.</div>';
        return;
      }
      list.innerHTML = filtered.map(r => `
        <div class="reservation-card">
          <div>
            <div style="font-weight:600;">${escapeHtml(r.user_name || r.user_email)}</div>
            <div style="font-size:.85rem; color:var(--admin-text-muted);">${escapeHtml(r.service)} · ${window.adminCore?.formatDate?.(r.date) || r.date} · ${r.time}</div>
          </div>
          <div style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;">
            <input type="number" min="1" max="50" value="4" class="form-control" id="sessions-${r.id}" style="width:70px; padding:.4rem;" title="Nombre de séances">
            <button class="btn btn-primary btn-sm" onclick="createProgramFromReservation('${r.id}', document.getElementById('sessions-${r.id}').value)">Démarrer le suivi</button>
          </div>
        </div>
      `).join('');
    }

    function filterReservations() {
      const q = (document.getElementById('reservation-search')?.value || '').toLowerCase().trim();
      if (!q) { renderReservationsList(currentReservations); return; }
      const filtered = currentReservations.filter(r =>
        (r.user_name && r.user_name.toLowerCase().includes(q)) ||
        (r.user_email && r.user_email.toLowerCase().includes(q)) ||
        (r.service && r.service.toLowerCase().includes(q))
      );
      renderReservationsList(filtered);
    }

    function updateStats() {
      const active = currentPrograms.filter(p => p.status === 'active').length;
      const completed = currentPrograms.filter(p => p.status === 'completed').length;
      document.getElementById('stat-active-programs').textContent = active;
      document.getElementById('stat-completed-programs').textContent = completed;
      const todayStr = new Date().toISOString().split('T')[0];
      document.getElementById('stat-today-sessions').textContent = sessionsCache.filter(s => s.session_date === todayStr).length;
    }

    function printProgramReport() {
      if (!selectedProgram) return;
      const first = sessionsCache[0];
      const last = sessionsCache[sessionsCache.length - 1];
      const weightDiff = (first?.weight_kg && last?.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
      const rows = sessionsCache.map(s => `
        <tr>
          <td>#${s.session_number}</td>
          <td>${s.session_date}</td>
          <td>${s.weight_kg || '—'}</td>
          <td>${s.measurements?.waist || '—'}</td>
          <td>${s.measurements?.thigh || '—'}</td>
          <td>${s.massage_notes || '—'}</td>
          <td>${s.diet_notes || '—'}</td>
        </tr>
      `).join('');
      document.getElementById('print-area').innerHTML = `
        <div style="padding:2rem; font-family:Arial,sans-serif;">
          <div style="text-align:center; margin-bottom:1.5rem;">
            <h2 style="margin:0;">DALIGHT — Rapport de suivi</h2>
            <p style="margin:.2rem 0 0; color:#555;">${escapeHtml(selectedProgram.service_name)}</p>
          </div>
          <div style="margin-bottom:1rem;">
            <p><strong>Client:</strong> ${escapeHtml(selectedProgram.client_name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(selectedProgram.client_email)}</p>
            <p><strong>Séances:</strong> ${sessionsCache.length} / ${selectedProgram.total_sessions}</p>
            ${weightDiff !== null ? `<p><strong>Variation poids:</strong> ${weightDiff > 0 ? '+' : ''}${weightDiff} kg</p>` : ''}
          </div>
          <table style="width:100%; border-collapse:collapse; margin-top:1rem;" border="1" cellpadding="8">
            <thead><tr style="background:#f3f3f3;"><th>Séance</th><th>Date</th><th>Poids</th><th>Ventre</th><th>Cuisse</th><th>Soin</th><th>Alimentation</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:1.5rem; text-align:center; font-size:.85rem; color:#777;">Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      `;
      window.print();
    }

    function emailProgramReport() {
      if (!selectedProgram) return;
      const first = sessionsCache[0];
      const last = sessionsCache[sessionsCache.length - 1];
      const weightDiff = (first?.weight_kg && last?.weight_kg) ? (last.weight_kg - first.weight_kg).toFixed(1) : null;
      const subject = encodeURIComponent('Votre progression chez DALIGHT');
      let body = `Bonjour ${selectedProgram.client_name},\n\nVoici votre rapport de suivi pour le service ${selectedProgram.service_name}.\n\n`;
      body += `Séances réalisées: ${sessionsCache.length} / ${selectedProgram.total_sessions}\n`;
      if (weightDiff !== null) body += `Variation de poids: ${weightDiff > 0 ? '+' : ''}${weightDiff} kg\n`;
      if (last?.measurements?.waist) body += `Ventre: ${last.measurements.waist} cm\n`;
      if (last?.measurements?.thigh) body += `Cuisse: ${last.measurements.thigh} cm\n`;
      body += `\nMerci de votre confiance.\nL’équipe DALIGHT`;
      window.location.href = `mailto:${encodeURIComponent(selectedProgram.client_email)}?subject=${subject}&body=${encodeURIComponent(body)}`;
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  