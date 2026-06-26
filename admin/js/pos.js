/* ============================================================
   DALIGHT — POS (Point of Sale)
   ============================================================ */

const DALIGHT_INFO = {
  name:    'DALIGHT',
  tagline: "L'Art du Bien-Être",
  address: 'Delmas 65, Port-au-Prince, Haïti',
  phone:   '+509 37 37 37 37',
  email:   'info@dalightbeauty.com',
  instagram: '@dalightbeauty',
  facebook:  'DALIGHT Beauty & Spa',
  whatsapp:  '+509 37 37 37 37',
  logo:    '../assets/images/logodaligth.png?v=2',
};

const DEPOSIT_RATE = 0.5;     // 50 % pour les massages
const HEADSPA_DEPOSIT = 1000; // HTG fixe par service tête

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

    // Load products (optional)
    try {
      const { data: prodData, error: prodErr } = await sb.from('products').select('*').eq('is_active', true).order('name');
      if (prodErr) throw prodErr;
      allProducts = (prodData || []).map(p => ({
        ...p,
        type: 'product',
        category: p.category || p.category_name || 'Produit',
        price_htg: withFee(p.price_htg || 0),
        price_usd: p.price_usd ? Math.round(Number(p.price_usd) * 1.03 * 100) / 100 : null,
      }));
      console.log('POS: Produits chargés:', allProducts.length);
    } catch (e) {
      console.warn('POS: Products table error (ignoring):', e.message);
      allProducts = [];
    }

    // Load formations (optional)
    try {
      const { data: formationsData, error: formationsErr } = await sb.from('formations').select('*').eq('is_active', true).order('name');
      if (formationsErr) throw formationsErr;
      allFormations = (formationsData || []).map(f => ({
        ...f,
        type: 'formation',
        category: f.category || f.category_name || 'Formation',
        price_htg: withFee(f.price_htg || 0),
        price_usd: f.price_usd ? Math.round(Number(f.price_usd) * 1.03 * 100) / 100 : null,
      }));
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

  grid.innerHTML = filtered.map(s => `
    <div class="svc-card" data-id="${s.id}">
      <div class="svc-cat-tag">${esc(s.category || (currentType === 'services' ? 'Service' : currentType === 'products' ? 'Produit' : 'Formation'))}</div>
      <div class="svc-name">${esc(s.name)}</div>
      <div class="svc-duration">${esc(s.duration || '')}</div>
      <div class="svc-price">${fmtHTG(s.price_htg)}<span class="svc-price-usd">${s.price_usd ? '· '+fmtUSD(s.price_usd) : ''}</span></div>
    </div>
  `).join('');

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
    receiptNo, dateTime, clientName, clientPhone,
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
        Instagram : ${DALIGHT_INFO.instagram} &nbsp;·&nbsp; Facebook : ${DALIGHT_INFO.facebook}
      </div>
      <div style="margin-top:.25rem;">WhatsApp : ${DALIGHT_INFO.whatsapp}</div>
      <div style="margin-top:.5rem;font-size:.68rem;color:#d1d5db;">Ce reçu est votre preuve d'achat. Conservez-le.</div>
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
  printArea.innerHTML = `<div id="receipt-content" style="max-width:400px;margin:0 auto;padding:1.5rem;font-family:Inter,sans-serif;">${html}</div>`;
  window.print();
  printArea.innerHTML = '';
};

document.getElementById('btn-preview').addEventListener('click', () => {
  if (!orderItems.length) { alert('Ajoutez au moins un service.'); return; }
  openReceipt(false);
});

document.getElementById('btn-confirm').addEventListener('click', async () => {
  if (!orderItems.length) return;
  openReceipt(true);

  // Save the sale to pos_sales table
  if (sb) {
    try {
      const clientName  = document.getElementById('client-name').value.trim() || 'Client POS';
      const clientPhone = document.getElementById('client-phone').value.trim();
      const subtotal    = orderItems.reduce((s, it) => s + it.price_htg * it.qty, 0);
      const deposit     = calcDeposit(orderItems);
      const isDeposit   = payChoice === 'deposit';
      const amountDue   = isDeposit ? deposit : subtotal;
      const balance     = isDeposit ? (subtotal - amountDue) : 0;

      const { data: { user } } = await sb.auth.getUser();

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
    } catch(e) {
      console.warn('POS: DB save failed (non-blocking):', e.message);
    }
  }
});

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
  await loadAllItems();
})();
