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

const ADMIN_EMAILS = ['laurorejeanclarens0@gmail.com'];

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
    id: 'rituel-zen-imperial',
    name: 'Rituel Zen Impérial',
    price: 125,
    priceHtg: 15000,
    duration: '90 min',
    priceId: 'price_rituel_zen_imperial',
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
    id: 'rituel-renaissance-4',
    name: 'Rituel Renaissance 4',
    price: 300,
    priceHtg: 35000,
    duration: '4 rituels',
    priceId: 'price_rituel_renaissance_4',
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
    duration: '6 rituels',
    priceId: 'price_cure_vitalite_6',
  },
];

const STORAGE_KEYS = {
  service: 'dalight:selectedRitual',
};

const pageId = document.body?.dataset?.page ?? '';
const isInsidePagesDir = window.location.pathname.includes('/pages/');
const reservationPath = isInsidePagesDir ? './services.html' : './pages/services.html';
const loginPath = isInsidePagesDir ? './login.html' : './pages/login.html';
const protectedPages = new Set(['reservation', 'payment', 'orders', 'admin']);

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
    
    // Try multiple CDN sources
    const cdnSources = [
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

// Initialize Supabase client asynchronously
let supabaseClient = null;

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

async function init() {
  console.log('🚀 Initializing DALIGHT app...');
  
  // Setup UI first (don't wait for Supabase)
  document.body.classList.add('js-enabled');
  setYear();
  setupNavToggle();
  syncMobileNavVisibility();
  handleServiceShortcuts();
  highlightMobileNav();
  
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
  
  console.log('✅ App initialization complete');
  console.log('👑 Is admin?', document.body.classList.contains('is-admin'));
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});

function setYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function setupNavToggle() {
  const nav = document.querySelector('.top-nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) {
    console.error('❌ Nav toggle not found - nav:', nav, 'toggle:', toggle);
    return;
  }
  console.log('✅ Nav toggle found, adding listeners');
  
  // Direct inline handler for testing
  toggle.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🍔 Toggle CLICKED via onclick');
    console.log('📋 nav element:', nav);
    console.log('📋 nav classes before:', nav.className);
    nav.classList.toggle('open');
    console.log('📋 nav classes after:', nav.className);
    console.log('📱 Menu open state:', nav.classList.contains('open'));
  };
  
  // Also add standard event listeners
  function handleToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🍔 Toggle clicked via addEventListener');
    nav.classList.toggle('open');
  }
  
  toggle.addEventListener('click', handleToggle);
  toggle.addEventListener('touchend', handleToggle);
}

function syncMobileNavVisibility() {
  const mobileNav = document.querySelector('.mobile-nav');
  if (!mobileNav) return;
  const shouldDisplay = window.matchMedia('(max-width: 720px)').matches;
  mobileNav.style.display = shouldDisplay ? 'grid' : 'none';
}

function highlightMobileNav() {
  const mobileNav = document.querySelector('.mobile-nav');
  if (!mobileNav || !pageId) return;
  const links = mobileNav.querySelectorAll('a');
  links.forEach((link) => {
    if (link.dataset.page === pageId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
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
    '<option value="" disabled selected>Sélectionnez un rituel</option>' +
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
  
  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized');
    alert('Erè: Supabase pa konekte. Tcheke koneksyon entènèt ou.');
    window.location.href = loginPath;
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
      console.log('⚠️ No session found, redirecting to login');
      window.location.href = loginPath;
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
    
    return data && data.role === 'admin';
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
      console.log('👑 Admin role applied (hardcoded:', isHardcodedAdmin, ', profile:', isProfileAdmin + ')');
    } else {
      document.body.classList.remove('is-admin');
    }
  } else {
    if (logoutBtn) logoutBtn.style.display = 'none';
    document.body.classList.remove('is-admin');
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
    } else {
      console.log('ℹ️ No active session');
      updateNavbarAuth(false);
    }
  } catch (error) {
    console.error('❌ Error detecting session role:', error);
  }
}

function updateNavbarAuth(isLoggedIn) {
  const navCta = document.querySelector('.nav-cta');
  if (!navCta) return;
  
  // Check if auth button already exists to avoid duplicates
  const existingAuthBtn = navCta.querySelector('.auth-btn');
  if (existingAuthBtn) {
    existingAuthBtn.remove(); // Remove old auth button before adding new one
  }
  
  // Create the auth button HTML
  let authHtml = '';
  if (isLoggedIn) {
    authHtml = `
      <button class="btn ghost auth-btn" id="navbar-logout-btn" type="button">
        <i data-lucide="log-out" style="width:16px;height:16px;"></i> Déconnecter
      </button>
    `;
  } else {
    authHtml = `
      <a class="btn ghost auth-btn" href="./pages/login.html">
        <i data-lucide="user" style="width:16px;height:16px;"></i> Connexion
      </a>
    `;
  }
  
  // Append auth button to nav-cta (adds to existing buttons like Reserve)
  navCta.insertAdjacentHTML('beforeend', authHtml);
  
  // Add logout handler if logged in
  if (isLoggedIn) {
    const logoutBtn = document.getElementById('navbar-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = './pages/login.html';
      });
    }
  }
  
  // Re-init icons
  if (window.lucide) {
    lucide.createIcons();
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

