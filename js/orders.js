import { formatDate, formatTime, getSupabase } from './main.js?v=5.0.0';

let supabase = getSupabase();

async function waitForSupabase() {
  let attempts = 0;
  while (!supabase && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    supabase = getSupabase();
    attempts++;
  }
  if (!supabase) {
    console.error('❌ Supabase failed to initialize in orders.js');
    return false;
  }
  return true;
}

const ordersList = document.getElementById('orders-list');
const emptyState = document.getElementById('orders-empty');
const ordersCountEl = document.getElementById('orders-count');
const ordersNextEl = document.getElementById('orders-next');
const filtersBar = document.getElementById('orders-filters');
const assistantNote = document.getElementById('orders-assistant-note');

let allReservations = [];
let activeFilter = 'ALL';
let resvPaymentMethods = [];
let selectedBalancePM = {};

const STATUS_FR = {
  PENDING:   { label: 'En attente', css: 'pending' },
  CONFIRMED: { label: 'Confirmé',   css: 'confirmed' },
  COMPLETED: { label: 'Terminé',    css: 'completed' },
  CANCELLED: { label: 'Annulé',     css: 'cancelled' },
};

const PAYMENT_STATUS_FR = {
  pending:       { label: 'En attente', css: 'pending' },
  deposit_paid:  { label: 'Acompte payé', css: 'partial' },
  balance_pending: { label: 'Solde en attente', css: 'partial' },
  fully_paid:    { label: 'Payé', css: 'paid' },
};

function toggleSections(hasRows) {
  if (emptyState) emptyState.hidden = hasRows;
  if (ordersList) ordersList.hidden = !hasRows;
}

function escapeHtml(value = '') {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}

function calcTotalFromServices(services) {
  if (!services || !Array.isArray(services)) return 0;
  return services.reduce((sum, s) => sum + (Number(s.price_htg) || 0), 0);
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function getTimeSlotOptions() {
  const slots = [];
  for (let h = 8; h <= 16; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 16) slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

function renderCard(r) {
  const st = STATUS_FR[r.status] || STATUS_FR.PENDING;
  const pst = PAYMENT_STATUS_FR[r.payment_status] || PAYMENT_STATUS_FR.pending;
  const locationLabel = r.location === 'Spa' ? 'Au Spa — Delmas 65' : r.location;
  const totalAmount = r.total_amount || calcTotalFromServices(r.services);
  const depositAmount = r.deposit_amount || 0;
  const balanceAmount = totalAmount - depositAmount - (r.balance_paid_amount || 0);
  const todayISO = getTodayISO();
  const isToday = r.date === todayISO;
  const isFuture = r.date > todayISO;
  const canModify = isFuture && (r.status === 'PENDING' || r.status === 'CONFIRMED');
  const needsBalance = r.payment_status === 'deposit_paid' && balanceAmount > 0;
  const hasModification = r.modification_reason;

  const modifyBtn = canModify
    ? `<button class="rc-btn rc-btn-modify" data-action="open-modify" data-id="${r.id}">
         <i data-lucide="calendar-edit" style="width:14px;height:14px;"></i> Modifier
       </button>`
    : '';

  const balanceBtn = needsBalance
    ? `<button class="rc-btn rc-btn-balance" data-action="open-balance" data-id="${r.id}">
         <i data-lucide="credit-card" style="width:14px;height:14px;"></i> Payer le solde (${balanceAmount.toLocaleString()} HTG)
       </button>`
    : '';

  const paymentStatusBadge = `<span class="rc-payment-status ${pst.css}">${pst.label}</span>`;

  const modificationNote = hasModification
    ? `<div class="rc-modification-note">
         <i data-lucide="info" style="width:14px;height:14px;"></i>
         Modification: ${escapeHtml(r.modification_reason)}
       </div>`
    : '';

  return `
    <article class="reservation-card" data-id="${r.id}">
      <div class="rc-main">
        <div>
          <div class="rc-service">${escapeHtml(r.service)}</div>
          <div class="rc-meta">
            <span><i data-lucide="calendar" style="width:14px;height:14px;"></i> ${formatDate(r.date)}</span>
            <span><i data-lucide="clock" style="width:14px;height:14px;"></i> ${formatTime(r.time)}</span>
            <span><i data-lucide="map-pin" style="width:14px;height:14px;"></i> ${escapeHtml(locationLabel)}</span>
          </div>
          <div class="rc-meta" style="margin-top:0.25rem;">
            ${paymentStatusBadge}
            <span>Total: ${totalAmount.toLocaleString()} HTG</span>
            ${r.deposit_amount ? `<span>Acompte: ${depositAmount.toLocaleString()} HTG</span>` : ''}
          </div>
        </div>
        <span class="rc-status ${st.css}">${st.label}</span>
      </div>
      <div class="rc-notes">${escapeHtml(r.notes || '')}</div>
      ${modificationNote}
      <div class="rc-actions">
        ${modifyBtn}
        ${balanceBtn}
      </div>
      <div class="rc-panel rc-modify-panel" hidden data-panel="modify">
        <h4>Modifier la réservation</h4>
        <div class="rc-form-row">
          <label>Nouvelle date</label>
          <input type="date" class="rc-input rc-input-date" value="${r.date}">
        </div>
        <div class="rc-form-row">
          <label>Nouvelle heure</label>
          <select class="rc-input rc-input-time">
            ${getTimeSlotOptions().map(t => `<option value="${t}" ${t === r.time ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="rc-form-row">
          <label>Raison du changement</label>
          <textarea class="rc-input rc-input-reason" rows="2" placeholder="Expliquez pourquoi vous voulez changer..."></textarea>
        </div>
        <div class="rc-panel-actions">
          <button class="rc-btn rc-btn-cancel" data-action="cancel-modify">Annuler</button>
          <button class="rc-btn rc-btn-save" data-action="save-modify" data-id="${r.id}">Confirmer le changement</button>
        </div>
      </div>
      <div class="rc-panel rc-balance-panel" hidden data-panel="balance">
        <h4>Payer le solde (${balanceAmount.toLocaleString()} HTG)</h4>
        <div class="rc-payment-methods" data-balance-id="${r.id}">
          <div class="rc-loading">Chargement des méthodes de paiement...</div>
        </div>
        <div class="rc-upload-zone" id="balance-upload-zone-${r.id}">
          <input type="file" id="balance-file-${r.id}" accept="image/*" style="display:none;">
          <i data-lucide="upload-cloud" style="width:32px;height:32px;color:#D4AF37;"></i>
          <p>Uploader la preuve du solde</p>
          <small>PNG, JPG — Max 5 MB</small>
          <div class="rc-file-name" id="balance-filename-${r.id}"></div>
        </div>
        <div class="rc-panel-actions">
          <button class="rc-btn rc-btn-cancel" data-action="cancel-balance">Annuler</button>
          <button class="rc-btn rc-btn-save" data-action="save-balance" data-id="${r.id}">Payer le solde</button>
        </div>
      </div>
    </article>
  `;
}

function groupAndRender(reservations) {
  if (!ordersList) return;

  const todayISO = getTodayISO();
  const today = reservations.filter(r => r.date === todayISO);
  const future = reservations.filter(r => r.date > todayISO).sort((a, b) => a.date.localeCompare(b.date));
  const past = reservations.filter(r => r.date < todayISO).sort((a, b) => b.date.localeCompare(a.date));

  let html = '';

  if (today.length > 0) {
    html += '<div class="rc-section-label">Aujourd\'hui</div>';
    html += today.map(renderCard).join('');
  }

  if (future.length > 0) {
    html += '<div class="rc-section-label">À venir</div>';
    html += future.map(renderCard).join('');
  }

  if (past.length > 0) {
    html += '<div class="rc-section-label">Passées</div>';
    html += past.map(renderCard).join('');
  }

  ordersList.innerHTML = html || '<p style="text-align:center;color:#9a8f86;padding:2rem;">Aucune réservation.</p>';
  if (window.lucide) window.lucide.createIcons();
  initBalancePanels();
}

async function handleModifyOpen(btn) {
  const card = btn.closest('.reservation-card');
  const panel = card.querySelector('.rc-modify-panel');
  panel.hidden = false;
}

async function handleModifySave(btn) {
  const id = btn.dataset.id;
  const card = btn.closest('.reservation-card');
  const newDate = card.querySelector('.rc-input-date').value;
  const newTime = card.querySelector('.rc-input-time').value;
  const reason = card.querySelector('.rc-input-reason').value.trim();

  if (!newDate || !newTime || !reason) {
    alert('Veuillez remplir tous les champs.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Traitement...';

  try {
    const { error } = await supabase
      .from('reservations')
      .update({
        date: newDate,
        time: newTime,
        modification_reason: reason,
        modified_at: new Date().toISOString(),
        status: 'PENDING'
      })
      .eq('id', id);

    if (error) throw error;

    alert('Votre demande de modification a été envoyée. L\'admin reconfirmera votre réservation.');
    card.querySelector('.rc-modify-panel').hidden = true;
    loadReservations();
  } catch (e) {
    console.error(e);
    alert('Erreur: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmer le changement';
  }
}

async function loadPaymentMethods() {
  if (resvPaymentMethods.length > 0) return resvPaymentMethods;

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  resvPaymentMethods = data || [];
  return resvPaymentMethods;
}

async function renderBalancePM(resvId) {
  const container = document.querySelector(`.rc-payment-methods[data-balance-id="${resvId}"]`);
  if (!container) return;

  container.innerHTML = '<div class="rc-loading">Chargement...</div>';

  const methods = await loadPaymentMethods();
  container.innerHTML = methods.map(pm => `
    <div class="rc-pm-card ${selectedBalancePM[resvId]?.slug === pm.slug ? 'selected' : ''}" data-pm-slug="${pm.slug}" data-action="select-pm" data-resv-id="${resvId}">
      <strong>${escapeHtml(pm.name)}</strong>
      ${pm.account_number ? `<p>${escapeHtml(pm.account_number)}</p>` : ''}
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();

  const zone = document.getElementById(`balance-upload-zone-${resvId}`);
  if (zone) {
    zone.onclick = () => document.getElementById(`balance-file-${resvId}`).click();
  }

  const fileInput = document.getElementById(`balance-file-${resvId}`);
  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      const nameEl = document.getElementById(`balance-filename-${resvId}`);
      if (nameEl) nameEl.textContent = file ? file.name : '';
    };
  }
}

async function selectBalancePM(resvId, slug) {
  const pm = resvPaymentMethods.find(m => m.slug === slug);
  if (!pm) return;

  selectedBalancePM[resvId] = pm;

  document.querySelectorAll(`.rc-pm-card[data-resv-id="${resvId}"]`).forEach(card => {
    card.classList.toggle('selected', card.dataset.pmSlug === slug);
  });

  let info = document.querySelector(`.rc-pm-info[data-resv-id="${resvId}"]`);
  if (!info) {
    const container = document.querySelector(`.rc-payment-methods[data-balance-id="${resvId}"]`);
    if (container) {
      info = document.createElement('div');
      info.className = 'rc-pm-info';
      info.dataset.resvId = resvId;
      container.insertAdjacentElement('afterend', info);
    }
  }

  if (info) {
    info.innerHTML = `
      <strong>Instructions:</strong>
      <p>${escapeHtml(pm.instructions)}</p>
      ${pm.account_name ? `<p><strong>Compte:</strong> ${escapeHtml(pm.account_name)}</p>` : ''}
    `;
  }
}

async function saveBalanceProof(btn) {
  const id = btn.dataset.id;
  const pm = selectedBalancePM[id];
  const fileInput = document.getElementById(`balance-file-${id}`);
  const file = fileInput?.files[0];

  if (!pm) {
    alert('Veuillez sélectionner une méthode de paiement.');
    return;
  }

  if (!file) {
    alert('Veuillez uploader la preuve de paiement.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Traitement...';

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `balance-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `balance-proofs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file);

    if (uploadError) throw new Error('Upload error: ' + uploadError.message);

    const { data: publicUrlData } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filePath);

    const total = await supabase
      .from('reservations')
      .select('total_amount, deposit_amount, balance_paid_amount')
      .eq('id', id)
      .single();

    const r = total.data;
    const balanceAmount = (r.total_amount || 0) - (r.deposit_amount || 0) - (r.balance_paid_amount || 0);

    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        balance_proof_url: publicUrlData.publicUrl,
        balance_paid_amount: (r.balance_paid_amount || 0) + balanceAmount,
        payment_status: 'balance_pending'
      })
      .eq('id', id);

    if (updateError) throw updateError;

    alert('Votre preuve a été envoyée. L\'admin confirmera votre paiement.');
    btn.closest('.rc-balance-panel').hidden = true;
    loadReservations();
  } catch (e) {
    console.error(e);
    alert('Erreur: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Payer le solde';
  }
}

function initBalancePanels() {
  document.querySelectorAll('.rc-balance-panel').forEach(panel => {
    panel.hidden = true;
  });
}

function wireCardActions() {
  if (!ordersList) return;
  ordersList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'open-modify') {
      handleModifyOpen(btn);
    } else if (action === 'save-modify') {
      handleModifySave(btn);
    } else if (action === 'cancel-modify') {
      btn.closest('.rc-modify-panel').hidden = true;
    } else if (action === 'open-balance') {
      const panel = btn.closest('.reservation-card').querySelector('.rc-balance-panel');
      panel.hidden = false;
      renderBalancePM(btn.dataset.id);
    } else if (action === 'save-balance') {
      saveBalanceProof(btn);
    } else if (action === 'cancel-balance') {
      btn.closest('.rc-balance-panel').hidden = true;
    } else if (action === 'select-pm') {
      selectBalancePM(btn.dataset.resvId, btn.dataset.pmSlug);
    }
  });
}

function getNextReservation(reservations = []) {
  const now = new Date();
  return reservations
    .map((reservation) => {
      const dateTime = new Date(`${reservation.date}T${reservation.time ?? '00:00'}`);
      return { reservation, dateTime };
    })
    .filter(({ dateTime }) => !Number.isNaN(dateTime.getTime()) && dateTime >= now)
    .sort((a, b) => a.dateTime - b.dateTime)[0];
}

function updateMetrics(reservations = []) {
  if (ordersCountEl) ordersCountEl.textContent = reservations.length.toString();
  if (ordersNextEl) {
    const next = getNextReservation(reservations);
    ordersNextEl.textContent = next
      ? `${formatDate(next.reservation.date)} · ${formatTime(next.reservation.time)}`
      : '—';
  }
}

async function loadReservations() {
  const ready = await waitForSupabase();
  if (!ready || !ordersList) {
    console.error('❌ Cannot load reservations - Supabase not ready');
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('⚠️ No session found');
      return;
    }

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allReservations = Array.isArray(data) ? data : [];
    const hasRows = allReservations.length > 0;
    toggleSections(hasRows);
    updateMetrics(allReservations);

    if (filtersBar) filtersBar.hidden = !hasRows;
    if (assistantNote) assistantNote.hidden = !hasRows;

    if (hasRows) {
      applyFilter();
    }
  } catch (error) {
    console.error(error);
    toggleSections(false);
    if (emptyState) {
      emptyState.querySelector('p').textContent = error.message || 'Impossible de charger les réservations.';
    }
  }
}

function subscribeToUpdates() {
  if (!supabase) return;
  const channel = supabase
    .channel('reservation-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
      loadReservations();
    })
    .subscribe();
  window.addEventListener('beforeunload', () => supabase.removeChannel(channel));
}

function applyFilter() {
  const filtered = activeFilter === 'ALL'
    ? allReservations
    : allReservations.filter((r) => r.status === activeFilter);
  if (filtered.length === 0 && allReservations.length > 0) {
    ordersList.innerHTML = '<p style="text-align:center;color:#9a8f86;padding:2rem;">Aucune réservation avec ce statut.</p>';
    ordersList.hidden = false;
  } else {
    groupAndRender(filtered);
  }
}

function wireFilters() {
  if (!filtersBar) return;
  filtersBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    filtersBar.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  });
}

async function initOrdersPage() {
  if (!ordersList) return;
  await waitForSupabase();
  wireFilters();
  wireCardActions();
  loadReservations();
  subscribeToUpdates();
}

window.ChatWidget = {
  open: () => {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) chatBubble.click();
  }
};

initOrdersPage();
