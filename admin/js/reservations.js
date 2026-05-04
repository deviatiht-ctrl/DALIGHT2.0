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
      <td>${r.location === 'Spa' ? '🏠 Au Spa' : '🚗 À domicile'}</td>
      <td>
        <div style="font-size:0.8rem;">
          ${r.payment_method ? ({'moncash':'📱 MonCash','natcash':'📱 NatCash','bank':'🏦 Banque'}[r.payment_method] || r.payment_method) : '<span class="text-muted">—</span>'}
        </div>
        ${r.payment_proof_url ? '<span style="color:#22c55e;font-size:0.75rem;">✓ Preuve</span>' : '<span style="color:#dc3545;font-size:0.75rem;">✕ Pas de preuve</span>'}
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
  const reservation = allReservations.find(r => r.id === id);
  if (!reservation) return;
  
  currentReservation = reservation;
  
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');
  const footer = document.getElementById('modal-footer');

  // Payment method label
  const payMethodLabels = { moncash: '📱 MonCash', natcash: '📱 NatCash', bank: '🏦 Compte Bancaire' };
  const payMethodLabel = payMethodLabels[reservation.payment_method] || reservation.payment_method || 'Non spécifié';

  // Payment proof image
  const proofHtml = reservation.payment_proof_url
    ? `<div>
         <div class="text-muted mb-1">📸 Preuve de paiement</div>
         <div style="background:var(--admin-card);padding:0.75rem;border-radius:8px;text-align:center;">
           <img src="${reservation.payment_proof_url}" alt="Preuve de paiement" 
                style="max-width:100%;max-height:280px;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);" 
                onclick="window.open('${reservation.payment_proof_url}','_blank')">
           <div style="margin-top:0.5rem;">
             <a href="${reservation.payment_proof_url}" target="_blank" class="btn btn-secondary btn-sm" style="font-size:0.75rem;">🔍 Voir en grand</a>
           </div>
         </div>
       </div>`
    : `<div>
         <div class="text-muted mb-1">📸 Preuve de paiement</div>
         <div style="background:rgba(220,53,69,0.1);padding:0.75rem;border-radius:8px;color:#dc3545;font-size:0.85rem;">
           ⚠️ Aucune preuve de paiement uploadée
         </div>
       </div>`;
  
  content.innerHTML = `
    <div style="display: grid; gap: 1rem;">
      <div class="d-flex justify-between align-center">
        <span class="text-muted">Statut</span>
        ${getStatusBadge(reservation.status)}
      </div>
      
      <hr style="border: none; border-top: 1px solid var(--admin-border);">
      
      <div>
        <div class="text-muted mb-1">Client</div>
        <div style="font-weight: 500;">${reservation.user_name || 'Non renseigné'}</div>
        <div class="text-muted">${reservation.user_email}</div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <div class="text-muted mb-1">Date</div>
          <div style="font-weight: 500;">${formatDate(reservation.date)}</div>
        </div>
        <div>
          <div class="text-muted mb-1">Heure</div>
          <div style="font-weight: 500;">${formatTime(reservation.time)}</div>
        </div>
      </div>
      
      <div>
        <div class="text-muted mb-1">Service</div>
        <div style="font-weight: 500;">${reservation.service}</div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <div class="text-muted mb-1">Lieu</div>
          <div style="font-weight: 500;">${reservation.location === 'Spa' ? '🏠 DALIGHT — Delmas 65' : '🚗 Service à domicile'}</div>
        </div>
        <div>
          <div class="text-muted mb-1">💳 Méthode de paiement</div>
          <div style="font-weight: 500;">${payMethodLabel}</div>
        </div>
      </div>
      
      ${reservation.id_type ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <div class="text-muted mb-1">Type d'ID</div>
            <div style="font-weight: 500;">${reservation.id_type}</div>
          </div>
          <div>
            <div class="text-muted mb-1">Numéro d'ID</div>
            <div style="font-weight: 500;">${reservation.id_number}</div>
          </div>
        </div>
      ` : ''}

      ${proofHtml}
      
      ${reservation.notes ? `
        <div>
          <div class="text-muted mb-1">Notes</div>
          <div style="background: var(--admin-card); padding: 1rem; border-radius: 8px;">${reservation.notes}</div>
        </div>
      ` : ''}
      
      <div class="text-muted" style="font-size: 0.8rem;">
        Créé le ${formatDate(reservation.created_at)}
      </div>
    </div>
  `;
  
  // Footer: email buttons + action buttons
  const emailButtonsHtml = `
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;width:100%;margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:0.78rem;color:rgba(255,255,255,0.45);width:100%;margin-bottom:0.25rem;">📧 Envoyer un email manuel</span>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${reservation.id}','confirmation')">✓ Confirmation</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${reservation.id}','cancellation')">✕ Annulation</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${reservation.id}','reminder')">⏰ Rappel</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${reservation.id}','completion')">🎉 Terminé</button>
      <button class="btn btn-secondary btn-sm" onclick="sendEmailTemplate('${reservation.id}','custom')">✏️ Vide</button>
    </div>
  `;

  let actions = `<button class="btn btn-secondary" onclick="closeModal()">Fermer</button>`;

  if (reservation.status === 'PENDING') {
    actions = `
      <button class="btn btn-danger" onclick="updateStatus('${reservation.id}', 'CANCELLED'); closeModal();">Annuler</button>
      <button class="btn btn-primary" onclick="updateStatus('${reservation.id}', 'CONFIRMED'); closeModal();">✓ Confirmer la réservation</button>
    `;
  } else if (reservation.status === 'CONFIRMED') {
    actions = `
      <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
      <button class="btn btn-primary" onclick="updateStatus('${reservation.id}', 'COMPLETED'); closeModal();">Marquer terminé</button>
    `;
  }

  footer.innerHTML = emailButtonsHtml + '<div style="display:flex;gap:0.5rem;justify-content:flex-end;width:100%;">' + actions + '</div>';
  footer.style.flexDirection = 'column';
  footer.style.alignItems = 'stretch';
  modal.classList.add('active');
};

window.closeModal = function() {
  const modal = document.getElementById('detail-modal');
  modal.classList.remove('active');
  currentReservation = null;
};

// ============================================
// MANUAL EMAIL TEMPLATES (mailto:)
// ============================================
window.sendEmailTemplate = function(reservationId, templateKey) {
  const r = allReservations.find(x => x.id === reservationId) || currentReservation;
  if (!r) return alert('Réservation introuvable');
  if (!r.user_email) return alert('Ce client n\'a pas d\'email enregistré.');

  const name     = r.user_name     || 'Cher(e) client(e)';
  const service  = r.service       || 'notre service';
  const date     = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '';
  const time     = r.time          || '';
  const location = r.location      || 'notre spa';
  const phone    = '+509 4747-7221';

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
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      
      const activeTab = document.getElementById(`tab-${tabName}`);
      if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
        
        // Load availability data if that tab
        if (tabName === 'availability') {
          loadAvailability();
        }
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
  // Wait for Supabase to be available
  let retries = 0;
  let supabase = getSupabaseClient();
  
  while (!supabase && retries < 20) {
    console.log('⏳ Waiting for Supabase... attempt', retries + 1);
    await new Promise(resolve => setTimeout(resolve, 300));
    supabase = getSupabaseClient();
    retries++;
  }
  
  console.log('🔍 Final supabase check:', supabase ? 'FOUND' : 'NULL');
  if (!supabase) {
    console.error('❌ Supabase not initialized after waiting');
    const tbody = document.getElementById('availability-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem; color: #ef4444;">
        ⚠️ Erreur: Connexion Supabase non établie.<br>
        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">Rafraîchir la page</button>
      </td></tr>`;
    }
    return;
  }
  
  console.log('✅ Supabase connected, loading availability...');
  
  // Update month display
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  document.getElementById('current-month-display').textContent = 
    `${monthNames[currentAvailabilityMonth.getMonth()]} ${currentAvailabilityMonth.getFullYear()}`;
  
  try {
    const year = currentAvailabilityMonth.getFullYear();
    const month = currentAvailabilityMonth.getMonth() + 1;
    
    // Call the RPC function
    const { data, error } = await supabase
      .rpc('get_month_availability', { 
        p_year: year, 
        p_month: month 
      });
    
    if (error) throw error;
    
    renderAvailabilityCalendar(data || []);
  } catch (err) {
    console.error('Error loading availability:', err);
    window.adminCore?.showToast('Erreur lors du chargement du calendrier', 'error');
  }
}

function renderAvailabilityCalendar(data) {
  const tbody = document.getElementById('availability-body');
  if (!tbody) return;
  
  // Group by date
  const byDate = {};
  data.forEach(slot => {
    if (!byDate[slot.available_date]) {
      byDate[slot.available_date] = {};
    }
    // Support both slot_time (new) and time_slot (old) column names
    const timeKey = slot.slot_time || slot.time_slot;
    const timeStr = timeKey ? String(timeKey).substring(0, 5) : null;
    if (timeStr) byDate[slot.available_date][timeStr] = slot;
  });
  
  // Sort dates
  const dates = Object.keys(byDate).sort();
  
  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  
  tbody.innerHTML = dates.map(date => {
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dayNum = dateObj.getDate();
    
    return `
      <tr>
        <td style="font-weight: 600; white-space: nowrap;">
          ${dayName} ${dayNum}
        </td>
        ${timeSlots.map(time => {
          const slot = byDate[date]?.[time];
          const status = getSlotStatus(slot);
          return `
            <td style="padding: 0;">
              <button 
                class="availability-cell ${status.class}"
                onclick="openSlotModal('${date}', '${time}', ${slot ? JSON.stringify(slot).replace(/"/g, '&quot;') : 'null'})"
                style="
                  width: 100%;
                  padding: 0.5rem;
                  border: none;
                  background: ${status.color};
                  color: ${status.textColor};
                  cursor: pointer;
                  font-size: 0.75rem;
                  ${slot?.is_exception ? 'border: 2px solid #dc2626;' : ''}
                "
                title="${status.tooltip}"
              >
                ${slot?.remaining_slots ?? '-'}
              </button>
            </td>
          `;
        }).join('')}
      </tr>
    `;
  }).join('');
}

function getSlotStatus(slot) {
  if (!slot || !slot.is_available) {
    return { 
      class: 'blocked', 
      color: '#6b7280', 
      textColor: 'white',
      tooltip: 'Bloqué / Non disponible'
    };
  }
  
  const remaining = slot.remaining_slots;
  const capacity = slot.max_capacity;
  
  if (remaining <= 0) {
    return { 
      class: 'full', 
      color: '#ef4444', 
      textColor: 'white',
      tooltip: `Complet (${slot.current_bookings}/${capacity})`
    };
  }
  
  if (remaining <= Math.ceil(capacity * 0.3)) {
    return { 
      class: 'limited', 
      color: '#f59e0b', 
      textColor: 'white',
      tooltip: `Presque plein - ${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`
    };
  }
  
  return { 
    class: 'available', 
    color: '#10b981', 
    textColor: 'white',
    tooltip: `${remaining} places disponibles`
  };
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

function openSlotModal(date, time, slotData) {
  console.log('🔴 openSlotModal called:', date, time, slotData);
  selectedSlot = { date, time, ...slotData };
  
  document.getElementById('capacity-time-display').value = `${date} à ${time}`;
  document.getElementById('capacity-input').value = slotData?.max_capacity || 1;
  document.getElementById('capacity-available').checked = slotData?.is_available ?? true;
  
  const modal = document.getElementById('capacity-modal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    console.log('✅ Capacity modal opened');
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
  
  const capacity = parseInt(document.getElementById('capacity-input').value);
  const isAvailable = document.getElementById('capacity-available').checked;
  
  try {
    const supabase = window.adminCore?.supabase;
    if (!supabase) throw new Error('Supabase not initialized');
    
    // Get day of week from date
    const dateObj = new Date(selectedSlot.date);
    const dayOfWeek = dateObj.getDay();
    
    const { data, error } = await supabase
      .rpc('admin_set_availability', {
        p_day_of_week: dayOfWeek,
        p_time_slot: selectedSlot.time + ':00',
        p_is_available: isAvailable,
        p_max_capacity: capacity
      });
    
    if (error) throw error;
    
    if (data?.success) {
      window.adminCore?.showToast('Capacité mise à jour');
      closeCapacityModal();
      loadAvailability();
    } else {
      window.adminCore?.showToast(data?.error || 'Erreur', 'error');
    }
  } catch (err) {
    console.error('Error saving capacity:', err);
    window.adminCore?.showToast('Erreur: ' + err.message, 'error');
  }
}

function openSetCapacityModal() {
  window.adminCore?.showToast('Sélectionnez un créneau dans le calendrier pour modifier sa capacité');
}
