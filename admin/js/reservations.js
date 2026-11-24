// ============================================
// DALIGHT - RESERVATIONS MANAGEMENT
// ============================================

let allReservations = [];
let currentFilter = 'all';
let currentReservation = null;

function formatPaymentMethod(pm) {
  if (!pm) return '—';
  if (String(pm).startsWith('other:')) return String(pm).slice(6);
  const labels = { moncash: 'MonCash', natcash: 'NatCash', bank: 'Banque', card: 'Carte crédit', check: 'Chèque', cash: 'Cash' };
  return labels[pm] || pm;
}

function ico(path, size = 14, color = 'currentColor') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2" width="${size}" height="${size}" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;
}

// ─── PRIX DYNAMIQUES VIDÉO CVISUAL / DALIGHT ──────────────────
window.adminVideoPricePublic = 1000;
window.adminVideoPricePrivate = 2000;

async function loadAdminVideoPricing() {
  try {
    const sb = window.adminCore?.supabase || window.supabaseClient;
    if (!sb) return;
    const { data: setRows } = await sb
      .from('settings')
      .select('key, value')
      .in('key', ['cvisual_video_config', 'video_service']);

    if (setRows && setRows.length) {
      setRows.forEach(row => {
        let val = row.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch(e){}
        }
        if (val) {
          if (val.price_public_htg) window.adminVideoPricePublic = Number(val.price_public_htg);
          if (val.price_private_htg) window.adminVideoPricePrivate = Number(val.price_private_htg);
        }
      });
    }

    // Mise à jour de l'affichage dans le modal de création
    const badgeEl = document.getElementById('create-video-price-badge');
    if (badgeEl) badgeEl.textContent = `+${window.adminVideoPricePublic.toLocaleString()} HTG`;
    const pubEl = document.getElementById('create-video-public-price-text');
    if (pubEl) pubEl.textContent = `+${window.adminVideoPricePublic.toLocaleString()} HTG`;
    const privEl = document.getElementById('create-video-private-price-text');
    if (privEl) privEl.textContent = `+${window.adminVideoPricePrivate.toLocaleString()} HTG`;
  } catch(e) {
    console.warn("Could not load dynamic admin video pricing:", e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const session = await window.adminCore?.checkAdminAuth();
  if (!session) return;
  
  initFilters();
  initSearch();
  initDateFilter();
  initExport();
  loadAdminVideoPricing();
  loadReservations();
});

// ============================================
// FILTERS
// ============================================

function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      renderReservations();
    });
  });
}

function initSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderReservations();
    });
  }
}

function initDateFilter() {
  const dateFilter = document.getElementById('date-filter');
  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      renderReservations();
    });
  }
}

// ============================================
// LOAD & RENDER
// ============================================

async function loadReservations() {
  const { fetchReservations, supabase } = window.adminCore;
  
  try {
    allReservations = await fetchReservations();
    renderReservations();
  } catch (err) {
    console.error('Error loading reservations:', err);
  }
}

function renderReservations() {
  const { formatDate, formatTime, getStatusBadge, getInitials } = window.adminCore;
  const tbody = document.getElementById('reservations-table');
  const countEl = document.getElementById('reservations-count');
  const searchInput = document.getElementById('search-input');
  const dateFilter = document.getElementById('date-filter');
  
  let filtered = [...allReservations];
  
  // Apply status filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(r => r.status === currentFilter);
  }
  
  // Apply search filter
  if (searchInput && searchInput.value) {
    const search = searchInput.value.toLowerCase();
    filtered = filtered.filter(r => 
      (r.user_email && r.user_email.toLowerCase().includes(search)) ||
      (r.user_name && r.user_name.toLowerCase().includes(search)) ||
      (r.service && r.service.toLowerCase().includes(search))
    );
  }
  
  // Apply date filter
  if (dateFilter && dateFilter.value) {
    filtered = filtered.filter(r => r.date === dateFilter.value);
  }
  
  // Update count
  if (countEl) {
    countEl.textContent = `${filtered.length} réservation${filtered.length > 1 ? 's' : ''}`;
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding: 3rem;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom: 1rem; opacity: 0.5;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <p>Aucune réservation trouvée</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${getInitials(r.user_name || r.user_email)}</div>
          <div>
            <div style="font-weight: 500;">${r.user_name || 'Client'}</div>
            <div class="text-muted" style="font-size: 0.8rem;">${r.user_email}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 500;">${r.service}</div>
        ${r.notes ? `<div class="text-muted" style="font-size: 0.8rem;">${truncateText(r.notes, 30)}</div>` : ''}
      </td>
      <td>
        <div style="font-weight: 500;">${formatDate(r.date)}</div>
        <div class="text-muted" style="font-size: 0.8rem;">${formatTime(r.time)}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:.35rem;font-size:.85rem;">
          ${r.location === 'Spa'
            ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Au Spa`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> Domicile`}
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:.35rem;font-size:.82rem;font-weight:500;">
          ${r.payment_method === 'moncash' || r.payment_method === 'natcash'
            ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`
            : r.payment_method === 'bank'
            ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h1v11M9 10h1v11M14 10h1v11M19 10h1v11"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`}
          ${formatPaymentMethod(r.payment_method)}
        </div>
        ${r.payment_proof_url ? `<div style="font-size:.72rem;color:#22c55e;margin-top:.2rem;">Preuve reçue</div>` : ''}
      </td>
      <td>${getStatusBadge(r.status)}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-icon btn-secondary btn-sm" onclick="openDetailModal('${r.id}')" title="Voir">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          ${r.status === 'PENDING' ? `
            <button class="btn btn-icon btn-success btn-sm" onclick="updateStatus('${r.id}', 'CONFIRMED')" title="Confirmer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-danger btn-sm" onclick="updateStatus('${r.id}', 'CANCELLED')" title="Annuler">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          ` : ''}
          ${r.status === 'AWAITING_PAYMENT' ? `
            <button class="btn btn-icon btn-success btn-sm" onclick="updateStatus('${r.id}', 'CONFIRMED')" title="Confirmer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
            <button class="btn btn-icon btn-danger btn-sm" onclick="updateStatus('${r.id}', 'CANCELLED')" title="Annuler">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          ` : ''}
          ${r.status === 'CONFIRMED' ? `
            <button class="btn btn-icon btn-success btn-sm" onclick="updateStatus('${r.id}', 'COMPLETED')" title="Marquer terminé">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// ============================================
// MODAL
// ============================================


// ============================================
// GIFT RESERVATION & DÉDICACE PARSER / RENDERER
// ============================================

function parseGiftReservationDetails(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const isGift = notes.includes('[RÉSERVATION POUR UN(E) PROCHE / CADEAU]') ||
                 notes.includes('Nom du bénéficiaire') ||
                 notes.includes('Dédicace');

  if (!isGift) return null;

  const nameMatch = notes.match(/•\s*Nom du bénéficiaire\s*:\s*([^\n\r•]+)/i);
  const phoneMatch = notes.match(/•\s*Téléphone WhatsApp bénéficiaire\s*:\s*([^\n\r•]+)/i);
  const dedieMatch = notes.match(/•\s*Message\s*\/\s*Dédicace\s*:\s*([\s\S]*?)(?=(•\s*Date d'envoi|•\s*Notes client|$))/i);
  const sendScheduleMatch = notes.match(/•\s*Date d'envoi souhaitée\s*:\s*([^\n\r•]+)/i);
  const clientNotesMatch = notes.match(/•\s*Notes client\s*:\s*([\s\S]*?)$/i);

  const beneficiaryName = nameMatch ? nameMatch[1].trim() : '';
  const beneficiaryPhone = phoneMatch ? phoneMatch[1].trim() : '';
  let dedicationMessage = dedieMatch ? dedieMatch[1].trim() : '';
  if (dedicationMessage === 'Aucun') dedicationMessage = '';
  const sendSchedule = sendScheduleMatch ? sendScheduleMatch[1].trim() : '';
  const clientNotes = clientNotesMatch ? clientNotesMatch[1].trim() : '';

  return {
    isGift: true,
    beneficiaryName,
    beneficiaryPhone,
    dedicationMessage,
    sendSchedule,
    clientNotes
  };
}

function renderGiftDedicationCard(r, giftInfo) {
  const ico = (path, size = 14, color = 'currentColor') =>
    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2" width="${size}" height="${size}" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const purchaser = r.user_name || 'Client(e)';
  const cleanPhone = giftInfo.beneficiaryPhone ? giftInfo.beneficiaryPhone.replace(/\D/g, '') : '';
  const waDirectLink = cleanPhone ? `https://wa.me/${cleanPhone.length === 8 ? '509' + cleanPhone : cleanPhone}` : '#';

  return `
    <!-- Carte Cadeau & Dédicace DALIGHT Haute Couture -->
    <div style="background: linear-gradient(135deg, rgba(34,47,29,0.95), rgba(18,27,18,0.98)); border: 1px solid rgba(212,175,55,0.45); border-radius: 14px; padding: 1.25rem; box-shadow: 0 10px 25px rgba(0,0,0,0.4), inset 0 0 20px rgba(212,175,55,0.06); display: grid; gap: 0.9rem;">
      
      <!-- Card Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(212,175,55,0.25); padding-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <div style="background: rgba(212,175,55,0.18); width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(212,175,55,0.35);">
            ${ico('M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H5z', 18, '#d4af37')}
          </div>
          <div>
            <div style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.2rem; font-weight: 700; color: #FAF8F5; letter-spacing: 0.03em;">
              CARTE CADEAU &amp; DÉDICACE PERSONNALISÉE
            </div>
            <div style="font-size: 0.78rem; color: var(--admin-accent); display: flex; align-items: center; gap: 0.35rem; margin-top: 0.1rem;">
              Offert avec bienveillance par <strong style="color: #fff;">${escapeHtml(purchaser)}</strong>
            </div>
          </div>
        </div>
        <span style="background: rgba(212,175,55,0.18); color: #d4af37; border: 1px solid rgba(212,175,55,0.4); padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em;">
          SOIN CADEAU
        </span>
      </div>

      <!-- Beneficiary Details -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.75rem; background: rgba(0,0,0,0.3); padding: 0.85rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
        <div>
          <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.2rem;">Bénéficiaire du soin</span>
          <strong style="font-size: 0.98rem; color: #FAF8F5;">${escapeHtml(giftInfo.beneficiaryName || 'Non spécifié')}</strong>
        </div>
        <div>
          <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.2rem;">Téléphone WhatsApp Bénéficiaire</span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong style="font-size: 0.98rem; color: #4ade80;">${escapeHtml(giftInfo.beneficiaryPhone || 'Non spécifié')}</strong>
            ${cleanPhone ? `
            <a href="${waDirectLink}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; justify-content: center; background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.35); border-radius: 6px; padding: 0.2rem 0.45rem; font-size: 0.72rem; color: #4ade80; text-decoration: none;">
              Ouvrir chat ↗
            </a>` : ''}
          </div>
        </div>
        ${giftInfo.sendSchedule ? `
        <div style="grid-column: 1 / -1; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.45rem;">
          ${ico('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 14, '#f59e0b')}
          <span style="font-size: 0.76rem; color: var(--admin-text-muted);">Moment d'envoi demandé :</span>
          <strong style="font-size: 0.85rem; color: #fbbf24;">${escapeHtml(giftInfo.sendSchedule)}</strong>
        </div>` : ''}
      </div>

      <!-- Dédicace Message Letter Box -->
      ${giftInfo.dedicationMessage ? `
      <div style="background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.25); border-left: 4px solid #d4af37; border-radius: 0 10px 10px 0; padding: 1rem 1.25rem; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--admin-accent); font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
            ${ico('M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z', 13)}
            Dédicace Personnalisée
          </div>
          <button type="button" onclick="copyDedicationMessage('${r.id}')" style="background: transparent; border: none; color: var(--admin-accent); font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
            ${ico('M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3', 12)}
            Copier
          </button>
        </div>
        <div style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.05rem; font-style: italic; line-height: 1.6; color: #FAF8F5; white-space: pre-wrap;">
          « ${escapeHtml(giftInfo.dedicationMessage)} »
        </div>
      </div>` : ''}

      <!-- Direct Action Buttons for Gift -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; padding-top: 0.35rem;">
        <button type="button" class="btn btn-primary btn-sm" onclick="sendGiftWhatsAppDedicationAction('${r.id}')" style="display: inline-flex; align-items: center; gap: 0.4rem; background: linear-gradient(135deg, #25D366, #128C7E); border: none; font-weight: 600; color: #fff;">
          ${ico('M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', 13, '#fff')}
          Envoyer Dédicace au Bénéficiaire (WhatsApp)
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="copyDedicationMessage('${r.id}')" style="display: inline-flex; align-items: center; gap: 0.35rem;">
          ${ico('M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3', 13)}
          Copier le texte
        </button>
      </div>

      <!-- Medical / Salon health notes separated -->
      ${giftInfo.clientNotes ? `
      <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.82rem; margin-top: 0.2rem;">
        <span style="color: #f87171; font-weight: 600; display: block; margin-bottom: 0.15rem;">Notes santé / préférences pour la praticienne :</span>
        <span style="color: #FAF8F5;">${escapeHtml(giftInfo.clientNotes)}</span>
      </div>` : ''}
    </div>`;
}

window.openDetailModal = function(id) {
  const { formatDate, formatTime, getStatusBadge } = window.adminCore;
  const r = allReservations.find(r => r.id === id);
  if (!r) return;

  currentReservation = r;
  const giftInfo = parseGiftReservationDetails(r.notes);

  const modal   = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');
  const footer  = document.getElementById('modal-footer');

  // ── Helpers ──────────────────────────────────────────────────
  const fmtHTG = n => n ? Number(n).toLocaleString('fr-FR') + ' HTG' : '—';
  const ico = (path, size = 14, color = 'currentColor') =>
    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2" width="${size}" height="${size}" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;

  // ── Payment method ────────────────────────────────────────────
  const _pmRaw = r.payment_method || '';
  const _pm = _pmRaw.toLowerCase();
  const isOther = _pmRaw.startsWith('other:');
  const isMobilePay = ['moncash', 'natcash', 'kashpaw'].includes(_pm);
  const methodMeta = {
    moncash: { label: 'MonCash',         path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    natcash: { label: 'NatCash',         path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    kashpaw: { label: 'KashPaw',         path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    bank:    { label: 'Compte Bancaire', path: 'M3 21h18M3 10h18M3 7l9-4 9 4M4 10h1v11M9 10h1v11M14 10h1v11M19 10h1v11' },
  };
  const mm = methodMeta[_pm] || { label: isOther ? formatPaymentMethod(_pmRaw) : (r.payment_method || 'Non spécifié'), path: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' };

  // ── Price ─────────────────────────────────────────────────────
  const totalAmt   = parseFloat(r.total_amount || r.total_price || 0);
  const depositAmt = parseFloat(r.deposit_amount || 0);
  const balancePaid = parseFloat(r.balance_amount_paid || 0);
  const isFull     = r.payment_choice === 'full' || r.payment_status === 'fully_paid';
  const amtPaid    = isFull ? totalAmt : depositAmt + balancePaid;
  const balance    = isFull ? 0 : Math.max(0, totalAmt - depositAmt - balancePaid);

  const priceBlock = totalAmt > 0 ? `
    <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--admin-border);display:grid;gap:.4rem;">
      <div style="display:flex;justify-content:space-between;font-size:.83rem;">
        <span style="color:var(--admin-text-muted);">Total service</span>
        <span style="font-weight:600;">${fmtHTG(totalAmt)}</span>
      </div>
      ${!isFull ? `
      <div style="display:flex;justify-content:space-between;font-size:.83rem;">
        <span style="color:var(--admin-text-muted);">Acompte versé</span>
        <span style="font-weight:600;color:#f59e0b;">${fmtHTG(amtPaid)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(245,158,11,.09);padding:.55rem .75rem;border-radius:8px;border:1px solid rgba(245,158,11,.25);margin-top:.1rem;">
        <span style="color:#d97706;font-weight:600;font-size:.85rem;">Solde à payer</span>
        <span style="font-weight:700;color:#d97706;font-size:1rem;">${fmtHTG(balance)}</span>
      </div>` : `
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(5,150,105,.08);padding:.55rem .75rem;border-radius:8px;border:1px solid rgba(5,150,105,.2);margin-top:.1rem;">
        <span style="color:#059669;font-weight:600;font-size:.85rem;">Paiement complet reçu</span>
        <span style="font-weight:700;color:#059669;font-size:1rem;">${fmtHTG(totalAmt)}</span>
      </div>`}
    </div>` : '';

  // ── Payment proof ─────────────────────────────────────────────
  // Show for bank always; for moncash/natcash only if it's a legacy screenshot reservation
  // Legacy = moncash/natcash paid via manual screenshot (proof exists, no external reference)
  const isLegacyMobilePay = isMobilePay && !r.payment_reference && !!r.payment_proof_url;
  let proofs = Array.isArray(r.payment_proofs) ? r.payment_proofs : [];
  if (proofs.length === 0 && r.payment_proof_url) proofs = [r.payment_proof_url];
  const proofHtml = (!isMobilePay || isLegacyMobilePay) && proofs.length > 0 ? `
    <div>
      <div style="display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--admin-text-muted);margin-bottom:.5rem;">
        ${ico('M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z')}
        Preuve(s) de paiement (${proofs.length})
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;">
        ${proofs.map((p, i) => `
          <div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--admin-border);">
            <img src="${p}" alt="Preuve ${i+1}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;" onclick="window.open('${p}','_blank')">
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;padding:.2rem;font-size:.7rem;text-align:center;">
              ${i === 0 ? 'Acompte' : i === 1 ? 'Paiement complet' : 'Preuve ' + (i+1)}
            </div>
          </div>`).join('')}
      </div>
    </div>` : '';

  // ── Actions & Communications HTML ────────────────────────────
  const automaticButtonsHtml = `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--admin-border);border-radius:10px;padding:.75rem;">
      <div style="font-size:.75rem;font-weight:600;color:var(--admin-text-muted);margin-bottom:.45rem;display:flex;align-items:center;gap:.3rem;">
        ${ico('M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2', 13)} Actions automatiques (Brevo & Statut)
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
        ${r.status === 'PENDING' ? `
          <button class="btn btn-success btn-sm" onclick="autoConfirmReservation('${r.id}')">Confirmer &amp; Email</button>
          <button class="btn btn-secondary btn-sm" onclick="autoSetPending('${r.id}')">Remettre en attente</button>` : ''}
        ${r.status === 'CONFIRMED' ? `
          <button class="btn btn-success btn-sm" onclick="autoCompleteReservation('${r.id}')">Terminer &amp; Email</button>` : ''}
      </div>
    </div>`;

  const whatsappButtonsHtml = `
    <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.25);border-radius:10px;padding:.75rem;">
      <div style="font-size:.75rem;font-weight:600;color:var(--admin-accent);margin-bottom:.45rem;display:flex;align-items:center;gap:.35rem;">
        ${ico('M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', 13)} Actions WhatsApp (Ligne #3 DALIGHT Dédiée)
      </div>
      <div style="display:flex;gap:.45rem;flex-wrap:wrap;">
        ${giftInfo ? `
        <button class="btn btn-primary btn-sm" onclick="sendGiftWhatsAppDedicationAction('${r.id}')" style="background:linear-gradient(135deg,#d4af37,#996515);border:none;color:#fff;font-weight:600;" title="Envoyer dédicace au bénéficiaire">
          ${ico('M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H5z', 12, '#fff')} Envoyer Dédicace (Bénéficiaire)
        </button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="sendWhatsAppConfirmationAction('${r.id}')" title="Renvoyer confirmation WhatsApp">
          ${ico('M5 13l4 4L19 7', 12)} Confirmer (WhatsApp)
        </button>
        <button class="btn btn-secondary btn-sm" onclick="sendWhatsAppReminder24hAction('${r.id}')" title="Rappel J-1 avec règle 24h">
          ${ico('M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', 12)} Rappel J-1 (WhatsApp)
        </button>
        <button class="btn btn-secondary btn-sm" onclick="sendWhatsAppAlert30mAction('${r.id}')" title="Alerte départ & retard (H-30 min)">
          ${ico('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 12)} Alerte H-30 min (Retard)
        </button>
      </div>
    </div>`;

  const emailButtonsHtml = `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--admin-border);border-radius:10px;padding:.75rem;">
      <div style="font-size:.75rem;font-weight:600;color:var(--admin-text-muted);margin-bottom:.45rem;display:flex;align-items:center;gap:.35rem;">
        ${ico('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', 13)} Emails manuels Brevo
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','confirmation')">Confirmation</button>
        <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','cancellation')">Annulation</button>
        <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','reminder')">Rappel</button>
        <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','completion')">Terminé</button>
        <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','custom')">Vide</button>
      </div>
    </div>`;

  // ── Content HTML ──────────────────────────────────────────────
  content.innerHTML = `
    <div style="display:grid;gap:1rem;">

      <!-- Status row -->
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:.8rem;color:var(--admin-text-muted);">Statut</span>
        ${getStatusBadge(r.status)}
      </div>

      <hr style="border:none;border-top:1px solid var(--admin-border);">

      <!-- Client card -->
      <div style="background:var(--admin-bg);border-radius:12px;padding:1rem;display:grid;gap:.65rem;">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div style="background:var(--admin-accent-light,rgba(201,162,39,.12));border-radius:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${ico('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', 18, 'var(--admin-accent,#c9a227)')}
          </div>
          <div>
            <div style="font-weight:600;font-size:.95rem;">${r.user_name || 'Client non renseigné'}</div>
            <div style="font-size:.75rem;color:var(--admin-text-muted);">Client</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--admin-text-muted);">
          ${ico('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z')}
          <span style="color:var(--admin-text);">${r.user_email || '—'}</span>
        </div>
        ${r.phone ? `
        <div style="display:flex;align-items:center;gap:.5rem;font-size:.88rem;">
          ${ico('M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', 14, 'var(--admin-accent,#c9a227)')}
          <strong>${r.phone}</strong>
        </div>` : ''}
      </div>


      <!-- Section Actions Rapides & Communications Client -->
      <div style="background:var(--admin-bg);border-radius:12px;padding:1rem;border:1px solid var(--admin-border);display:grid;gap:.75rem;">
        <div style="font-weight:600;font-size:.88rem;color:var(--admin-accent);display:flex;align-items:center;gap:.4rem;">
          ${ico('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', 15, 'var(--admin-accent)')}
          Communications & Notifications
        </div>
        ${whatsappButtonsHtml}
        ${automaticButtonsHtml}
        ${emailButtonsHtml}
      </div>

      <!-- Date / Time / Service / Location -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
        <div style="background:var(--admin-bg);border-radius:10px;padding:.75rem;">
          <div style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:var(--admin-text-muted);margin-bottom:.3rem;">
            ${ico('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')} Date
          </div>
          <div style="font-weight:600;font-size:.9rem;">${formatDate(r.date)}</div>
        </div>
        <div style="background:var(--admin-bg);border-radius:10px;padding:.75rem;">
          <div style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:var(--admin-text-muted);margin-bottom:.3rem;">
            ${ico('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z')} Heure
          </div>
          <div style="font-weight:600;font-size:.9rem;">${formatTime(r.time)}</div>
        </div>
        <div style="background:var(--admin-bg);border-radius:10px;padding:.75rem;">
          <div style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:var(--admin-text-muted);margin-bottom:.3rem;">
            ${ico('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z')} Service
          </div>
          <div style="font-weight:600;font-size:.88rem;">${r.service || '—'}</div>
        </div>
        <div style="background:var(--admin-bg);border-radius:10px;padding:.75rem;">
          <div style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:var(--admin-text-muted);margin-bottom:.3rem;">
            ${ico('M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z')} Lieu
          </div>
          <div style="font-weight:600;font-size:.88rem;">${r.location === 'Spa' ? 'DALIGHT — Delmas 65' : 'À domicile'}</div>
        </div>
      </div>

      <!-- Payment card -->
      <div style="background:var(--admin-bg);border-radius:12px;padding:1rem;border:1px solid var(--admin-border);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--admin-text-muted);">
            ${ico('M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z')} Paiement
          </div>
          <div style="display:flex;align-items:center;gap:.4rem;font-weight:600;font-size:.9rem;">
            ${ico(mm.path, 15)} ${mm.label}
          </div>
        </div>
        <div style="margin-top:.6rem;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:.78rem;color:var(--admin-text-muted);">Type</div>
          <div style="display:inline-flex;align-items:center;gap:.35rem;padding:.25rem .6rem;border-radius:20px;font-size:.8rem;font-weight:600;
            ${isFull
              ? 'background:rgba(5,150,105,.1);color:#059669;border:1px solid rgba(5,150,105,.2);'
              : 'background:rgba(245,158,11,.1);color:#d97706;border:1px solid rgba(245,158,11,.2);'}">
            ${isFull
              ? ico('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 13, '#059669') + ' Paiement complet'
              : ico('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 13, '#d97706') + ' Acompte'}
          </div>
        </div>
        ${priceBlock}
      </div>

      ${proofHtml}

      ${r.id_type ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
        <div style="background:var(--admin-bg);border-radius:10px;padding:.75rem;">
          <div style="font-size:.72rem;color:var(--admin-text-muted);margin-bottom:.25rem;">Type d'ID</div>
          <div style="font-weight:600;">${r.id_type}</div>
        </div>
        <div style="background:var(--admin-bg);border-radius:10px;padding:.75rem;">
          <div style="font-size:.72rem;color:var(--admin-text-muted);margin-bottom:.25rem;">Numéro d'ID</div>
          <div style="font-weight:600;">${r.id_number}</div>
        </div>
      </div>` : ''}

      ${giftInfo ? renderGiftDedicationCard(r, giftInfo) : (r.notes ? `
      <div>
        <div style="font-size:.78rem;color:var(--admin-text-muted);margin-bottom:.35rem;">Notes</div>
        <div style="background:var(--admin-bg);padding:.85rem 1rem;border-radius:10px;border:1px solid var(--admin-border);font-size:.88rem;">${r.notes}</div>
      </div>` : '')}

      ${(r.wants_video || r.video_requested) ? `
      <!-- Option Video Souvenir -->
      <div style="background:var(--admin-bg);border-radius:12px;padding:1rem;border:1px solid rgba(212,175,55,0.3);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:.6rem;">
          <div style="background:rgba(212,175,55,0.15);width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${ico('M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', 17, 'var(--admin-accent,#c9a227)')}
          </div>
          <div>
            <div style="font-weight:600;font-size:.88rem;color:var(--admin-accent,#c9a227);">Option Vidéo Souvenir Professionnelle 4K (CVISUAL)</div>
            <div style="font-size:.76rem;color:var(--admin-text-muted);margin-top:.15rem;">
              Consentement : <strong style="color:var(--admin-text);">${r.video_consent === 'private' ? 'Usage Privé Uniquement (WhatsApp)' : 'Autorisé Réseaux Sociaux (Public)'}</strong>
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;color:var(--admin-accent,#c9a227);font-size:.95rem;">+${(Number(r.video_price) || (r.video_consent === 'private' ? (window.adminVideoPricePrivate || 2000) : (window.adminVideoPricePublic || 1000))).toLocaleString()} HTG</div>
          <span style="font-size:.7rem;padding:.15rem .5rem;border-radius:6px;background:rgba(74,222,128,0.15);color:#4ade80;font-weight:600;">Inclus</span>
          <div style="margin-top:0.4rem;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.toggleReservationVideoAdmin('${r.id}', false)" style="font-size:0.7rem; color:#f87171; border-color:rgba(239,68,68,0.3); padding:0.2rem 0.55rem; cursor:pointer;">Désactiver Option Vidéo</button>
          </div>
        </div>
      </div>` : `
      <!-- Option Video Non Activée -->
      <div style="background:var(--admin-bg);border-radius:12px;padding:0.85rem 1rem;border:1px dashed rgba(212,175,55,0.3);display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:.6rem;">
          <div style="background:rgba(212,175,55,0.15);width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${ico('M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', 17, 'var(--admin-accent,#c9a227)')}
          </div>
          <div>
            <div style="font-weight:600;font-size:.88rem;color:var(--admin-accent,#c9a227);">Option Vidéo Souvenir Professionnelle 4K (CVISUAL)</div>
            <div style="font-size:.76rem;color:var(--admin-text-muted);margin-top:.15rem;">Non activée pour cette réservation</div>
          </div>
        </div>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" onclick="window.toggleReservationVideoAdmin('${r.id}', true, 'public')" style="font-size:0.75rem; padding:0.35rem 0.65rem; background:linear-gradient(135deg, #d4af37, #996515); border:none; color:#fff; cursor:pointer;">+ Activer Vidéo Public (${(window.adminVideoPricePublic || 1000).toLocaleString()} HTG)</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.toggleReservationVideoAdmin('${r.id}', true, 'private')" style="font-size:0.75rem; padding:0.35rem 0.65rem; border-color:rgba(212,175,55,0.3); color:#FAF8F5; cursor:pointer;">+ Activer Privé (${(window.adminVideoPricePrivate || 2000).toLocaleString()} HTG)</button>
        </div>
      </div>`}

      <!-- Consent Form section -->
      <div id="consent-section-${r.id}" style="background:var(--admin-bg);border-radius:12px;padding:1rem;border:1px solid var(--admin-border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
          <div style="display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--admin-text-muted);">
            ${ico('M9 12h6m-6 4h6m-2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2M9 12l2-2m-2 2l-2-2m2 2v6', 14)} Formulaire de consentement
          </div>
        </div>
        <div id="consent-status-${r.id}" style="font-size:.85rem;">
          <div class="loading-spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:.4rem;"></div> Chargement...
        </div>
      </div>

      <div style="font-size:.75rem;color:var(--admin-text-muted);">
        Créé le ${formatDate(r.created_at)}
      </div>
    </div>`;

  // ── Footer ────────────────────────────────────────────────────
  const showBalanceBtn = balance > 0 && !isFull && r.status !== 'CANCELLED';

  let actions = '';
  if (r.status === 'PENDING') {
    actions = `
      <button class="btn btn-danger btn-sm" onclick="updateStatus('${r.id}','CANCELLED');closeModal();">Annuler</button>
      <button class="btn btn-primary btn-sm" onclick="updateStatus('${r.id}','CONFIRMED');closeModal();">Confirmer</button>`;
  } else if (r.status === 'AWAITING_PAYMENT') {
    actions = `
      <button class="btn btn-danger btn-sm" onclick="updateStatus('${r.id}','CANCELLED');closeModal();">Annuler</button>
      <button class="btn btn-primary btn-sm" onclick="updateStatus('${r.id}','CONFIRMED');closeModal();">Confirmer</button>`;
  } else if (r.status === 'CONFIRMED') {
    actions = `
      <button class="btn btn-secondary btn-sm" onclick="closeModal()">Fermer</button>
      ${showBalanceBtn ? `<button class="btn btn-primary btn-sm" onclick="openBalanceModal('${r.id}')">${ico('M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', 14)} Payer solde</button>` : ''}
      <button class="btn btn-primary btn-sm" onclick="updateStatus('${r.id}','COMPLETED');closeModal();">Marquer terminé</button>`;
  } else {
    actions = `<button class="btn btn-secondary btn-sm" onclick="closeModal()">Fermer</button>`;
  }

  footer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:.75rem;flex-wrap:wrap;">
      <button class="btn btn-secondary btn-sm" onclick="printReservationDetail('${r.id}')" style="display:flex;align-items:center;gap:.35rem;">
        ${ico('M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z', 14)} Imprimer
      </button>
      <div style="display:flex;gap:.5rem;align-items:center;">
        ${actions}
      </div>
    </div>`;
  footer.style.flexDirection = 'row';
  footer.style.alignItems = 'center';
  footer.style.padding = '0.75rem 0 0 0';
  modal.classList.add('active');

  // Load consent form info asynchronously
  loadConsentSection(r.id);
};

window.closeModal = function() {
  const modal = document.getElementById('detail-modal');
  modal.classList.remove('active');
  currentReservation = null;
};

// ── Print reservation detail ────────────────────────────────────────────────
window.printReservationDetail = function(id) {
  const r = allReservations.find(r => r.id === id);
  if (!r) return;

  const fmtHTG = n => n ? Number(n).toLocaleString('fr-FR') + ' HTG' : '—';
  const totalAmt = parseFloat(r.total_amount || r.total_price || 0);
  const depositAmt = parseFloat(r.deposit_amount || 0);
  const isFull = r.payment_choice === 'full' || r.payment_status === 'fully_paid';
  const balancePaid = parseFloat(r.balance_amount_paid || 0);
  const balance = isFull ? 0 : Math.max(0, totalAmt - depositAmt - balancePaid);
  const amtPaid = isFull ? totalAmt : depositAmt + balancePaid;

  const printHtml = `
    <div style="max-width:210mm;margin:0 auto;padding:10mm;font-family:Inter,sans-serif;color:#1a1a1a;">
      <div style="text-align:center;margin-bottom:8mm;">
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#4A3728;">DALIGHT</div>
        <div style="font-size:10px;color:#7a7068;letter-spacing:2px;text-transform:uppercase;">L'Art du Bien-Être</div>
        <div style="font-size:9px;color:#6b7280;margin-top:4px;line-height:1.5;">
          Delmas 65, Faustin Premier Durandise #10<br>
          Port-au-Prince • +509 47 47 72 21
        </div>
      </div>
      <hr style="border:none;border-top:1px dashed #d1d5db;margin:5mm 0;">
      <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">Reçu #${r.reservation_number || r.id}</div>
      <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
      <hr style="border:none;border-top:1px dashed #d1d5db;margin:5mm 0;">
      <div style="margin-bottom:6mm;">
        <div style="font-size:11px;font-weight:700;margin-bottom:3px;">Client</div>
        <div style="font-size:10px;">${r.user_name || 'Client'}</div>
        <div style="font-size:10px;color:#6b7280;">${r.user_email || '—'}</div>
        <div style="font-size:10px;color:#6b7280;">${r.phone || '—'}</div>
      </div>
      <div style="margin-bottom:6mm;">
        <div style="font-size:11px;font-weight:700;margin-bottom:3px;">Service</div>
        <div style="font-size:10px;">${r.service || '—'}</div>
        <div style="font-size:10px;color:#6b7280;">${formatDate(r.date)} à ${formatTime(r.time)} — ${r.location === 'Spa' ? 'Au Spa' : 'À domicile'}</div>
      </div>
      <hr style="border:none;border-top:1px dashed #d1d5db;margin:5mm 0;">
      ${r.promo_code ? `<div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Code promo</span><span><strong>${r.promo_code}</strong>${r.discount_amount ? ' (−' + fmtHTG(r.discount_amount) + ')' : ''}</span></div>` : ''}
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Total service</span><span>${fmtHTG(totalAmt)}</span></div>
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Acompte / Payé</span><span>${fmtHTG(amtPaid)}</span></div>
      ${balance > 0 ? `<div style="font-size:11px;display:flex;justify-content:space-between;margin-top:4px;font-weight:700;color:#92400e;"><span>SOLDE RESTANT</span><span>${fmtHTG(balance)}</span></div>` : `<div style="font-size:11px;display:flex;justify-content:space-between;margin-top:4px;font-weight:700;color:#059669;"><span>PAIEMENT COMPLET</span><span>${fmtHTG(totalAmt)}</span></div>`}
      <hr style="border:none;border-top:1px dashed #d1d5db;margin:5mm 0;">
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Méthode de paiement</span><span>${formatPaymentMethod(r.payment_method).toUpperCase()}</span></div>
      ${r.balance_payment_method ? `<div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Méthode solde</span><span>${formatPaymentMethod(r.balance_payment_method).toUpperCase()}</span></div>` : ''}
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Statut</span><span>${r.status}</span></div>
      <div style="text-align:center;font-size:9px;color:#9ca3af;margin-top:10mm;line-height:1.6;">
        Merci pour votre confiance!<br>
        @dalightbeauty
      </div>
    </div>
  `;

  const printArea = document.getElementById('print-area');
  printArea.innerHTML = printHtml;
  window.print();
  printArea.innerHTML = '';
};

// ── Print all reservations list ─────────────────────────────────────────────
window.printReservationsList = function() {
  const { formatDate, formatTime, getStatusBadge } = window.adminCore;
  const searchInput = document.getElementById('search-input');
  const dateFilter = document.getElementById('date-filter');

  let filtered = [...allReservations];
  if (currentFilter !== 'all') filtered = filtered.filter(r => r.status === currentFilter);
  if (searchInput && searchInput.value) {
    const q = searchInput.value.toLowerCase();
    filtered = filtered.filter(r =>
      (r.user_email && r.user_email.toLowerCase().includes(q)) ||
      (r.user_name && r.user_name.toLowerCase().includes(q)) ||
      (r.service && r.service.toLowerCase().includes(q))
    );
  }
  if (dateFilter && dateFilter.value) filtered = filtered.filter(r => r.date === dateFilter.value);

  const rows = filtered.map(r => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${r.user_name || 'Client'}</td>
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${r.service || '—'}</td>
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${formatDate(r.date)} ${formatTime(r.time)}</td>
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${r.location === 'Spa' ? 'Au Spa' : 'Domicile'}</td>
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${formatPaymentMethod(r.payment_method)} (${r.payment_choice === 'full' ? 'Complet' : 'Acompte'})</td>
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${r.status}</td>
    </tr>
  `).join('');

  const printHtml = `
    <div style="max-width:297mm;margin:0 auto;padding:10mm;font-family:Inter,sans-serif;color:#1a1a1a;">
      <div style="text-align:center;margin-bottom:8mm;">
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#4A3728;">DALIGHT</div>
        <div style="font-size:10px;color:#7a7068;letter-spacing:2px;text-transform:uppercase;">Liste des réservations</div>
      </div>
      <div style="font-size:9px;color:#6b7280;margin-bottom:4mm;">
        Filtre: ${currentFilter === 'all' ? 'Toutes' : currentFilter} — ${dateFilter && dateFilter.value ? 'Date: ' + dateFilter.value : 'Toutes les dates'} — Imprimé le ${new Date().toLocaleDateString('fr-FR')}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Client</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Service</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Date & Heure</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Lieu</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Paiement</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" style="text-align:center;padding:10px;font-size:9px;">Aucune réservation</td></tr>'}
        </tbody>
      </table>
      <div style="font-size:9px;color:#6b7280;margin-top:5mm;">Total: ${filtered.length} réservation${filtered.length > 1 ? 's' : ''}</div>
    </div>
  `;

  const printArea = document.getElementById('print-area');
  printArea.innerHTML = printHtml;
  window.print();
  printArea.innerHTML = '';
};

// ── Balance payment ─────────────────────────────────────────────────────────
let balanceReservationId = null;
let selectedBalancePM = 'cash';
let currentBalanceDue = 0;

window.openBalanceModal = function(id) {
  const r = allReservations.find(r => r.id === id);
  if (!r) return;

  const due = computeBalance(r);
  if (due <= 0) {
    window.adminCore.showToast('Aucun solde à payer pour cette réservation.', 'info');
    return;
  }

  balanceReservationId = id;
  selectedBalancePM = 'cash';
  currentBalanceDue = due;
  document.querySelectorAll('.balance-pm-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.pm === 'cash'));
  document.getElementById('balance-reference').value = '';
  document.getElementById('balance-amount').value = '';
  document.getElementById('balance-other-text').value = '';
  document.getElementById('balance-other-wrap').style.display = 'none';

  const totalAmt = parseFloat(r.total_amount || r.total_price || 0);
  const depositAmt = parseFloat(r.deposit_amount || 0);
  const balancePaid = parseFloat(r.balance_amount_paid || 0);
  const paidSoFar = depositAmt + balancePaid;

  document.getElementById('balance-info').innerHTML = `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:.75rem 1rem;">
      <div style="font-size:.78rem;color:#92400e;margin-bottom:.25rem;">Solde restant</div>
      <div style="font-size:1.4rem;font-weight:700;color:#b45309;">${currentBalanceDue.toLocaleString('fr-FR')} HTG</div>
      <div style="font-size:.75rem;color:#92400e;margin-top:.25rem;">
        Total: ${totalAmt.toLocaleString('fr-FR')} HTG — Déjà payé: ${paidSoFar.toLocaleString('fr-FR')} HTG
      </div>
    </div>
  `;

  const modal = document.getElementById('balance-modal');
  modal.style.display = 'flex';
  modal.classList.add('active');
};

function computeBalance(r) {
  const totalAmt = parseFloat(r.total_amount || r.total_price || 0);
  const depositAmt = parseFloat(r.deposit_amount || 0);
  const balancePaid = parseFloat(r.balance_amount_paid || 0);
  const isFull = r.payment_choice === 'full' || r.payment_status === 'fully_paid';
  return isFull ? 0 : Math.max(0, totalAmt - depositAmt - balancePaid);
}

window.closeBalanceModal = function() {
  const modal = document.getElementById('balance-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  balanceReservationId = null;
  currentBalanceDue = 0;
};

window.selectBalancePM = function(pm) {
  selectedBalancePM = pm;
  document.querySelectorAll('.balance-pm-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pm === pm);
  });
  const otherWrap = document.getElementById('balance-other-wrap');
  if (otherWrap) otherWrap.style.display = pm === 'other' ? 'block' : 'none';
};

window.processBalancePayment = async function() {
  if (!balanceReservationId) return;
  const r = allReservations.find(r => r.id === balanceReservationId);
  if (!r) return;

  const supabase = getSupabaseClient();
  if (!supabase) {
    window.adminCore.showToast('Connexion Supabase non disponible.', 'error');
    return;
  }

  const totalAmt = parseFloat(r.total_amount || r.total_price || 0);
  const depositAmt = parseFloat(r.deposit_amount || 0);
  const balancePaid = parseFloat(r.balance_amount_paid || 0);
  const balanceDue = Math.max(0, totalAmt - depositAmt - balancePaid);

  if (balanceDue <= 0) {
    window.adminCore.showToast('Aucun solde à payer.', 'info');
    closeBalanceModal();
    return;
  }

  let amountInput = parseFloat(document.getElementById('balance-amount').value);
  if (!amountInput || amountInput <= 0 || amountInput > balanceDue) amountInput = balanceDue;
  const isFinal = amountInput >= balanceDue;

  let method = selectedBalancePM;
  if (method === 'other') {
    const otherText = document.getElementById('balance-other-text').value.trim();
    method = otherText ? `other:${otherText}` : 'other';
  }

  const resNum = r.reservation_number || ('DL' + Date.now().toString().slice(-8));
  const reference = document.getElementById('balance-reference').value.trim() || `${resNum}-BAL-${isFinal ? 'SOLDE' : 'PARTIEL'}`;

  const submitBtn = document.querySelector('#balance-modal .btn-primary');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:.35rem;"></span> Traitement...`;
  }

  try {
    const newBalancePaid = balancePaid + amountInput;
    const isNowFull = newBalancePaid >= balanceDue;
    const baseUpdates = {
      balance_amount_paid: newBalancePaid,
      balance_payment_method: method,
      balance_payment_reference: reference,
      payment_status: isNowFull ? 'fully_paid' : 'deposit_paid',
      payment_choice: isNowFull ? 'full' : 'deposit',
    };
    if (isNowFull && r.status === 'AWAITING_PAYMENT') {
      baseUpdates.status = 'CONFIRMED';
    }

    // Mobile payments (moncash/natcash) are recorded directly without redirect.

    // Cash / bank / card / check / other: mark immediately
    const { error: updateErr } = await supabase.from('reservations').update(baseUpdates).eq('id', r.id);
    if (updateErr) throw updateErr;

    const idx = allReservations.findIndex(res => res.id === r.id);
    if (idx !== -1) {
      allReservations[idx] = { ...allReservations[idx], ...baseUpdates };
    }

    closeBalanceModal();
    closeModal();
    renderReservations();
    window.adminCore.showToast('Paiement enregistré avec succès', 'success');
    printReservationDetail(r.id);
  } catch (err) {
    console.error('Error processing balance payment:', err);
    window.adminCore.showToast('Erreur lors du paiement: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
};

// ── Consent forms ───────────────────────────────────────────────────────────
let currentConsentReservationId = null;
let currentConsentTemplate = null;
let currentConsentSubmission = null;
let currentConsentSigPad = null;

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function matchReservationTemplate(r, templates, serviceMap = {}) {
  if (!templates || !templates.length) return null;
  const names = [];
  if (Array.isArray(r.services)) r.services.forEach(s => { if (s && s.name) names.push(String(s.name).toLowerCase()); });
  if (r.service) names.push(String(r.service).toLowerCase());
  const cats = [];
  if (Array.isArray(r.services)) r.services.forEach(s => { if (s && s.category) cats.push(String(s.category).toLowerCase()); });
  if (serviceMap[r.service_id]) cats.push(String(serviceMap[r.service_id]).toLowerCase());
  if (r.service_category) cats.push(String(r.service_category).toLowerCase());

  let match = templates.find(t => !t.applies_to_all && t.service_id && t.service_id === r.service_id);
  if (match) return match;
  match = templates.find(t => !t.applies_to_all && t.service_name &&
    names.some(n => n.includes(t.service_name.toLowerCase()) || t.service_name.toLowerCase().includes(n)));
  if (match) return match;
  match = templates.find(t => !t.applies_to_all && t.service_category &&
    cats.some(c => c === t.service_category.toLowerCase()));
  if (match) return match;
  return templates.find(t => t.applies_to_all) || null;
}

async function loadConsentSection(reservationId) {
  const statusEl = document.getElementById(`consent-status-${reservationId}`);
  if (!statusEl) return;

  const r = allReservations.find(x => x.id === reservationId);
  if (!r) { statusEl.innerHTML = 'Réservation introuvable.'; return; }

  const supabase = getSupabaseClient();
  if (!supabase) { statusEl.innerHTML = 'Connexion Supabase indisponible.'; return; }

  try {
    const [tplRes, subRes, svcRes] = await Promise.all([
      supabase.from('form_templates').select('*').eq('is_active', true),
      supabase.from('form_submissions').select('*').eq('reservation_id', reservationId),
      supabase.from('services').select('id, category')
    ]);

    if (tplRes.error) throw tplRes.error;
    const templates = tplRes.data || [];
    const submissions = subRes.data || [];
    const serviceMap = Object.fromEntries((svcRes.data || []).map(s => [s.id, s.category]));

    const template = matchReservationTemplate(r, templates, serviceMap);
    const submission = submissions.length ? submissions[0] : null;

    if (!template) {
      statusEl.innerHTML = `<span style="color:var(--admin-text-muted);">Aucun formulaire actif pour ce service.</span>`;
      return;
    }

    if (submission) {
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:.4rem;color:#059669;font-weight:600;">
          ${ico('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 15, '#059669')}
          Formulaire rempli · <span class="ref-chip">${esc(submission.reference_number)}</span>
        </div>
        <div style="margin-top:.5rem; display:flex; gap:.4rem; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="openConsentModal('${r.id}')">Voir / Modifier</button>
          <button class="btn btn-secondary btn-sm" onclick="sendConsentLink('${r.id}')">Renvoyer au client</button>
        </div>`;
    } else {
      statusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:.4rem;color:#92400e;font-weight:600;">
          ${ico('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 15, '#92400e')}
          Formulaire en attente
        </div>
        <div style="margin-top:.5rem; display:flex; gap:.4rem; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="openConsentModal('${r.id}')">Remplir maintenant</button>
          <button class="btn btn-secondary btn-sm" onclick="sendConsentLink('${r.id}')">Envoyer au client</button>
        </div>`;
    }
  } catch (err) {
    console.error('loadConsentSection error:', err);
    statusEl.innerHTML = `<span style="color:#ef4444;">Erreur chargement formulaire.</span>`;
  }
}

window.openConsentModal = async function(reservationId) {
  currentConsentReservationId = reservationId;
  const r = allReservations.find(x => x.id === reservationId);
  if (!r) return;

  const supabase = getSupabaseClient();
  if (!supabase) { window.adminCore.showToast('Connexion Supabase indisponible.', 'error'); return; }

  const modal = document.getElementById('consent-modal');
  const body = document.getElementById('consent-modal-body');
  const footer = document.getElementById('consent-modal-footer');

  body.innerHTML = '<div class="loading-spinner"></div> Chargement...';
  footer.innerHTML = '<button class="btn btn-secondary" onclick="closeConsentModal()">Fermer</button>';
  modal.style.display = 'flex';

  try {
    const [tplRes, subRes, svcRes] = await Promise.all([
      supabase.from('form_templates').select('*').eq('is_active', true),
      supabase.from('form_submissions').select('*').eq('reservation_id', reservationId),
      supabase.from('services').select('id, category')
    ]);
    if (tplRes.error) throw tplRes.error;
    const templates = tplRes.data || [];
    const submissions = subRes.data || [];
    const serviceMap = Object.fromEntries((svcRes.data || []).map(s => [s.id, s.category]));

    const template = matchReservationTemplate(r, templates, serviceMap);
    const submission = submissions.length ? submissions[0] : null;
    currentConsentTemplate = template;
    currentConsentSubmission = submission;

    if (!template) {
      document.getElementById('consent-modal-title').textContent = 'Formulaire indisponible';
      body.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Aucun modèle de formulaire actif pour ce service.</div>';
      return;
    }

    document.getElementById('consent-modal-title').textContent = esc(template.title);

    if (submission) {
      // Read-only view
      body.innerHTML = buildSubmissionView(template, submission, r);
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="closeConsentModal()">Fermer</button>
        <button class="btn btn-secondary" onclick="printConsentSubmission('${submission.id}')">Imprimer</button>
        <button class="btn btn-primary" onclick="reopenConsentForEdit('${r.id}')">Remplir à nouveau</button>
        <button class="btn btn-secondary" onclick="sendConsentLink('${r.id}')">Renvoyer au client</button>`;
    } else {
      body.innerHTML = buildConsentForm(template, r);
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="closeConsentModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitConsentForm('${r.id}')">Enregistrer le formulaire</button>
        <button class="btn btn-secondary" onclick="sendConsentLink('${r.id}')">Envoyer au client</button>`;
      initConsentSignature();
    }
  } catch (err) {
    console.error('openConsentModal error:', err);
    body.innerHTML = `<div class="text-center" style="padding:2rem;color:#ef4444;">Erreur: ${esc(err.message)}</div>`;
  }
};

window.closeConsentModal = function() {
  document.getElementById('consent-modal').style.display = 'none';
  currentConsentReservationId = null;
  currentConsentTemplate = null;
  currentConsentSubmission = null;
  currentConsentSigPad = null;
};

window.reopenConsentForEdit = async function(reservationId) {
  currentConsentSubmission = null;
  await window.openConsentModal(reservationId);
};

const PRACTITIONER_LABELS = new Set([
  'Analyse du cuir chevelu', 'Type de soin recommandé', 'Fréquence des séances',
  'Soin effectué', 'Durée', 'Techniques utilisées', 'Conseils après soin / recommandations'
]);

function isPractitionerField(label = '') {
  if (PRACTITIONER_LABELS.has(label)) return true;
  const lower = label.toLowerCase();
  return lower.includes('diagnostic du praticien') ||
    lower.includes('plan de traitement') ||
    lower.includes('conseils après soin');
}

function buildConsentForm(template, r) {
  const fields = Array.isArray(template.fields) ? template.fields : [];
  return `
    ${template.description ? `<div style="background:#fff7ed;border-left:3px solid #D4AF37;padding:.85rem 1rem;border-radius:0 8px 8px 0;font-size:.88rem;color:#5a4a3a;line-height:1.6;margin-bottom:1.25rem;">${esc(template.description)}</div>` : ''}
    <div style="display:grid;gap:1rem;">
      ${fields.map((f, i) => renderConsentField(f, i)).join('')}
    </div>`;
}

function renderConsentField(f, idx) {
  if (f.role === 'practitioner' || isPractitionerField(f.label)) return '';
  const req = f.required ? '<span style="color:#dc2626;margin-left:.2rem;">*</span>' : '';
  if (f.type === 'section') {
    return `<div style="font-weight:700;color:#4A3728;margin:.8rem 0 .2rem;padding-bottom:.35rem;border-bottom:1px solid var(--admin-border);">${esc(f.label)}</div>`;
  }
  let control = '';
  if (f.type === 'text') control = `<input type="text" class="form-input" id="cf-field-${idx}" data-idx="${idx}">`;
  else if (f.type === 'textarea') control = `<textarea class="form-input" rows="3" id="cf-field-${idx}" data-idx="${idx}"></textarea>`;
  else if (f.type === 'date') control = `<input type="date" class="form-input" id="cf-field-${idx}" data-idx="${idx}">`;
  else if (f.type === 'select') control = `<select class="form-input" id="cf-field-${idx}" data-idx="${idx}"><option value="">— Choisir —</option>${(f.options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'radio') control = `<div id="cf-field-${idx}" data-idx="${idx}">${(f.options || []).map(o => `<label style="display:flex;align-items:center;gap:.4rem;padding:.4rem 0;cursor:pointer;"><input type="radio" name="cf-radio-${idx}" value="${esc(o)}" style="width:16px;height:16px;"> ${esc(o)}</label>`).join('')}</div>`;
  else if (f.type === 'checkbox') control = `<div id="cf-field-${idx}" data-idx="${idx}">${(f.options || []).map(o => `<label style="display:flex;align-items:center;gap:.4rem;padding:.4rem 0;cursor:pointer;"><input type="checkbox" value="${esc(o)}" style="width:16px;height:16px;"> ${esc(o)}</label>`).join('')}</div>`;
  else if (f.type === 'consent') control = `<label style="display:flex;align-items:center;gap:.4rem;padding:.4rem 0;cursor:pointer;"><input type="checkbox" id="cf-field-${idx}" data-idx="${idx}" style="width:16px;height:16px;"> Oui, j'accepte</label>`;
  else if (f.type === 'signature') {
    return `
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-weight:600;font-size:.88rem;margin-bottom:.4rem;">${esc(f.label)} ${req}</label>
        <div style="border:1.5px dashed #d9cebf;border-radius:12px;background:#fdfbf8;padding:.5rem;">
          <canvas id="cf-signature" width="560" height="160" style="width:100%;height:160px;border-radius:8px;background:#fff;cursor:crosshair;"></canvas>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem;">
            <small style="color:#9a8f86;">Signez avec la souris ou le doigt</small>
            <button type="button" class="btn btn-secondary btn-sm" onclick="clearConsentSignature()">Effacer</button>
          </div>
        </div>
        <div id="cf-signature-err" style="color:#dc2626;font-size:.82rem;margin-top:.3rem;display:none;">La signature est requise.</div>
      </div>`;
  }
  return `
    <div style="margin-bottom:1rem;">
      <label style="display:block;font-weight:600;font-size:.88rem;margin-bottom:.4rem;">${esc(f.label)} ${req}</label>
      ${control}
      <div id="cf-err-${idx}" style="color:#dc2626;font-size:.82rem;margin-top:.3rem;display:none;">Ce champ est obligatoire.</div>
    </div>`;
}

function buildSubmissionView(template, submission, r) {
  const answers = Array.isArray(submission.answers) ? submission.answers : [];
  const fields = Array.isArray(template.fields) ? template.fields : [];
  const rows = answers.map(a => {
    if (a.role === 'practitioner' || isPractitionerField(a.label)) return '';
    if (a.type === 'section') return `<div style="font-weight:700;color:#4A3728;margin:.8rem 0 .2rem;padding-bottom:.35rem;border-bottom:1px solid var(--admin-border);">${esc(a.label)}</div>`;
    let val = a.value;
    if (Array.isArray(val)) val = val.join(', ');
    if (a.type === 'consent') val = (val === true || val === 'true' || val === 'oui') ? '✓ Accepté' : (val || '—');
    return `<div style="margin-bottom:.85rem;"><div style="font-size:.78rem;color:var(--admin-text-muted);margin-bottom:.25rem;">${esc(a.label)}</div><div style="background:var(--admin-bg);padding:.65rem .85rem;border-radius:8px;font-size:.9rem;">${esc(val || '—')}</div></div>`;
  }).join('');

  const d = new Date(submission.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `
    <div style="margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
        <div style="font-size:.85rem;color:#059669;font-weight:600;">✓ Déjà rempli le ${d}</div>
        <span class="ref-chip">${esc(submission.reference_number)}</span>
      </div>
    </div>
    <div style="border:1px solid var(--admin-border);border-radius:10px;padding:1rem;">
      ${rows || '<p style="color:var(--admin-text-muted);">Aucune réponse.</p>'}
      ${submission.signature_data ? `
        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--admin-border);">
          <div style="font-weight:600;font-size:.85rem;margin-bottom:.4rem;">Signature du client</div>
          <img src="${submission.signature_data}" alt="Signature" style="max-width:280px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;">
        </div>` : ''}
    </div>`;
}

function initConsentSignature() {
  const canvas = document.getElementById('cf-signature');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1a1a';

  let drawing = false, hasInk = false, last = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => { drawing = true; last = pos(e); e.preventDefault(); };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; hasInk = true; e.preventDefault();
  };
  const end = () => { drawing = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  currentConsentSigPad = {
    clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; },
    isEmpty: () => !hasInk,
    toDataURL: () => canvas.toDataURL('image/png')
  };
}

window.clearConsentSignature = function() {
  if (currentConsentSigPad) currentConsentSigPad.clear();
};

window.submitConsentForm = async function(reservationId) {
  const r = allReservations.find(x => x.id === reservationId);
  if (!r || !currentConsentTemplate) return;

  const supabase = getSupabaseClient();
  if (!supabase) { window.adminCore.showToast('Connexion Supabase indisponible.', 'error'); return; }

  const fields = Array.isArray(currentConsentTemplate.fields) ? currentConsentTemplate.fields : [];
  const answers = [];
  let firstErr = null;

  fields.forEach((f, idx) => {
    const type = f.type;
    let value = '';
    if (type === 'section') {
      answers.push({ field_id: String(idx), label: f.label, type, value: '' });
      return;
    }

    if (type === 'checkbox') {
      const checked = Array.from(document.querySelectorAll(`#cf-field-${idx} input[type=checkbox]:checked`)).map(c => c.value);
      value = checked;
    } else if (type === 'radio') {
      const checked = document.querySelector(`input[name="cf-radio-${idx}"]:checked`);
      value = checked ? checked.value : '';
    } else if (type === 'consent') {
      const c = document.getElementById(`cf-field-${idx}`);
      value = c && c.checked ? 'oui' : '';
    } else if (type === 'signature') {
      value = currentConsentSigPad && !currentConsentSigPad.isEmpty() ? currentConsentSigPad.toDataURL() : '';
    } else {
      const input = document.getElementById(`cf-field-${idx}`);
      value = input ? input.value.trim() : '';
    }

    const errEl = document.getElementById(`cf-err-${idx}`) || document.getElementById('cf-signature-err');
    if (errEl) errEl.style.display = 'none';

    const isEmpty = (Array.isArray(value) ? value.length === 0 : !value) || (type === 'consent' && value !== 'oui');
    if (f.required && isEmpty) {
      if (errEl) {
        errEl.textContent = type === 'signature' ? 'La signature est requise.' : type === 'consent' ? 'Vous devez accepter.' : 'Ce champ est obligatoire.';
        errEl.style.display = 'block';
      }
      if (!firstErr) firstErr = type === 'signature' ? document.getElementById('cf-signature') : document.getElementById(`cf-field-${idx}`);
    }

    if (type !== 'signature') {
      answers.push({ field_id: String(idx), label: f.label, type, value });
    } else {
      answers.push({ field_id: String(idx), label: f.label, type, value: value ? '✓ Signé' : '' });
    }
  });

  if (firstErr) {
    firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Signature data separate
  let signatureData = '';
  const sigIdx = fields.findIndex(f => f.type === 'signature');
  if (sigIdx !== -1 && currentConsentSigPad && !currentConsentSigPad.isEmpty()) {
    signatureData = currentConsentSigPad.toDataURL();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const record = {
      form_template_id: currentConsentTemplate.id,
      reservation_id: r.id,
      user_id: user?.id || r.user_id || null,
      client_name: r.user_name || '',
      client_email: r.user_email || '',
      client_phone: r.phone || '',
      service_name: r.service || '',
      form_title: currentConsentTemplate.title || '',
      form_type: currentConsentTemplate.form_type || '',
      answers,
      signature_data: signatureData,
    };

    let result;
    if (currentConsentSubmission) {
      result = await supabase.from('form_submissions').update(record).eq('id', currentConsentSubmission.id).select().single();
    } else {
      result = await supabase.from('form_submissions').insert([record]).select().single();
    }
    if (result.error) throw result.error;

    window.adminCore.showToast(currentConsentSubmission ? 'Formulaire mis à jour' : 'Formulaire enregistré', 'success');
    closeConsentModal();
    loadConsentSection(r.id);
  } catch (err) {
    console.error('submitConsentForm error:', err);
    window.adminCore.showToast('Erreur: ' + err.message, 'error');
  }
};

window.sendConsentLink = async function(reservationId) {
  const r = allReservations.find(x => x.id === reservationId);
  if (!r || !r.user_email) { window.adminCore.showToast('Email client manquant.', 'error'); return; }

  const formUrl = `${window.location.origin}/pages/orders.html?show_consent=1&reservation_id=${encodeURIComponent(reservationId)}`;
  const subject = encodeURIComponent('Veuillez remplir votre formulaire de consentement — DALIGHT');
  const body = encodeURIComponent(`Bonjour ${r.user_name || 'cher(e) client(e)'},\n\nMerci de remplir le formulaire de consentement pour votre réservation du ${r.date} à ${r.time}.\n\nLien: ${formUrl}\n\nÀ très bientôt,\nL'équipe DALIGHT`);
  window.location.href = `mailto:${encodeURIComponent(r.user_email)}?subject=${subject}&body=${body}`;
};

window.printConsentSubmission = function(submissionId) {
  // Opens admin forms page in new tab focused on the submission
  window.open(`forms.html?submission=${encodeURIComponent(submissionId)}`, '_blank');
};

// ============================================
// AUTOMATIC BREVO ACTIONS
// ============================================

window.autoConfirmReservation = async function(id) {
  const reservation = allReservations.find(r => r.id === id);
  if (!reservation) return;

  if (!confirm(`Voulez-vous confirmer cette réservation et envoyer les notifications automatiques (WhatsApp & Email) au client?`)) return;

  try {
    // Update status first
    await window.adminCore.updateReservationStatus(id, 'CONFIRMED');
    
    // Send confirmation email via Brevo
    await sendBrevoEmail(reservation, 'confirmation');
    
    window.adminCore.showToast('Réservation confirmée ! Notification WhatsApp & Email envoyées.');
    
    // Update local data
    const index = allReservations.findIndex(r => r.id === id);
    if (index !== -1) {
      allReservations[index].status = 'CONFIRMED';
    }
    
    renderReservations();
    window.adminCore.updatePendingBadge();
    closeModal();
  } catch (err) {
    const details = err?.message || err?.details || err?.hint || '';
    window.adminCore.showToast(
      details ? `Erreur: ${details}` : 'Erreur lors de la confirmation',
      'error'
    );
  }
};

window.autoSetPending = async function(id) {
  if (!confirm(`Voulez-vous remettre cette réservation en attente?`)) return;

  try {
    await window.adminCore.updateReservationStatus(id, 'PENDING');
    window.adminCore.showToast('Réservation remise en attente');
    
    const index = allReservations.findIndex(r => r.id === id);
    if (index !== -1) {
      allReservations[index].status = 'PENDING';
    }
    
    renderReservations();
    window.adminCore.updatePendingBadge();
    closeModal();
  } catch (err) {
    window.adminCore.showToast('Erreur lors de la mise à jour', 'error');
  }
};

window.autoCompleteReservation = async function(id) {
  const reservation = allReservations.find(r => r.id === id);
  if (!reservation) return;

  if (!confirm(`Voulez-vous marquer cette réservation comme terminée et envoyer un email de remerciement?`)) return;

  try {
    // Update status first
    await window.adminCore.updateReservationStatus(id, 'COMPLETED');
    
    // Send completion email via Brevo
    await sendBrevoEmail(reservation, 'completion');
    
    window.adminCore.showToast('Réservation terminée et email envoyé !');
    
    // Update local data
    const index = allReservations.findIndex(r => r.id === id);
    if (index !== -1) {
      allReservations[index].status = 'COMPLETED';
    }
    
    renderReservations();
    closeModal();
  } catch (err) {
    const details = err?.message || err?.details || err?.hint || '';
    window.adminCore.showToast(
      details ? `Erreur: ${details}` : 'Erreur lors de la mise à jour',
      'error'
    );
  }
};

// Send email via Brevo Edge Function
async function sendBrevoEmail(reservation, type) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Connexion Supabase non disponible');
  }

  // Import email templates
  const { adminConfirmationEmail } = await import('../../js/email-templates.js?v=5.0.0');
  
  let html = '';
  let subject = '';
  
  // Payment choice info for emails
  const paymentChoiceText = reservation.payment_choice === 'full' 
    ? '✓ Paiement complet effectué'
    : '⏳ Acompte payé - Le reste sera réglé au spa';
  
  if (type === 'confirmation') {
    html = adminConfirmationEmail(reservation);
    // Add payment choice info to the email
    const paymentInfo = `
      <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid ${reservation.payment_choice === 'full' ? '#059669' : '#f59e0b'};">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">💰 Information de paiement</div>
        <div style="color: ${reservation.payment_choice === 'full' ? '#059669' : '#f59e0b'}; font-weight: 500;">${paymentChoiceText}</div>
        ${reservation.payment_choice === 'deposit' ? `
          <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
            N'oubliez pas de régler le montant restant à votre arrivée au spa.
          </div>
        ` : ''}
      </div>
    `;
    html = html.replace('</body>', paymentInfo + '</body>');
    subject = `Votre réservation DALIGHT est confirmée`;
  } else if (type === 'completion') {
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <img src="https://www.dalightbeauty.com/assets/images/logodaligth.png" alt="DALIGHT" style="height: 60px;">
        </div>
        <h1 style="color: #4A3728;">Merci pour votre visite !</h1>
        <p>Bonjour ${reservation.user_name || 'Cher client'},</p>
        <p>Merci d'avoir choisi DALIGHT pour votre ${reservation.service} ! Nous espérons que vous avez apprécié ce moment de bien-être.</p>
        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #059669;">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">💰 Paiement</div>
          <div style="color: #059669; font-weight: 500;">${paymentChoiceText}</div>
        </div>
        <p>Votre avis compte énormément pour nous. N'hésitez pas à nous laisser un commentaire sur nos réseaux sociaux.</p>
        <p>À très bientôt,<br>L'équipe DALIGHT</p>
      </div>
    `;
    subject = `Merci pour votre visite - DALIGHT`;
  }

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to: reservation.user_email,
      subject: subject,
      html: html
    }
  });

  if (error) {
    throw new Error(`Erreur envoi email: ${error.message}`);
  }

  return data;
}

// ============================================
// MANUAL EMAIL TEMPLATES (mailto:)
// ============================================
window.sendEmailTemplate = function(reservationId, templateKey) {
  const r = allReservations.find(x => x.id === reservationId) || currentReservation;
  if (!r) return alert('Réservation introuvable');
  if (!r.user_email) return alert('Ce client n\'a pas d\'email enregistré.');

  const name     = r.user_name     || 'Cher(e) client(e)';
  const service  = r.service       || 'notre service';
  
  const safeParseDate = (dateStr) => {
    if (!dateStr) return null;
    const match = typeof dateStr === 'string' ? dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    return new Date(dateStr);
  };
  const parsedDate = safeParseDate(r.date);
  const date     = parsedDate ? parsedDate.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '';
  const time     = r.time          || '';
  const location = r.location      || 'notre spa';
  const phone    = '+509 4747-7221';
  
  // Payment choice info
  const paymentChoiceText = r.payment_choice === 'full' 
    ? '✓ Paiement complet effectué'
    : '⏳ Acompte payé - Le reste sera réglé au spa';
  const paymentInfo = `
💰 Information de paiement
${paymentChoiceText}
${r.payment_choice === 'deposit' ? 'N\'oubliez pas de régler le montant restant à votre arrivée au spa.' : ''}
`;

  const templates = {
    confirmation: {
      subject: `✓ Confirmation de votre réservation - DALIGHT Spa`,
      body:
`Bonjour ${name},

Nous avons le plaisir de vous confirmer votre réservation chez DALIGHT :

• Service  : ${service}
• Date     : ${date}
• Heure    : ${time}
• Lieu     : ${location}

${paymentInfo}

Nous avons hâte de vous accueillir ! En cas de question ou d'empêchement, merci de nous prévenir au moins 24h à l'avance.

📞 ${phone}
📍 Delmas 65, Faustin Premier Durandise #10

À très bientôt,
L'équipe DALIGHT`
    },
    cancellation: {
      subject: `Annulation de votre réservation - DALIGHT Spa`,
      body:
`Bonjour ${name},

Nous vous confirmons l'annulation de votre réservation :

• Service : ${service}
• Date    : ${date}
• Heure   : ${time}

Nous sommes désolés pour tout désagrément. N'hésitez pas à nous contacter pour planifier une nouvelle réservation à votre convenance.

📞 ${phone}

Cordialement,
L'équipe DALIGHT`
    },
    reminder: {
      subject: `⏰ Rappel de votre rendez-vous - DALIGHT Spa`,
      body:
`Bonjour ${name},

Petit rappel amical : vous avez rendez-vous chez DALIGHT demain !

• Service : ${service}
• Date    : ${date}
• Heure   : ${time}
• Lieu    : ${location}

${paymentInfo}

Nous vous attendons avec impatience. Merci d'arriver 5 à 10 minutes avant l'heure prévue.

📞 Pour toute modification : ${phone}
📍 Delmas 65, Faustin Premier Durandise #10

À très vite,
L'équipe DALIGHT`
    },
    completion: {
      subject: `🎉 Merci pour votre visite - DALIGHT Spa`,
      body:
`Bonjour ${name},

Merci d'avoir choisi DALIGHT pour votre ${service} ! Nous espérons que vous avez apprécié ce moment de détente et de bien-être.

💰 Paiement
${paymentChoiceText}

Votre avis compte énormément pour nous. N'hésitez pas à nous laisser un commentaire sur nos réseaux sociaux :
• Instagram : @dalightbeauty
• TikTok    : @dalightbeauty

Nous serions ravis de vous revoir très bientôt pour un nouveau service.

À bientôt,
L'équipe DALIGHT
📞 ${phone}`
    },
    custom: {
      subject: `DALIGHT - ${service}`,
      body:
`Bonjour ${name},

${paymentInfo}

`
    },
  };

  const t = templates[templateKey] || templates.custom;
  const mailto = `mailto:${encodeURIComponent(r.user_email)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
  window.location.href = mailto;
};

// Close modal on overlay click
document.getElementById('detail-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal();
  }
});

// ============================================
// STATUS UPDATE
// ============================================

window.updateStatus = async function(id, status) {
  const statusText = {
    'CONFIRMED': 'confirmer',
    'COMPLETED': 'marquer comme terminée',
    'CANCELLED': 'annuler'
  };
  
  if (!confirm(`Voulez-vous ${statusText[status]} cette réservation ?`)) return;
  
  try {
    await window.adminCore.updateReservationStatus(id, status);
    window.adminCore.showToast(`Réservation ${status === 'CONFIRMED' ? 'confirmée (WhatsApp & Email envoyés)' : status === 'COMPLETED' ? 'terminée' : 'annulée'} !`);
    
    // Update local data
    const index = allReservations.findIndex(r => r.id === id);
    if (index !== -1) {
      allReservations[index].status = status;
    }
    
    renderReservations();
    window.adminCore.updatePendingBadge();
  } catch (err) {
    const details = err?.message || err?.details || err?.hint || '';
    window.adminCore.showToast(
      details ? `Erreur lors de la mise à jour: ${details}` : 'Erreur lors de la mise à jour',
      'error'
    );
  }
};

// ============================================
// EXPORT
// ============================================

function initExport() {
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }
}

function exportToCSV() {
  const { formatDate, formatTime } = window.adminCore;
  
  const headers = ['Client', 'Email', 'Service', 'Date', 'Heure', 'Lieu', 'Statut'];
  const rows = allReservations.map(r => [
    r.user_name || 'N/A',
    r.user_email,
    r.service,
    formatDate(r.date),
    formatTime(r.time),
    r.location,
    r.status
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  window.URL.revokeObjectURL(url);
  window.adminCore.showToast('Export CSV téléchargé !');
}

// ============================================
// UTILITIES
// ============================================

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// AVAILABILITY MANAGEMENT
// ============================================

let currentAvailabilityMonth = new Date();
let selectedSlot = null;

// Initialize tabs
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initMonthNavigation();
  loadServiceCategories();

  // Check for hash fragment to switch to availability tab
  if (window.location.hash === '#availability') {
    const availabilityTab = document.querySelector('.tab-btn[data-tab="availability"]');
    if (availabilityTab) {
      availabilityTab.click();
    }
  }
});

// Fetch service categories from database and populate dropdowns
let availableServiceCategories = [];

// Helper functions for multi-service selection checkboxes
window.toggleAllBlockServices = function(checked) {
  const allCb = document.getElementById('block-service-all');
  if (allCb) allCb.checked = checked;
  document.querySelectorAll('.block-service-cb').forEach(cb => {
    cb.checked = checked;
  });
};

window.onBlockAllServicesChange = function(checked) {
  if (checked) {
    document.querySelectorAll('.block-service-cb').forEach(cb => cb.checked = false);
  }
};

window.onBlockSingleServiceChange = function() {
  const anyChecked = Array.from(document.querySelectorAll('.block-service-cb')).some(cb => cb.checked);
  const allCb = document.getElementById('block-service-all');
  if (allCb && anyChecked) {
    allCb.checked = false;
  }
};

window.toggleAllCapacityServices = function(checked) {
  const allCb = document.getElementById('capacity-service-all');
  if (allCb) allCb.checked = checked;
  document.querySelectorAll('.capacity-service-cb').forEach(cb => {
    cb.checked = checked;
  });
};

window.onCapacityAllServicesChange = function(checked) {
  if (checked) {
    document.querySelectorAll('.capacity-service-cb').forEach(cb => cb.checked = false);
  }
};

window.onCapacitySingleServiceChange = function() {
  const anyChecked = Array.from(document.querySelectorAll('.capacity-service-cb')).some(cb => cb.checked);
  const allCb = document.getElementById('capacity-service-all');
  if (allCb && anyChecked) {
    allCb.checked = false;
  }
};

async function loadServiceCategories() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Fetch from service_categories if available
    let dbCategories = [];
    try {
      const { data: catData } = await supabase
        .from('service_categories')
        .select('slug, label')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (catData && catData.length) {
        dbCategories = catData;
      }
    } catch(e) {
      console.warn('Could not read service_categories table:', e);
    }

    const { data: services, error } = await supabase
      .from('services')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories from services:', error);
    }

    // Default category map
    const defaultLabels = {
      'headspa': 'Head Spa',
      'massage-relaxant': 'Massage Relaxant',
      'wood-therapy': 'Wood Therapy',
      'facial': 'Facial',
      'ongles': 'Ongles & Manucure',
      'lifting-colombien': 'Lifting colombien',
      'package': 'Packages',
      'cure': 'Cures'
    };

    const slugsFromServices = [...new Set(services?.map(s => s.category) || [])];
    const categoryMap = new Map();

    // Add db categories
    dbCategories.forEach(c => {
      if (c.slug) categoryMap.set(c.slug, c.label || defaultLabels[c.slug] || c.slug);
    });

    // Add from services
    slugsFromServices.forEach(slug => {
      if (slug && !categoryMap.has(slug)) {
        categoryMap.set(slug, defaultLabels[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')));
      }
    });

    // Ensure our core categories exist
    ['headspa', 'massage-relaxant', 'wood-therapy', 'facial', 'ongles'].forEach(slug => {
      if (!categoryMap.has(slug)) {
        categoryMap.set(slug, defaultLabels[slug]);
      }
    });

    availableServiceCategories = Array.from(categoryMap.entries()).map(([slug, label]) => ({ slug, label }));
    console.log('✅ Loaded categories for availability:', availableServiceCategories);

    // 1. Populate availability category filter dropdown
    const categoryFilter = document.getElementById('availability-category-filter');
    if (categoryFilter) {
      const currentValue = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="all">🌐 Toutes les catégories (Global)</option>';
      availableServiceCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.slug;
        option.textContent = cat.label;
        categoryFilter.appendChild(option);
      });
      if (currentValue && (categoryMap.has(currentValue) || currentValue === 'all')) {
        categoryFilter.value = currentValue;
      }
    }

    // 2. Populate block-service-checkboxes in block modal
    const blockCbContainer = document.getElementById('block-service-checkboxes');
    if (blockCbContainer) {
      blockCbContainer.innerHTML = availableServiceCategories.map(cat => `
        <label style="display:flex;align-items:center;gap:0.45rem;cursor:pointer;font-size:0.82rem;background:rgba(255,255,255,0.04);padding:0.4rem 0.55rem;border-radius:6px;border:1px solid rgba(255,255,255,0.08);transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
          <input type="checkbox" class="block-service-cb" value="${cat.slug}" onchange="onBlockSingleServiceChange()" style="accent-color:#ef4444;width:16px;height:16px;cursor:pointer;">
          <span style="font-weight:500;">${cat.label}</span>
        </label>
      `).join('');
    }

    // 3. Populate capacity-service-checkboxes in capacity modal
    const capCbContainer = document.getElementById('capacity-service-checkboxes');
    if (capCbContainer) {
      capCbContainer.innerHTML = availableServiceCategories.map(cat => `
        <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.8rem;background:rgba(255,255,255,0.04);padding:0.35rem 0.5rem;border-radius:6px;border:1px solid rgba(255,255,255,0.08);transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
          <input type="checkbox" class="capacity-service-cb" value="${cat.slug}" onchange="onCapacitySingleServiceChange()" style="accent-color:#6366f1;width:15px;height:15px;cursor:pointer;">
          <span style="font-weight:500;">${cat.label}</span>
        </label>
      `).join('');
    }

  } catch (err) {
    console.error('Error loading service categories:', err);
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  console.log('📋 Initializing tabs, found', tabBtns.length, 'tab buttons');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      console.log('🔄 Switching to tab:', tabName);
      
      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      
      const targetTab = document.getElementById(`tab-${tabName}`);
      if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
        console.log('✅ Tab displayed:', tabName);
        
        // Load availability data when switching to availability tab
        if (tabName === 'availability') {
          console.log('📅 Loading availability calendar...');
          loadAvailability();
        }
      } else {
        console.error('❌ Tab not found:', tabName);
      }
    });
  });
}

function initMonthNavigation() {
  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentAvailabilityMonth.setMonth(currentAvailabilityMonth.getMonth() - 1);
    loadAvailability();
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    currentAvailabilityMonth.setMonth(currentAvailabilityMonth.getMonth() + 1);
    loadAvailability();
  });

  document.getElementById('availability-category-filter')?.addEventListener('change', () => {
    loadAvailability();
  });
}

// Helper to get Supabase from multiple sources
function getSupabaseClient() {
  function wrap(c) {
    if (!c || c._dalightWrapped) return c;
    const orig = c.from.bind(c);
    c.from = (t) => orig(t.startsWith('dalight_') ? t : ('dalight_' + t));
    c._dalightWrapped = true;
    return c;
  }
  if (window.adminCore?.supabase) return wrap(window.adminCore.supabase);
  if (window.dalightAdminSupabase) return wrap(window.dalightAdminSupabase);
  if (window.supabaseClient) return wrap(window.supabaseClient);
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    const SUPABASE_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
    return wrap(supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
  }
  return null;
}

async function loadAvailability() {
  let retries = 0;
  let supabase = getSupabaseClient();
  while (!supabase && retries < 20) {
    await new Promise(resolve => setTimeout(resolve, 300));
    supabase = getSupabaseClient();
    retries++;
  }

  if (!supabase) {
    const tbody = document.getElementById('availability-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:2rem;color:#ef4444;">
      ⚠️ Connexion Supabase non établie.
      <button onclick="location.reload()" class="btn btn-primary" style="margin-top:1rem;">Rafraîchir</button>
    </td></tr>`;
    return;
  }

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin',
                      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  document.getElementById('current-month-display').textContent =
    `${monthNames[currentAvailabilityMonth.getMonth()]} ${currentAvailabilityMonth.getFullYear()}`;

  const year  = currentAvailabilityMonth.getFullYear();
  const month = currentAvailabilityMonth.getMonth() + 1;

  try {
    // Admin calendar: toujou itilize exceptions-only (pa RPC ki retounen règ rekiran)
    const data = await loadAvailabilityFallback(supabase, year, month);
    renderAvailabilityCalendar(data || []);
  } catch (err) {
    console.error('❌ loadAvailability error:', err);
    window.adminCore?.showToast('Erreur calendrier: ' + err.message, 'error');
  }
}

// Fallback: sèlman availability_exceptions (slots admin eksplisite mete) + bookings
async function loadAvailabilityFallback(supabase, year, month) {
  console.log('🔄 Using exceptions-only fallback query...');
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

  // Get selected category filter
  const categoryFilter = document.getElementById('availability-category-filter')?.value || 'all';

  // Build exceptions query with category filter
  let exceptionsQuery = supabase.from('availability_exceptions').select('*')
    .gte('exception_date', startDate).lte('exception_date', endDate);
  
  if (categoryFilter !== 'all') {
    exceptionsQuery = exceptionsQuery.or(`service_type.eq.${categoryFilter},service_type.eq.all,service_type.is.null`);
  }

  const [exceptionsRes, bookingsRes] = await Promise.all([
    exceptionsQuery,
    supabase.from('reservations').select('date, time, status, service, service_id, services')
      .gte('date', startDate).lte('date', endDate)
      .not('status', 'ilike', '%cancel%')
  ]);

  const exceptions = exceptionsRes.data || [];
  const bookings   = bookingsRes.data || [];
  const results    = [];

  // Helper to match a reservation against a category
  function matchesCategory(b, cat) {
    if (cat === 'all') return true;
    if (Array.isArray(b.services) && b.services.some(s => s.category === cat)) return true;
    const bName = (b.service || '').toLowerCase().trim();
    if (cat === 'headspa' && (bName.includes('head spa') || bName.includes('headspa'))) return true;
    if (cat === 'massage-relaxant' && bName.includes('massage')) return true;
    if (cat === 'wood-therapy' && (bName.includes('wood') || bName.includes('minceur'))) return true;
    if (cat === 'facial' && (bName.includes('facial') || bName.includes('visage'))) return true;
    if (cat === 'ongles' && (bName.includes('mani') || bName.includes('pédi') || bName.includes('ongle'))) return true;
    return false;
  }

  // Filter bookings by category if category filter is set
  let filteredBookings = bookings;
  if (categoryFilter !== 'all') {
    let serviceIds = [];
    try {
      const { data: services } = await supabase
        .from('services')
        .select('id')
        .eq('category', categoryFilter);
      serviceIds = services?.map(s => s.id) || [];
    } catch(e) {}

    filteredBookings = bookings.filter(b => {
      if (b.service_id && serviceIds.includes(b.service_id)) return true;
      return matchesCategory(b, categoryFilter);
    });
  }

  for (const exc of exceptions) {
    if (!exc.time_slot) continue; // skip jou antye
    const dateStr = exc.exception_date;
    const timeStr = exc.time_slot.substring(0, 5);
    const booked  = filteredBookings.filter(b =>
      b.date === dateStr && b.time?.substring(0,5) === timeStr
    ).length;
    const capacity  = exc.max_capacity ?? ((categoryFilter === 'headspa' || categoryFilter === 'massage-relaxant') ? 2 : 1);
    const remaining = exc.is_blocked ? 0 : Math.max(0, capacity - booked);

    results.push({
      available_date:   dateStr,
      slot_time:        exc.time_slot,
      is_available:     !exc.is_blocked && remaining > 0,
      is_blocked:       !!exc.is_blocked,
      service_type:     exc.service_type || 'all',
      max_capacity:     capacity,
      current_bookings: booked,
      remaining_slots:  remaining,
      is_exception:     true
    });
  }

  // Also include dates & times with bookings that don't have explicit exceptions yet
  const coveredKeySet = new Set(exceptions.filter(e => e.time_slot).map(e => `${e.exception_date}_${e.time_slot.substring(0,5)}`));
  const seenBookedSlots = new Set();

  filteredBookings.forEach(b => {
    if (!b.date || !b.time) return;
    const tStr = b.time.substring(0, 5);
    const key = `${b.date}_${tStr}`;
    if (!coveredKeySet.has(key) && !seenBookedSlots.has(key)) {
      seenBookedSlots.add(key);
      const bookedCount = filteredBookings.filter(bk => bk.date === b.date && bk.time?.substring(0,5) === tStr).length;
      const defaultCap = (categoryFilter === 'headspa' || categoryFilter === 'massage-relaxant') ? 2 : 1;
      const remaining = Math.max(0, defaultCap - bookedCount);
      results.push({
        available_date: b.date,
        slot_time: tStr + ':00',
        is_available: remaining > 0,
        is_blocked: false,
        service_type: categoryFilter !== 'all' ? categoryFilter : 'all',
        max_capacity: defaultCap,
        current_bookings: bookedCount,
        remaining_slots: remaining,
        is_exception: false
      });
    }
  });

  return results;
}

function renderAvailabilityCalendar(data) {
  const tbody = document.getElementById('availability-body');
  if (!tbody) return;

  const categoryFilter = document.getElementById('availability-category-filter')?.value || 'all';

  // Index exceptions par date+heure (array pou sipòte pliziè service_type)
  const byDate = {};
  data.forEach(slot => {
    const timeKey = slot.slot_time || slot.time_slot;
    const timeStr = timeKey ? String(timeKey).substring(0, 5) : null;
    if (!timeStr) return;
    if (!byDate[slot.available_date]) byDate[slot.available_date] = {};
    if (!byDate[slot.available_date][timeStr]) byDate[slot.available_date][timeStr] = [];
    byDate[slot.available_date][timeStr].push(slot);
  });

  // Montre TOUT jou nan mwa a (pou admin ka klike n'importe ki selil)
  const year  = currentAvailabilityMonth.getFullYear();
  const month = currentAvailabilityMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const allDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    allDates.push(dateStr);
  }

  const timeSlots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

  tbody.innerHTML = allDates.map(date => {
    const dateObj = new Date(date + 'T12:00:00');
    const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dayNum  = dateObj.getDate();
    const isPast  = dateObj < new Date(new Date().toDateString());

    return `<tr style="${isPast ? 'opacity:.5;' : ''}">
      <td style="font-weight:600;white-space:nowrap;font-size:.8rem;padding:.25rem .5rem;">
        ${dayName} ${dayNum}
      </td>
      ${timeSlots.map(time => {
        const slots = byDate[date]?.[time] || [];
        
        let primary = null;
        if (categoryFilter !== 'all') {
          // Find slot matching categoryFilter first, then fallback to global 'all' block
          primary = slots.find(s => s.service_type === categoryFilter)
                 || slots.find(s => (s.service_type === 'all' || !s.service_type) && s.is_blocked)
                 || slots.find(s => s.service_type === 'all' || !s.service_type)
                 || null;
        } else {
          // Global view
          primary = slots.find(s => (s.service_type === 'all' || !s.service_type) && s.is_blocked)
                 || slots.find(s => s.service_type === 'all' || !s.service_type)
                 || slots[0] || null;
        }

        const hasPartialBlock = slots.some(s => s.is_blocked) &&
          !slots.some(s => s.is_blocked && (s.service_type === 'all' || !s.service_type));
        
        const status = getSlotStatus(primary, slots, categoryFilter);
        
        const isBlockedForCurrentView = (primary?.is_blocked && (primary.service_type === 'all' || !primary.service_type || (categoryFilter !== 'all' && primary.service_type === categoryFilter)));

        const label = !primary ? '✓'
          : isBlockedForCurrentView ? '🔒'
          : (categoryFilter === 'all' && hasPartialBlock) ? '⚡'
          : `${primary.remaining_slots}/${primary.max_capacity}`;

        return `<td style="padding:1px;">
          <button
            class="availability-cell ${status.class}"
            onclick="openSlotModal('${date}','${time}',${primary ? JSON.stringify(primary).replace(/"/g,'&quot;') : 'null'}, ${JSON.stringify(slots).replace(/"/g,'&quot;')})"
            style="width:100%;min-width:36px;height:34px;border:1px solid #e5e7eb;border-radius:4px;
                   background:${status.color};color:${status.textColor};
                   cursor:pointer;font-size:0.7rem;font-weight:600;"
            title="${status.tooltip}"
          >${label}</button>
        </td>`;
      }).join('')}
    </tr>`;
  }).join('');
}

function getSlotStatus(slot, allSlots, categoryFilter) {
  categoryFilter = categoryFilter || document.getElementById('availability-category-filter')?.value || 'all';

  if (categoryFilter !== 'all') {
    // Specific service category filter
    const isCatBlocked = (slot?.is_blocked && (slot.service_type === categoryFilter || slot.service_type === 'all' || !slot.service_type))
                      || allSlots?.some(s => s.is_blocked && (s.service_type === categoryFilter || s.service_type === 'all' || !s.service_type));
    
    if (isCatBlocked) {
      return { class: 'blocked', color: '#6b7280', textColor: 'white', tooltip: `Bloqué (${categoryFilter})` };
    }
    if (!slot) {
      return { class: 'available', color: '#10b981', textColor: 'white', tooltip: 'Disponible — cliquez pour configurer' };
    }
    if (slot.remaining_slots <= 0) {
      return { class: 'full', color: '#ef4444', textColor: 'white', tooltip: `Complet (${slot.current_bookings}/${slot.max_capacity})` };
    }
    if (slot.remaining_slots <= Math.ceil(slot.max_capacity * 0.3)) {
      return { class: 'limited', color: '#f59e0b', textColor: 'white', tooltip: `Presque plein — ${slot.remaining_slots} restante(s)` };
    }
    return { class: 'available', color: '#10b981', textColor: 'white', tooltip: `${slot.remaining_slots} place(s) disponible(s)` };
  }

  // Global / Tous les services view
  if (!slot && (!allSlots || allSlots.length === 0)) {
    return { class: 'available', color: '#10b981', textColor: 'white', tooltip: 'Disponible — cliquez pour configurer' };
  }
  // Bloke pou tout sèvis
  if (slot?.is_blocked && (slot.service_type === 'all' || !slot.service_type)) {
    return { class: 'blocked', color: '#6b7280', textColor: 'white', tooltip: 'Bloqué (tous services)' };
  }
  // Blokaaj parsyèl — kèk kategori sèlman
  if (allSlots?.some(s => s.is_blocked)) {
    const cats = allSlots.filter(s => s.is_blocked).map(s => s.service_type || 'all').join(', ');
    return { class: 'partial', color: '#f59e0b', textColor: 'white', tooltip: `Partiellement bloqué: ${cats}` };
  }
  if (!slot) {
    return { class: 'available', color: '#10b981', textColor: 'white', tooltip: 'Disponible — cliquez pour configurer' };
  }
  // Konplè
  if (slot.remaining_slots <= 0) {
    return { class: 'full', color: '#ef4444', textColor: 'white', tooltip: `Complet (${slot.current_bookings}/${slot.max_capacity})` };
  }
  // Prèske konplè (≤30%)
  if (slot.remaining_slots <= Math.ceil(slot.max_capacity * 0.3)) {
    return { class: 'limited', color: '#f59e0b', textColor: 'white', tooltip: `Presque plein — ${slot.remaining_slots} restante(s)` };
  }
  // Disponib
  return { class: 'available', color: '#10b981', textColor: 'white', tooltip: `${slot.remaining_slots} place(s) disponible(s)` };
}

// Modal Functions
function openBlockDateModal() {
  console.log('🔴 openBlockDateModal called');
  const modal = document.getElementById('block-date-modal');
  console.log('📦 Modal element:', modal);
  
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.getElementById('block-date-input').value = '';
    document.getElementById('block-time-from').value = '';
    document.getElementById('block-time-to').value = '';
    document.getElementById('block-reason-input').value = '';
    document.getElementById('selected-hours-preview').style.display = 'none';
    document.getElementById('existing-reservations-section').style.display = 'none';
    document.getElementById('no-reservations-msg').style.display = 'none';

    // Reset multi-service checkboxes: default to 'all' checked
    const allCb = document.getElementById('block-service-all');
    if (allCb) allCb.checked = true;
    document.querySelectorAll('.block-service-cb').forEach(cb => cb.checked = false);

    console.log('✅ Modal opened with active class');
  } else {
    console.error('❌ Modal not found!');
    alert('Erreur: Modal non trouvé. Veuillez rafraîchir la page.');
  }
}

function closeBlockDateModal() {
  const modal = document.getElementById('block-date-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    console.log('✅ Modal closed');
  }
  document.getElementById('existing-reservations-section').style.display = 'none';
  document.getElementById('no-reservations-msg').style.display = 'none';
  document.getElementById('selected-hours-preview').style.display = 'none';
}

// Time Range Functions
function setTimeRange(from, to) {
  console.log('⏰ Setting time range:', from, 'to', to);
  document.getElementById('block-time-from').value = from;
  document.getElementById('block-time-to').value = to;
  updateHoursPreview();
  window.adminCore?.showToast(`Plage horaire: ${from} à ${to}`);
}

function onTimeFromChange() {
  const from = document.getElementById('block-time-from').value;
  const toSelect = document.getElementById('block-time-to');
  
  if (from && !toSelect.value) {
    const nextHour = parseInt(from.split(':')[0]) + 1;
    if (nextHour <= 18) {
      toSelect.value = `${nextHour.toString().padStart(2, '0')}:00`;
    }
  }
  updateHoursPreview();
}

function updateHoursPreview() {
  const from = document.getElementById('block-time-from').value;
  const to = document.getElementById('block-time-to').value;
  const previewSection = document.getElementById('selected-hours-preview');
  const hoursList = document.getElementById('hours-to-block-list');
  
  if (!from || !to) {
    previewSection.style.display = 'none';
    return;
  }
  
  const startHour = parseInt(from.split(':')[0]);
  const endHour = parseInt(to.split(':')[0]);
  const hours = [];
  
  for (let h = startHour; h < endHour; h++) {
    hours.push(`${h.toString().padStart(2, '0')}:00`);
  }
  
  if (hours.length === 0) {
    previewSection.style.display = 'none';
    return;
  }
  
  hoursList.innerHTML = hours.map(h => 
    `<span style="padding: 0.25rem 0.5rem; background: #ef4444; color: white; border-radius: 4px; font-size: 0.75rem;">${h}</span>`
  ).join('');
  
  previewSection.style.display = 'block';
}

// Get array of hours to block
function getHoursToBlock() {
  const from = document.getElementById('block-time-from').value;
  const to = document.getElementById('block-time-to').value;
  
  if (!from && !to) {
    return ['ALL_DAY'];
  }
  if (!from || !to) {
    return [from || to];
  }
  
  const startHour = parseInt(from.split(':')[0]);
  const endHour = parseInt(to.split(':')[0]);
  const hours = [];
  
  for (let h = startHour; h < endHour; h++) {
    hours.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return hours;
}

// Load reservations when date is selected
async function onBlockDateChange(date) {
  console.log('📅 Date changed:', date);
  if (!date) {
    document.getElementById('existing-reservations-section').style.display = 'none';
    document.getElementById('no-reservations-msg').style.display = 'none';
    return;
  }

  const listContainer = document.getElementById('existing-reservations-list');
  const section = document.getElementById('existing-reservations-section');
  const noMsg = document.getElementById('no-reservations-msg');

  listContainer.innerHTML = '<p style="text-align: center; color: var(--admin-text-muted);">Chargement...</p>';
  section.style.display = 'block';
  noMsg.style.display = 'none';

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      listContainer.innerHTML = '<p style="color: #ef4444;">Erreur: Supabase non connecté. Rafraîchissez la page.</p>';
      return;
    }

    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, user_name, service, time, status, location')
      .eq('date', date)
      .not('status', 'ilike', '%cancel%')
      .order('time', { ascending: true });

    if (error) throw error;

    if (!reservations || reservations.length === 0) {
      section.style.display = 'none';
      noMsg.style.display = 'block';
      return;
    }

    listContainer.innerHTML = reservations.map(r => {
      const time = r.time?.substring(0, 5) || '--:--';
      const statusColors = {
        'PENDING': '#f59e0b',
        'CONFIRMED': '#10b981',
        'COMPLETED': '#3b82f6',
        'NO_SHOW': '#ef4444'
      };
      const statusLabels = {
        'PENDING': 'En attente',
        'CONFIRMED': 'Confirmée',
        'COMPLETED': 'Terminée',
        'NO_SHOW': 'No-show'
      };

      return `
        <div onclick="selectReservationTime('${time}', '${r.user_name}', '${r.service}')" 
             style="padding: 0.75rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.03); 
                    border-radius: 8px; cursor: pointer; border: 1px solid var(--admin-border);
                    transition: all 0.2s;"
             onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.borderColor='#6366f1'"
             onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='var(--admin-border)'">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 1.1rem; color: #fff;">${time}</strong>
              <span style="margin-left: 0.5rem; color: var(--admin-text-muted);">${r.service}</span>
            </div>
            <span style="font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 4px; 
                         background: ${statusColors[r.status] || '#6b7280'}20; 
                         color: ${statusColors[r.status] || '#6b7280'};">
              ${statusLabels[r.status] || r.status}
            </span>
          </div>
          <div style="margin-top: 0.25rem; font-size: 0.85rem; color: var(--admin-text-muted);">
            👤 ${r.user_name || 'Client'} | 📍 ${r.location || 'Spa'}
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #6366f1;">
            → Cliquez pour bloquer cette heure
          </div>
        </div>
      `;
    }).join('');

    section.style.display = 'block';
    noMsg.style.display = 'none';

  } catch (err) {
    console.error('Error loading reservations:', err);
    listContainer.innerHTML = `<p style="color: #ef4444;">Erreur: ${err.message}</p>`;
  }
}

// Select time from reservation
function selectReservationTime(time, clientName, service) {
  console.log('⏰ Selected reservation time:', time);
  document.getElementById('block-time-from').value = time;
  const nextHour = (parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0') + ':00';
  document.getElementById('block-time-to').value = nextHour;
  updateHoursPreview();
  const reasonInput = document.getElementById('block-reason-input');
  if (!reasonInput.value) {
    reasonInput.value = `Bloquer - Réservation ${clientName} (${service})`;
  }
  window.adminCore?.showToast(`Heure ${time} sélectionnée pour ${clientName}`);
}

async function confirmBlockDate() {
  console.log('🔴 confirmBlockDate called');
  
  const date = document.getElementById('block-date-input').value;
  const reason = document.getElementById('block-reason-input').value;
  const hoursToBlock = getHoursToBlock();
  
  if (!date) {
    window.adminCore?.showToast('Veuillez sélectionner une date', 'error');
    return;
  }

  // Get selected services from checkboxes
  const isAllChecked = document.getElementById('block-service-all')?.checked;
  const checkedBoxes = Array.from(document.querySelectorAll('.block-service-cb:checked')).map(cb => cb.value);

  let targetServices = [];
  if (isAllChecked || checkedBoxes.length === 0) {
    targetServices = ['all'];
  } else {
    targetServices = checkedBoxes;
  }

  console.log('📅 Date:', date, '🕐 Hours:', hoursToBlock, '🏷️ Target Services:', targetServices);
  
  const btn = document.querySelector('#block-date-modal .btn-danger');
  const originalText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
  }
  
  try {
    let retries = 0;
    let supabase = getSupabaseClient();
    while (!supabase && retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 300));
      supabase = getSupabaseClient();
      retries++;
    }
    if (!supabase) throw new Error('Supabase non initialisé. Veuillez rafraîchir la page.');

    const blockedEntries = [];
    const errors = [];

    for (const hour of hoursToBlock) {
      const formattedTime = (hour === 'ALL_DAY') ? null : (hour.length === 5 ? (hour + ':00') : hour);

      for (const svc of targetServices) {
        console.log('📤 Blocking:', hour, 'service:', svc);
        try {
          // Direct Upsert into availability_exceptions
          const { error: upsertErr } = await supabase
            .from('availability_exceptions')
            .upsert({
              exception_date: date,
              time_slot: formattedTime,
              is_blocked: true,
              service_type: svc,
              reason: reason || 'Bloqué par admin'
            }, { onConflict: 'exception_date,time_slot,service_type' });

          if (upsertErr) {
            // Fallback RPC attempt
            try {
              await supabase.rpc('admin_block_slot', {
                p_date: date,
                p_time_slot: formattedTime,
                p_service_type: svc,
                p_is_blocked: true,
                p_reason: reason || 'Bloqué par admin'
              });
            } catch(rpcErr) {
              console.warn('RPC fallback error:', rpcErr);
            }
          }

          blockedEntries.push(`${hour === 'ALL_DAY' ? 'Toute la journée' : hour} (${svc})`);
        } catch (err) {
          errors.push(`${hour} [${svc}]: ${err.message}`);
        }
      }
    }
    
    console.log('📊 Results:', { blocked: blockedEntries.length, errors: errors.length });
    
    if (blockedEntries.length > 0) {
      const svcNames = targetServices.includes('all') ? 'Tous les services' : targetServices.join(', ');
      window.adminCore?.showToast(`Bloqué avec succès pour : ${svcNames} ✓`);
      closeBlockDateModal();
      loadAvailability();
    } else if (errors.length > 0) {
      window.adminCore?.showToast('Erreur: ' + errors[0], 'error');
    }
    
  } catch (err) {
    console.error('❌ Error blocking date:', err);
    window.adminCore?.showToast('Erreur: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText || '🚫 Bloquer';
    }
  }
}

function openSlotModal(date, time, slotData, allSlotsData) {
  console.log('🔴 openSlotModal called:', date, time, slotData, allSlotsData);
  selectedSlot = { date, time, data: slotData };

  const isExisting  = !!slotData;
  const isBlocked   = slotData?.is_blocked === true;

  const titleEl = document.getElementById('capacity-modal-title');
  if (titleEl) titleEl.textContent = isExisting ? 'Modifier créneau' : 'Ajouter créneau';

  document.getElementById('capacity-time-display').value = `${date} à ${time}`;
  document.getElementById('capacity-input').value = slotData?.max_capacity || 1;
  document.getElementById('capacity-available').checked = isBlocked ? false : (slotData?.is_available ?? true);
  
  const categoryFilter = document.getElementById('availability-category-filter')?.value || 'all';
  const targetSvc = slotData?.service_type || (categoryFilter !== 'all' ? categoryFilter : 'all');

  // Pre-check multi-service checkboxes in capacity modal
  const capAllCb = document.getElementById('capacity-service-all');
  if (targetSvc === 'all') {
    if (capAllCb) capAllCb.checked = true;
    document.querySelectorAll('.capacity-service-cb').forEach(cb => cb.checked = false);
  } else {
    if (capAllCb) capAllCb.checked = false;
    document.querySelectorAll('.capacity-service-cb').forEach(cb => {
      cb.checked = (cb.value === targetSvc);
    });
  }

  // Breakdown list
  const breakdownContainer = document.getElementById('capacity-breakdown');
  const breakdownList = document.getElementById('capacity-breakdown-list');
  if (breakdownContainer && breakdownList && allSlotsData && allSlotsData.length > 0) {
    breakdownContainer.style.display = 'block';
    breakdownList.innerHTML = allSlotsData.map(s => {
      const type = s.service_type === 'all' ? 'Tous les services' : s.service_type;
      const statusText = s.is_blocked ? '<span style="color:#ef4444;font-weight:bold;">Bloqué</span>' : `${s.remaining_slots}/${s.max_capacity} disponibles`;
      return `<li style="margin-bottom:0.25rem;"><strong>${type}</strong>: ${statusText}</li>`;
    }).join('');
  } else if (breakdownContainer) {
    breakdownContainer.style.display = 'none';
  }

  const btnDeblock = document.getElementById('btn-deblock-slot');
  const blockedInfo = document.getElementById('slot-blocked-info');
  if (btnDeblock) btnDeblock.style.display = isExisting ? 'block' : 'none';
  if (blockedInfo) blockedInfo.style.display = isBlocked ? 'block' : 'none';

  const modal = document.getElementById('capacity-modal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

async function deleteSlot() {
  if (!selectedSlot?.date || !selectedSlot?.time) return;
  if (!confirm(`Supprimer le créneau ${selectedSlot.date} à ${selectedSlot.time} ?`)) return;

  try {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Connexion Supabase non établie.');

    const isAllChecked = document.getElementById('capacity-service-all')?.checked;
    const checkedBoxes = Array.from(document.querySelectorAll('.capacity-service-cb:checked')).map(cb => cb.value);

    const formattedTime = selectedSlot.time.length === 5 ? (selectedSlot.time + ':00') : selectedSlot.time;

    if (isAllChecked || checkedBoxes.length === 0) {
      // Delete all or 'all'
      await supabase
        .from('availability_exceptions')
        .delete()
        .eq('exception_date', selectedSlot.date)
        .eq('time_slot', formattedTime);
    } else {
      for (const svc of checkedBoxes) {
        await supabase
          .from('availability_exceptions')
          .delete()
          .eq('exception_date', selectedSlot.date)
          .eq('time_slot', formattedTime)
          .eq('service_type', svc);
      }
    }

    window.adminCore?.showToast('Créneau supprimé ✓');
    closeCapacityModal();
    loadAvailability();
  } catch (err) {
    console.error('Error deleting slot:', err);
    window.adminCore?.showToast('Erreur: ' + err.message, 'error');
  }
}

function closeCapacityModal() {
  const modal = document.getElementById('capacity-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
  selectedSlot = null;
  console.log('✅ Capacity modal closed');
}

async function saveCapacity() {
  if (!selectedSlot) return;

  const capacity    = parseInt(document.getElementById('capacity-input').value) || 1;
  const isAvailable = document.getElementById('capacity-available').checked;
  
  const isAllChecked = document.getElementById('capacity-service-all')?.checked;
  const checkedBoxes = Array.from(document.querySelectorAll('.capacity-service-cb:checked')).map(cb => cb.value);

  let targetServices = [];
  if (isAllChecked || checkedBoxes.length === 0) {
    targetServices = ['all'];
  } else {
    targetServices = checkedBoxes;
  }

  console.log('💾 Saving capacity:', { date: selectedSlot.date, time: selectedSlot.time, capacity, isAvailable, targetServices });

  try {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Connexion Supabase non établie. Rafraîchissez la page.');

    const formattedTime = selectedSlot.time.length === 5 ? (selectedSlot.time + ':00') : selectedSlot.time;

    for (const svc of targetServices) {
      const { error } = await supabase
        .from('availability_exceptions')
        .upsert({
          exception_date: selectedSlot.date,
          time_slot:      formattedTime,
          is_blocked:     !isAvailable,
          max_capacity:   isAvailable ? capacity : null,
          service_type:   svc
        }, { onConflict: 'exception_date,time_slot,service_type' });

      if (error) {
        console.warn('Upsert fallback for', svc, error);
        await supabase
          .from('availability_exceptions')
          .upsert({
            exception_date: selectedSlot.date,
            time_slot:      formattedTime,
            is_blocked:     !isAvailable,
            max_capacity:   isAvailable ? capacity : null
          }, { onConflict: 'exception_date,time_slot' });
      }
    }

    window.adminCore?.showToast('Créneau mis à jour ✓');
    closeCapacityModal();
    loadAvailability();
  } catch (err) {
    console.error('Error saving capacity:', err);
    window.adminCore?.showToast('Erreur: ' + err.message, 'error');
  }
}

function openSetCapacityModal() {
  window.adminCore?.showToast('Sélectionnez un créneau dans le calendrier pour modifier sa capacité');
}

// ============================================
// ADMIN CREATE RESERVATION
// ============================================

let createReservationClient = null;
let createReservationServices = [];
let createReservationHeadSpaPricing = [];
let createReservationExtras = []; // sèvis "extra" kreye a la vole (kache sou sit la)
let createReservationCart = []; // PANIER interactif des services sélectionnés
const HAIR_TYPE_LABELS = { dreadlocks: 'Dreadlocks', defrises: 'Cheveux Défrisés', naturels: 'Cheveux Naturels' };

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try { window.lucide.createIcons(); } catch(e) { console.warn('Lucide icon refresh:', e); }
  }
}
window.refreshLucideIcons = refreshLucideIcons;

function withFee(p) { return Math.round(Number(p) * 1.03); }
function withoutFee(p) { return Math.round(Number(p)); }

function openCreateReservationModal() {
  const modal = document.getElementById('create-reservation-modal');
  if (!modal) {
    console.error('Modal #create-reservation-modal not found');
    return;
  }
  
  modal.style.display = 'flex';
  modal.classList.add('active');

  const form = document.getElementById('create-reservation-form');
  if (form) form.reset();

  const clientInfo = document.getElementById('create-client-info');
  if (clientInfo) clientInfo.textContent = '';
  
  const clientError = document.getElementById('create-client-error');
  if (clientError) clientError.style.display = 'none';

  const totalEl = document.getElementById('create-reservation-total');
  if (totalEl) totalEl.textContent = '0 HTG';

  const feeDisplay = document.getElementById('create-moncash-fee-display');
  if (feeDisplay) feeDisplay.textContent = '';

  const cfg = document.getElementById('create-services-config');
  if (cfg) cfg.innerHTML = '';

  const videoConsentBox = document.getElementById('create-video-consent-box');
  if (videoConsentBox) videoConsentBox.style.display = 'none';

  const videoToggle = document.getElementById('create-video-toggle');
  if (videoToggle) videoToggle.checked = false;
  const videoBlock = document.getElementById('create-video-consent-block');
  if (videoBlock) videoBlock.style.display = 'none';
  const defaultRadio = document.querySelector('input[name="create_video_consent"][value="public"]');
  if (defaultRadio) defaultRadio.checked = true;

  createReservationClient = null;
  createReservationExtras = [];
  createReservationCart = [];
  loadAdminVideoPricing();
  renderCreateCart();
  setTimeout(refreshLucideIcons, 50);

  const extraList = document.getElementById('extra-services-list');
  if (extraList) extraList.innerHTML = '';

  const extraForm = document.getElementById('extra-service-form');
  if (extraForm) extraForm.style.display = 'none';

  ['extra-svc-name', 'extra-svc-price', 'extra-svc-duration'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  loadCreateReservationServices();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('create-date');
  if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];

  const timeInput = document.getElementById('create-time');
  if (timeInput && !timeInput.value) timeInput.value = '10:00';
}


// ── Code Promo & Remise dans Création Réservation Admin ─────────────────────
let adminCreateAppliedPromo = null;

window.applyCreatePromoCode = async function() {
  const codeInput = document.getElementById('create-promo-code');
  const code = (codeInput?.value || '').trim().toUpperCase();
  const feedback = document.getElementById('create-promo-feedback');
  const badge = document.getElementById('create-discount-badge');

  if (!code) {
    adminCreateAppliedPromo = null;
    if (feedback) { feedback.style.display = 'none'; feedback.textContent = ''; }
    if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
    updateCreateReservationTotal();
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Erreur: Connexion Supabase non disponible.';
    }
    return;
  }

  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      adminCreateAppliedPromo = null;
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#ef4444';
        feedback.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="alert-circle" style="width:14px;height:14px;"></i> Code promo invalide ou inactif.</span> <button type="button" onclick="clearCreatePromoCode()" style="background:none;border:none;color:#6366f1;cursor:pointer;text-decoration:underline;font-size:0.75rem;margin-left:4px;">Effacer</button>'; refreshLucideIcons();
      }
      if (badge) badge.style.display = 'none';
      updateCreateReservationTotal();
      return;
    }

    const now = new Date();
    if (data.valid_until && new Date(data.valid_until) < now) {
      adminCreateAppliedPromo = null;
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#ef4444';
        feedback.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="alert-circle" style="width:14px;height:14px;"></i> Ce code promo a expiré.</span>'; refreshLucideIcons();
      }
      if (badge) badge.style.display = 'none';
      updateCreateReservationTotal();
      return;
    }

    adminCreateAppliedPromo = data;
    const valText = data.discount_type === 'percentage' ? `${data.discount_value}%` : `${Number(data.discount_value).toLocaleString()} HTG`;
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#10b981';
      feedback.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Code promo <strong>${data.code}</strong> appliqué : <strong>-${valText}</strong> !</span> <button type="button" onclick="clearCreatePromoCode()" style="background:none;border:none;color:#ef4444;cursor:pointer;text-decoration:underline;font-size:0.75rem;margin-left:6px;">Retirer</button>`; refreshLucideIcons();
    }
    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = `Promo: -${valText}`;
    }
    updateCreateReservationTotal();
  } catch (err) {
    console.error('Error verifying promo code:', err);
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Erreur lors de la vérification du code promo.';
    }
  }
};

window.clearCreatePromoCode = function() {
  adminCreateAppliedPromo = null;
  const codeInput = document.getElementById('create-promo-code');
  if (codeInput) codeInput.value = '';
  const feedback = document.getElementById('create-promo-feedback');
  if (feedback) { feedback.style.display = 'none'; feedback.textContent = ''; }
  const badge = document.getElementById('create-discount-badge');
  if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
  updateCreateReservationTotal();
};

function closeCreateReservationModal() {
  const modal = document.getElementById('create-reservation-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.display = 'none';
  createReservationClient = null;
  createReservationCart = [];
  renderCreateCart();
  if (window.clearCreatePromoCode) window.clearCreatePromoCode();
  const dIn = document.getElementById("create-discount-input"); if (dIn) dIn.value = "";
}


window.toggleCreateVideoOption = function(isChecked) {
  const block = document.getElementById('create-video-consent-block');
  if (block) block.style.display = isChecked ? 'block' : 'none';
  updateCreateReservationTotal();
};

async function loadCreateReservationServices() {
  const pickerEl = document.getElementById('create-service-picker');
  if (!pickerEl) return;

  const supabase = getSupabaseClient();
  if (!supabase) {
    pickerEl.innerHTML = '<option value="">Supabase non connecté.</option>';
    return;
  }

  try {
    const [{ data: services, error: svcErr }, { data: pricing, error: priceErr }] = await Promise.all([
      supabase.from('services').select('id, name, price_htg, price_usd, duration, category, is_visible, is_extra').eq('is_active', true).order('name'),
      supabase.from('head_spa_pricing').select('*').eq('is_active', true).order('sort_order')
    ]);

    if (svcErr) throw svcErr;
    createReservationServices = services || [];
    createReservationHeadSpaPricing = pricing || [];

    if (!createReservationServices.length) {
      pickerEl.innerHTML = '<option value="">Aucun service actif disponible</option>';
      return;
    }

    // Grouper les services logiquement sans emojis
    const categoryGroups = {
      'package': { label: 'Combos & Forfaits', items: [] },
      'headspa': { label: 'Head Spa', items: [] },
      'massage-relaxant': { label: 'Massages Relaxants', items: [] },
      'facial': { label: 'Soins Visage (Facial)', items: [] },
      'wood-therapy': { label: 'Wood Thérapie', items: [] },
      'ongles': { label: 'Soins des Ongles', items: [] },
      'other': { label: 'Autres Services & Extras', items: [] }
    };

    createReservationServices.forEach(s => {
      const catKey = String(s.category || '').toLowerCase();
      if (categoryGroups[catKey]) {
        categoryGroups[catKey].items.push(s);
      } else {
        categoryGroups['other'].items.push(s);
      }
    });

    let optionsHtml = '<option value="">-- Choisir un service à ajouter au panier --</option>';

    Object.values(categoryGroups).forEach(group => {
      if (group.items.length > 0) {
        optionsHtml += `<optgroup label="${group.label}">`;
        group.items.forEach(s => {
          const isExtra = s.is_extra === true || s.is_visible === false;
          const price = Number(s.price_htg || 0);
          optionsHtml += `<option value="${s.id}">${escapeHtml(s.name)}${isExtra ? ' [EXTRA]' : ''} — ${price.toLocaleString()} HTG</option>`;
        });
        optionsHtml += `</optgroup>`;
      }
    });

    pickerEl.innerHTML = optionsHtml;
    renderCreateCart();
  } catch (err) {
    console.error('Error loading services:', err);
    pickerEl.innerHTML = '<option value="">Erreur chargement services.</option>';
  }
}

// ── PANIER INTERACTIF (Ajout multiple, quantité, suppression) ─────────────
window.addPickerServiceToCart = function() {
  const pickerEl = document.getElementById('create-service-picker');
  const serviceId = pickerEl?.value;
  if (!serviceId) {
    window.adminCore?.showToast('Veuillez sélectionner un service dans la liste déroulante.', 'warning');
    return;
  }

  const svc = createReservationServices.find(s => s.id === serviceId);
  if (!svc) {
    window.adminCore?.showToast('Service introuvable.', 'error');
    return;
  }

  const isHeadSpa = String(svc.category || '').toLowerCase() === 'headspa';

  // Si le service existe déjà dans le panier (et s'il s'agit de headspa avec même type de cheveux)
  const existing = createReservationCart.find(item => item.id === svc.id && (!isHeadSpa || item.hair_type === 'naturels'));
  if (existing) {
    existing.qty += 1;
    window.adminCore?.showToast(`Quantité augmentée : ${existing.name} (x${existing.qty})`, 'info');
  } else {
    createReservationCart.push({
      cartItemId: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      id: svc.id,
      name: svc.name,
      price_htg: Number(svc.price_htg || 0),
      price_usd: 0,
      category: svc.category || '',
      duration: svc.duration || null,
      extra: !!svc.is_extra,
      hair_type: isHeadSpa ? 'naturels' : null,
      qty: 1
    });
    window.adminCore?.showToast(`Ajouté au panier : ${svc.name}`, 'success');
  }

  pickerEl.value = '';
  renderCreateCart();
  updateCreateReservationTotal();
};

window.quickAddServiceByName = function(nameSnippet) {
  if (!createReservationServices || !createReservationServices.length) {
    window.adminCore?.showToast('Services en cours de chargement...', 'warning');
    return;
  }

  const query = String(nameSnippet).toLowerCase();
  const svc = createReservationServices.find(s => String(s.name || '').toLowerCase().includes(query));
  if (!svc) {
    window.adminCore?.showToast(`Service "${nameSnippet}" non trouvé dans la liste.`, 'warning');
    return;
  }

  const isHeadSpa = String(svc.category || '').toLowerCase() === 'headspa';
  const existing = createReservationCart.find(item => item.id === svc.id && (!isHeadSpa || item.hair_type === 'naturels'));
  if (existing) {
    existing.qty += 1;
    window.adminCore?.showToast(`Quantité augmentée : ${existing.name} (x${existing.qty})`, 'info');
  } else {
    createReservationCart.push({
      cartItemId: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      id: svc.id,
      name: svc.name,
      price_htg: Number(svc.price_htg || 0),
      price_usd: 0,
      category: svc.category || '',
      duration: svc.duration || null,
      extra: !!svc.is_extra,
      hair_type: isHeadSpa ? 'naturels' : null,
      qty: 1
    });
    window.adminCore?.showToast(`Ajouté au panier : ${svc.name}`, 'success');
  }

  renderCreateCart();
  updateCreateReservationTotal();
};

window.clearCreateCart = function() {
  if (!createReservationCart.length) return;
  createReservationCart = [];
  renderCreateCart();
  updateCreateReservationTotal();
  window.adminCore?.showToast('Panier vidé.', 'info');
};

window.changeCreateCartItemQty = function(cartItemId, delta) {
  const item = createReservationCart.find(i => i.cartItemId === cartItemId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    createReservationCart = createReservationCart.filter(i => i.cartItemId !== cartItemId);
    window.adminCore?.showToast('Service retiré du panier.', 'info');
  }
  renderCreateCart();
  updateCreateReservationTotal();
};

window.removeCreateCartItem = function(cartItemId) {
  createReservationCart = createReservationCart.filter(i => i.cartItemId !== cartItemId);
  window.adminCore?.showToast('Service retiré du panier.', 'info');
  renderCreateCart();
  updateCreateReservationTotal();
};

window.updateCreateCartItemHairType = function(cartItemId, newHairType) {
  const item = createReservationCart.find(i => i.cartItemId === cartItemId);
  if (item) {
    item.hair_type = newHairType;
    updateCreateReservationTotal();
  }
};

function renderCreateCart() {
  const badgeEl = document.getElementById('create-cart-badge');
  const emptyEl = document.getElementById('create-cart-empty');
  const listEl = document.getElementById('create-cart-items-list');
  const clearBtn = document.getElementById('create-cart-clear-btn');
  const footerEl = document.getElementById('create-cart-footer');
  const footerCount = document.getElementById('create-cart-footer-count');
  const footerTotal = document.getElementById('create-cart-footer-total');

  const totalQty = createReservationCart.reduce((sum, item) => sum + (item.qty || 1), 0);
  const cartSubtotal = createReservationCart.reduce((sum, item) => sum + (Number(item.price_htg || 0) * (item.qty || 1)), 0);

  if (badgeEl) {
    badgeEl.textContent = `${totalQty} service${totalQty > 1 ? 's' : ''}`;
  }
  if (clearBtn) {
    clearBtn.style.display = createReservationCart.length > 0 ? 'inline-flex' : 'none';
  }

  if (!listEl) return;

  if (createReservationCart.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (footerEl) footerEl.style.display = 'none';
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    refreshLucideIcons();
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (footerEl) {
    footerEl.style.display = 'flex';
    if (footerCount) footerCount.textContent = totalQty;
    if (footerTotal) footerTotal.textContent = `${cartSubtotal.toLocaleString()} HTG`;
  }
  listEl.style.display = 'flex';

  listEl.innerHTML = createReservationCart.map(item => {
    const isHeadSpa = String(item.category || '').toLowerCase() === 'headspa';
    const unitPrice = Number(item.price_htg || 0);
    const lineTotal = unitPrice * item.qty;

    return `
      <div class="cart-item-card">
        <!-- Info service -->
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 0.88rem; color: var(--admin-text, #1e293b); display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span>${escapeHtml(item.name)}</span>
            ${item.extra ? '<span style="background:rgba(212,175,55,0.15);color:var(--admin-accent);font-size:0.65rem;font-weight:700;padding:1px 6px;border-radius:10px;border:1px solid rgba(212,175,55,0.3);">EXTRA</span>' : ''}
          </div>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span style="font-weight: 500;">${unitPrice.toLocaleString()} HTG</span>
            ${isHeadSpa ? `
              <span style="display: inline-flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.03); padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                <span style="font-size: 0.72rem; color: #64748b;">Type:</span>
                <select onchange="updateCreateCartItemHairType('${item.cartItemId}', this.value)" style="font-size: 0.75rem; padding: 1px 4px; border: none; background: transparent; cursor: pointer; font-weight: 500; color: var(--admin-text);">
                  <option value="naturels" ${item.hair_type === 'naturels' ? 'selected' : ''}>Naturels</option>
                  <option value="defrises" ${item.hair_type === 'defrises' ? 'selected' : ''}>Défrisés</option>
                  <option value="dreadlocks" ${item.hair_type === 'dreadlocks' ? 'selected' : ''}>Dreadlocks</option>
                </select>
              </span>
            ` : ''}
          </div>
        </div>

        <!-- Contrôles Quantité -->
        <div class="cart-stepper">
          <button type="button" class="cart-stepper-btn" onclick="changeCreateCartItemQty('${item.cartItemId}', -1)" title="Diminuer">
            <i data-lucide="minus" style="width: 12px; height: 12px;"></i>
          </button>
          <span style="min-width: 24px; text-align: center; font-weight: 700; font-size: 0.88rem; color: #0f172a;">${item.qty}</span>
          <button type="button" class="cart-stepper-btn" onclick="changeCreateCartItemQty('${item.cartItemId}', 1)" title="Augmenter">
            <i data-lucide="plus" style="width: 12px; height: 12px;"></i>
          </button>
        </div>

        <!-- Total ligne -->
        <div style="min-width: 75px; text-align: right; font-weight: 700; font-size: 0.88rem; color: var(--admin-accent, #d4af37);">
          ${lineTotal.toLocaleString()} HTG
        </div>

        <!-- Bouton Retirer -->
        <div>
          <button type="button" class="cart-delete-btn" onclick="removeCreateCartItem('${item.cartItemId}')" title="Retirer du panier">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  refreshLucideIcons();
}

// ── Sèvis EXTRA (kache sou sit piblik la) ───────────────────────────────────
window.toggleExtraServiceForm = function() {
  const f = document.getElementById('extra-service-form');
  if (f) f.style.display = f.style.display === 'none' ? '' : 'none';
};

window.addExtraService = async function() {
  const name = document.getElementById('extra-svc-name').value.trim();
  const price = parseFloat(document.getElementById('extra-svc-price').value);
  const duration = document.getElementById('extra-svc-duration').value.trim();
  const save = document.getElementById('extra-svc-save').checked;

  if (!name) { window.adminCore?.showToast('Non sèvis la obligatwa.', 'error'); return; }
  if (!price || price <= 0) { window.adminCore?.showToast('Pri HTG la obligatwa.', 'error'); return; }

  const supabase = getSupabaseClient();
  let dbId = null;

  if (save && supabase) {
    try {
      const { data, error } = await supabase.from('services').insert({
        name,
        price_htg: price,
        price_usd: 0,
        duration: duration || null,
        category: 'package',
        is_active: true,
        is_visible: false,
        is_extra: true,
        sort_order: 999,
      }).select('id').single();
      if (error) throw error;
      dbId = data?.id || null;
      if (dbId) {
        createReservationServices.push({ id: dbId, name, price_htg: price, price_usd: 0, duration, category: 'package', is_visible: false, is_extra: true });
      }
    } catch (e) {
      console.warn('Extra service save notice:', e.message);
    }
  }

  // Ajoute l dirèkteman nan Panier a
  createReservationCart.push({
    cartItemId: 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    id: dbId,
    name,
    price_htg: price,
    price_usd: 0,
    duration: duration || null,
    category: 'package',
    extra: true,
    hair_type: null,
    qty: 1
  });

  document.getElementById('extra-svc-name').value = '';
  document.getElementById('extra-svc-price').value = '';
  document.getElementById('extra-svc-duration').value = '';
  const f = document.getElementById('extra-service-form');
  if (f) f.style.display = 'none';

  renderCreateCart();
  updateCreateReservationTotal();
  window.adminCore?.showToast(`Sèvis extra "${name}" ajoute nan panier a !`, 'success');
};

// Fonksyon stubs pou konpatibilite
function onCreateServiceToggle() {}
function renderHeadSpaConfig() { return ''; }
function populateHeadSpaLengthOptions() {}
function renderExtraServices() {}
window.onExtraServiceToggle = function() {};
window.removeExtraService = function() {};

window.generateRandomClientPassword = function() {
  const pwd = 'Dalight' + Math.floor(1000 + Math.random() * 9000) + '!';
  const el = document.getElementById('create-client-password');
  if (el) el.value = pwd;
  return pwd;
};

window.autoCheckClientEmail = function() {
  const email = document.getElementById('create-email')?.value.trim();
  if (email && email.includes('@')) {
    searchClientByEmail();
  }
};

async function searchClientByEmail() {
  const emailInput = document.getElementById('create-email');
  const infoEl = document.getElementById('create-client-info');
  const errorEl = document.getElementById('create-client-error');
  const badgeEl = document.getElementById('client-account-status-badge');
  const nameInput = document.getElementById('create-client-name');
  const phoneInput = document.getElementById('create-client-phone');
  const pwdGroup = document.getElementById('create-password-group');
  const pwdInput = document.getElementById('create-client-password');
  const email = emailInput?.value.trim().toLowerCase();

  if (infoEl) infoEl.textContent = '';
  if (errorEl) errorEl.style.display = 'none';
  createReservationClient = null;

  if (!email || !email.includes('@')) {
    if (errorEl) {
      errorEl.textContent = 'Veuillez entrer une adresse email valide.';
      errorEl.style.display = 'block';
    }
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('email', email)
      .maybeSingle();

    if (data && data.id) {
      // Existing client found
      createReservationClient = data;
      if (nameInput && data.full_name) nameInput.value = data.full_name;
      if (phoneInput && data.phone) phoneInput.value = data.phone;
      if (pwdGroup) pwdGroup.style.display = 'none';
      if (badgeEl) {
        badgeEl.textContent = 'Compte existant';
        badgeEl.style.background = 'rgba(74,222,128,0.18)';
        badgeEl.style.color = '#4ade80';
      }
      if (infoEl) {
        infoEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> Compte client trouvé : <strong>${escapeHtml(data.full_name || 'Sans nom')}</strong> (${escapeHtml(data.email)})</span>`; refreshLucideIcons();
      }
    } else {
      // New client: show password box, pre-fill temporary password
      createReservationClient = null;
      if (pwdGroup) pwdGroup.style.display = 'block';
      if (pwdInput && !pwdInput.value) generateRandomClientPassword();
      if (badgeEl) {
        badgeEl.textContent = 'Nouveau client (Accès sera créé)';
        badgeEl.style.background = 'rgba(212,175,55,0.18)';
        badgeEl.style.color = 'var(--admin-accent)';
      }
      if (infoEl) {
        infoEl.innerHTML = '<span style="color:var(--admin-accent);font-size:0.83rem;">Nouveau client : le compte et ses accès privés lui seront envoyés par WhatsApp et email.</span>';
      }
    }
  } catch (err) {
    console.warn("Client lookup warning:", err);
  }
}

function updateCreateReservationTotal() {
  const includeFee = document.getElementById('create-include-moncash-fee')?.checked ?? true;
  let subtotal = 0;

  // Calcul du sous-total basé sur le panier interactif
  createReservationCart.forEach(item => {
    const base = Number(item.price_htg || 0);
    subtotal += base * (item.qty || 1);
  });

  // Option Vidéo Souvenir (dynamique selon settings CVISUAL)
  const wantsVideo = document.getElementById('create-video-toggle')?.checked ?? false;
  const videoConsent = document.querySelector('input[name="create_video_consent"]:checked')?.value || 'public';
  const pubPrice = window.adminVideoPricePublic || 1000;
  const privPrice = window.adminVideoPricePrivate || 2000;
  const videoPrice = wantsVideo ? (videoConsent === 'private' ? privPrice : pubPrice) : 0;
  if (wantsVideo) {
    subtotal += videoPrice;
  }

  // 2. Calcul des réductions (Code promo + Remise manuelle)
  let promoDiscount = 0;
  if (adminCreateAppliedPromo) {
    if (adminCreateAppliedPromo.discount_type === 'percentage') {
      promoDiscount = Math.round(subtotal * (Number(adminCreateAppliedPromo.discount_value) / 100));
    } else {
      promoDiscount = Math.min(subtotal, Number(adminCreateAppliedPromo.discount_value) || 0);
    }
  }

  const manualDiscVal = parseFloat(document.getElementById('create-discount-input')?.value) || 0;
  const manualDiscType = document.getElementById('create-discount-type')?.value || 'fixed';
  let manualDiscount = 0;
  const remainingAfterPromo = Math.max(0, subtotal - promoDiscount);
  if (manualDiscVal > 0) {
    if (manualDiscType === 'percent') {
      manualDiscount = Math.round(remainingAfterPromo * (manualDiscVal / 100));
    } else {
      manualDiscount = Math.min(remainingAfterPromo, manualDiscVal);
    }
  }

  const totalDiscount = Math.min(subtotal, promoDiscount + manualDiscount);
  const netBeforeFee = Math.max(0, subtotal - totalDiscount);

  // 3. Frais MonCash (3%) appliqués sur le montant net
  const feeAmount = (includeFee && netBeforeFee > 0) ? (withFee(netBeforeFee) - netBeforeFee) : 0;
  const total = netBeforeFee + feeAmount;

  const totalEl = document.getElementById('create-reservation-total');
  const feeEl = document.getElementById('create-moncash-fee-display');

  if (totalEl) {
    let parts = [];
    if (subtotal > 0) parts.push(`Sous-total : ${subtotal.toLocaleString()} HTG`);
    if (totalDiscount > 0) parts.push(`<span style="color:#10b981;">Réduction : -${totalDiscount.toLocaleString()} HTG</span>`);
    if (includeFee && feeAmount > 0) parts.push(`Frais MonCash : +${feeAmount.toLocaleString()} HTG`);
    if (subtotal > 0) parts.push(`<strong style="color:var(--admin-accent);font-size:1.05rem;">TOTAL : ${total.toLocaleString()} HTG</strong>`);
    if (wantsVideo) parts.push(`(dont Vidéo : ${videoPrice.toLocaleString()} HTG)`);
    totalEl.innerHTML = parts.join(' &nbsp;—&nbsp; ');
  }
  if (feeEl) feeEl.textContent = includeFee ? 'Frais MonCash (3%) calculés sur le montant net' : 'Frais MonCash retirés';

  return { subtotal, totalDiscount, feeAmount, total, headSpaMissing: false };
}

async function submitCreateReservation() {
  const emailInput = document.getElementById('create-email');
  const nameInput = document.getElementById('create-client-name');
  const phoneInput = document.getElementById('create-client-phone');
  const pwdInput = document.getElementById('create-client-password');

  const clientEmail = (emailInput?.value || '').trim().toLowerCase();
  const clientName = (nameInput?.value || '').trim();
  const clientPhone = (phoneInput?.value || '').trim();
  const clientPassword = (pwdInput?.value || '').trim() || generateRandomClientPassword();

  if (!clientEmail || !clientEmail.includes('@')) {
    window.adminCore?.showToast("Veuillez saisir une adresse email valide pour le client.", "error");
    emailInput?.focus();
    return;
  }
  if (!clientName) {
    window.adminCore?.showToast("Le nom complet du client est obligatoire.", "error");
    nameInput?.focus();
    return;
  }

  const date = document.getElementById('create-date').value;
  const time = document.getElementById('create-time').value;
  if (!date || !time) {
    window.adminCore?.showToast('Date et heure obligatoires.', 'error');
    return;
  }

  if (!createReservationCart || createReservationCart.length === 0) {
    window.adminCore?.showToast('Veuillez ajouter au moins un service au panier.', 'error');
    return;
  }

  const { subtotal, totalDiscount, feeAmount, total } = updateCreateReservationTotal();
  const includeFee = document.getElementById('create-include-moncash-fee')?.checked ?? true;

  // Construction de la liste des services avec support des quantités multiples
  const selectedServices = [];
  createReservationCart.forEach(item => {
    const isHeadSpa = String(item.category || '').toLowerCase() === 'headspa';
    const hairType = item.hair_type || 'naturels';
    const hairTypeLabel = isHeadSpa ? (HAIR_TYPE_LABELS[hairType] || hairType) : null;
    const displayName = (isHeadSpa && hairTypeLabel) ? `${item.name} (${hairTypeLabel})` : item.name;
    const baseHtg = Number(item.price_htg || 0);

    for (let q = 0; q < item.qty; q++) {
      selectedServices.push({
        id: item.id || null,
        name: displayName,
        base_name: item.name,
        price_htg: includeFee ? withFee(baseHtg) : baseHtg,
        price_usd: 0,
        hair_type: isHeadSpa ? hairType : null,
        hair_length: 'Toutes longueurs',
        category: item.category || 'general',
        extra: !!item.extra,
        duration: item.duration || null,
        qty: 1,
        total_qty: item.qty,
        unit_index: q + 1
      });
    }
  });

  const serviceSummary = createReservationCart.map(item => {
    const isHeadSpa = String(item.category || '').toLowerCase() === 'headspa';
    const hairType = item.hair_type || 'naturels';
    const hairTypeLabel = isHeadSpa ? (HAIR_TYPE_LABELS[hairType] || hairType) : null;
    const fullName = (isHeadSpa && hairTypeLabel) ? `${item.name} (${hairTypeLabel})` : item.name;
    return item.qty > 1 ? `${item.qty}x ${fullName}` : fullName;
  }).join(', ');

  if (!selectedServices.length) {
    window.adminCore?.showToast('Erreur lors de la préparation des services du panier.', 'error');
    return;
  }

  const wantsVideo = document.getElementById('create-video-toggle')?.checked ?? false;
  const videoConsent = document.querySelector('input[name="create_video_consent"]:checked')?.value || 'public';
  const pubPrice = window.adminVideoPricePublic || 1000;
  const privPrice = window.adminVideoPricePrivate || 2000;
  const videoPrice = wantsVideo ? (videoConsent === 'private' ? privPrice : pubPrice) : 0;

  const reservationNumber = 'DL' + Date.now().toString().slice(-8);

  const supabase = getSupabaseClient();
  if (!supabase) {
    window.adminCore?.showToast('Supabase non connecté.', 'error');
    return;
  }

  let finalUserId = createReservationClient?.id || null;
  let isNewClientAccount = false;

  // If client does not exist, create client user and profile
  if (!finalUserId) {
    try {
      window.adminCore?.showToast('Création du compte client...');
      finalUserId = crypto.randomUUID();

      // Try Auth signUp
      try {
        const { data: authData } = await supabase.auth.signUp({
          email: clientEmail,
          password: clientPassword,
          options: {
            data: { full_name: clientName, phone: clientPhone }
          }
        });
        if (authData?.user?.id) finalUserId = authData.user.id;
      } catch(authE) {
        console.warn("Auth signup warning (fallback to profiles):", authE);
      }

      // Upsert into profiles table
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .upsert({
          id: finalUserId,
          email: clientEmail,
          full_name: clientName,
          phone: clientPhone || null,
          role: 'client',
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' })
        .select()
        .maybeSingle();

      if (profData?.id) finalUserId = profData.id;
      isNewClientAccount = true;
    } catch(accErr) {
      console.warn("Account creation notice:", accErr);
      if (!finalUserId) finalUserId = crypto.randomUUID();
    }
  }

  const record = {
    reservation_number: reservationNumber,
    user_id: finalUserId,
    user_email: clientEmail,
    user_name: clientName,
    phone: clientPhone || null,
    service: serviceSummary,
    services: selectedServices.map(s => ({ id: s.id, name: s.name, price_htg: s.price_htg, price_usd: s.price_usd, hair_type: s.hair_type || null, hair_length: s.hair_length || null, extra: !!s.extra })),
    service_id: (selectedServices.find(s => s.id) || selectedServices[0]).id || null,
    location: document.getElementById('create-location').value,
    date,
    time,
    status: document.getElementById('create-status').value,
    payment_status: document.getElementById('create-payment-status').value,
    payment_method: document.getElementById('create-payment-method').value,
    payment_choice: 'full',
    total_amount: total,
    total_amount_htg: total,
    deposit_amount: total,
    balance_amount_due: 0,
    promo_code: adminCreateAppliedPromo ? adminCreateAppliedPromo.code : null,
    discount_amount: totalDiscount || 0,
    discount_pct: (adminCreateAppliedPromo && adminCreateAppliedPromo.discount_type === 'percentage') ? Number(adminCreateAppliedPromo.discount_value) : 0,
    notes: document.getElementById('create-notes').value.trim() || null,
    wants_video: wantsVideo,
    video_requested: wantsVideo,
    video_consent: wantsVideo ? videoConsent : null,
    video_price: videoPrice,
    video_status: wantsVideo ? 'pending' : null,
  };

  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert([record])
      .select();

    if (error) throw error;

    const reservation = data?.[0] || record;

    // Enregistrer l'utilisation du code promo si applicable
    if (adminCreateAppliedPromo) {
      try {
        await supabase.from('promo_codes').update({
          uses_count: (Number(adminCreateAppliedPromo.uses_count) || 0) + 1,
          updated_at: new Date().toISOString()
        }).eq('id', adminCreateAppliedPromo.id);

        await supabase.from('promo_code_uses').insert([{
          promo_code_id: adminCreateAppliedPromo.id,
          code: adminCreateAppliedPromo.code,
          reservation_id: reservation.id,
          user_id: finalUserId,
          discount_applied_htg: totalDiscount || 0,
          created_at: new Date().toISOString()
        }]);
      } catch(promoErr) {
        console.warn('Promo code use tracking notice:', promoErr);
      }
    }


    // Automatic WhatsApp Dispatch on Ligne #3 DALIGHT
    const cleanPhone = String(clientPhone).replace(/\D/g, '');
    if (cleanPhone) {
      const formattedPhone = cleanPhone.length === 8 ? ('509' + cleanPhone) : cleanPhone;
      let waMessage = "";

      if (isNewClientAccount) {
        waMessage = `Bonjour ${clientName} ! ✨

Votre réservation chez DALIGHT a bien été enregistrée :
📅 Date : ${date} à ${time}
🌿 Soin : ${record.service}
📍 Lieu : ${record.location}
💰 Total : ${total.toLocaleString()} HTG${wantsVideo ? ` (Option Vidéo ${videoPrice.toLocaleString()} HTG inclus)` : ''}

Comme vous n'aviez pas encore de compte client chez DALIGHT, nous venons de vous créer un accès privé afin que vous puissiez suivre vos rendez-vous, accéder à vos vidéos souvenirs 4K et réserver vos prochaines séances en toute simplicité :
• Identifiant (Email) : ${clientEmail}
• Mot de passe temporaire : ${clientPassword}

Vous pouvez vous connecter à tout moment sur notre site officiel et vous pourrez modifier ce mot de passe directement dans votre profil dès votre première connexion :
👉 https://dalightbeauty.com/pages/client-portal.html

Au plaisir de vous accueillir chez DALIGHT ! 🌿`;
      } else {
        waMessage = `Bonjour ${clientName} ! ✨

Votre réservation chez DALIGHT a bien été enregistrée :
📅 Date : ${date} à ${time}
🌿 Soin : ${record.service}
📍 Lieu : ${record.location}
💰 Total : ${total.toLocaleString()} HTG${wantsVideo ? ` (Option Vidéo ${videoPrice.toLocaleString()} HTG inclus)` : ''}

Merci de votre confiance et au plaisir de vous choyer chez DALIGHT ! 🌿`;
      }

      // Send via CVISUAL Gateway Ligne #3
      fetch('https://cvisual-whatsapp-gateway.onrender.com/api/v1/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: formattedPhone,
          message: waMessage,
          kind: 'manual_direct',
          mode: 'sync',
          account_index: 3
        })
      }).catch(e => console.warn('WhatsApp gateway send notice:', e));
    }

    // Send confirmation email if checked
    if (document.getElementById('create-send-email')?.checked) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: clientEmail,
            subject: `Votre réservation DALIGHT ${reservationNumber}`,
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
                <h2 style="color: #7c3aed;">Bonjour ${escapeHtml(clientName)},</h2>
                <p>Votre réservation a bien été enregistrée chez <strong>DALIGHT</strong>.</p>
                <p><strong>N° Réservation :</strong> #${reservationNumber}<br>
                   <strong>Soin :</strong> ${escapeHtml(record.service)}<br>
                   <strong>Date &amp; Heure :</strong> ${date} à ${time}<br>
                   <strong>Lieu :</strong> ${escapeHtml(record.location)}<br>
                   <strong>Total :</strong> ${total.toLocaleString()} HTG</p>
                ${isNewClientAccount ? `
                  <div style="background: #f1f5f9; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                    <p style="margin: 0 0 0.5rem 0; font-weight: bold; color: #0f172a;">Vos identifiants d'accès client DALIGHT :</p>
                    <p style="margin: 0;">• Email : <strong>${escapeHtml(clientEmail)}</strong><br>• Mot de passe temporaire : <strong>${escapeHtml(clientPassword)}</strong></p>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #64748b;">Vous pourrez modifier ce mot de passe à tout moment dans votre espace profil.</p>
                  </div>
                ` : ''}
                <p>Merci de votre confiance et à très bientôt chez DALIGHT !</p>
              </div>
            `
          }
        });
      } catch (emailErr) {
        console.warn('Email confirmation notice:', emailErr);
      }
    }

    window.adminCore?.showToast(isNewClientAccount
      ? `Réservation ${reservationNumber} & compte client créés avec succès ! Identifiants envoyés sur WhatsApp ✓`
      : `Réservation ${reservationNumber} créée avec succès ✓`, 'success');

    closeCreateReservationModal();
    loadReservations();
  } catch (err) {
    console.error('Error creating reservation:', err);
    window.adminCore?.showToast('Erreur création : ' + err.message, 'error');
  }
}

function withFeeUSD(p) { return Number((Number(p) * 1.03).toFixed(2)); }

window.openCreateReservationModal = openCreateReservationModal;
window.closeCreateReservationModal = closeCreateReservationModal;
window.searchClientByEmail = searchClientByEmail;
window.createClientAccountForReservation = createClientAccountForReservation;
window.submitCreateReservation = submitCreateReservation;
window.updateCreateReservationTotal = updateCreateReservationTotal;
window.onCreateServiceToggle = onCreateServiceToggle;
window.populateHeadSpaLengthOptions = populateHeadSpaLengthOptions;
window.addPickerServiceToCart = addPickerServiceToCart;
window.changeCreateCartItemQty = changeCreateCartItemQty;
window.removeCreateCartItem = removeCreateCartItem;
window.updateCreateCartItemHairType = updateCreateCartItemHairType;
window.renderCreateCart = renderCreateCart;
window.quickAddServiceByName = quickAddServiceByName;
window.clearCreateCart = clearCreateCart;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// WHATSAPP DEDICATED ACTIONS (LIGNE 3 DALIGHT)
// ============================================

window.sendWhatsAppConfirmationAction = async function(id) {
  const r = allReservations.find(res => res.id === id);
  if (!r) return;
  const phone = r.phone || r.user_phone;
  if (!phone) {
    window.adminCore.showToast('Aucun numéro de téléphone pour cette réservation', 'warning');
    return;
  }
  if (!confirm(`Envoyer la confirmation WhatsApp officielle sur le ${phone} ?`)) return;

  try {
    const success = await window.adminCore.sendReservationWhatsAppConfirmation(r);
    if (success) {
      window.adminCore.showToast('Confirmation WhatsApp envoyée avec succès !');
    } else {
      window.adminCore.showToast('Échec de l\'envoi WhatsApp (vérifiez la connexion)', 'error');
    }
  } catch (err) {
    window.adminCore.showToast('Erreur: ' + (err.message || 'Échec d\'envoi'), 'error');
  }
};

window.sendWhatsAppReminder24hAction = async function(id) {
  const r = allReservations.find(res => res.id === id);
  if (!r) return;
  const phone = r.phone || r.user_phone;
  if (!phone) {
    window.adminCore.showToast('Aucun numéro de téléphone pour cette réservation', 'warning');
    return;
  }
  if (!confirm(`Envoyer le Rappel J-1 (24h avant) par WhatsApp au client (${phone}) ?`)) return;

  try {
    const success = await window.adminCore.sendReservationWhatsAppReminder24h(r);
    if (success) {
      window.adminCore.showToast('Rappel J-1 WhatsApp transmis avec succès (Slow Lane) !');
    } else {
      window.adminCore.showToast('Échec lors de l\'envoi du rappel WhatsApp', 'error');
    }
  } catch (err) {
    window.adminCore.showToast('Erreur: ' + (err.message || 'Échec'), 'error');
  }
};

window.sendWhatsAppAlert30mAction = async function(id) {
  const r = allReservations.find(res => res.id === id);
  if (!r) return;
  const phone = r.phone || r.user_phone;
  if (!phone) {
    window.adminCore.showToast('Aucun numéro de téléphone pour cette réservation', 'warning');
    return;
  }
  if (!confirm(`Envoyer l'Alerte Ponctualité & Retard (H-30 min) à ${phone} ?`)) return;

  try {
    const success = await window.adminCore.sendReservationWhatsAppAlert30m(r);
    if (success) {
      window.adminCore.showToast('Alerte H-30 min WhatsApp envoyée avec succès (Fast Lane) !');
    } else {
      window.adminCore.showToast('Échec lors de l\'envoi de l\'alerte WhatsApp', 'error');
    }
  } catch (err) {
    window.adminCore.showToast('Erreur: ' + (err.message || 'Échec'), 'error');
  }
};

window.sendGiftWhatsAppDedicationAction = async function(id) {
  const r = allReservations.find(res => res.id === id);
  if (!r) return;
  const giftInfo = parseGiftReservationDetails(r.notes);
  if (!giftInfo) {
    window.adminCore?.showToast('Cette réservation ne comporte pas de dédicace cadeau.', 'warning');
    return;
  }
  const phone = giftInfo.beneficiaryPhone;
  if (!phone) {
    window.adminCore?.showToast('Aucun numéro WhatsApp trouvé pour le bénéficiaire.', 'warning');
    return;
  }

  const promptMsg = `Envoyer la Carte Cadeau & Dédicace personnalisée par WhatsApp au bénéficiaire (${giftInfo.beneficiaryName || 'Bénéficiaire'} - ${phone}) via la Ligne #3 DALIGHT ?`;
  if (!confirm(promptMsg)) return;

  try {
    const success = await window.adminCore.sendGiftDedicationWhatsApp(r, giftInfo);
    if (success) {
      window.adminCore?.showToast(`Dédicace cadeau envoyée avec succès à ${giftInfo.beneficiaryName} (${phone}) !`);
    } else {
      window.adminCore?.showToast('Échec lors de l\'envoi WhatsApp (vérifiez la passerelle)', 'error');
    }
  } catch (err) {
    window.adminCore?.showToast('Erreur : ' + (err.message || 'Échec d\'envoi'), 'error');
  }
};

window.copyDedicationMessage = function(id) {
  const r = allReservations.find(res => res.id === id);
  if (!r) return;
  const giftInfo = parseGiftReservationDetails(r.notes);
  const textToCopy = giftInfo?.dedicationMessage || r.notes || '';
  if (!textToCopy) {
    window.adminCore?.showToast('Aucun message à copier.', 'warning');
    return;
  }

  navigator.clipboard.writeText(textToCopy).then(() => {
    window.adminCore?.showToast('Dédicace copiée dans le presse-papiers ✓');
  }).catch(() => {
    window.adminCore?.showToast('Impossible de copier automatiquement.', 'error');
  });
};

window.toggleReservationVideoAdmin = async function(id, enable, consent = 'public') {
  try {
    const sb = window.adminCore?.supabase || window.supabaseClient;
    if (!sb) throw new Error("Supabase indisponible");

    const pubPrice = window.adminVideoPricePublic || 1000;
    const privPrice = window.adminVideoPricePrivate || 2000;
    const price = enable ? (consent === 'private' ? privPrice : pubPrice) : 0;
    const payload = enable ? {
      wants_video: true,
      video_requested: true,
      video_consent: consent,
      video_price: price,
      video_status: 'pending',
      updated_at: new Date().toISOString()
    } : {
      wants_video: false,
      video_requested: false,
      video_price: 0,
      video_status: null,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from('reservations').update(payload).eq('id', id);
    if (error) throw error;

    if (window.adminCore?.showToast) {
      window.adminCore.showToast(enable ? "Option Vidéo 4K activée !" : "Option Vidéo 4K désactivée.", "success");
    }

    if (typeof allReservations !== 'undefined' && Array.isArray(allReservations)) {
      const found = allReservations.find(x => x.id === id);
      if (found) Object.assign(found, payload);
    }

    if (typeof window.openDetailModal === 'function') {
      window.openDetailModal(id);
    }
  } catch(err) {
    console.error("Toggle video error:", err);
    alert("Erreur: " + err.message);
  }
};
