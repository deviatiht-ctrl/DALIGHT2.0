/* ============================================================
   DALIGHT — POS (Point of Sale)
   ============================================================ */

const DALIGHT_INFO = {
  name:      'DALIGHT',
  tagline:   "L'Art du Bien-Être",
  address:   'Delmas 65, Faustin Premier Durandise #10, Port-au-Prince',
  phone:     '+509 47 47 72 21',
  email:     'dalightbeauty15mai@gmail.com',
  instagram: '@dalightbeauty',
  facebook:  '@dalightbeauty',
  tiktok:    '@dalightbeauty',
  whatsapp:  '+509 47 47 72 21',
  logo:      '../assets/images/logodaligth.png?v=2',
  qr:        '../assets/images/qr.png',
};

const DEPOSIT_RATE = 0.5;     // 50 % pour les massages
const HEADSPA_DEPOSIT = 1000; // HTG fixe par service tête

const ALL_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00',
];

let sb = null;
let allServices = [];
let allProducts = [];
let allFormations = [];
let orderItems  = [];
let selectedPM  = 'cash';
let payChoice   = 'full';
let receiptData = null;
let currentType = 'services';

/* ── Supabase init ───────────────────────────────────────── */
async function initSupabase() {
  let tries = 0;
  while (!window.dalightAdminSupabase && !window.adminCore?.supabase && tries < 50) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }
  sb = window.dalightAdminSupabase || window.adminCore?.supabase;
  if (!sb) {
    console.error('POS: Supabase client non disponible');
    return;
  }

  // Force reinitialize if wrong URL
  const correctUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co';
  if (sb.supabaseUrl !== correctUrl) {
    console.warn('POS: Wrong Supabase URL detected, reinitializing:', sb.supabaseUrl);
    const { createClient } = supabase;
    sb = createClient(correctUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U');
    window.dalightAdminSupabase = sb;
  }

  console.log('POS: Supabase client initialisé, URL:', sb.supabaseUrl);
}

/* ── Helpers ─────────────────────────────────────────────── */
const fmtHTG = n => Number(n).toLocaleString('fr-HT') + ' HTG';
const fmtUSD = n => '$' + Number(n).toFixed(2);
const esc    = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function withFee(p) {
  return Math.round(Number(p) * 1.03);
}

function genReceiptNo() {
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `REC-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(Math.random()*9000)+1000}`;
}

function fmtDateTime(d = new Date()) {
  const pad = n => String(n).padStart(2,'0');
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calcDeposit(items) {
  const MASSAGE_CATS = ['massage','wood-therapy','massage-relaxant'];
  let massageTotal = 0, headspaCount = 0;
  items.forEach(it => {
    const cat = (it.category || '').toLowerCase();
    if (MASSAGE_CATS.some(c => cat.includes(c))) {
      massageTotal += it.price_htg * it.qty;
    } else {
      headspaCount += it.qty;
    }
  });
  const base = Math.round(massageTotal * DEPOSIT_RATE) + headspaCount * HEADSPA_DEPOSIT;
  return withFee(base);
}

/* ── Date/Time Slots ───────────────────────────────────────── */
function setMinimumDate() {
  const dateField = document.getElementById('pos-date');
  if (!dateField) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateField.min = today.toISOString().split('T')[0];
}

function renderTimeSlots(bookedTimes = []) {
  const timeSelect = document.getElementById('pos-time');
  if (!timeSelect) return;

  const booked = bookedTimes.map(t => (t || '').slice(0, 5));
  timeSelect.innerHTML = '<option value="">-- Choisir un créneau --</option>';

  ALL_SLOTS.forEach(slot => {
    const isBooked = booked.includes(slot);
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = isBooked ? `${slot} — Indisponible` : slot;
    opt.disabled = isBooked;
    if (isBooked) opt.style.color = '#aaa';
    timeSelect.appendChild(opt);
  });
}

async function loadBookedSlots(date) {
  const timeSelect = document.getElementById('pos-time');
  if (!timeSelect) return;

  timeSelect.innerHTML = '<option value="">Chargement...</option>';
  timeSelect.disabled = true;

  try {
    const { data, error } = await sb
      .from('reservations')
      .select('time')
      .eq('date', date)
      .not('status', 'eq', 'CANCELLED');

    if (error) throw error;
    const bookedTimes = (data || []).map(r => r.time);
    renderTimeSlots(bookedTimes);
  } catch (e) {
    console.warn('POS: Could not load booked slots:', e.message);
    renderTimeSlots([]);
  } finally {
    timeSelect.disabled = false;
  }
}

function initDateListeners() {
  const dateField = document.getElementById('pos-date');
  if (!dateField) return;
  dateField.addEventListener('change', async () => {
    if (!dateField.value) return;
    await loadBookedSlots(dateField.value);
  });
}

/* ── Load All Items ───────────────────────────────────────── */
async function loadAllItems() {
  const grid = document.getElementById('svc-grid');

  try {
    // Load services
    const { data: svcData, error: svcErr } = await sb.from('services').select('*').eq('is_active', true).order('category').order('name');
    if (svcErr) throw svcErr;
    allServices = (svcData || []).map(s => ({
      ...s,
      type: 'service',
      price_htg: withFee(s.price_htg || 0),
      price_usd: s.price_usd ? Math.round(Number(s.price_usd) * 1.03 * 100) / 100 : null,
    }));
    console.log('POS: Services chargés:', allServices.length);

    // Load products (optional) — uses `price` column (not price_htg)
    try {
      const { data: prodData, error: prodErr } = await sb.from('products').select('id,name,description,price,sale_price,is_active,image_urls').eq('is_active', true).order('name');
      if (prodErr) throw prodErr;
      allProducts = (prodData || []).map(p => ({
        ...p,
        type: 'product',
        category: 'Produit',
        duration: '',
        price_htg: withFee(Number(p.sale_price || p.price) || 0),
        price_usd: null,
      }));
      console.log('POS: Produits chargés:', allProducts.length);
    } catch (e) {
      console.warn('POS: Products table error (ignoring):', e.message);
      allProducts = [];
    }

    // Load formations (optional) — uses price_inscription, price_blouse, price_cosmetique etc.
    try {
      const { data: formationsData, error: formationsErr } = await sb.from('formations')
        .select('id,name,subtitle,duration,is_active,price_inscription,price_blouse,price_cosmetique,price_corporel,price_decoration,price_massage,order_index')
        .eq('is_active', true).order('order_index');
      if (formationsErr) throw formationsErr;
      allFormations = (formationsData || []).map(f => {
        const fraisInscription = Number(f.price_inscription) || 0;
        const fraisBlouse      = Number(f.price_blouse)      || 0;
        const participation    = Number(f.price_cosmetique || f.price_corporel || f.price_decoration || f.price_massage) || 0;
        const total = fraisInscription + fraisBlouse + participation;
        return {
          ...f,
          type: 'formation',
          category: 'Formation',
          price_htg: total,
          price_usd: null,
          frais_inscription: fraisInscription,
          frais_blouse: fraisBlouse,
          participation: participation,
        };
      });
      console.log('POS: Formations chargées:', allFormations.length);
    } catch (e) {
      console.warn('POS: Formations table error (ignoring):', e.message);
      allFormations = [];
    }

    buildCategoryFilter();
    renderServiceGrid('all', '');
  } catch (e) {
    console.error('POS: Erreur critique chargement:', e);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--admin-danger);">Erreur chargement: ${esc(e.message)}</div>`;
  }
}

function buildCategoryFilter() {
  const bar = document.getElementById('cat-filter');
  let items = [];
  if (currentType === 'services') items = allServices;
  else if (currentType === 'products') items = allProducts;
  else if (currentType === 'formations') items = allFormations;
  else { bar.innerHTML = ''; return; }

  const cats = [...new Set(items.map(s => s.category).filter(Boolean))];
  bar.innerHTML = `<button class="cat-btn active" data-cat="all">Tous</button>` +
    cats.map(c => `<button class="cat-btn" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
}

// Event listeners setup (call once after DOM ready)
function setupEventListeners() {
  console.log('POS: Setting up event listeners');

  // Category filter
  const catFilter = document.getElementById('cat-filter');
  if (catFilter && !catFilter.dataset.posListener) {
    catFilter.dataset.posListener = 'true';
    catFilter.addEventListener('click', e => {
      console.log('POS: Category filter clicked');
      const btn = e.target.closest('.cat-btn');
      if (!btn) return;
      catFilter.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderServiceGrid(btn.dataset.cat, document.getElementById('svc-search').value);
    });
  }

  // Type filter
  const typeFilter = document.getElementById('type-filter');
  if (typeFilter && !typeFilter.dataset.posListener) {
    typeFilter.dataset.posListener = 'true';
    typeFilter.addEventListener('click', e => {
      console.log('POS: Type filter clicked, type:', e.target.closest('.cat-btn')?.dataset.type);
      const btn = e.target.closest('.cat-btn');
      if (!btn) return;
      typeFilter.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      buildCategoryFilter();
      renderServiceGrid('all', document.getElementById('svc-search').value);
    });
  }

  // Search
  const searchInput = document.getElementById('svc-search');
  if (searchInput && !searchInput.dataset.posListener) {
    searchInput.dataset.posListener = 'true';
    searchInput.addEventListener('input', e => {
      console.log('POS: Search input:', e.target.value);
      renderServiceGrid('all', e.target.value);
    });
  }
}

function renderServiceGrid(cat = 'all', search = '') {
  const grid = document.getElementById('svc-grid');

  if (currentType === 'custom') {
    renderCustomGrid();
    return;
  }

  let items = [];
  if (currentType === 'services') items = allServices;
  else if (currentType === 'products') items = allProducts;
  else if (currentType === 'formations') items = allFormations;

  const q = search.toLowerCase();
  const filtered = items.filter(s => {
    const matchCat  = cat === 'all' || (s.category || '') === cat;
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--admin-text-muted);">Aucun ${currentType === 'services' ? 'service' : currentType === 'products' ? 'produit' : 'formation'} trouvé</div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => {
    let priceBlock = '';
    if (s.type === 'formation') {
      priceBlock = `
        <div class="svc-formation-fees">
          ${s.frais_inscription ? `<div class="fee-row"><span>Inscription</span><span>${fmtHTG(s.frais_inscription)}</span></div>` : ''}
          ${s.frais_blouse      ? `<div class="fee-row"><span>Blouse/Docs</span><span>${fmtHTG(s.frais_blouse)}</span></div>` : ''}
          ${s.participation     ? `<div class="fee-row"><span>Participation</span><span>${fmtHTG(s.participation)}</span></div>` : ''}
        </div>
        <div class="svc-price">${s.price_htg ? 'Total : '+fmtHTG(s.price_htg) : '<em style="font-size:.7rem;color:#aaa;">Sur demande</em>'}</div>`;
    } else {
      priceBlock = `<div class="svc-price">${fmtHTG(s.price_htg)}<span class="svc-price-usd">${s.price_usd ? '· '+fmtUSD(s.price_usd) : ''}</span></div>`;
    }
    return `
    <div class="svc-card${s.type === 'formation' ? ' svc-card--formation' : ''}" data-id="${s.id}">
      <div class="svc-cat-tag">${esc(s.category || (currentType === 'services' ? 'Service' : currentType === 'products' ? 'Produit' : 'Formation'))}</div>
      <div class="svc-name">${esc(s.name)}</div>
      <div class="svc-duration">${esc(s.duration || '')}</div>
      ${priceBlock}
    </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons({ el: grid });
  grid.querySelectorAll('.svc-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = items.find(s => String(s.id) === String(card.dataset.id));
      if (item) addToOrder(item);
    });
  });
}

function renderCustomGrid() {
  const grid = document.getElementById('svc-grid');
  grid.innerHTML = `
    <div style="grid-column:1/-1;padding:1.5rem;background:#f8fafc;border-radius:12px;border:1px dashed var(--admin-border);">
      <div style="font-weight:600;margin-bottom:.75rem;">Ajouter un article personnalisé</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
        <input id="custom-name" type="text" placeholder="Nom de l'article" style="flex:1;min-width:150px;padding:.4rem .6rem;border:1px solid var(--admin-border);border-radius:6px;font-size:.85rem;">
        <input id="custom-price" type="number" placeholder="Prix HTG" style="width:110px;padding:.4rem .6rem;border:1px solid var(--admin-border);border-radius:6px;font-size:.85rem;">
      </div>
      <button id="add-custom-btn" class="pm-btn" style="background:var(--admin-accent);color:#fff;border:none;padding:.4rem .8rem;font-size:.82rem;cursor:pointer;">+ Ajouter</button>
    </div>
  `;

  if (window.lucide) lucide.createIcons({ el: grid });

  document.getElementById('add-custom-btn').addEventListener('click', () => {
    const name = document.getElementById('custom-name').value.trim();
    const price = Number(document.getElementById('custom-price').value);
    if (!name || !price || price <= 0) {
      alert('Veuillez entrer un nom et un prix valide.');
      return;
    }
    addToOrder({
      id: `custom-${Date.now()}`,
      name,
      price_htg: withFee(price),
      price_usd: null,
      category: 'Custom',
      duration: '',
      type: 'custom',
    });
    document.getElementById('custom-name').value = '';
    document.getElementById('custom-price').value = '';
  });
}

/* ── Order Logic ─────────────────────────────────────────── */
function addToOrder(svc) {
  const existing = orderItems.find(it => it.id === svc.id);
  if (existing) {
    existing.qty++;
  } else {
    orderItems.push({ ...svc, qty: 1 });
  }
  renderOrder();
}

function removeFromOrder(id) {
  orderItems = orderItems.filter(it => it.id !== id);
  renderOrder();
}

function changeQty(id, delta) {
  const item = orderItems.find(it => it.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderOrder();
}

function renderOrder() {
  const container = document.getElementById('order-items');
  const confirmBtn = document.getElementById('btn-confirm');
  const previewBtn = document.getElementById('btn-preview');

  if (!orderItems.length) {
    container.innerHTML = `<div class="pos-empty"><i data-lucide="sparkles" style="width:2.5rem;height:2.5rem;"></i>Sélectionnez un service pour démarrer</div>`;
    if (window.lucide) lucide.createIcons({ el: container });
    confirmBtn.disabled = true;
    updateTotals();
    return;
  }

  container.innerHTML = orderItems.map(it => `
    <div class="order-item">
      <div class="order-item-info">
        <div class="order-item-name">${esc(it.name)}</div>
        <div class="order-item-price">${fmtHTG(it.price_htg * it.qty)}</div>
      </div>
      <div class="qty-ctrl">
        <button type="button" class="qty-btn" data-action="minus" data-id="${it.id}">−</button>
        <span class="qty-val">${it.qty}</span>
        <button type="button" class="qty-btn" data-action="plus" data-id="${it.id}">+</button>
        <button type="button" class="qty-btn" data-action="remove" data-id="${it.id}" style="color:var(--admin-danger);border-color:rgba(220,38,38,.2);">✕</button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons({ el: container });
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'plus')   changeQty(id,  1);
      if (btn.dataset.action === 'minus')  changeQty(id, -1);
      if (btn.dataset.action === 'remove') removeFromOrder(id);
    });
  });

  confirmBtn.disabled = false;
  updateTotals();
}

function updateTotals() {
  const subtotal = orderItems.reduce((s, it) => s + it.price_htg * it.qty, 0);
  const deposit  = calcDeposit(orderItems);
  const isDeposit = payChoice === 'deposit';

  document.getElementById('tot-subtotal').textContent = fmtHTG(subtotal);
  document.getElementById('tot-total').textContent    = fmtHTG(subtotal);

  const depRow = document.getElementById('tot-deposit-row');
  if (isDeposit && subtotal > 0) {
    depRow.style.display = '';
    document.getElementById('tot-deposit').textContent = fmtHTG(deposit);
  } else {
    depRow.style.display = 'none';
  }
}

/* ── Payment method & choice UI ─────────────────────────── */
document.getElementById('pm-btns').addEventListener('click', e => {
  const btn = e.target.closest('.pm-btn');
  if (!btn) return;
  document.querySelectorAll('.pm-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPM = btn.dataset.pm;
});

document.querySelectorAll('.choice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    payChoice = btn.dataset.choice;
    updateTotals();
  });
});

document.getElementById('clear-order').addEventListener('click', () => {
  if (orderItems.length === 0) return;
  if (confirm('Vider la commande ?')) { orderItems = []; renderOrder(); }
});

document.getElementById('svc-search').addEventListener('input', e => {
  const activeCat = document.querySelector('.cat-btn.active')?.dataset.cat || 'all';
  renderServiceGrid(activeCat, e.target.value);
});

/* ── Receipt Builder ─────────────────────────────────────── */
function buildReceiptHTML(data) {
  const {
    receiptNo, dateTime, clientName, clientPhone, date, time,
    items, subtotal, deposit, amountDue, balance,
    paymentMethod, paymentChoice,
  } = data;

  const pmLabels = { cash: 'Cash', moncash: 'MonCash', natcash: 'NatCash', bank: 'Virement bancaire' };
  const pmLabel = pmLabels[paymentMethod] || paymentMethod;
  const isDeposit = paymentChoice === 'deposit';

  const itemsRows = items.map(it => `
    <tr>
      <td>${esc(it.name)}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;">${fmtHTG(it.price_htg)}</td>
      <td>${fmtHTG(it.price_htg * it.qty)}</td>
    </tr>
  `).join('');

  const paidBox = isDeposit ? `
    <div class="rcpt-paid-box">
      <div class="paid-row"><span class="paid-label">Acompte versé — ${pmLabel}</span><span class="paid-val">${fmtHTG(amountDue)}</span></div>
    </div>
    <div class="rcpt-balance-box">
      <div class="paid-row"><span class="paid-label">Solde restant à payer</span><span class="paid-val">${fmtHTG(balance)}</span></div>
    </div>
  ` : `
    <div class="rcpt-paid-box">
      <div class="paid-row"><span class="paid-label">Paiement complet — ${pmLabel}</span><span class="paid-val">${fmtHTG(amountDue)}</span></div>
    </div>
  `;

  return `
    <div class="rcpt-header">
      <img class="rcpt-logo" src="${DALIGHT_INFO.logo}" alt="DALIGHT" onerror="this.style.display='none'">
      <div class="rcpt-brand">${DALIGHT_INFO.name}</div>
      <div class="rcpt-tagline">${DALIGHT_INFO.tagline}</div>
      <div class="rcpt-info">
        ${DALIGHT_INFO.address}<br>
        ${DALIGHT_INFO.phone} · ${DALIGHT_INFO.email}
      </div>
    </div>

    <hr class="rcpt-divider">

    <div class="rcpt-meta">
      <span>Reçu N°</span><strong>${esc(receiptNo)}</strong>
      <span>Date</span><strong>${esc(dateTime)}</strong>
      ${date ? `<span>Réservation</span><strong>${esc(date)} à ${esc(time || '--:--')}</strong>` : ''}
      ${clientName ? `<span>Client</span><strong>${esc(clientName)}</strong>` : ''}
      ${clientPhone ? `<span>Tél.</span><strong>${esc(clientPhone)}</strong>` : ''}
    </div>

    <hr class="rcpt-divider">

    <div class="rcpt-section-title">Services</div>
    <table class="rcpt-items">
      <thead><tr><th>Service</th><th style="text-align:center;">Qté</th><th style="text-align:right;">Prix unit.</th><th style="text-align:right;">Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="rcpt-totals">
      <div class="rcpt-total-row"><span>Sous-total</span><span>${fmtHTG(subtotal)}</span></div>
      <div class="rcpt-total-row grand"><span>TOTAL</span><span>${fmtHTG(subtotal)}</span></div>
    </div>

    ${paidBox}

    <div class="rcpt-footer">
      <div class="rcpt-thankyou">Merci de votre visite !</div>
      <div class="rcpt-social">
        <span style="display:inline-flex;align-items:center;gap:3px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          ${DALIGHT_INFO.instagram}
        </span>
        &nbsp;·&nbsp;
        <span style="display:inline-flex;align-items:center;gap:3px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          ${DALIGHT_INFO.facebook}
        </span>
        &nbsp;·&nbsp;
        <span style="display:inline-flex;align-items:center;gap:3px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
          ${DALIGHT_INFO.tiktok}
        </span>
      </div>
      <div style="margin-top:.25rem;">WhatsApp / Tel : ${DALIGHT_INFO.whatsapp}</div>
      <div style="margin-top:.5rem;font-size:.68rem;color:#d1d5db;">Ce reçu est votre preuve d'achat. Conservez-le.</div>
      <div class="rcpt-qr">
        <img src="${DALIGHT_INFO.qr}" alt="QR Code" class="rcpt-qr-img" onerror="this.parentElement.style.display='none'">
        <div class="rcpt-qr-label">Scannez-moi</div>
      </div>
    </div>
  `;
}

function buildReceiptData(confirmed = false) {
  const subtotal = orderItems.reduce((s, it) => s + it.price_htg * it.qty, 0);
  const deposit  = calcDeposit(orderItems);
  const isDeposit = payChoice === 'deposit';
  const amountDue = isDeposit ? deposit : subtotal;
  const balance   = isDeposit ? subtotal - deposit : 0;

  return {
    receiptNo:     confirmed ? genReceiptNo() : 'APERÇU',
    dateTime:      fmtDateTime(),
    clientName:    document.getElementById('client-name').value.trim(),
    clientPhone:   document.getElementById('client-phone').value.trim(),
    date:          document.getElementById('pos-date').value || null,
    time:          document.getElementById('pos-time').value || null,
    items:         orderItems,
    subtotal,
    deposit,
    amountDue,
    balance,
    paymentMethod: selectedPM,
    paymentChoice: payChoice,
  };
}

function openReceipt(confirmed = false) {
  receiptData = buildReceiptData(confirmed);
  document.getElementById('receipt-content').innerHTML = buildReceiptHTML(receiptData);
  document.getElementById('receipt-overlay').classList.add('open');
  if (window.lucide) lucide.createIcons();
}

window.closeReceipt = function () {
  document.getElementById('receipt-overlay').classList.remove('open');
};

window.printReceipt = function () {
  const html = buildReceiptHTML({ ...receiptData, receiptNo: receiptData.receiptNo === 'APERÇU' ? genReceiptNo() : receiptData.receiptNo });
  const printArea = document.getElementById('print-area');
  const paperSize = document.getElementById('paper-size').value || '80mm';
  printArea.innerHTML = `<div class="paper-${paperSize}" id="receipt-content" style="margin:0 auto;padding:1.5rem;font-family:Inter,sans-serif;">${html}</div>`;
  window.print();
  printArea.innerHTML = '';
};

window.closePlopOverlay = function () {
  document.getElementById('plop-overlay').classList.remove('open');
};

document.getElementById('btn-preview').addEventListener('click', () => {
  if (!orderItems.length) { alert('Ajoutez au moins un service.'); return; }
  openReceipt(false);
});

document.getElementById('btn-confirm').addEventListener('click', async () => {
  if (!orderItems.length) return;

  const posDate = document.getElementById('pos-date').value;
  const posTime = document.getElementById('pos-time').value;

  // If MonCash/NatCash and has date/time, show Plop overlay first
  if ((selectedPM === 'moncash' || selectedPM === 'natcash') && posDate && posTime) {
    const subtotal = orderItems.reduce((s, it) => s + it.price_htg * it.qty, 0);
    const deposit = calcDeposit(orderItems);
    const amountDue = payChoice === 'deposit' ? deposit : subtotal;

    document.getElementById('plop-amount').textContent = fmtHTG(amountDue);
    document.getElementById('plop-overlay').classList.add('open');

    document.getElementById('btn-plop-pay').onclick = async () => {
      await processPOSSale(posDate, posTime);
    };
  } else {
    // Cash, Bank, or no date/time: direct confirm (no Plop redirect)
    await processPOSSale(posDate, posTime);
  }
});

async function processPOSSale(date, time) {
  openReceipt(true);

  const clientName  = document.getElementById('client-name').value.trim() || 'Client POS';
  const clientPhone = document.getElementById('client-phone').value.trim();
  const subtotal    = orderItems.reduce((s, it) => s + it.price_htg * it.qty, 0);
  const deposit     = calcDeposit(orderItems);
  const isDeposit   = payChoice === 'deposit';
  const amountDue   = isDeposit ? deposit : subtotal;
  const balance     = isDeposit ? (subtotal - amountDue) : 0;

  const { data: { user } } = await sb.auth.getUser();

  // Insert into pos_sales
  await sb.from('pos_sales').insert({
    receipt_no: receiptData.receiptNo,
    client_name: clientName,
    client_phone: clientPhone || null,
    items: orderItems.map(it => ({
      id: it.id,
      name: it.name,
      price_htg: it.price_htg,
      price_usd: it.price_usd,
      qty: it.qty,
      category: it.category,
      type: it.type || 'service',
    })),
    subtotal_htg: subtotal,
    deposit_htg: amountDue,
    amount_due_htg: amountDue,
    balance_htg: balance,
    payment_method: selectedPM,
    payment_choice: payChoice,
    admin_id: user?.id || null,
    admin_email: user?.email || null,
    status: 'completed',
  });

  // If date/time provided, also insert into reservations
  if (date && time) {
    console.log('POS: Creating reservation with date:', date, 'time:', time);
    const reservationNumber = 'DL' + Date.now().toString().slice(-8);
    const paymentReference = `${reservationNumber}-${payChoice === 'full' ? 'FULL' : 'DEP'}`;

    const reservationRecord = {
      reservation_number: reservationNumber,
      user_id: null,
      user_email: null,
      user_name: clientName,
      phone: clientPhone || null,
      service: orderItems.map(s => s.name).join(', '),
      services: orderItems,
      date: date,
      time: time,
      notes: null,
      payment_method: selectedPM,
      payment_proof_url: null,
      deposit_amount: deposit,
      total_amount: subtotal,
      payment_status: selectedPM === 'bank' ? (isDeposit ? 'deposit_paid' : 'fully_paid') : 'pending',
      payment_reference: paymentReference,
      location: 'Spa',
      status: 'PENDING',
    };

    console.log('POS: Reservation record:', reservationRecord);
    const { data: insertData, error: insertError } = await sb.from('reservations').insert([reservationRecord]).select();
    console.log('POS: Insert result - data:', insertData, 'error:', insertError);

    if (!insertError && insertData?.[0]) {
      const savedReservation = insertData[0];

      // If MonCash/NatCash, create Plop payment
      if (selectedPM === 'moncash' || selectedPM === 'natcash') {
        try {
          const { createPlopPayment } = await import('../js/plop-payment.js?v=5.0.0');
          const payment = await createPlopPayment(sb, {
            refference_id: paymentReference,
            montant: amountDue,
            payment_method: selectedPM,
            context_type: 'reservation',
            context_id: savedReservation.id,
          });

          await sb.from('reservations').update({
            plop_transaction_id: payment.transaction_id || null,
          }).eq('id', savedReservation.id);

          // Redirect to Plop Plop
          window.location.href = payment.url;
          return;
        } catch (plopErr) {
          console.error('POS: Plop payment error:', plopErr);
          alert('Erreur création paiement Plop Plop: ' + plopErr.message);
        }
      }
    } else if (insertError) {
      console.warn('POS: Reservation insert failed (non-blocking):', insertError.message);
    }
  }

  // Clear order for non-Plop cases
  orderItems = [];
  renderOrder();
}

/* ── Clock ───────────────────────────────────────────────── */
function updateClock() {
  const el = document.getElementById('pos-clock');
  if (el) el.textContent = fmtDateTime();
}
updateClock();
setInterval(updateClock, 30000);

/* ── Init ────────────────────────────────────────────────── */
(async () => {
  await initSupabase();
  if (window.adminCore?.init) window.adminCore.init();
  setupEventListeners();
  setMinimumDate();
  initDateListeners();
  await loadAllItems();
})();
