// ============================================
// SPECIALS FRONTEND LOGIC (DALIGHT LUXURY SUITE)
// ============================================

const SUPABASE_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';

// Guaranteed Fallback Specials from Supabase (Always displays instantly)
const FALLBACK_SPECIALS = [
  {
    id: "e78d8502-8a3f-4547-8186-fbf98312b263",
    title: "Spécial Offre Combo Duo Zen",
    description: "Offre spéciale sur nos formules Combo Duo Zen (Head Spa & Massage Relaxant). Profitez d'une expérience de relaxation ultime adaptée à la nature de vos cheveux (Naturels, Défrisés, ou Locs).",
    flyer_url: "https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/specials-flyers/special-1785789027490-WhatsApp%20Image%202026-08-02%20at%204.11.20%20PM.jpeg",
    start_date: "2026-08-03",
    end_date: "2026-12-31",
    is_active: true,
    services: [
      {
        service_id: "ba180384-9bfe-40ef-a75b-415fe48b4d79",
        service_name: "COMBO DUO ZEN DEFRISE",
        service_price: 8000,
        discount_type: "percentage",
        discount_value: 20
      },
      {
        service_id: "5e85d269-a6e5-4535-9b71-80b11f03ac03",
        service_name: "COMBO ZEN NATUREL",
        service_price: 7000,
        discount_type: "percentage",
        discount_value: 15
      }
    ]
  },
  {
    id: "8cbb89db-6f62-4680-89ca-48ef62d5947c",
    title: "Special Wood Therapy & Détox",
    description: "Technique sculptante aux instruments en bois précieux pour drainer la lymphe et tonifier le corps chez DALIGHT à Delmas 65.",
    flyer_url: "https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/specials-flyers/special-1782408370237-9df1f52a-9190-4853-8921-2e4f3b0937b0.jpeg",
    start_date: "2026-06-25",
    end_date: "2026-12-31",
    is_active: true,
    services: [
      {
        service_id: "wood-therapy-special",
        service_name: "WOOD THERAPY PROTOCOLE INTÉGRAL",
        service_price: 9500,
        discount_type: "percentage",
        discount_value: 25
      }
    ]
  }
];

let allSpecials = [...FALLBACK_SPECIALS];

async function getSupabaseClient() {
  if (window.dalightSupabase) return window.dalightSupabase;
  if (window.supabase && window.supabase.createClient) {
    try {
      window.dalightSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.dalightSupabase;
    } catch (e) {
      console.warn('Direct Supabase creation error:', e);
    }
  }
  let attempts = 0;
  while (!window.dalightSupabase && attempts < 25) {
    await new Promise(r => setTimeout(r, 100));
    if (window.supabase && window.supabase.createClient) {
      window.dalightSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.dalightSupabase;
    }
    attempts++;
  }
  return window.dalightSupabase || null;
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

function calcFinalPrice(price, type, value) {
  if (!price) return null;
  if (type === 'percentage') return Math.round(price * (1 - value / 100));
  if (type === 'fixed') return Math.max(0, price - value);
  return price;
}

async function loadSpecials() {
  const grid = document.getElementById('specials-frontend-grid');
  if (!grid) return;

  // Render initial fallback specials immediately so user never sees empty box
  renderSpecialsGrid();

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.warn('Using fallback specials (Supabase not available yet)');
      return;
    }

    const { data, error } = await supabase
      .from('dl_specials_with_services')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not query dl_specials_with_services, keeping fallbacks:', error.message);
      return;
    }

    if (data && data.length > 0) {
      allSpecials = data;
      renderSpecialsGrid();
    }
  } catch (err) {
    console.error('Error loading specials from Supabase:', err);
  }
}

function renderSpecialsGrid() {
  const grid = document.getElementById('specials-frontend-grid');
  if (!grid) return;

  const wrapper = document.getElementById('specials-wrapper');
  if (wrapper) wrapper.style.display = 'block';

  if (!allSpecials || allSpecials.length === 0) {
    allSpecials = [...FALLBACK_SPECIALS];
  }

  grid.innerHTML = allSpecials.map(s => {
    // Calcule max reduction pou afiche sou card
    const maxDiscount = s.services && s.services.length > 0
      ? s.services.reduce((max, sv) => {
          if (sv.discount_type === 'percentage') return Math.max(max, sv.discount_value);
          return max;
        }, 0)
      : (s.id.includes('wood') ? 25 : 20);

    const discountBadge = maxDiscount > 0
      ? `<div class="spa-special-discount-badge">-${maxDiscount}%</div>`
      : '';

    const dateLabel = s.end_date
      ? `Jusqu'au ${formatDate(s.end_date)}`
      : 'Durée limitée';

    const serviceCount = s.services ? s.services.length : 1;

    const fallbackImg = s.id.includes('wood')
      ? '../assets/images/service_woodtherapy.jpg'
      : '../assets/images/service_headspa.jpg';

    const flyerImg = s.flyer_url || fallbackImg;

    return `
    <div onclick="openSpecialDetail('${s.id}')" class="spa-special-card">
      <div class="spa-special-arch-frame">
        <img src="${flyerImg}" alt="${esc(s.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}';">
        ${discountBadge}
      </div>
      <div class="spa-special-body">
        <h3 class="spa-special-title">${esc(s.title)}</h3>
        <div class="spa-special-meta">
          <span class="spa-special-pill">
            <i data-lucide="calendar" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:4px;"></i>
            ${dateLabel}
          </span>
          <span class="spa-special-pill">
            <i data-lucide="sparkles" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:4px;"></i>
            ${serviceCount} soin${serviceCount > 1 ? 's' : ''} inclus
          </span>
        </div>
        <div class="spa-special-btn">
          <span>Découvrir l'Offre</span>
          <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
        </div>
      </div>
    </div>
  `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openSpecialDetail(id) {
  const s = allSpecials.find(x => x.id === id) || FALLBACK_SPECIALS.find(x => x.id === id);
  if (!s) return;

  // Parse services si retounen kòm string JSON
  let services = s.services;
  if (typeof services === 'string') { try { services = JSON.parse(services); } catch(e) { services = []; } }
  if (!Array.isArray(services) || services.length === 0) {
    // Si pa gen services, bay yon default service pou pemet rezèvasyon
    services = [
      {
        service_id: s.id,
        service_name: s.title,
        service_price: 8500,
        discount_type: 'percentage',
        discount_value: 20
      }
    ];
  }

  const servicesHtml = services.map(sv => {
    const original = sv.service_price || 8000;
    const final = calcFinalPrice(original, sv.discount_type, sv.discount_value);
    const badge = sv.discount_type === 'percentage'
      ? `<span style="background:linear-gradient(135deg, #E6B800, #C99700);color:#1a2010;font-size:.74rem;font-weight:700;padding:.25rem .6rem;border-radius:9999px;display:inline-block;">-${sv.discount_value}%</span>`
      : `<span style="background:linear-gradient(135deg, #E6B800, #C99700);color:#1a2010;font-size:.74rem;font-weight:700;padding:.25rem .6rem;border-radius:9999px;display:inline-block;">-${Number(sv.discount_value).toLocaleString()} HTG</span>`;
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.15rem;border-radius:18px;background:rgba(255,255,255,0.05);border:1px solid rgba(194,164,144,0.2);gap:.75rem;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:.92rem;color:var(--spa-white, #fff);">${esc(sv.service_name)}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin-top:.25rem;">
          ${original ? `<span style="font-size:.8rem;color:rgba(255,255,255,0.45);text-decoration:line-through;">${(window.withFee ? window.withFee(original) : Math.round(original*1.03)).toLocaleString()} HTG</span>` : ''}
          ${final !== null ? `<span style="font-size:.88rem;font-weight:700;color:var(--spa-taupe-rose, #C2A490);">${(window.withFee ? window.withFee(final) : Math.round(final*1.03)).toLocaleString()} HTG</span>` : ''}
          ${badge}
        </div>
      </div>
      <button type="button" class="book-special-btn"
        data-service-id="${sv.service_id || ''}"
        data-service-name="${esc(sv.service_name)}"
        data-discount-percent="${sv.discount_type==='percentage' ? sv.discount_value : 0}"
        data-discount-fixed="${sv.discount_type==='fixed' ? sv.discount_value : 0}"
        data-discount-type="${sv.discount_type || 'none'}"
        style="flex-shrink:0;background:linear-gradient(135deg,var(--spa-taupe-rose,#C2A490) 0%,#a88a76 100%);color:#1a2010;border:none;border-radius:9999px;padding:.55rem 1.15rem;font-size:.8rem;font-weight:700;cursor:pointer;letter-spacing:.05em;text-transform:uppercase;box-shadow:0 4px 15px rgba(194,164,144,0.35);">Réserver</button>
    </div>`;
  }).join('');

  // Retire vye modal si li egziste deja
  const old = document.getElementById('special-detail-modal');
  if (old) old.remove();

  // Kreye modal la dynamikman
  const overlay = document.createElement('div');
  overlay.id = 'special-detail-modal';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSpecialDetail(); });
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    zIndex: '99999',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    boxSizing: 'border-box'
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background: 'rgba(26, 33, 17, 0.96)',
    backdropFilter: 'blur(25px)',
    WebkitBackdropFilter: 'blur(25px)',
    border: '1px solid rgba(194, 164, 144, 0.35)',
    borderRadius: '32px',
    maxWidth: '540px', width: '100%', maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
    fontFamily: 'var(--spa-font-sans, "Outfit", sans-serif)',
    color: '#FAF8F5'
  });

  const flyerImg = s.flyer_url || (s.id.includes('wood') ? '../assets/images/service_woodtherapy.jpg' : '../assets/images/service_headspa.jpg');

  box.innerHTML = `
    <div style="background:rgba(30, 37, 19, 0.95);padding:1.5rem 1.8rem;border-radius:32px 32px 0 0;border-bottom:1px solid rgba(194,164,144,0.2);display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h3 style="color:#fff;margin:0;font-family:var(--spa-font-serif, 'Cormorant Garamond', serif);font-size:1.5rem;font-weight:400;line-height:1.2;">${esc(s.title)}</h3>
        ${s.end_date ? `<p style="color:var(--spa-taupe-rose);margin:.3rem 0 0;font-size:.82rem;">Jusqu'au ${formatDate(s.end_date)}</p>` : ''}
      </div>
      <button onclick="closeSpecialDetail()" style="background:rgba(255,255,255,.08);border:1px solid rgba(194,164,144,0.25);color:#fff;font-size:1.4rem;cursor:pointer;line-height:1;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;">&times;</button>
    </div>
    <div style="padding:1rem 1.5rem 0;">
      <img src="${flyerImg}" alt="${esc(s.title)}" style="width:100%;height:210px;object-fit:cover;display:block;border-radius:20px;border:1px solid rgba(194,164,144,0.25);">
    </div>
    <div style="padding:1.4rem 1.8rem 2rem;">
      ${s.description ? `<p style="color:var(--spa-cream-light);font-size:.9rem;line-height:1.65;margin:0 0 1.25rem;padding-bottom:1rem;border-bottom:1px solid rgba(194,164,144,0.15);">${esc(s.description)}</p>` : ''}
      <div style="font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:var(--spa-taupe-rose);margin-bottom:.85rem;">Soins Inclus avec Réductions</div>
      <div style="display:flex;flex-direction:column;gap:.65rem;">${servicesHtml}</div>
    </div>`;

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
  if (window.lucide) lucide.createIcons();
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

  const cart = JSON.parse(localStorage.getItem('dalight:serviceCart') || '[]');
  const exists = cart.find(item => item.service_id === serviceId);
  if (exists) {
    if (window.showToast) window.showToast('error', 'Déjà dans le panier', `${serviceName} est déjà ajouté.`);
    else alert('Ce service est déjà dans votre panier');
    closeSpecialDetail();
    if (window.openCart) window.openCart();
    return;
  }

  const supabase = await getSupabaseClient();
  let basePriceHtg = 8000;
  let basePriceUsd = 65;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();
      if (data) {
        basePriceHtg = data.price_htg || 8000;
        basePriceUsd = data.price_usd || 65;
      }
    } catch(err) {
      console.warn('Could not load service from db, using calculated prices:', err);
    }
  }

  const fee = window.withFee || ((p) => Math.round(p * 1.03));
  const feeUSD = window.withFeeUSD || ((p) => Math.round(p * 1.03 * 100) / 100);
  let finalPriceHtg, finalPriceUsd;

  if (discountType === 'percentage' && discountPercent > 0) {
    finalPriceHtg = fee(basePriceHtg * (1 - discountPercent / 100));
    finalPriceUsd = feeUSD(basePriceUsd * (1 - discountPercent / 100));
  } else if (discountType === 'fixed' && discountFixed > 0) {
    finalPriceHtg = fee(Math.max(0, basePriceHtg - discountFixed));
    finalPriceUsd = feeUSD(Math.max(0, basePriceUsd - (discountFixed / (basePriceHtg / basePriceUsd))));
  } else {
    finalPriceHtg = fee(basePriceHtg);
    finalPriceUsd = feeUSD(basePriceUsd);
  }

  const specialItem = {
    id: 'special_' + Date.now(),
    service_id: serviceId,
    name: serviceName + (discountPercent > 0 ? ` (Offre -${discountPercent}%)` : ''),
    duration: '60 min',
    price_htg: finalPriceHtg,
    price_usd: finalPriceUsd,
    category: 'special'
  };

  cart.push(specialItem);
  localStorage.setItem('dalight:serviceCart', JSON.stringify(cart));

  if (window.updateCartUI) window.updateCartUI();
  if (window.showToast) {
    window.showToast('success', 'Offre Spéciale ajoutée !', `${serviceName} a été ajouté à votre panier.`);
  }

  closeSpecialDetail();
  if (window.openCart) window.openCart();
}

// Make functions globally available
window.openSpecialDetail = openSpecialDetail;
window.closeSpecialDetail = closeSpecialDetail;
window.bookSpecialService = bookSpecialService;
window.loadSpecials = loadSpecials;

// Auto-run immediately & on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSpecials);
  } else {
    loadSpecials();
  }
}
