import { formatDate, formatTime, getSupabase } from './main.js?v=5.0.0';
import { createPlopPayment, verifyPlopPayment, isAutomaticPlopPayment, isBankPayment } from './plop-payment.js';
import { loadConsentData, matchTemplate, findSubmission, openConsentModal } from './consent-forms.js?v=202607121600';
import { loadLoyaltyCards, renderLoyaltySection, getClientReferralCode } from './loyalty-client.js?v=2';

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
let consentData = { templates: [], submissions: [] };

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
  const locationLabel = r.location === 'Spa' ? 'Au Spa — Delmas 65' : (r.location || 'Au Spa — Delmas 65');
  const totalAmount = Number(r.total_amount_htg || r.total_amount || calcTotalFromServices(r.services) || 0);
  const depositAmount = Number(r.deposit_amount || 0);
  const balanceAmount = Math.max(0, totalAmount - depositAmount - (Number(r.balance_paid_amount) || 0));
  const todayISO = getTodayISO();
  const isFuture = r.date >= todayISO;
  const canModify = isFuture && (r.status === 'PENDING' || r.status === 'CONFIRMED');
  const needsBalance = (r.payment_status === 'deposit_paid' || r.payment_status === 'partial') && balanceAmount > 0;
  const hasModification = r.modification_reason;

  // Status Icon
  let statusIcon = 'clock';
  if (r.status === 'CONFIRMED') statusIcon = 'check-circle';
  else if (r.status === 'COMPLETED') statusIcon = 'sparkles';
  else if (r.status === 'CANCELLED') statusIcon = 'x-circle';

  const statusBadge = `<span class="rc-status-pill ${st.css}"><i data-lucide="${statusIcon}" style="width:13px;height:13px;"></i> ${st.label}</span>`;

  // Direct WhatsApp button
  const resvNum = r.reservation_number || (r.id ? r.id.slice(0, 8) : 'DALIGHT');
  const waText = encodeURIComponent(`Bonjour DALIGHT ! Je vous contacte au sujet de ma réservation #${resvNum} (${r.service}) prévue le ${formatDate(r.date)} à ${formatTime(r.time)}.`);
  const waBtn = `<a href="https://wa.me/50947477221?text=${waText}" target="_blank" rel="noopener" class="rc-btn rc-btn-wa"><i data-lucide="message-circle" style="width:14px;height:14px;"></i> Contacter sur WhatsApp</a>`;

  const modifyBtn = canModify
    ? `<button class="rc-btn rc-btn-modify" data-action="open-modify" data-id="${r.id}">
         <i data-lucide="calendar" style="width:14px;height:14px;"></i> Modifier la date
       </button>`
    : '';

  const balanceBtn = needsBalance
    ? `<button class="rc-btn rc-btn-balance" data-action="open-balance" data-id="${r.id}">
         <i data-lucide="credit-card" style="width:14px;height:14px;"></i> Payer le solde (${balanceAmount.toLocaleString()} HTG)
       </button>`
    : '';

  const tpl = matchTemplate(r, consentData.templates, consentData.serviceMap);
  const sub = tpl ? findSubmission(r, consentData.submissions) : null;
  const consentBtn = tpl
    ? `<button class="rc-btn rc-btn-modify" data-action="open-consent" data-id="${r.id}">
         <i data-lucide="file-signature" style="width:14px;height:14px;"></i> ${sub ? 'Formulaire de consentement' : 'Remplir le consentement'}
       </button>`
    : '';

  // Video indicator
  const hasVideo = r.wants_video || r.video_requested;
  const videoTag = hasVideo
    ? `<span style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.25rem 0.65rem;border-radius:20px;background:rgba(212,175,55,0.15);color:var(--orders-gold);border:1px solid rgba(212,175,55,0.3);font-size:0.75rem;font-weight:600;"><i data-lucide="video" style="width:12px;height:12px;"></i> Option Vidéo Souvenir incluse</span>`
    : '';

  // Notes box
  const notesBox = r.notes
    ? `<div class="rc-notes-box"><i data-lucide="file-text" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;color:var(--orders-gold);"></i> ${escapeHtml(r.notes)}</div>`
    : '';

  const modificationNote = hasModification
    ? `<div style="background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.3);padding:0.75rem;border-radius:10px;margin-bottom:1rem;font-size:0.84rem;color:#facc15;display:flex;align-items:center;gap:0.4rem;">
         <i data-lucide="info" style="width:16px;height:16px;flex-shrink:0;"></i>
         <span>Demande de modification : ${escapeHtml(r.modification_reason)}</span>
       </div>`
    : '';

  return `
    <article class="reservation-card" data-id="${r.id}">
      <div class="rc-header-row">
        <div>
          <span style="font-size:0.75rem;font-family:monospace;color:var(--orders-gold);letter-spacing:0.05em;display:block;margin-bottom:0.25rem;">RÉSERVATION #${resvNum}</span>
          <h3 class="rc-service">${escapeHtml(r.service)}</h3>
        </div>
        ${statusBadge}
      </div>

      <div class="rc-meta">
        <span><i data-lucide="calendar"></i> ${formatDate(r.date)}</span>
        <span><i data-lucide="clock"></i> ${formatTime(r.time)}</span>
        <span><i data-lucide="map-pin"></i> ${escapeHtml(locationLabel)}</span>
        ${videoTag}
      </div>

      <div class="rc-pay-detail">
        <div class="rc-pay-row">
          <span>Montant de la prestation</span>
          <strong>${totalAmount.toLocaleString()} HTG</strong>
        </div>
        ${depositAmount > 0 ? `
          <div class="rc-pay-row">
            <span>Acompte versé</span>
            <strong style="color:#4ade80;">-${depositAmount.toLocaleString()} HTG</strong>
          </div>
        ` : ''}
        ${needsBalance ? `
          <div class="rc-pay-row" style="background:rgba(234,179,8,0.1);">
            <span style="color:#facc15;">Solde à régler</span>
            <strong style="color:#facc15;">${balanceAmount.toLocaleString()} HTG</strong>
          </div>
        ` : ''}
      </div>

      ${notesBox}
      ${modificationNote}

      <div class="rc-actions">
        ${waBtn}
        ${modifyBtn}
        ${balanceBtn}
        ${consentBtn}
      </div>

      <!-- Modify Panel Inline -->
      <div class="rc-panel rc-modify-panel" hidden data-panel="modify" style="margin-top:1.25rem;padding:1.25rem;background:rgba(14,20,12,0.85);border:1px solid rgba(212,175,55,0.3);border-radius:14px;">
        <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;color:var(--orders-gold);margin:0 0 1rem 0;">Modifier la date ou l'heure</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
          <div>
            <label style="display:block;font-size:0.8rem;color:var(--orders-muted);margin-bottom:0.25rem;">Nouvelle date</label>
            <input type="date" class="rc-input rc-input-date" value="${r.date}" style="width:100%;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;color:var(--orders-muted);margin-bottom:0.25rem;">Nouvelle heure</label>
            <select class="rc-input rc-input-time" style="width:100%;box-sizing:border-box;">
              ${getTimeSlotOptions().map(t => `<option value="${t}" ${t === r.time ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-bottom:1rem;">
          <label style="display:block;font-size:0.8rem;color:var(--orders-muted);margin-bottom:0.25rem;">Raison du report</label>
          <input type="text" class="rc-input rc-input-reason" placeholder="Ex: Empêchement professionnel..." style="width:100%;box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:0.6rem;justify-content:flex-end;">
          <button class="rc-btn rc-btn-modify" data-action="cancel-modify">Annuler</button>
          <button class="rc-btn rc-btn-balance" data-action="save-modify" data-id="${r.id}">Confirmer la modification</button>
        </div>
      </div>

      <!-- Balance Panel Inline -->
      <div class="rc-panel rc-balance-panel" hidden data-panel="balance" style="margin-top:1.25rem;padding:1.25rem;background:rgba(14,20,12,0.85);border:1px solid rgba(212,175,55,0.3);border-radius:14px;">
        <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;color:var(--orders-gold);margin:0 0 1rem 0;">Régler le solde (${balanceAmount.toLocaleString()} HTG)</h4>
        <div class="rc-payment-methods" data-balance-id="${r.id}">
          <div class="rc-loading" style="font-size:0.85rem;color:var(--orders-muted);">Chargement des méthodes...</div>
        </div>
        <div class="rc-upload-zone" id="balance-upload-zone-${r.id}" style="display:none;margin-top:1rem;padding:1rem;border:1px dashed var(--orders-border-card);border-radius:10px;text-align:center;cursor:pointer;">
          <input type="file" id="balance-file-${r.id}" accept="image/*,.pdf" style="display:none;">
          <i data-lucide="upload" style="width:24px;height:24px;color:var(--orders-gold);"></i>
          <p style="margin:0.25rem 0 0;font-size:0.82rem;color:var(--orders-cream);">Uploader le reçu de transfert</p>
          <div class="rc-file-name" id="balance-filename-${r.id}" style="font-size:0.78rem;color:#4ade80;margin-top:0.25rem;"></div>
        </div>
        <div style="display:flex;gap:0.6rem;justify-content:flex-end;margin-top:1rem;">
          <button class="rc-btn rc-btn-modify" data-action="cancel-balance">Annuler</button>
          <button class="rc-btn rc-btn-balance" data-action="save-balance" data-id="${r.id}">Soumettre le solde</button>
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

  const zone = document.getElementById(`balance-upload-zone-${resvId}`);
  if (zone) zone.style.display = isBankPayment(slug) && pm.requires_proof ? 'block' : 'none';
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

  if (isBankPayment(pm.slug) && pm.requires_proof && !file) {
    alert('Veuillez uploader la preuve de paiement.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Traitement...';

  try {
    let publicUrl = null;
    if (file) {
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
      publicUrl = publicUrlData.publicUrl;
    }

    const total = await supabase
      .from('reservations')
      .select('total_amount, deposit_amount, balance_paid_amount')
      .eq('id', id)
      .single();

    const r = total.data;
    const balanceAmount = (r.total_amount || 0) - (r.deposit_amount || 0) - (r.balance_paid_amount || 0);

    if (isAutomaticPlopPayment(pm.slug)) {
      const reference = `RESV-BAL-${id}-${Date.now()}`;
      const payment = await createPlopPayment(supabase, {
        refference_id: reference,
        montant: balanceAmount,
        payment_method: pm.slug,
        context_type: 'reservation_balance',
        context_id: id,
        redirect_url: `${window.location.origin}${window.location.pathname}`,
      });

      const { error: autoUpdateError } = await supabase
        .from('reservations')
        .update({
          balance_payment_reference: reference,
          balance_plop_transaction_id: payment.transaction_id || null,
          payment_status: 'balance_pending'
        })
        .eq('id', id);

      if (autoUpdateError) throw autoUpdateError;
      window.location.href = payment.url;
      return;
    }

    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        balance_proof_url: publicUrl,
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
    } else if (action === 'open-consent') {
      openConsentForReservation(btn.dataset.id);
    }
  });
}

function openConsentForReservation(id) {
  const r = allReservations.find(res => res.id === id);
  if (!r) return;
  const tpl = matchTemplate(r, consentData.templates, consentData.serviceMap);
  if (!tpl) return;
  const sub = findSubmission(r, consentData.submissions);
  openConsentModal({
    supabase,
    reservation: r,
    template: tpl,
    submission: sub,
    onSubmitted: (newSub) => {
      consentData.submissions.push(newSub);
      applyFilter();
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

function showPaymentSuccessPopup(reservationNumber, date, time) {
  const existing = document.getElementById('payment-success-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'payment-success-popup';
  popup.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:99998;animation:fadeIn 0.25s ease-out;"></div>
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:2.5rem;border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,0.4);z-index:99999;max-width:480px;width:90vw;text-align:center;animation:slideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275);">
      <div style="width:80px;height:80px;background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;box-shadow:0 8px 20px rgba(16,185,129,0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <h3 style="margin:0 0 1rem;color:#1f2937;font-size:1.5rem;font-weight:700;">Paiement confirmé !</h3>
      <p style="margin:0 0 1.5rem;color:#4b5563;font-size:1rem;line-height:1.7;">
        Votre réservation <strong style="color:#D4AF37;">#${escapeHtml(reservationNumber || '')}</strong> a été confirmée avec succès.<br><br>
        <strong>Date:</strong> ${formatDate(date)}<br>
        <strong>Heure:</strong> ${formatTime(time)}
      </p>
      <button onclick="document.getElementById('payment-success-popup').remove()" style="background:linear-gradient(135deg,#D4AF37 0%,#C5A028 100%);color:#fff;border:none;padding:1rem 2rem;border-radius:12px;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 4px 15px rgba(212,175,55,0.4);transition:all 0.2s;">
        Parfait !
      </button>
    </div>
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideIn { from { opacity: 0; transform: translate(-50%, -45%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
    </style>
  `;
  document.body.appendChild(popup);
}

function showPaymentFailedPopup(reservationNumber) {
  const existing = document.getElementById('payment-failed-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'payment-failed-popup';
  popup.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:99998;animation:fadeIn 0.25s ease-out;"></div>
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:2rem;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.3);z-index:99999;max-width:420px;width:90vw;text-align:center;animation:slideIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275);">
      <div style="width:64px;height:64px;background:#fef2f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <h3 style="margin:0 0 .5rem;color:#1f2937;font-size:1.25rem;">Réservation non confirmée</h3>
      <p style="margin:0 0 1.25rem;color:#6b7280;font-size:.95rem;line-height:1.5;">
        La réservation <strong>#${escapeHtml(reservationNumber || '')}</strong> n'a pas été confirmée car le paiement n'a pas été effectué.<br>
        Veuillez réessayer avec MonCash ou NatCash pour réserver votre créneau.
      </p>
      <button onclick="document.getElementById('payment-failed-popup').remove()" style="background:#dc2626;color:#fff;border:none;padding:.75rem 1.5rem;border-radius:10px;font-weight:600;cursor:pointer;">Compris</button>
    </div>
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideIn { from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
    </style>
  `;
  document.body.appendChild(popup);
}

async function verifyPendingPlopPayments(reservations) {
  const pending = reservations.filter(
    r => r.payment_status === 'pending' && r.payment_reference && !r.plop_client_id
  );
  if (!pending.length) return;

  // Server-side reconcile first (works even for reservations from other devices)
  try {
    await supabase.functions.invoke('plop-payment', { body: { action: 'reconcile' } });
  } catch (_) {}

  let showedPopup = false;

  for (const r of pending) {
    try {
      const result = await verifyPlopPayment(supabase, r.payment_reference);
      if (result && result.trans_status === 'ok') {
        const isFullPayment = r.payment_reference.endsWith('-FULL');
        const updates = {
          status: 'CONFIRMED',
          payment_status: isFullPayment ? 'fully_paid' : 'deposit_paid',
          plop_transaction_id: result.id_transaction || r.plop_transaction_id || null,
          plop_client_id: result.id_client || null,
        };

        await supabase.from('reservations').update(updates).eq('id', r.id);
        Object.assign(r, updates);
        
        // Show success popup for newly confirmed payment
        if (!showedPopup) {
          showPaymentSuccessPopup(r.reservation_number, r.date, r.time);
          showedPopup = true;
        }
      } else {
        const transStatus = String(result?.trans_status || '').toLowerCase();
        const isDefinitiveFailure = ['failed', 'cancelled', 'canceled', 'expired', 'refused', 'declined'].includes(transStatus);
        // Grace period: never cancel a reservation created less than 30 minutes ago
        // (the customer may still be completing the payment)
        const ageMs = Date.now() - new Date(r.created_at).getTime();
        if (isDefinitiveFailure && ageMs > 30 * 60 * 1000) {
          await supabase.from('reservations').update({ status: 'CANCELLED', payment_status: 'failed' }).eq('id', r.id);
          Object.assign(r, { status: 'CANCELLED', payment_status: 'failed' });
          if (!showedPopup) {
            showPaymentFailedPopup(r.reservation_number);
            showedPopup = true;
          }
        }
        // Generic errors (result.status === false, network issues, etc.) are IGNORED:
        // the reservation stays pending and will be re-verified on the next visit / reconcile.
      }
    } catch (_) {}
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
      toggleSections(false);
      const nameEl = document.getElementById('page-profile-name');
      const metaEl = document.getElementById('page-profile-meta');
      if (nameEl) nameEl.textContent = 'Non connecté';
      if (metaEl) metaEl.innerHTML = '<a href="./login.html" style="color:var(--orders-gold);text-decoration:underline;">Cliquez ici pour vous connecter</a>';
      return;
    }

    // Populate on-page profile info
    await populateOnPageProfile(session);

    let query = supabase.from('reservations').select('*');
    if (session.user.id && session.user.email) {
      query = query.or(`user_id.eq.${session.user.id},user_email.eq.${session.user.email}`);
    } else {
      query = query.eq('user_id', session.user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    allReservations = Array.isArray(data) ? data : [];
    await verifyPendingPlopPayments(allReservations);
    consentData = await loadConsentData(supabase, session.user.id);

    // Load loyalty cards for this user
    const userEmail = session.user.email;
    const cards = await loadLoyaltyCards(supabase, userEmail);
    const referralCode = await getClientReferralCode(supabase, userEmail, session.user.user_metadata?.full_name);
    const loyaltySection = document.getElementById('loyalty-section');
    if (loyaltySection) {
      loyaltySection.innerHTML = renderLoyaltySection(cards, referralCode);
      if (window.lucide) window.lucide.createIcons();
    }

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

async function populateOnPageProfile(session) {
  let userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
  let userPhone = session.user.user_metadata?.phone || '';
  const userEmail = session.user.email || '';

  try {
    const raw = localStorage.getItem('dalight:user_profile');
    if (raw) {
      const p = JSON.parse(raw);
      if (!userName && p.fullName) userName = p.fullName;
      if (!userPhone && p.phone) userPhone = p.phone;
    }
  } catch(e){}

  try {
    const { data: dbProfile } = await supabase
      .from('profiles')
      .select('full_name, phone, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (dbProfile) {
      if (dbProfile.full_name) userName = dbProfile.full_name;
      if (dbProfile.phone) userPhone = dbProfile.phone;
    }
  } catch(e){}

  const nameEl = document.getElementById('page-profile-name');
  const metaEl = document.getElementById('page-profile-meta');
  const avatarEl = document.getElementById('page-profile-avatar');

  if (nameEl) nameEl.textContent = userName || 'Client DALIGHT';
  if (metaEl) metaEl.textContent = `${userEmail} ${userPhone ? '· ' + userPhone : ''}`;
  if (avatarEl) avatarEl.textContent = (userName ? userName.charAt(0) : (userEmail ? userEmail.charAt(0) : 'D')).toUpperCase();

  // Wire direct logout
  const logoutBtn = document.getElementById('page-direct-logout');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem('dalight:user_profile');
      localStorage.removeItem('dalight_user_profile');
      window.location.href = './login.html';
    };
  }

  // Wire direct delete
  const deleteBtn = document.getElementById('page-direct-delete');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const confirmed = window.confirm("Êtes-vous absolument certain(e) de vouloir supprimer définitivement votre compte DALIGHT ? Vos données personnelles seront effacées.");
      if (!confirmed) return;
      try {
        await supabase.from('profiles').delete().eq('id', session.user.id);
        await supabase.from('reservations').update({ user_id: null, notes: '[Compte client supprimé]' }).eq('user_id', session.user.id);
        await supabase.auth.signOut();
        localStorage.removeItem('dalight:user_profile');
        localStorage.removeItem('dalight_user_profile');
        alert('Votre compte a été supprimé avec succès.');
        window.location.href = '../index.html';
      } catch(err) {
        alert('Erreur: ' + err.message);
      }
    };
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
  await loadReservations();
  handleUrlConsentOpen();
  subscribeToUpdates();
}

function handleUrlConsentOpen() {
  const params = new URLSearchParams(window.location.search);
  const showConsent = params.get('show_consent') === '1';
  const reservationId = params.get('reservation_id');
  if (!showConsent || !reservationId || !allReservations.length) return;

  const r = allReservations.find(res => res.id === reservationId);
  if (!r) return;

  // Clean URL params without reload
  const url = new URL(window.location.href);
  url.searchParams.delete('show_consent');
  url.searchParams.delete('reservation_id');
  window.history.replaceState({}, '', url);

  openConsentForReservation(r.id);
}

window.ChatWidget = {
  open: () => {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) chatBubble.click();
  }
};

initOrdersPage();
