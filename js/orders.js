import { formatDate, formatTime, getSupabase } from './main.js';

// Wait for Supabase to be initialized
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

const STATUS_FR = {
  PENDING:   { label: 'En attente', css: 'pending' },
  CONFIRMED: { label: 'Confirmé',   css: 'confirmed' },
  COMPLETED: { label: 'Terminé',    css: 'completed' },
  CANCELLED: { label: 'Annulé',     css: 'cancelled' },
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

function renderCards(reservations = []) {
  if (!ordersList) return;

  ordersList.innerHTML = reservations
    .map((r) => {
      const st = STATUS_FR[r.status] || STATUS_FR.PENDING;
      const locationLabel = r.location === 'Spa' ? 'Au Spa — Delmas 65' : r.location;
      const notesBlock = r.notes
        ? `<div class="rc-notes">${escapeHtml(r.notes)}</div>`
        : '';

      return `
        <article class="reservation-card">
          <div>
            <div class="rc-service">${escapeHtml(r.service)}</div>
            <div class="rc-meta">
              <span><i data-lucide="calendar" style="width:14px;height:14px;"></i> ${formatDate(r.date)}</span>
              <span><i data-lucide="clock" style="width:14px;height:14px;"></i> ${formatTime(r.time)}</span>
              <span><i data-lucide="map-pin" style="width:14px;height:14px;"></i> ${escapeHtml(locationLabel)}</span>
            </div>
          </div>
          <span class="rc-status ${st.css}">${st.label}</span>
          ${notesBlock}
        </article>
      `;
    })
    .join('');

  // Re-init Lucide icons for the newly injected elements
  if (window.lucide) window.lucide.createIcons();
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
  if (ordersCountEl) {
    ordersCountEl.textContent = reservations.length.toString();
  }

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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = './login.html';
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

    // Show/hide filter bar + assistant note
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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations' },
      () => {
        loadReservations();
      }
    )
    .subscribe();

  window.addEventListener('beforeunload', () => {
    supabase.removeChannel(channel);
  });
}

function applyFilter() {
  const filtered = activeFilter === 'ALL'
    ? allReservations
    : allReservations.filter((r) => r.status === activeFilter);

  if (filtered.length === 0 && allReservations.length > 0) {
    ordersList.innerHTML = '<p style="text-align:center;color:#9a8f86;padding:2rem;">Aucune réservation avec ce statut.</p>';
    ordersList.hidden = false;
  } else {
    renderCards(filtered);
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
  loadReservations();
  subscribeToUpdates();
}

// Export for chat widget
window.ChatWidget = {
  open: () => {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) chatBubble.click();
  }
};

initOrdersPage();
