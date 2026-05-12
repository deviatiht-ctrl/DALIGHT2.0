// ============================================
// DALIGHT HEAD SPA - DASHBOARD
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for admin core to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const session = await window.adminCore?.checkAdminAuth();
  if (!session) return;
  
  loadDashboardStats();
  loadRecentReservations();
  initCharts();
});

// ============================================
// STATS
// ============================================

async function loadDashboardStats() {
  const { fetchReservations, fetchClients, getSupabaseClient } = window.adminCore;
  
  try {
    const supabase = getSupabaseClient();
    
    // Fetch all reservations
    const reservations = await fetchReservations();
    const clients = await fetchClients();
    
    // Total reservations
    document.getElementById('total-reservations').textContent = reservations.length;
    
    // Pending reservations
    const pending = reservations.filter(r => r.status === 'PENDING');
    document.getElementById('pending-reservations').textContent = pending.length;
    
    // Total clients
    document.getElementById('total-clients').textContent = clients.length;
    
    // Calculate revenue (this month) from confirmed/completed reservations
    const now = new Date();
    const thisMonth = reservations.filter(r => {
      const date = new Date(r.created_at);
      return date.getMonth() === now.getMonth() && 
             date.getFullYear() === now.getFullYear() &&
             (r.status === 'COMPLETED' || r.status === 'CONFIRMED');
    });
    
    const revenue = thisMonth.reduce((sum, r) => sum + (parseFloat(r.total_amount_usd) || 0), 0);
    document.getElementById('total-revenue').textContent = `$${revenue.toFixed(0)}`;
    
    // Calculate revenue change vs last month
    const lastMonth = reservations.filter(r => {
      const date = new Date(r.created_at);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
      return date.getMonth() === lastMonthDate.getMonth() && 
             date.getFullYear() === lastMonthDate.getFullYear() &&
             (r.status === 'COMPLETED' || r.status === 'CONFIRMED');
    });
    
    const lastMonthRevenue = lastMonth.reduce((sum, r) => sum + (parseFloat(r.total_amount_usd) || 0), 0);
    const revenueChange = lastMonthRevenue > 0 
      ? ((revenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(0)
      : 0;
    
    const revenueChangeEl = document.getElementById('revenue-change');
    if (revenueChangeEl) {
      const isPositive = revenueChange >= 0;
      revenueChangeEl.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
      revenueChangeEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" d="${isPositive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}"/>
        </svg>
        ${isPositive ? '+' : ''}${revenueChange}% vs dernier mois
      `;
    }
    
    // Visitors tracking (unique sessions this month)
    const { count: visitorCount } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
      .lte('created_at', new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString());
    
    document.getElementById('total-visitors').textContent = visitorCount || 0;
    
    // Visitors change vs last month
    const { count: lastMonthVisitorCount } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString())
      .lte('created_at', new Date(now.getFullYear(), now.getMonth(), 0).toISOString());
    
    const visitorChange = lastMonthVisitorCount > 0 
      ? ((visitorCount - lastMonthVisitorCount) / lastMonthVisitorCount * 100).toFixed(0)
      : 0;
    
    const visitorChangeEl = document.getElementById('visitors-change');
    if (visitorChangeEl) {
      const isPositive = visitorChange >= 0;
      visitorChangeEl.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
      visitorChangeEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" d="${isPositive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}"/>
        </svg>
        ${isPositive ? '+' : ''}${visitorChange}% vs dernier mois
      `;
    }
    
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ============================================
// RECENT RESERVATIONS TABLE
// ============================================

async function loadRecentReservations() {
  const { fetchReservations, formatDate, formatTime, getStatusBadge, getInitials } = window.adminCore;
  const tbody = document.getElementById('recent-reservations');
  
  try {
    const reservations = await fetchReservations({ limit: 10 });
    
    if (reservations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted" style="padding: 3rem;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom: 1rem; opacity: 0.5;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p>Aucune réservation pour le moment</p>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = reservations.map(r => `
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
        <td>${r.service}</td>
        <td>${formatDate(r.date)}</td>
        <td>${formatTime(r.time)}</td>
        <td>${r.location === 'Spa' ? 'Au Spa' : 'À domicile'}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-icon btn-secondary btn-sm" onclick="viewReservation('${r.id}')" title="Voir">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            ${r.status === 'PENDING' ? `
              <button class="btn btn-icon btn-success btn-sm" onclick="confirmReservation('${r.id}')" title="Confirmer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
    
  } catch (err) {
    console.error('Error loading reservations:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger" style="padding: 2rem;">
          Erreur lors du chargement des réservations
        </td>
      </tr>
    `;
  }
}

// ============================================
// RESERVATION ACTIONS
// ============================================

window.viewReservation = function(id) {
  window.location.href = `reservations.html?id=${id}`;
};

window.confirmReservation = async function(id) {
  if (!confirm('Confirmer cette réservation ?')) return;
  
  try {
    await window.adminCore.updateReservationStatus(id, 'CONFIRMED');
    window.adminCore.showToast('Réservation confirmée !');
    loadRecentReservations();
    loadDashboardStats();
    window.adminCore.updatePendingBadge();
  } catch (err) {
    window.adminCore.showToast('Erreur lors de la confirmation', 'error');
  }
};

// ============================================
// CHARTS
// ============================================

async function initCharts() {
  const { fetchReservations } = window.adminCore;
  const reservations = await fetchReservations();
  
  // Reservations Chart (Last 7 days)
  const reservationsCtx = document.getElementById('reservationsChart');
  if (reservationsCtx) {
    const last7Days = getLast7Days();
    const reservationsByDay = last7Days.map(day => {
      return reservations.filter(r => r.date === day.date).length;
    });
    
    new Chart(reservationsCtx, {
      type: 'line',
      data: {
        labels: last7Days.map(d => d.label),
        datasets: [{
          label: 'Réservations',
          data: reservationsByDay,
          borderColor: '#d4af37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#d4af37',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              stepSize: 1
            }
          }
        }
      }
    });
  }
  
  // Services Chart (Pie)
  const servicesCtx = document.getElementById('servicesChart');
  if (servicesCtx) {
    const serviceCount = {};
    reservations.forEach(r => {
      const service = r.service || 'Autre';
      serviceCount[service] = (serviceCount[service] || 0) + 1;
    });
    
    const sortedServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    new Chart(servicesCtx, {
      type: 'doughnut',
      data: {
        labels: sortedServices.map(s => truncateText(s[0], 20)),
        datasets: [{
          data: sortedServices.map(s => s[1]),
          backgroundColor: [
            '#d4af37',
            '#4ade80',
            '#60a5fa',
            '#f87171',
            '#a78bfa'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              padding: 15,
              usePointStyle: true
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

function getLast7Days() {
  const days = [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split('T')[0],
      label: dayNames[date.getDay()]
    });
  }
  
  return days;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
