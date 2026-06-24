// ============================================
// SPECIALS FRONTEND LOGIC
// ============================================

let allSpecials = [];

async function getSupabaseClient() {
  // Atann window.dalightSupabase (main.js inisyalize li)
  let attempts = 0;
  while (!window.dalightSupabase && attempts < 50) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  return window.dalightSupabase || null;
}

async function loadSpecials() {
  const grid = document.getElementById('specials-frontend-grid');
  if (!grid) return;

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:rgba(74,55,40,.6);">Aucun special disponible</div>';
      return;
    }

    const { data, error } = await supabase
      .from('dl_specials_with_services')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    allSpecials = data || [];
    renderSpecialsGrid();
  } catch (err) {
    console.error('Error loading specials:', err);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:rgba(74,55,40,.6);">Aucun special disponible</div>';
  }
}

function renderSpecialsGrid() {
  const grid = document.getElementById('specials-frontend-grid');
  if (!grid) return;

  if (allSpecials.length === 0) {
    // Hide the whole wrapper if no specials
    const wrapper = document.getElementById('specials-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    return;
  }

  grid.innerHTML = allSpecials.map(s => {
    // Calcule max reduction pou afiche sou card
    const maxDiscount = s.services && s.services.length > 0
      ? s.services.reduce((max, sv) => {
          if (sv.discount_type === 'percentage') return Math.max(max, sv.discount_value);
          return max;
        }, 0)
      : 0;

    const discountBadge = maxDiscount > 0
      ? `<div style="position:absolute;top:.75rem;right:.75rem;background:#c9a227;color:#fff;font-weight:700;font-size:.8rem;padding:.35rem .65rem;border-radius:20px;box-shadow:0 2px 8px rgba(201,162,39,.4);">-${maxDiscount}%</div>`
      : '';

    const dateLabel = s.end_date
      ? `<div style="font-size:.75rem;color:rgba(74,55,40,.55);margin-top:.25rem;">Jusqu'au ${formatDate(s.end_date)}</div>`
      : '';

    const serviceCount = s.services ? s.services.length : 0;
    const serviceLabel = serviceCount > 0
      ? `<div style="font-size:.78rem;color:rgba(74,55,40,.6);margin-top:.3rem;">${serviceCount} service${serviceCount > 1 ? 's' : ''} inclus</div>`
      : '';

    const placeholder = `<div style="width:100%;height:200px;background:linear-gradient(135deg,#4A3728,#6B4F3B);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,.4)' width='48' height='48'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm7 8a2 2 0 100-4 2 2 0 000 4zm-6 8a6 6 0 0112 0'/></svg></div>`;

    return `
    <div onclick="openSpecialDetail('${s.id}')" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(74,55,40,.1);cursor:pointer;transition:transform .2s,box-shadow .2s;position:relative;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 30px rgba(74,55,40,.18)';" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(74,55,40,.1)';">
      <div style="position:relative;">
        ${s.flyer_url ? `<img src="${s.flyer_url}" alt="${esc(s.title)}" style="width:100%;height:200px;object-fit:cover;display:block;">` : placeholder}
        ${discountBadge}
      </div>
      <div style="padding:1rem 1.25rem 1.25rem;">
        <h3 style="font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:600;margin:0 0 .15rem;color:#2d1f14;">${esc(s.title)}</h3>
        ${dateLabel}
        ${serviceLabel}
        <div style="margin-top:.85rem;background:linear-gradient(135deg,#4A3728,#6B4F3B);color:#fff;text-align:center;padding:.6rem;border-radius:8px;font-size:.85rem;font-weight:600;">Voir l'offre →</div>
      </div>
    </div>
  `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function calcFinalPrice(price, type, value) {
  if (!price) return null;
  if (type === 'percentage') return Math.round(price * (1 - value / 100));
  if (type === 'fixed') return Math.max(0, price - value);
  return price;
}

function openSpecialDetail(id) {
  const s = allSpecials.find(x => x.id === id);
  if (!s) return;

  // Parse services si retounen kòm string JSON
  let services = s.services;
  if (typeof services === 'string') { try { services = JSON.parse(services); } catch(e) { services = []; } }
  if (!Array.isArray(services)) services = [];

  const servicesHtml = services.length > 0 ? services.map(sv => {
    const original = sv.service_price;
    const final = calcFinalPrice(original, sv.discount_type, sv.discount_value);
    const badge = sv.discount_type === 'percentage'
      ? `<span style="background:#c9a227;color:#fff;font-size:.7rem;font-weight:700;padding:.2rem .5rem;border-radius:10px;display:inline-block;">-${sv.discount_value}%</span>`
      : `<span style="background:#c9a227;color:#fff;font-size:.7rem;font-weight:700;padding:.2rem .5rem;border-radius:10px;display:inline-block;">-${Number(sv.discount_value).toLocaleString()} HTG</span>`;
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-radius:10px;background:#faf7f4;gap:.75rem;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:.88rem;color:#2d1f14;">${esc(sv.service_name)}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;margin-top:.2rem;">
          ${original ? `<span style="font-size:.78rem;color:rgba(74,55,40,.45);text-decoration:line-through;">${(window.withFee ? window.withFee(original) : Math.round(original*1.03)).toLocaleString()} HTG</span>` : ''}
          ${final !== null ? `<span style="font-size:.82rem;font-weight:700;color:#2d1f14;">${(window.withFee ? window.withFee(final) : Math.round(final*1.03)).toLocaleString()} HTG</span>` : ''}
          ${badge}
        </div>
      </div>
      <button type="button" class="book-special-btn"
        data-service-id="${sv.service_id || ''}"
        data-service-name="${esc(sv.service_name)}"
        data-discount-percent="${sv.discount_type==='percentage' ? sv.discount_value : 0}"
        data-discount-fixed="${sv.discount_type==='fixed' ? sv.discount_value : 0}"
        data-discount-type="${sv.discount_type || 'none'}"
        style="flex-shrink:0;background:linear-gradient(135deg,#4A3728,#6B4F3B);color:#fff;border:none;border-radius:8px;padding:.45rem .8rem;font-size:.78rem;font-weight:600;cursor:pointer;">Réserver</button>
    </div>`;
  }).join('') : '<p style="color:rgba(74,55,40,.5);font-size:.88rem;text-align:center;padding:1.5rem 0;">Aucun service associé</p>';

  // Retire vye modal si li egziste deja
  const old = document.getElementById('special-detail-modal');
  if (old) old.remove();

  // Kreye modal la dynamikman — zero konfli CSS
  const overlay = document.createElement('div');
  overlay.id = 'special-detail-modal';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSpecialDetail(); });
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    background: 'rgba(0,0,0,0.6)', zIndex: '99999',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    boxSizing: 'border-box'
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background: '#ffffff', borderRadius: '20px',
    maxWidth: '520px', width: '100%', maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    fontFamily: 'Montserrat, sans-serif', color: '#2d1f14'
  });

  box.innerHTML = `
    <div style="background:linear-gradient(135deg,#4A3728,#6B4F3B);padding:1.25rem 1.5rem;border-radius:20px 20px 0 0;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h3 style="color:#fff;margin:0;font-family:'Playfair Display',serif;font-size:1.15rem;line-height:1.3;">${esc(s.title)}</h3>
        ${s.end_date ? `<p style="color:rgba(255,255,255,.75);margin:.2rem 0 0;font-size:.8rem;">Jusqu'au ${formatDate(s.end_date)}</p>` : ''}
      </div>
      <button onclick="closeSpecialDetail()" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.4rem;cursor:pointer;line-height:1;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">&times;</button>
    </div>
    ${s.flyer_url ? `<img src="${s.flyer_url}" alt="${esc(s.title)}" style="width:100%;height:185px;object-fit:cover;display:block;">` : ''}
    <div style="padding:1.25rem 1.5rem 1.75rem;">
      ${s.description ? `<p style="color:rgba(74,55,40,.72);font-size:.87rem;line-height:1.65;margin:0 0 1.1rem;padding-bottom:1rem;border-bottom:1px solid rgba(74,55,40,.1);">${esc(s.description)}</p>` : ''}
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(74,55,40,.4);margin-bottom:.65rem;">Services avec réductions</div>
      <div style="display:flex;flex-direction:column;gap:.5rem;">${servicesHtml}</div>
    </div>`;

  // Delegated event listener — evite onclick inline (safe pou non ki gen apostrophe)
  box.addEventListener('click', e => {
    const btn = e.target.closest('.book-special-btn');
    if (!btn) return;
    e.stopPropagation();
    bookSpecialService(
      btn.dataset.serviceId,
      btn.dataset.serviceName,
      Number(btn.dataset.discountPercent),
      Number(btn.dataset.discountFixed),
      btn.dataset.discountType
    );
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function closeSpecialDetail() {
  const modal = document.getElementById('special-detail-modal');
  if (modal) modal.remove();
  document.body.style.overflow = '';
}

async function bookSpecialService(serviceId, serviceName, discountPercent, discountFixed, discountType) {
  if (!serviceId) {
    alert('Service introuvable. Veuillez réessayer.');
    return;
  }

  // Check if already in cart
  const cart = JSON.parse(localStorage.getItem('dalight:serviceCart') || '[]');
  const exists = cart.find(item => item.service_id === serviceId);
  if (exists) {
    if (window.showToast) window.showToast('error', 'Déjà dans le panier', `${serviceName} est déjà ajouté.`);
    else alert('Ce service est déjà dans votre panier');
    closeSpecialDetail();
    if (window.openCart) window.openCart();
    return;
  }

  // Get Supabase client (attann li si pa prè)
  const supabase = await getSupabaseClient();
  if (!supabase) {
    alert('Connexion impossible. Veuillez rafraîchir la page.');
    return;
  }

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (error || !data) {
    alert('Erreur lors du chargement du service: ' + (error?.message || 'Service introuvable'));
    return;
  }

  // Calculate discounted price + fees
  const fee = window.withFee || ((p) => Math.round(p * 1.03));
  const feeUSD = window.withFeeUSD || ((p) => Math.round(p * 1.03 * 100) / 100);
  let finalPriceHtg, finalPriceUsd;

  if (discountType === 'percentage' && discountPercent > 0) {
    finalPriceHtg = fee(data.price_htg * (1 - discountPercent / 100));
    finalPriceUsd = feeUSD(data.price_usd * (1 - discountPercent / 100));
  } else if (discountType === 'fixed' && discountFixed > 0) {
    finalPriceHtg = fee(Math.max(0, data.price_htg - discountFixed));
    finalPriceUsd = feeUSD(Math.max(0, data.price_usd - (discountFixed / (data.price_htg / data.price_usd))));
  } else {
    finalPriceHtg = fee(data.price_htg);
    finalPriceUsd = feeUSD(data.price_usd);
  }

  cart.push({
    id: Date.now().toString(),
    service_id: serviceId,
    name: serviceName,
    description: data.description,
    duration: data.duration,
    price_htg: finalPriceHtg,
    price_usd: finalPriceUsd,
    original_price_htg: data.price_htg,
    original_price_usd: data.price_usd,
    discount_percent: discountType === 'percentage' ? discountPercent : 0,
    discount_fixed: discountType === 'fixed' ? discountFixed : 0,
    is_special: true
  });
  localStorage.setItem('dalight:serviceCart', JSON.stringify(cart));

  if (window.updateCartUI) window.updateCartUI();
  if (window.showToast) window.showToast('success', 'Ajouté au panier', `${serviceName} avec réduction a été ajouté.`);

  closeSpecialDetail();
  if (window.openCart) window.openCart();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// Make functions globally available
window.openSpecialDetail = openSpecialDetail;
window.closeSpecialDetail = closeSpecialDetail;
window.bookSpecialService = bookSpecialService;

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadSpecials();
});
