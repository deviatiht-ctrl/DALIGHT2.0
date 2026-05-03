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

async function loadAvailability() {
  const supabase = window.adminCore?.supabase;
  if (!supabase) {
    console.error('Supabase not initialized');
    return;
  }
  
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
    byDate[slot.available_date][slot.time_slot] = slot;
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
    document.getElementById('block-date-input').value = '';
    document.getElementById('block-time-input').value = '';
    document.getElementById('block-reason-input').value = '';
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
}

async function confirmBlockDate() {
  console.log('🔴 confirmBlockDate called');
  
  const date = document.getElementById('block-date-input').value;
  const time = document.getElementById('block-time-input').value;
  const reason = document.getElementById('block-reason-input').value;
  
  console.log('📅 Date:', date, '🕐 Time:', time, '📝 Reason:', reason);
  
  if (!date) {
    console.error('❌ No date selected');
    window.adminCore?.showToast('Veuillez sélectionner une date', 'error');
    return;
  }
  
  try {
    const supabase = window.adminCore?.supabase;
    console.log('🔌 Supabase:', supabase ? 'OK' : 'NULL');
    
    if (!supabase) {
      throw new Error('Supabase not initialized - refresh page');
    }
    
    console.log('📤 Calling admin_block_date RPC...');
    const { data, error } = await supabase
      .rpc('admin_block_date', {
        p_date: date,
        p_time_slot: time || null,
        p_reason: reason || 'Bloque par admin',
        p_is_blocked: true
      });
    
    console.log('📥 Response:', { data, error });
    
    if (error) throw error;
    
    if (data?.success) {
      window.adminCore?.showToast(data.action === 'bloke' ? 'Date bloquée avec succès' : 'Modification effectuée');
      closeBlockDateModal();
      loadAvailability();
    } else {
      window.adminCore?.showToast(data?.error || 'Erreur', 'error');
    }
  } catch (err) {
    console.error('❌ Error blocking date:', err);
    window.adminCore?.showToast('Erreur: ' + err.message, 'error');
    alert('Erreur: ' + err.message + '\n\nVérifiez que vous avez exécuté dateheure.sql dans Supabase');
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
