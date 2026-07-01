// ============================================
// DALIGHT HEAD SPA - RESERVATIONS MANAGEMENT
// ============================================

let allReservations = [];
let currentFilter = 'all';
let currentReservation = null;

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const session = await window.adminCore?.checkAdminAuth();
  if (!session) return;
  
  initFilters();
  initSearch();
  initDateFilter();
  initExport();
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
  const { fetchReservations } = window.adminCore;
  
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
          ${{ moncash: 'MonCash', natcash: 'NatCash', bank: 'Banque' }[r.payment_method] || (r.payment_method || '—')}
        </div>
        ${['moncash','natcash'].includes(r.payment_method)
          ? (r.plop_client_id
              ? `<div style="font-size:.72rem;color:#0369a1;margin-top:.2rem;">ID: ${r.plop_client_id}</div>`
              : `<div style="font-size:.72rem;color:#92400e;margin-top:.2rem;">Plop en attente</div>`)
          : (r.payment_proof_url
              ? `<div style="font-size:.72rem;color:#22c55e;margin-top:.2rem;">Preuve reçue</div>`
              : '')}
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

window.openDetailModal = function(id) {
  const { formatDate, formatTime, getStatusBadge } = window.adminCore;
  const r = allReservations.find(r => r.id === id);
  if (!r) return;

  currentReservation = r;

  const modal   = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');
  const footer  = document.getElementById('modal-footer');

  // ── Helpers ──────────────────────────────────────────────────
  const fmtHTG = n => n ? Number(n).toLocaleString('fr-FR') + ' HTG' : '—';
  const ico = (path, size = 14, color = 'currentColor') =>
    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2" width="${size}" height="${size}" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;

  // ── Payment method ────────────────────────────────────────────
  const _pm = (r.payment_method || '').toLowerCase();
  const isMobilePay = ['moncash', 'natcash', 'kashpaw'].includes(_pm);
  const methodMeta = {
    moncash: { label: 'MonCash',         path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    natcash: { label: 'NatCash',         path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    kashpaw: { label: 'KashPaw',         path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    bank:    { label: 'Compte Bancaire', path: 'M3 21h18M3 10h18M3 7l9-4 9 4M4 10h1v11M9 10h1v11M14 10h1v11M19 10h1v11' },
  };
  const mm = methodMeta[_pm] || { label: r.payment_method || 'Non spécifié', path: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' };

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
  // Show for bank always; for moncash/natcash only if it's a legacy (pre-Plop) reservation
  // Legacy = moncash/natcash paid via manual screenshot (proof exists, no Plop reference)
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

  // ── Plop Plop section (moncash/natcash only, always shown) ────
  const plopRow = (label, val, highlight = false) => `
    <div style="display:flex;justify-content:space-between;align-items:center;${highlight ? 'background:#e0f2fe;padding:.4rem .6rem;border-radius:6px;' : 'padding:.25rem 0;'}font-size:.82rem;margin-top:.3rem;">
      <span style="color:${highlight ? '#0369a1' : 'var(--admin-text-muted)'};font-weight:${highlight ? '600' : '400'};">${label}</span>
      <code style="font-size:.78rem;font-weight:${highlight ? '700' : '400'};color:${highlight ? '#0369a1' : 'inherit'};">${val}</code>
    </div>`;

  // ── Plop Plop section — all moncash/natcash except legacy screenshot ──
  const plopHtml = isMobilePay && !isLegacyMobilePay ? `
    <div style="background:#f0f9ff;border-radius:12px;padding:1rem;border:1px solid #bae6fd;">
      <div style="display:flex;align-items:center;gap:.5rem;font-weight:600;color:#0369a1;margin-bottom:.6rem;font-size:.85rem;">
        ${ico('M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', 15, '#0369a1')}
        Plop Plop — Vérification du paiement
      </div>
      ${r.payment_reference    ? plopRow('Référence', r.payment_reference) : ''}
      ${r.plop_transaction_id  ? plopRow('ID Transaction', r.plop_transaction_id) : ''}
      ${r.plop_client_id
        ? plopRow('ID Client Plop Plop', r.plop_client_id, true)
        : `<div style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;color:#92400e;background:#fef3c7;padding:.5rem .75rem;border-radius:6px;margin-top:.3rem;border:1px solid #fde68a;">
            ${ico('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 14, '#92400e')}
            ID client Plop Plop non encore capturé
          </div>`}
      ${r.balance_payment_reference ? `
        <div style="margin-top:.6rem;padding-top:.6rem;border-top:1px dashed #bae6fd;">
          ${plopRow('Réf. solde restant', r.balance_payment_reference)}
        </div>` : ''}
      ${r.balance_plop_client_id ? plopRow('ID Client Plop (solde)', r.balance_plop_client_id, true) : ''}
    </div>` : '';

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

      ${plopHtml}
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

      ${r.notes ? `
      <div>
        <div style="font-size:.78rem;color:var(--admin-text-muted);margin-bottom:.35rem;">Notes</div>
        <div style="background:var(--admin-bg);padding:.85rem 1rem;border-radius:10px;border:1px solid var(--admin-border);font-size:.88rem;">${r.notes}</div>
      </div>` : ''}

      <div style="font-size:.75rem;color:var(--admin-text-muted);">
        Créé le ${formatDate(r.created_at)}
      </div>
    </div>`;

  // ── Footer ────────────────────────────────────────────────────
  const automaticButtonsHtml = `
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;width:100%;margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid var(--admin-border);">
      <span style="font-size:.75rem;color:var(--admin-text-muted);width:100%;margin-bottom:.2rem;display:flex;align-items:center;gap:.3rem;">
        ${ico('M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2', 13)} Actions automatiques (Brevo)
      </span>
      ${r.status === 'PENDING' ? `
        <button class="btn btn-success btn-sm" onclick="autoConfirmReservation('${r.id}')">Confirmer &amp; Email</button>
        <button class="btn btn-secondary btn-sm" onclick="autoSetPending('${r.id}')">Remettre en attente</button>` : ''}
      ${r.status === 'CONFIRMED' ? `
        <button class="btn btn-success btn-sm" onclick="autoCompleteReservation('${r.id}')">Terminer &amp; Email</button>` : ''}
    </div>`;

  const emailButtonsHtml = `
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;width:100%;margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid var(--admin-border);">
      <span style="font-size:.75rem;color:var(--admin-text-muted);width:100%;margin-bottom:.2rem;display:flex;align-items:center;gap:.3rem;">
        ${ico('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', 13)} Emails manuels
      </span>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','confirmation')">Confirmation</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','cancellation')">Annulation</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','reminder')">Rappel</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','completion')">Terminé</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${r.id}','custom')">Vide</button>
    </div>`;

  const plopVerifyHtml = isMobilePay && !isLegacyMobilePay ? `
    <div style="width:100%;margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid var(--admin-border);">
      <button class="btn btn-sm" onclick="verifyReservationPayment('${r.id}')"
        style="width:100%;background:#0369a1;color:#fff;border:none;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.55rem 1rem;border-radius:8px;font-weight:600;cursor:pointer;">
        ${ico('M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', 14, '#fff')}
        Vérifier paiement Plop Plop
      </button>
      <div style="font-size:.72rem;text-align:center;margin-top:.3rem;${r.plop_client_id ? 'color:#059669;' : 'color:#92400e;'}">
        ${r.plop_client_id
          ? `Confirmé — ID client: ${r.plop_client_id}`
          : r.payment_reference
            ? `Réf: ${r.payment_reference} — non encore vérifié`
            : `Aucune référence stockée — vous pouvez en entrer une manuellement`}
      </div>
    </div>` : '';

  const showBalanceBtn = balance > 0 && !isFull && r.status !== 'CANCELLED';

  let actions = `
    <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
    <button class="btn btn-secondary" onclick="printReservationDetail('${r.id}')" style="display:flex;align-items:center;gap:.35rem;">
      ${ico('M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z', 14)} Imprimer
    </button>
    ${showBalanceBtn ? `<button class="btn btn-primary" onclick="openBalanceModal('${r.id}')" style="display:flex;align-items:center;gap:.35rem;">
      ${ico('M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', 14)} Payer le solde
    </button>` : ''}
  `;
  if (r.status === 'PENDING') {
    actions = `
      <button class="btn btn-danger" onclick="updateStatus('${r.id}','CANCELLED');closeModal();">Annuler</button>
      <button class="btn btn-secondary" onclick="printReservationDetail('${r.id}')">${ico('M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z', 14)} Imprimer</button>
      <button class="btn btn-primary" onclick="updateStatus('${r.id}','CONFIRMED');closeModal();">Confirmer</button>`;
  } else if (r.status === 'CONFIRMED') {
    actions = `
      <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
      <button class="btn btn-secondary" onclick="printReservationDetail('${r.id}')">${ico('M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z', 14)} Imprimer</button>
      <button class="btn btn-primary" onclick="updateStatus('${r.id}','COMPLETED');closeModal();">Marquer terminé</button>
      ${showBalanceBtn ? `<button class="btn btn-primary" onclick="openBalanceModal('${r.id}')">${ico('M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', 14)} Payer solde</button>` : ''}`;
  }

  footer.innerHTML = plopVerifyHtml + automaticButtonsHtml + emailButtonsHtml +
    '<div style="display:flex;gap:.5rem;justify-content:flex-end;flex-wrap:wrap;width:100%;">' + actions + '</div>';
  footer.style.flexDirection = 'column';
  footer.style.alignItems    = 'stretch';
  modal.classList.add('active');
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
        <div style="font-size:11px;font-weight:700;margin-bottom:3px;">Service / Rituel</div>
        <div style="font-size:10px;">${r.service || '—'}</div>
        <div style="font-size:10px;color:#6b7280;">${formatDate(r.date)} à ${formatTime(r.time)} — ${r.location === 'Spa' ? 'Au Spa' : 'À domicile'}</div>
      </div>
      <hr style="border:none;border-top:1px dashed #d1d5db;margin:5mm 0;">
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Total service</span><span>${fmtHTG(totalAmt)}</span></div>
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Acompte / Payé</span><span>${fmtHTG(amtPaid)}</span></div>
      ${balance > 0 ? `<div style="font-size:11px;display:flex;justify-content:space-between;margin-top:4px;font-weight:700;color:#92400e;"><span>SOLDE RESTANT</span><span>${fmtHTG(balance)}</span></div>` : `<div style="font-size:11px;display:flex;justify-content:space-between;margin-top:4px;font-weight:700;color:#059669;"><span>PAIEMENT COMPLET</span><span>${fmtHTG(totalAmt)}</span></div>`}
      <hr style="border:none;border-top:1px dashed #d1d5db;margin:5mm 0;">
      <div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Méthode de paiement</span><span>${(r.payment_method || '—').toUpperCase()}</span></div>
      ${r.balance_payment_method ? `<div style="font-size:10px;display:flex;justify-content:space-between;margin-bottom:3px;"><span>Méthode solde</span><span>${r.balance_payment_method.toUpperCase()}</span></div>` : ''}
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
      <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${r.payment_method || '—'} (${r.payment_choice === 'full' ? 'Complet' : 'Acompte'})</td>
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
            <th style="text-align:left;padding:6px;border-bottom:2px solid #1a1a1a;font-size:9px;">Rituel</th>
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

window.openBalanceModal = function(id) {
  const r = allReservations.find(r => r.id === id);
  if (!r) return;

  balanceReservationId = id;
  selectedBalancePM = 'cash';
  document.querySelectorAll('.balance-pm-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.pm === 'cash'));
  document.getElementById('balance-reference').value = '';

  const totalAmt = parseFloat(r.total_amount || r.total_price || 0);
  const depositAmt = parseFloat(r.deposit_amount || 0);
  const balancePaid = parseFloat(r.balance_amount_paid || 0);
  const balance = Math.max(0, totalAmt - depositAmt - balancePaid);

  document.getElementById('balance-info').innerHTML = `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:.75rem 1rem;">
      <div style="font-size:.78rem;color:#92400e;margin-bottom:.25rem;">Solde à payer</div>
      <div style="font-size:1.4rem;font-weight:700;color:#b45309;">${balance.toLocaleString('fr-FR')} HTG</div>
      <div style="font-size:.75rem;color:#92400e;margin-top:.25rem;">
        Total: ${totalAmt.toLocaleString('fr-FR')} HTG — Déjà payé: ${(depositAmt + balancePaid).toLocaleString('fr-FR')} HTG
      </div>
    </div>
  `;

  document.getElementById('balance-modal').style.display = 'flex';
};

window.closeBalanceModal = function() {
  document.getElementById('balance-modal').style.display = 'none';
  balanceReservationId = null;
};

window.selectBalancePM = function(pm) {
  selectedBalancePM = pm;
  document.querySelectorAll('.balance-pm-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pm === pm);
  });
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
  const balance = Math.max(0, totalAmt - depositAmt - balancePaid);
  const reference = document.getElementById('balance-reference').value.trim() || `${r.reservation_number || 'DL' + Date.now().toString().slice(-8)}-SOLDE`;

  try {
    // Mobile payment: create Plop Plop payment for balance
    if (selectedBalancePM === 'moncash' || selectedBalancePM === 'natcash') {
      const { createPlopPayment } = await import('../js/plop-payment.js?v=5.0.0');
      const payment = await createPlopPayment(supabase, {
        refference_id: reference,
        montant: balance,
        payment_method: selectedBalancePM,
        context_type: 'reservation_balance',
        context_id: r.id,
      });

      if (payment?.transaction_id) {
        await supabase.from('reservations').update({
          balance_amount_paid: balancePaid + balance,
          balance_payment_method: selectedBalancePM,
          balance_payment_reference: reference,
          balance_plop_transaction_id: payment.transaction_id,
          payment_status: 'fully_paid',
          payment_choice: 'full',
        }).eq('id', r.id);
      }
      if (payment?.url) { window.location.href = payment.url; return; }
    } else {
      // Cash or bank: mark balance paid immediately
      await supabase.from('reservations').update({
        balance_amount_paid: balancePaid + balance,
        balance_payment_method: selectedBalancePM,
        balance_payment_reference: reference,
        payment_status: 'fully_paid',
        payment_choice: 'full',
      }).eq('id', r.id);
    }

    // Update local data
    const idx = allReservations.findIndex(res => res.id === r.id);
    if (idx !== -1) {
      allReservations[idx].balance_amount_paid = balancePaid + balance;
      allReservations[idx].balance_payment_method = selectedBalancePM;
      allReservations[idx].balance_payment_reference = reference;
      allReservations[idx].payment_status = 'fully_paid';
      allReservations[idx].payment_choice = 'full';
    }

    closeBalanceModal();
    closeModal();
    renderReservations();
    window.adminCore.showToast('Solde payé avec succès', 'success');
    // Print receipt after balance payment
    printReservationDetail(r.id);
  } catch (err) {
    console.error('Error processing balance payment:', err);
    window.adminCore.showToast('Erreur lors du paiement du solde', 'error');
  }
};

// ── Vérification paiement Plop Plop ─────────────────────────────────────────
window.verifyReservationPayment = async function(id) {
  const r = allReservations.find(r => r.id === id);
  if (!r) return;

  let refferenceId = r.payment_reference;
  if (!refferenceId) {
    refferenceId = prompt('Entrez la référence Plop Plop pour cette réservation\n(ex: DL12345678-FULL ou DL12345678-DEP) :');
    if (!refferenceId?.trim()) return;
    refferenceId = refferenceId.trim();
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    window.adminCore.showToast('Connexion Supabase non disponible.', 'error');
    return;
  }

  window.adminCore.showToast('Vérification en cours…');

  try {
    const { data, error } = await supabase.functions.invoke('plop-payment', {
      body: { action: 'verify', refference_id: refferenceId },
    });

    if (error) throw new Error(error.message || 'Erreur invocation Edge Function.');
    if (!data) throw new Error('Réponse vide de Plop Plop.');

    if (data.trans_status === 'ok') {
      const updates = {
        plop_client_id:     data.id_client     || null,
        plop_transaction_id: data.id_transaction || null,
        payment_status:     'fully_paid',
      };

      const { error: dbErr } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id);

      if (dbErr) throw new Error('Erreur mise à jour DB: ' + dbErr.message);

      const idx = allReservations.findIndex(r => r.id === id);
      if (idx !== -1) Object.assign(allReservations[idx], updates);

      window.adminCore.showToast('Paiement confirmé !', 'success');
      openDetailModal(id);
    } else {
      const method = data.method || r.payment_method || '';
      const tid    = data.id_transaction || '—';
      window.adminCore.showToast(
        `Paiement non confirmé (statut: ${data.trans_status || 'no'}) · ID trans: ${tid}`,
        'error'
      );
    }
  } catch (err) {
    console.error('[verifyReservationPayment]', err);
    window.adminCore.showToast('Erreur: ' + err.message, 'error');
  }
};

// ============================================
// AUTOMATIC BREVO ACTIONS
// ============================================

window.autoConfirmReservation = async function(id) {
  const reservation = allReservations.find(r => r.id === id);
  if (!reservation) return;

  if (!confirm(`Voulez-vous confirmer cette réservation et envoyer un email automatique au client?`)) return;

  try {
    // Update status first
    await window.adminCore.updateReservationStatus(id, 'CONFIRMED');
    
    // Send confirmation email via Brevo
    await sendBrevoEmail(reservation, 'confirmation');
    
    window.adminCore.showToast('Réservation confirmée et email envoyé !');
    
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

Nous avons le plaisir de vous confirmer votre réservation chez DALIGHT Spa :

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

Petit rappel amical : vous avez rendez-vous chez DALIGHT Spa demain !

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

Merci d'avoir choisi DALIGHT Spa pour votre ${service} ! Nous espérons que vous avez apprécié ce moment de détente et de bien-être.

💰 Paiement
${paymentChoiceText}

Votre avis compte énormément pour nous. N'hésitez pas à nous laisser un commentaire sur nos réseaux sociaux :
• Instagram : @dalightbeauty
• TikTok    : @dalightbeauty

Nous serions ravis de vous revoir très bientôt pour un nouveau rituel.

À bientôt,
L'équipe DALIGHT
📞 ${phone}`
    },
    custom: {
      subject: `DALIGHT Spa - ${service}`,
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
    window.adminCore.showToast(`Réservation ${status === 'CONFIRMED' ? 'confirmée' : status === 'COMPLETED' ? 'terminée' : 'annulée'} !`);
    
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
  const blob = new Blob([csv], { type: 'text/csv' });
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
async function loadServiceCategories() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: services, error } = await supabase
      .from('services')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    // Get distinct categories
    const categories = [...new Set(services?.map(s => s.category) || [])];
    console.log('Fetched categories:', categories);

    // Populate availability category filter
    const categoryFilter = document.getElementById('availability-category-filter');
    if (categoryFilter) {
      const currentValue = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="all">Toutes les catégories</option>';
      categories.forEach(cat => {
        if (cat) {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
          categoryFilter.appendChild(option);
        }
      });
      // Restore previous selection if possible
      if (categories.includes(currentValue) || currentValue === 'all') {
        categoryFilter.value = currentValue;
      }
    }

    // Populate modal service type dropdown
    const serviceTypeSelect = document.getElementById('capacity-service-type');
    if (serviceTypeSelect) {
      const currentValue = serviceTypeSelect.value;
      serviceTypeSelect.innerHTML = '<option value="all">Tous les services (bloquer la salle entière)</option>';
      categories.forEach(cat => {
        if (cat) {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1) + ' uniquement';
          serviceTypeSelect.appendChild(option);
        }
      });
      // Restore previous selection if possible
      if (categories.includes(currentValue) || currentValue === 'all') {
        serviceTypeSelect.value = currentValue;
      }
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
  // Check all possible sources
  if (window.adminCore?.supabase) {
    console.log('✅ Found supabase in window.adminCore');
    return window.adminCore.supabase;
  }
  if (window.dalightAdminSupabase) {
    console.log('✅ Found supabase in window.dalightAdminSupabase');
    return window.dalightAdminSupabase;
  }
  if (window.supabaseClient) {
    console.log('✅ Found supabase in window.supabaseClient');
    return window.supabaseClient;
  }
  // Try global supabase object directly
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    console.log('⚠️ Creating new supabase client');
    const SUPABASE_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
    return supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    exceptionsQuery = exceptionsQuery.eq('service_type', categoryFilter);
  }

  const [exceptionsRes, bookingsRes] = await Promise.all([
    exceptionsQuery,
    supabase.from('reservations').select('date, time, status, service_id')
      .gte('date', startDate).lte('date', endDate)
      .not('status', 'eq', 'cancelled')
  ]);

  const exceptions = exceptionsRes.data || [];
  const bookings   = bookingsRes.data || [];
  const results    = [];

  // Filter bookings by category if category filter is set
  let filteredBookings = bookings;
  if (categoryFilter !== 'all') {
    // Get service IDs for the selected category
    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('category', categoryFilter);
    
    const serviceIds = services?.map(s => s.id) || [];
    filteredBookings = bookings.filter(b => serviceIds.includes(b.service_id));
  }

  for (const exc of exceptions) {
    if (!exc.time_slot) continue; // skip jou antye
    const dateStr = exc.exception_date;
    const timeStr = exc.time_slot.substring(0, 5);
    const booked  = filteredBookings.filter(b =>
      b.date === dateStr && b.time?.substring(0,5) === timeStr
    ).length;
    const capacity  = exc.max_capacity ?? 1;
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
  return results;
}

function renderAvailabilityCalendar(data) {
  const tbody = document.getElementById('availability-body');
  if (!tbody) return;

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
        const slots   = byDate[date]?.[time] || [];
        const primary = slots.find(s => (s.service_type === 'all' || !s.service_type) && s.is_blocked)
                     || slots.find(s => s.service_type === 'all' || !s.service_type)
                     || slots[0] || null;
        const hasPartialBlock = slots.some(s => s.is_blocked) &&
          !slots.some(s => s.is_blocked && (s.service_type === 'all' || !s.service_type));
        const status = getSlotStatus(primary, slots);
        const label  = !primary ? '✓'
          : (primary.is_blocked && (primary.service_type === 'all' || !primary.service_type)) ? '🔒'
          : hasPartialBlock ? '⚡'
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

function getSlotStatus(slot, allSlots) {
  // Pa konfigire encore — disponib pa default (vèt)
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
    // Use active class for proper CSS display
    modal.classList.add('active');
    modal.style.display = 'flex';
    // Clear all fields
    document.getElementById('block-date-input').value = '';
    document.getElementById('block-time-from').value = '';
    document.getElementById('block-time-to').value = '';
    document.getElementById('block-reason-input').value = '';
    // Hide preview and reservations
    document.getElementById('selected-hours-preview').style.display = 'none';
    document.getElementById('existing-reservations-section').style.display = 'none';
    document.getElementById('no-reservations-msg').style.display = 'none';
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
  // Clear all sections
  document.getElementById('existing-reservations-section').style.display = 'none';
  document.getElementById('no-reservations-msg').style.display = 'none';
  document.getElementById('selected-hours-preview').style.display = 'none';
  // Reset service type selector
  const svcTypeEl = document.getElementById('block-service-type');
  if (svcTypeEl) svcTypeEl.value = 'all';
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
  
  // If "from" is selected and "to" is empty or before "from", set "to" to next hour
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
  
  // Generate list of hours to block
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
  
  // Display hours
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
    // Block whole day - return special marker
    return ['ALL_DAY'];
  }
  
  if (!from || !to) {
    // Single hour
    return [from || to];
  }
  
  // Range of hours
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

  // Show loading
  listContainer.innerHTML = '<p style="text-align: center; color: var(--admin-text-muted);">Chargement...</p>';
  section.style.display = 'block';
  noMsg.style.display = 'none';

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      listContainer.innerHTML = '<p style="color: #ef4444;">Erreur: Supabase non connecté. Rafraîchissez la page.</p>';
      return;
    }

    // Load reservations for this date
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, user_name, service, time, status, location')
      .eq('date', date)
      .not('status', 'eq', 'CANCELLED')
      .order('time', { ascending: true });

    if (error) throw error;

    if (!reservations || reservations.length === 0) {
      section.style.display = 'none';
      noMsg.style.display = 'block';
      return;
    }

    // Display reservations
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
  
  // Set as single hour (from and to are the same)
  document.getElementById('block-time-from').value = time;
  const nextHour = (parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0') + ':00';
  document.getElementById('block-time-to').value = nextHour;
  
  // Update preview
  updateHoursPreview();
  
  // Auto-fill reason with client info
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
  const serviceType = document.getElementById('block-service-type')?.value || 'all';
  const hoursToBlock = getHoursToBlock();
  
  console.log('📅 Date:', date, '🕐 Hours:', hoursToBlock, '🏷️ Service:', serviceType);
  
  if (!date) {
    window.adminCore?.showToast('Veuillez sélectionner une date', 'error');
    return;
  }
  
  const btn = document.querySelector('#block-date-modal .btn-danger');
  const originalText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = hoursToBlock.length > 1
      ? `Bloquer ${hoursToBlock.length} heures...`
      : 'Traitement...';
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

    const blockedHours = [];
    const errors = [];

    for (const hour of hoursToBlock) {
      console.log('📤 Blocking:', hour, 'service:', serviceType);
      try {
        // Try new admin_block_slot first (supports service_type), fallback to admin_block_date
        let data, error;
        const slotResult = await supabase.rpc('admin_block_slot', {
          p_date: date,
          p_time_slot: hour === 'ALL_DAY' ? null : hour,
          p_service_type: serviceType,
          p_is_blocked: true,
          p_reason: reason || 'Bloqué par admin'
        });
        data = slotResult.data;
        error = slotResult.error;

        // Fallback: if function doesn't exist yet, use old admin_block_date
        if (error && error.message?.includes('does not exist')) {
          const fallback = await supabase.rpc('admin_block_date', {
            p_date: date,
            p_time_slot: hour === 'ALL_DAY' ? null : hour,
            p_reason: reason || 'Bloqué par admin',
            p_is_blocked: true
          });
          data = fallback.data;
          error = fallback.error;
        }

        if (error) {
          errors.push(`${hour}: ${error.message}`);
        } else if (data?.success) {
          blockedHours.push(hour === 'ALL_DAY' ? 'Toute la journée' : hour);
        }
      } catch (err) {
        errors.push(`${hour}: ${err.message}`);
      }
    }
    
    console.log('📊 Results:', { blocked: blockedHours.length, errors: errors.length });
    
    if (blockedHours.length > 0) {
      const svcLabel = serviceType === 'all' ? '' : ` (${serviceType})`;
      const message = blockedHours.length === 1
        ? `Créneau bloqué${svcLabel}: ${blockedHours[0]}`
        : `${blockedHours.length} créneaux bloqués${svcLabel}: ${blockedHours.join(', ')}`;
      window.adminCore?.showToast(message);
      closeBlockDateModal();
      loadAvailability();
    } else if (errors.length > 0) {
      window.adminCore?.showToast('Erreur: ' + errors[0], 'error');
    }
    
  } catch (err) {
    console.error('❌ Error blocking date:', err);
    window.adminCore?.showToast('Erreur: ' + err.message, 'error');
    alert('Erreur: ' + err.message + '\n\nVérifiez que vous avez exécuté dateheure.sql dans Supabase');
  } finally {
    // Restore button state
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

  // Titre modal
  const titleEl = document.getElementById('capacity-modal-title');
  if (titleEl) titleEl.textContent = isExisting ? 'Modifier créneau' : 'Ajouter créneau';

  // Champs
  document.getElementById('capacity-time-display').value = `${date} à ${time}`;
  document.getElementById('capacity-input').value = slotData?.max_capacity || 1;
  document.getElementById('capacity-available').checked = isBlocked ? false : (slotData?.is_available ?? true);
  const svcTypeEl = document.getElementById('capacity-service-type');
  
  // Pre-select the category filter value if no slot data exists, otherwise use slot's service_type
  const categoryFilter = document.getElementById('availability-category-filter')?.value || 'all';
  const serviceType = slotData?.service_type || categoryFilter;
  if (svcTypeEl) svcTypeEl.value = serviceType;

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

  // Bouton débloquer — visible sèlman si kreno egziste nan DB
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

    // Essai 1: avec service_type
    const delSvcType = document.getElementById('capacity-service-type')?.value || 'all';
    let { error } = await supabase
      .from('availability_exceptions')
      .delete()
      .eq('exception_date', selectedSlot.date)
      .eq('time_slot', selectedSlot.time + ':00')
      .eq('service_type', delSvcType);

    if (error) {
      // Essai 2: sans service_type
      const { error: e2 } = await supabase
        .from('availability_exceptions')
        .delete()
        .eq('exception_date', selectedSlot.date)
        .eq('time_slot', selectedSlot.time + ':00');
      if (e2) throw e2;
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
  const serviceType = document.getElementById('capacity-service-type')?.value || 'all';

  console.log('💾 Saving capacity:', { date: selectedSlot.date, time: selectedSlot.time, capacity, isAvailable, serviceType });

  try {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Connexion Supabase non établie. Rafraîchissez la page.');

    // Ekri nan availability_exceptions (dat espesifik), pa availability_rules (rekiran)
    const { error } = await supabase
      .from('availability_exceptions')
      .upsert({
        exception_date: selectedSlot.date,
        time_slot:      selectedSlot.time + ':00',
        is_blocked:     !isAvailable,
        max_capacity:   isAvailable ? capacity : null,
        service_type:   serviceType
      }, { onConflict: 'exception_date,time_slot,service_type' });

    if (error) {
      console.error('❌ Error saving capacity:', error);
    } else {
      console.log('✅ Capacity saved successfully');
    }

    if (error) {
      // Si constraint pa egziste ak service_type, essaie san li
      const { error: e2 } = await supabase
        .from('availability_exceptions')
        .upsert({
          exception_date: selectedSlot.date,
          time_slot:      selectedSlot.time + ':00',
          is_blocked:     !isAvailable,
          max_capacity:   isAvailable ? capacity : null
        }, { onConflict: 'exception_date,time_slot' });
      if (e2) throw e2;
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
