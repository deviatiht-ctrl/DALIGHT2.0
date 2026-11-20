
// Supabase client wrapper with transparent compatibility
function wrapWithDalightPrefix(client) {
  if (!client || client._dalightWrapped) return client;
  const origFrom = client.from.bind(client);
  client.from = function(tableName) {
    return origFrom(tableName);
  };
  client._dalightWrapped = true;
  return client;
}
import { initRegistrationPopup } from './registration-popup.js';

// ── Payment processing fees (Moncash 3% only) ──────────────────
window.DALIGHT_FEE_RATE = 0.03;
// Client price = base × 1.03 (HTG only)
window.withFee = (price) => {
  const p = Number(price);
  return Math.round(p * (1 + window.DALIGHT_FEE_RATE));
};
window.withFeeUSD = (price) => Math.round(Number(price) * (1 + window.DALIGHT_FEE_RATE) * 100) / 100;
// ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  supabaseUrl: 'https://rbwoiejztrkghfkpxquo.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U',
  stripePublicKey: 'pk_test_yourPublishableKey',
  stripeCheckoutUrl: '/api/create-checkout-session',
  smtpSecureToken: '',
  notificationFrom: 'concierge@dalight.com',
  notificationBcc: '',
  publicBaseUrl: window.location.origin,
  resendApiKey: 're_WNFsawq8_NbVdiFmSj1gSLuzhJ5qr4knr',
  adminEmail: 'laurorejeanclarens0@gmail.com',
};

const ADMIN_EMAILS = [
  'laurorejeanclarens0@gmail.com',
  'laurorejeanclarens@gmail.com',
  'dalightbeauty@gmail.com',
  'admin@dalightbeauty.com',
  'cvisual@gmail.com'
];

const servicesCatalog = [
  {
    id: 'head-spa-signature',
    name: 'Head Spa Signature',
    price: 85,
    priceHtg: 10000,
    duration: '60 min',
    priceId: 'price_head_spa_signature',
  },
  {
    id: 'service-zen-imperial',
    name: 'Service Zen Impérial',
    price: 125,
    priceHtg: 15000,
    duration: '90 min',
    priceId: 'price_service_zen_imperial',
  },
  {
    id: 'soin-detox-equilibre',
    name: 'Soin Détox & Équilibre',
    price: 100,
    priceHtg: 12000,
    duration: '75 min',
    priceId: 'price_soin_detox_equilibre',
  },
  {
    id: 'head-spa-eclat-visage',
    name: 'Head Spa & Éclat Visage',
    price: 150,
    priceHtg: 18000,
    duration: '105 min',
    priceId: 'price_head_spa_eclat_visage',
  },
  {
    id: 'duo-serenite',
    name: 'Duo Sérénité',
    price: 160,
    priceHtg: 19000,
    duration: '60 min',
    priceId: 'price_duo_serenite',
  },
  {
    id: 'service-renaissance-4',
    name: 'Service Renaissance 4',
    price: 300,
    priceHtg: 35000,
    duration: '4 services',
    priceId: 'price_service_renaissance_4',
  },
  {
    id: 'love-zen-package',
    name: 'Love & Zen Package',
    price: 100,
    priceHtg: 12000,
    duration: '90 min',
    priceId: 'price_love_zen',
  },
  {
    id: 'cure-vitalite-6',
    name: 'Cure Vitalité Intense (6)',
    price: 420,
    priceHtg: 50000,
    duration: '6 services',
    priceId: 'price_cure_vitalite_6',
  },
];

const STORAGE_KEYS = {
  service: 'dalight:selectedRitual',
};

let pageId = '';
const isInsidePagesDir = window.location.pathname.includes('/pages/');
const reservationPath = isInsidePagesDir ? './services.html' : './pages/services.html';
const loginPath = isInsidePagesDir ? './login.html' : './pages/login.html';
const registerPath = isInsidePagesDir ? './register.html' : './pages/register.html';
const protectedPages = new Set(['reservation', 'payment', 'orders', 'admin', 'reservation-v2']);

// ── Mobile bottom nav (Telegram-style glass bar) ────────────────────
const NAV_TABS = {
  home: { icon: 'home', label: 'Accueil', file: null },
  services: { icon: 'sparkles', label: 'Réserver', file: 'services.html' },
  shop: { icon: 'shopping-bag', label: 'Boutique', file: 'shop.html' },
  orders: { icon: 'calendar-check', label: 'Réservations', file: 'orders.html' },
  loyalty: { icon: 'crown', label: 'Fidélité', file: 'loyalty.html' },
  login: { icon: 'user', label: 'Compte', file: 'login.html' },
};

const NAV_FULL = ['home', 'services', 'shop', 'orders', 'loyalty', 'login'];

// Which tabs show up per page — main pages get the full bar,
// secondary/flow pages only get what's actually useful to them.
const NAV_CONFIG = {
  home: NAV_FULL,
  services: NAV_FULL,
  soins: NAV_FULL,
  shop: NAV_FULL,
  orders: NAV_FULL,
  loyalty: NAV_FULL,
  login: ['home', 'services', 'login'],
  register: ['home', 'services', 'login'],
  product: ['home', 'services', 'shop', 'orders', 'login'],
  payment: ['home', 'shop', 'orders', 'login'],
  checkout: ['home', 'shop', 'orders', 'login'],
  cart: ['home', 'shop', 'orders', 'login'],
  'order-confirmation': ['home', 'shop', 'orders', 'login'],
  'reservation-v2': ['home', 'services', 'orders', 'login'],
  formation: ['home', 'services', 'shop', 'login'],
  follow: ['home', 'services', 'shop', 'login'],
  giveaway: ['home', 'services', 'loyalty', 'login'],
  about: ['home', 'services', 'shop', 'login'],
};

// Pages whose pageId doesn't map 1:1 to a tab id, but should still
// highlight the closest matching tab as active.
const NAV_ACTIVE_OVERRIDE = {
  soins: 'services',
  'reservation-v2': 'services',
};

const runtimeConfig = {
  supabaseUrl: window.__ENV__?.SUPABASE_URL || DEFAULT_CONFIG.supabaseUrl,
  supabaseAnonKey: window.__ENV__?.SUPABASE_ANON_KEY || DEFAULT_CONFIG.supabaseAnonKey,
  stripePublicKey: window.__ENV__?.STRIPE_PUBLIC_KEY || DEFAULT_CONFIG.stripePublicKey,
  stripeCheckoutUrl: window.__ENV__?.STRIPE_CHECKOUT_URL || DEFAULT_CONFIG.stripeCheckoutUrl,
  smtpSecureToken: window.__ENV__?.SMTP_SECURE_TOKEN || DEFAULT_CONFIG.smtpSecureToken,
  notificationFrom: window.__ENV__?.NOTIFICATION_FROM || DEFAULT_CONFIG.notificationFrom,
  notificationBcc: window.__ENV__?.NOTIFICATION_BCC || DEFAULT_CONFIG.notificationBcc,
  publicBaseUrl: window.__ENV__?.PUBLIC_BASE_URL || DEFAULT_CONFIG.publicBaseUrl,
};

// Wait for Supabase CDN to load before creating client
function waitForSupabase() {
  return new Promise((resolve) => {
    if (window.supabase && window.supabase.createClient) {
      console.log('✅ Supabase CDN already loaded');
      resolve(true);
      return;
    }
    
    console.log('⏳ Waiting for Supabase CDN to load...');
    
    // Wait up to 10 seconds for Supabase to load
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds
    const interval = setInterval(() => {
      attempts++;
      
      if (window.supabase && window.supabase.createClient) {
        clearInterval(interval);
        console.log('✅ Supabase CDN loaded after', attempts * 100, 'ms');
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error('❌ Supabase CDN failed to load after 10 seconds');
        console.error('💡 Check your internet connection or CDN availability');
        resolve(false);
      }
      
      // Log progress every 2 seconds
      if (attempts % 20 === 0) {
        console.log(`⏳ Still waiting for Supabase CDN... (${attempts * 100}ms)`);
      }
    }, 100);
  });
}

// Dynamically load Supabase from CDN if not already loaded
function loadSupabaseCDN() {
  return new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) {
      resolve(true);
      return;
    }
    
    console.log('📦 Loading Supabase from CDN...');
    
    // Try local vendor first, then CDN sources as fallback
    const cdnSources = [
      './vendor/supabase/supabase.min.js',
      '../vendor/supabase/supabase.min.js',
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.1/dist/umd/supabase.min.js',
      'https://unpkg.com/@supabase/supabase-js@2.45.1/dist/umd/supabase.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/supabase.js/2.45.1/supabase.min.js'
    ];
    
    let currentSource = 0;
    
    function tryLoadNext() {
      if (currentSource >= cdnSources.length) {
        console.error('❌ All CDN sources failed');
        reject(new Error('Failed to load Supabase from any CDN'));
        return;
      }
      
      const src = cdnSources[currentSource];
      console.log(`🔄 Trying CDN source ${currentSource + 1}: ${src}`);
      
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        console.log('✅ Supabase loaded from:', src);
        resolve(true);
      };
      script.onerror = () => {
        console.warn('❌ Failed to load from:', src);
        currentSource++;
        tryLoadNext();
      };
      document.head.appendChild(script);
    }
    
    tryLoadNext();
  });
}

// Initialize Supabase client
// Synchronous fast pre-check for admin status to eliminate layout flicker
(function checkAdminPreload() {
  try {
    const cachedRole = localStorage.getItem('dalight_user_role');
    if (cachedRole === 'admin') {
      document.body?.classList.add('is-admin');
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          const email = (parsed?.user?.email || '').toLowerCase().trim();
          if (email && ADMIN_EMAILS.includes(email)) {
            document.body?.classList.add('is-admin');
            localStorage.setItem('dalight_user_role', 'admin');
          }
        }
      }
    }
  } catch(e){}
})();

let supabaseClient = null;

// Synchronous initialization if Supabase is already loaded on the page via script tag
if (window.supabase && window.supabase.createClient) {
  try {
    supabaseClient = window.supabase.createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey);
    wrapWithDalightPrefix(supabaseClient);
    window.dalightSupabase = supabaseClient;
    window.dalightReady = true;
    window.dalightServices = servicesCatalog;
    console.log('✅ Supabase client initialized synchronously at script load');
  } catch (err) {
    console.warn('⚠️ Synchronous Supabase initialization failed:', err);
  }
}

async function initSupabase() {
  console.log('🔧 Initializing Supabase client...');
  
  // First, try to load Supabase from CDN if not already loaded
  try {
    await loadSupabaseCDN();
  } catch (error) {
    console.error('❌ Failed to load Supabase CDN:', error);
    return null;
  }
  
  // Wait for it to be available
  const loaded = await waitForSupabase();
  if (!loaded) {
    console.error('❌ Supabase client initialization failed');
    return null;
  }
  
  try {
    supabaseClient = window.supabase.createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey);
    wrapWithDalightPrefix(supabaseClient);
    
    // 🔧 GLOBAL READY SIGNALS - FIX RESERVATION TIMING ISSUE
    window.dalightSupabase = supabaseClient;
    window.dalightReady = true;
    window.dalightServices = servicesCatalog;
    console.log('✅ Supabase client initialized successfully');
    console.log('🌍 Global signals set: window.dalightSupabase & window.dalightReady=true');
    
    // Test the connection
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
    } else {
      console.log('✅ Supabase connection test passed');
      if (data?.session) {
        console.log('✅ Active session found for:', data.session.user?.email);
      } else {
        console.log('ℹ️ No active session');
      }
    }
    
    return supabaseClient;
  } catch (err) {
    console.error('❌ Error creating Supabase client:', err);
    return null;
  }
}

let isAppInitialized = false;

async function init() {
  if (isAppInitialized) {
    console.log('⚠️ App already initialized, skipping...');
    return;
  }
  isAppInitialized = true;
  pageId = document.body?.dataset?.page ?? '';
  
  // Robust fallback to URL path if pageId is missing or body not yet parsed
  if (!pageId) {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('services.html')) {
      pageId = 'services';
    } else if (path.includes('reservation-v2.html')) {
      pageId = 'reservation-v2';
    } else if (path.includes('orders.html')) {
      pageId = 'orders';
    } else if (path.includes('payment.html')) {
      pageId = 'payment';
    } else if (path.includes('/admin/')) {
      pageId = 'admin';
    }
    console.log('ℹ️ pageId fallback from URL:', pageId);
  }
  
  console.log('🚀 Initializing DALIGHT app...');
  
  // Setup UI first (don't wait for Supabase)
  document.body.classList.add('js-enabled');
  setYear();
  setupNavToggle();
  syncMobileNavVisibility();
  handleServiceShortcuts();
  renderMobileNav();
  
  // Initialize Supabase (non-blocking for UI)
  initSupabase().then(() => {
    // Detect session role after Supabase is ready
    detectSessionRole();
  }).catch(err => {
    console.warn('⚠️ Supabase init failed, continuing without auth:', err);
  });
  
  setupRevealOnScroll();
  initLucideIcons();
  window.addEventListener('resize', syncMobileNavVisibility);

  if (protectedPages.has(pageId)) {
    console.log('🔒 Protected page detected:', pageId);
    ensureAuth().catch((err) => {
      console.error('❌ Auth check failed:', err.message);
    });
  }

  // Initialize the luxury registration pop-up for unregistered users
  initRegistrationPopup();
  
  console.log('✅ App initialization complete');
  console.log('👑 Is admin?', document.body.classList.contains('is-admin'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}

function setYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function setupNavToggle() {
  const nav = document.querySelector('.top-nav');
  const toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    function handleToggle(e) {
      e.preventDefault();
      e.stopPropagation();
      nav.classList.toggle('open');
      toggle.classList.toggle('active');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    }

    toggle.addEventListener('click', handleToggle);

    // Fermer le menu si on clique en dehors
    document.addEventListener('click', function(e) {
      if (nav.classList.contains('open') && !nav.contains(e.target)) {
        nav.classList.remove('open');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // SPA Hamburger Support
  const spaHamburger = document.getElementById('spa-hamburger') || document.querySelector('.spa-hamburger-btn');
  const spaMenu = document.getElementById('spa-mobile-menu') || document.querySelector('.spa-mobile-menu');
  if (spaHamburger && spaMenu) {
    spaHamburger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      spaMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (spaMenu.classList.contains('open') && !spaMenu.contains(e.target) && !spaHamburger.contains(e.target)) {
        spaMenu.classList.remove('open');
      }
    });
  }
}

function syncMobileNavVisibility() {
  const mobileNav = document.querySelector('.mobile-nav');
  if (!mobileNav) return;
  const shouldDisplay = window.matchMedia('(max-width: 900px)').matches;
  mobileNav.style.display = shouldDisplay ? 'flex' : 'none';
}

function renderMobileNav() {
  const mobileNav = document.querySelector('.mobile-nav');
  if (!mobileNav || !pageId) return;

  const tabIds = NAV_CONFIG[pageId] || ['home', 'shop', 'orders', 'login'];
  const activeId = NAV_ACTIVE_OVERRIDE[pageId] || pageId;
  const rootPrefix = isInsidePagesDir ? '../' : './';
  const pagesPrefix = isInsidePagesDir ? './' : './pages/';

  mobileNav.innerHTML = tabIds
    .map((id) => {
      const tab = NAV_TABS[id];
      if (!tab) return '';
      const href = tab.file ? `${pagesPrefix}${tab.file}` : `${rootPrefix}index.html`;
      const classes = [id === activeId ? 'active' : '', id === 'loyalty' ? 'tab-loyalty' : '']
        .filter(Boolean)
        .join(' ');
      return `<a href="${href}" data-page="${id}"${classes ? ` class="${classes}"` : ''}>
        <i data-lucide="${tab.icon}"></i>
        <span>${tab.label}</span>
      </a>`;
    })
    .join('');

  // Apple-style icon "zoom" bounce on tap, before the page navigates away.
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.querySelectorAll('a').forEach((l) => l.classList.remove('nav-tap'));
      link.classList.add('nav-tap');
    });
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function setupRevealOnScroll() {
  const revealEls = document.querySelectorAll('.reveal-on-scroll');
  if (!revealEls.length) return;

  const show = (element) => element.classList.add('visible');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach(show);
  }
}

function initLucideIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function handleServiceShortcuts() {
  const buttons = document.querySelectorAll('[data-service]');
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const serviceName = btn.dataset.service;
      if (!serviceName) return;
      sessionStorage.setItem(STORAGE_KEYS.service, serviceName);
      window.location.href = reservationPath;
    });
  });
}

export function createOptionsForServices(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML =
    '<option value="" disabled selected>Sélectionnez un service</option>' +
    servicesCatalog
      .map(
        (service) =>
          `<option value="${service.name}" data-price="${service.price}" data-price-id="${service.priceId}">${service.name} · ${service.priceHtg.toLocaleString()} HTG / $${service.price}</option>`
      )
      .join('');

  const stored = sessionStorage.getItem(STORAGE_KEYS.service);
  if (stored) {
    const matched = Array.from(selectEl.options).find((opt) => opt.value === stored);
    if (matched) {
      selectEl.value = stored;
    }
  }
}

export async function ensureAuth() {
  console.log('🔐 Checking authentication...');
  
  // Wait for Supabase to initialize if not ready
  let attempts = 0;
  while (!supabaseClient && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized after waiting');
    // Don't redirect immediately - give user a chance to see the page
    console.warn('⚠️ Auth check skipped - Supabase not ready');
    return null;
  }
  
  try {
    const {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error('❌ getSession error:', error.message);
      throw error;
    }
    
    console.log('Session check result:', session ? '✅ Active' : '❌ None');
    
    if (!session) {
      console.log('⚠️ No session found, redirecting...');
      const activePage = document.body?.dataset?.page ?? pageId ?? '';
      if (activePage === 'reservation-v2') {
        window.location.href = `${registerPath}?redirect=reservation-v2.html`;
      } else if (activePage === 'services') {
        window.location.href = `${registerPath}?redirect=services.html`;
      } else {
        window.location.href = loginPath;
      }
      throw new Error('User not authenticated');
    }
    
    console.log('✅ User authenticated:', session.user?.email);
    await applySessionRole(session);
    return session;
  } catch (error) {
    console.error('❌ Auth check error:', error);
    throw error;
  }
}

function isAdminEmail(email = '') {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

async function isAdminFromProfile(userId) {
  if (!supabaseClient || !userId) return false;
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.log('⚠️ Could not fetch profile role:', error.message);
      return false;
    }
    
    return data && (data.role === 'admin' || data.role === 'super_admin' || data.role === 'owner');
  } catch (err) {
    console.error('❌ Error checking admin role from profile:', err);
    return false;
  }
}

async function applySessionRole(session) {
  const logoutBtn = document.getElementById('logout-btn');
  if (session) {
    if (logoutBtn) logoutBtn.style.display = 'block';
    
    // Check both hardcoded list and profiles table
    const isHardcodedAdmin = isAdminEmail(session.user?.email || '');
    const isProfileAdmin = await isAdminFromProfile(session.user?.id);
    
    if (isHardcodedAdmin || isProfileAdmin) {
      document.body.classList.add('is-admin');
      localStorage.setItem('dalight_user_role', 'admin');
      console.log('👑 Admin role applied (hardcoded:', isHardcodedAdmin, ', profile:', isProfileAdmin + ')');
      ensureMobileAdminLink(true);
    } else {
      document.body.classList.remove('is-admin');
      localStorage.removeItem('dalight_user_role');
      ensureMobileAdminLink(false);
    }
  } else {
    if (logoutBtn) logoutBtn.style.display = 'none';
    document.body.classList.remove('is-admin');
    localStorage.removeItem('dalight_user_role');
    ensureMobileAdminLink(false);
  }
}

function ensureMobileAdminLink(isAdmin) {
  const mobileMenu = document.getElementById('spa-mobile-menu') || document.querySelector('.spa-mobile-menu');
  if (!mobileMenu) return;

  const adminHref = isInsidePagesDir ? '../admin/dashboard.html' : './admin/dashboard.html';
  let adminBtn = mobileMenu.querySelector('.spa-mobile-admin-btn') || mobileMenu.querySelector('a.admin-link');

  if (isAdmin) {
    if (!adminBtn) {
      adminBtn = document.createElement('a');
      adminBtn.href = adminHref;
      adminBtn.className = 'admin-link spa-mobile-admin-btn';
      adminBtn.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:0.55rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Panneau Administration
        </span>
        <span class="badge-admin" style="background:rgba(212,175,55,0.25); color:#D4AF37; font-size:0.68rem; padding:0.18rem 0.55rem; border-radius:999px; text-transform:uppercase; font-weight:800; letter-spacing:0.5px; border:1px solid rgba(212,175,55,0.4);">Admin</span>
      `;
      const firstLink = mobileMenu.querySelector('a');
      if (firstLink && firstLink.nextSibling) {
        mobileMenu.insertBefore(adminBtn, firstLink.nextSibling);
      } else {
        mobileMenu.prepend(adminBtn);
      }
    } else {
      adminBtn.href = adminHref;
    }
    adminBtn.style.display = 'flex';
  } else {
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

async function detectSessionRole() {
  console.log('🔍 Detecting session role...');
  
  if (!supabaseClient) {
    console.log('⚠️ Supabase client not ready');
    return;
  }
  
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      console.log('📋 Session found for:', session.user?.email);
      await applySessionRole(session);
      updateNavbarAuth(true);
      
            if (isAdminEmail(session.user?.email || '')) {
        console.log('👑 Admin role detected - showing admin links');
      }
      
      // Check influencer role & display golden badge
      checkAndShowInfluencerLink(session.user?.email || '');
      if (false) {
        console.log('👑 Admin role detected - showing admin links');
      }
    } else {
      console.log('ℹ️ No active session');
      updateNavbarAuth(false);
      document.body.classList.remove('is-admin');
      document.querySelectorAll('.influencer-portal-btn, .mob-inf-link').forEach(el => el.remove());
    }
  } catch (error) {
    console.error('❌ Error detecting session role:', error);
  }
}

function updateNavbarAuth(isLoggedIn) {
  // 1. Clean up any wide auth button from nav-cta to keep navbar perfectly balanced & uncrowded
  const navCta = document.querySelector('.nav-cta') || document.querySelector('.spa-nav-right');
  if (navCta) {
    const existingAuthBtn = navCta.querySelector('.auth-btn');
    if (existingAuthBtn) existingAuthBtn.remove();

    // Circular user icon in navbar triggers Profile Drawer if logged in, or goes to login
    const accountIconBtn = navCta.querySelector('.spa-icon-btn.mobile-auth-link') || 
                           navCta.querySelector('a.spa-icon-btn[aria-label="Compte"]') ||
                           navCta.querySelector('a.spa-icon-btn[title*="Espace"]') ||
                           navCta.querySelector('a.spa-icon-btn[title*="Compte"]');
                           
    if (accountIconBtn) {
      if (isLoggedIn) {
        accountIconBtn.classList.add('logged-in');
        accountIconBtn.title = 'Mon Profil & Rendez-vous';
        accountIconBtn.onclick = (e) => {
          e.preventDefault();
          openUserProfileDrawer();
        };
      } else {
        accountIconBtn.classList.remove('logged-in');
        accountIconBtn.href = loginPath;
        accountIconBtn.title = 'Connexion / Inscription';
        accountIconBtn.onclick = null;
      }
    }
  }

  // 2. Mobile Menu links
  const mobileMenu = document.getElementById('spa-mobile-menu') || document.querySelector('.spa-mobile-menu');
  if (mobileMenu) {
    let drawerAuth = mobileMenu.querySelector('a[href*="login.html"]') || mobileMenu.querySelector('#mobile-drawer-auth');
    if (drawerAuth) {
      drawerAuth.id = 'mobile-drawer-auth';
      if (isLoggedIn) {
        drawerAuth.innerHTML = '<i data-lucide="user" style="width:16px;height:16px;display:inline-block;margin-right:6px;vertical-align:-2px;"></i> Mon Profil &amp; Déconnexion';
        drawerAuth.href = '#';
        drawerAuth.onclick = (e) => {
          e.preventDefault();
          const menu = document.getElementById('spa-mobile-menu');
          if (menu) menu.classList.remove('active');
          openUserProfileDrawer();
        };
      } else {
        drawerAuth.innerHTML = '<i data-lucide="user" style="width:16px;height:16px;display:inline-block;margin-right:6px;vertical-align:-2px;"></i> Connexion / Compte';
        drawerAuth.href = loginPath;
        drawerAuth.onclick = null;
      }
    }
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Global Luxury Profile Drawer (View, Edit Profile, Delete Account, Logout)
export async function openUserProfileDrawer() {
  let overlay = document.getElementById('dalight-profile-overlay');
  const ordersPath = isInsidePagesDir ? './orders.html' : './pages/orders.html';
  const servicesPath = isInsidePagesDir ? './services.html' : './pages/services.html';

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dalight-profile-overlay';
    overlay.className = 'dalight-profile-overlay';
    overlay.innerHTML = `
      <div class="dalight-profile-drawer" id="dalight-profile-drawer">
        <div class="profile-drawer-header">
          <div class="profile-avatar-wrap">
            <div class="profile-avatar-circle" id="drawer-user-initials">D</div>
            <div>
              <h3 id="drawer-user-name" class="profile-drawer-title">Mon Profil</h3>
              <span id="drawer-user-email" class="profile-drawer-email">Chargement...</span>
            </div>
          </div>
          <button type="button" class="profile-close-btn" id="drawer-close-btn" aria-label="Fermer">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="profile-quick-nav">
          <a href="${isInsidePagesDir ? '../admin/dashboard.html' : './admin/dashboard.html'}" class="profile-quick-link profile-admin-quick-link" id="drawer-admin-link" style="display:none; grid-column:1/-1; background:linear-gradient(135deg, rgba(212,175,55,0.22), rgba(153,101,21,0.28)); border:1px solid rgba(212,175,55,0.55); color:#FAF8F5; font-weight:700;">
            <i data-lucide="shield" style="color:#D4AF37;"></i> Panneau Administration DALIGHT
          </a>
          <a href="${ordersPath}" class="profile-quick-link">
            <i data-lucide="calendar"></i> Mes Rendez-vous
          </a>
          <a href="${servicesPath}" class="profile-quick-link">
            <i data-lucide="sparkles"></i> Réserver un Soin
          </a>
        </div>

        <div class="profile-drawer-section">
          <div class="profile-section-title">
            <i data-lucide="user-check"></i> Modifier Mes Informations
          </div>

          <form id="drawer-edit-form" onsubmit="event.preventDefault();">
            <div class="profile-form-group">
              <label for="drawer-input-name">Nom complet *</label>
              <input type="text" id="drawer-input-name" class="profile-input" required placeholder="Ex: Marie Voltaire">
            </div>

            <div class="profile-form-group">
              <label for="drawer-input-phone">Numéro WhatsApp / Téléphone *</label>
              <input type="tel" id="drawer-input-phone" class="profile-input" required placeholder="Ex: +509 3844-1234">
            </div>

            <div class="profile-form-group">
              <label for="drawer-input-email">Adresse Email</label>
              <input type="email" id="drawer-input-email" class="profile-input" readonly disabled style="opacity:0.75;cursor:not-allowed;">
              <small style="color:var(--spa-text-subtle);font-size:0.75rem;margin-top:0.25rem;display:block;">Email sécurisé de votre compte</small>
            </div>

            <div id="drawer-feedback-msg" style="display:none;font-size:0.84rem;margin:0.75rem 0;padding:0.6rem 0.85rem;border-radius:8px;"></div>

            <button type="button" class="btn-profile-primary" id="drawer-btn-save">
              <i data-lucide="check"></i> Enregistrer les modifications
            </button>
          </form>
        </div>

        <div class="profile-drawer-section profile-bottom-section">
          <button type="button" class="btn-profile-logout" id="drawer-btn-logout">
            <i data-lucide="log-out"></i> Se Déconnecter
          </button>

          <div class="profile-danger-box">
            <div class="danger-title">
              <i data-lucide="alert-triangle"></i> Gestion du Compte
            </div>
            <p class="danger-desc">
              Supprimer définitivement votre compte client DALIGHT et effacer vos données enregistrées.
            </p>
            <button type="button" class="btn-profile-danger" id="drawer-btn-delete">
              <i data-lucide="trash-2"></i> Supprimer mon compte
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
    document.getElementById('drawer-close-btn').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    document.getElementById('drawer-btn-save').addEventListener('click', handleSaveProfile);
    document.getElementById('drawer-btn-logout').addEventListener('click', handleLogout);
    document.getElementById('drawer-btn-delete').addEventListener('click', handleDeleteAccount);
  }

  // Populate data
  await loadDrawerData();

  overlay.style.display = 'flex';
  if (window.lucide) lucide.createIcons();
}

if (typeof window !== 'undefined') {
  window.openDalightProfile = openUserProfileDrawer;
}

async function loadDrawerData() {
  let userEmail = '';
  let userName = '';
  let userPhone = '';

  // 1. Check local storage
  try {
    const raw = localStorage.getItem('dalight:user_profile') || localStorage.getItem('dalight_user_profile');
    if (raw) {
      const p = JSON.parse(raw);
      userName = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
      userPhone = p.phone || '';
      userEmail = p.email || '';
    }
  } catch(e){}

  // 2. Check Supabase session
  if (supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        userEmail = session.user.email || userEmail;
        const metaName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
        if (metaName && !userName) userName = metaName;
        if (session.user.user_metadata?.phone && !userPhone) userPhone = session.user.user_metadata.phone;

        // Live from profiles table
        const { data: dbProfile } = await supabaseClient
          .from('profiles')
          .select('full_name, phone, email')
          .eq('id', session.user.id)
          .maybeSingle();

        if (dbProfile) {
          if (dbProfile.full_name) userName = dbProfile.full_name;
          if (dbProfile.phone) userPhone = dbProfile.phone;
          if (dbProfile.email) userEmail = dbProfile.email;
        }
      }
    } catch(e){}
  }

  const nameEl = document.getElementById('drawer-user-name');
  const emailEl = document.getElementById('drawer-user-email');
  const initialsEl = document.getElementById('drawer-user-initials');
  const inputName = document.getElementById('drawer-input-name');
  const inputPhone = document.getElementById('drawer-input-phone');
  const inputEmail = document.getElementById('drawer-input-email');

  if (nameEl) nameEl.textContent = userName || 'Client DALIGHT';
  if (emailEl) emailEl.textContent = userEmail || 'Compte Membre';
  if (initialsEl) initialsEl.textContent = (userName ? userName.charAt(0) : (userEmail ? userEmail.charAt(0) : 'D')).toUpperCase();
  if (inputName) inputName.value = userName || '';
  if (inputPhone) inputPhone.value = userPhone || '';
  if (inputEmail) inputEmail.value = userEmail || '';
}

async function handleSaveProfile() {
  const inputName = document.getElementById('drawer-input-name');
  const inputPhone = document.getElementById('drawer-input-phone');
  const feedback = document.getElementById('drawer-feedback-msg');
  const btn = document.getElementById('drawer-btn-save');

  const newName = inputName?.value.trim();
  const newPhone = inputPhone?.value.trim();

  if (!newName || !newPhone) {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(239, 68, 68, 0.2)';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Veuillez remplir votre nom et numéro de téléphone.';
    }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Enregistrement...';
  if (window.lucide) lucide.createIcons();

  try {
    let userEmail = '';
    let userId = null;

    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        userId = session.user.id;
        userEmail = session.user.email || '';

        // Update profiles table
        await supabaseClient
          .from('profiles')
          .update({
            full_name: newName,
            phone: newPhone,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        // Update auth metadata
        await supabaseClient.auth.updateUser({
          data: { full_name: newName, phone: newPhone }
        });
      }
    }

    // Update localStorage
    const parts = newName.split(/\s+/);
    const profile = {
      fullName: newName,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: userEmail,
      phone: newPhone
    };
    localStorage.setItem('dalight:user_profile', JSON.stringify(profile));

    // Update UI elements
    const nameEl = document.getElementById('drawer-user-name');
    const initialsEl = document.getElementById('drawer-user-initials');
    if (nameEl) nameEl.textContent = newName;
    if (initialsEl) initialsEl.textContent = newName.charAt(0).toUpperCase();

    // If on orders.html, update on-page profile elements
    const pageName = document.getElementById('page-profile-name');
    const pageMeta = document.getElementById('page-profile-meta');
    const pageAvatar = document.getElementById('page-profile-avatar');
    if (pageName) pageName.textContent = newName;
    if (pageMeta) pageMeta.textContent = `${userEmail} · ${newPhone}`;
    if (pageAvatar) pageAvatar.textContent = newName.charAt(0).toUpperCase();

    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(34, 197, 94, 0.2)';
      feedback.style.color = '#4ade80';
      feedback.textContent = 'Vos modifications ont été enregistrées avec succès !';
    }
  } catch (err) {
    console.error('Error saving profile:', err);
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(239, 68, 68, 0.2)';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Erreur lors de la mise à jour : ' + err.message;
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check"></i> Enregistrer les modifications';
    if (window.lucide) lucide.createIcons();
  }
}

async function handleLogout() {
  if (supabaseClient) {
    try { await supabaseClient.auth.signOut(); } catch(e){}
  }
  localStorage.removeItem('dalight:user_profile');
  localStorage.removeItem('dalight_user_profile');
  window.location.href = isInsidePagesDir ? './login.html' : './pages/login.html';
}

async function handleDeleteAccount() {
  const confirmed = window.confirm("Êtes-vous absolument sûr(e) de vouloir supprimer définitivement votre compte DALIGHT ? Cette action est irréversible et effacera vos données personnelles.");
  if (!confirmed) return;

  try {
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        // Delete profile row
        await supabaseClient.from('profiles').delete().eq('id', session.user.id);
        // Anonymize user reservations
        await supabaseClient.from('reservations').update({ user_id: null, notes: '[Compte client supprimé]' }).eq('user_id', session.user.id);
        // Sign out
        await supabaseClient.auth.signOut();
      }
    }
    localStorage.removeItem('dalight:user_profile');
    localStorage.removeItem('dalight_user_profile');
    alert('Votre compte a été supprimé avec succès.');
    window.location.href = isInsidePagesDir ? '../index.html' : './index.html';
  } catch(err) {
    console.error('Error deleting account:', err);
    alert('Erreur: ' + err.message);
  }
}


export function getSupabase() {
  // 🔧 FALLBACK TO GLOBAL for reservation.js compatibility
  return supabaseClient || window.dalightSupabase || null;
}

export function getConfig() {
  return runtimeConfig;
}

export { servicesCatalog };

export function formatDate(date) {
  if (!date) return '';
  // Prevent timezone shift for DATE columns like "2026-04-24"
  // by parsing as local date instead of UTC midnight.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(timeString) {
  const date = new Date(`1970-01-01T${timeString}`);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function watchLogout(buttonId = 'logout-btn') {
  const btn = document.getElementById(buttonId);
  if (!btn || !supabaseClient) return;
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = loginPath;
  });
}

export function isAdminSession(session) {
  return !!session && isAdminEmail(session.user?.email || '');
}

watchLogout();


// Navbar scroll effect for modern luxury navbar
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('spa-navbar') || document.querySelector('.spa-nav-wrapper');
    if (navbar) {
      if (window.scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  }, { passive: true });
}


async function checkAndShowInfluencerLink(userEmail) {
  if (!userEmail || typeof userEmail !== 'string' || !userEmail.trim() || !supabaseClient) {
    document.querySelectorAll('.influencer-portal-btn, .mob-inf-link').forEach(el => el.remove());
    return;
  }
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    const { data: inf } = await supabaseClient
      .from('dalight_influencers')
      .select('id, assigned_code')
      .ilike('email', cleanEmail)
      .maybeSingle();

    const { data: promo } = await supabaseClient
      .from('dalight_promo_codes')
      .select('id, code')
      .ilike('owner_email', cleanEmail)
      .eq('owner_type', 'influencer')
      .maybeSingle();

    if (inf || promo) {
      console.log('⭐ Showing Influencer portal link in navbar');
      const infUrl = isInsidePagesDir ? './influencer.html' : './pages/influencer.html';
      
      // Add to desktop navbar right
      const navCta = document.querySelector('.nav-cta');
      if (navCta && !navCta.querySelector('.influencer-portal-btn')) {
        const infBtn = document.createElement('a');
        infBtn.href = infUrl;
        infBtn.className = 'spa-pill-btn influencer-portal-btn';
        infBtn.style.cssText = 'background: linear-gradient(135deg, #D4AF37, #AA771C) !important; color: #12180C !important; font-weight: 700 !important; border: none !important; margin-right: 0.5rem;';
        infBtn.innerHTML = '<i data-lucide="award" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Espace Influenceur';
        navCta.prepend(infBtn);
      }

      // Add to mobile menu drawer
      const mobMenu = document.getElementById('spa-mobile-menu') || document.querySelector('.spa-mobile-menu');
      if (mobMenu && !mobMenu.querySelector('.mob-inf-link')) {
        const mobLink = document.createElement('a');
        mobLink.href = infUrl;
        mobLink.className = 'mob-inf-link';
        mobLink.style.cssText = 'color: #D4AF37 !important; font-weight: 700 !important;';
        mobLink.innerHTML = '⭐ Espace Influenceur';
        mobMenu.prepend(mobLink);
      }

      if (window.lucide) lucide.createIcons();
    }
  } catch(e) {
    console.warn('checkAndShowInfluencerLink:', e);
  }
}
