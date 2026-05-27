/**
 * DALIGHT - Premium Navbar Announcement Banner Module
 * Injects a highly responsive, mobile-optimized banner at the very top of the page.
 * Prompts new users to register or login with clear, tap-friendly buttons to simplify bookings & purchases.
 */

const isInsidePages = window.location.pathname.includes('/pages/');

export function initRegistrationPopup() {
  // 1. Exclude banner on login, register, and admin pages
  const currentPath = window.location.pathname.toLowerCase();
  const excludedPages = ['login.html', 'register.html', 'admin.html', 'admin/'];
  if (excludedPages.some(page => currentPath.includes(page))) {
    console.log('ℹ️ Banner skipped on this page.');
    return;
  }

  // 2. Check if the user already dismissed the banner for this session
  const sessionDismissed = sessionStorage.getItem('dalight:popup_dismissed');

  if (sessionDismissed === 'true') {
    console.log('ℹ️ Banner dismissed for this session.');
    return;
  }

  // Wait 1.5 seconds and display the elegant announcement banner
  setTimeout(async () => {
    // Perform an asynchronous check for Supabase session just in case
    try {
      const sb = window.dalightSupabase || window.supabaseClient;
      if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) {
          console.log('ℹ️ Active Supabase session found, skipping banner.');
          
          // Sync Supabase Database profiles table to localStorage to keep user data updated
          await syncSupabaseProfile(sb, session.user);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not check Supabase session for banner:', e);
    }

    // Double check to prevent double render
    if (sessionStorage.getItem('dalight:popup_dismissed')) {
      return;
    }

    injectStyles();
    injectBanner();
  }, 1500);
}

// Syncs Supabase database profile to localStorage
async function syncSupabaseProfile(sb, user) {
  try {
    const { data: profileData, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (profileData && !error) {
      const nameParts = (profileData.full_name || '').split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const profile = {
        fullName: profileData.full_name || '',
        firstName,
        lastName,
        email: profileData.email || user.email || '',
        phone: profileData.phone || '',
        address: profileData.address || '',
        registeredAt: profileData.created_at || new Date().toISOString()
      };
      
      localStorage.setItem('dalight:user_profile', JSON.stringify(profile));
      console.log('🔄 Synced Supabase profiles table to localStorage:', profile);
    }
  } catch (syncErr) {
    console.warn('Failed to sync profile database to local storage:', syncErr);
  }
}

// Injects custom CSS styling for the luxury top banner
function injectStyles() {
  if (document.getElementById('dalight-banner-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'dalight-banner-styles';
  styleEl.textContent = `
    /* Premium Alert Banner Styling */
    .dl-alert-banner {
      background: linear-gradient(90deg, #D4AF37 0%, #f6e3a2 50%, #b89326 100%);
      color: #2A1A0A !important;
      border-bottom: 2px solid rgba(184, 147, 38, 0.4);
      padding: 0.75rem 3rem 0.75rem 1.5rem;
      position: relative;
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.88rem;
      font-weight: 500;
      text-align: center;
      box-shadow: 0 4px 15px rgba(45, 30, 20, 0.08);
      opacity: 0;
      transform: translateY(-100%);
      transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      width: 100%;
      box-sizing: border-box;
    }

    .dl-alert-banner.active {
      opacity: 1;
      transform: translateY(0);
    }

    .dl-alert-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      width: 100%;
      max-width: 1200px;
    }

    .dl-alert-text {
      margin: 0;
      color: #2A1A0A !important;
      line-height: 1.4;
    }

    .dl-alert-text strong {
      font-weight: 700;
    }

    .dl-alert-buttons {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    /* Premium Tactile Buttons for Mobile/Desktop Touch Targets */
    .dl-alert-btn {
      background: #2A1A0A;
      color: #D4AF37 !important;
      padding: 0.35rem 0.9rem;
      border-radius: 30px;
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      box-shadow: 0 3px 6px rgba(0,0,0,0.16);
      transition: all 0.25s ease;
      text-decoration: none !important;
      border: 1px solid #2A1A0A;
      cursor: pointer;
    }

    .dl-alert-btn:hover {
      background: #4A3728;
      border-color: #4A3728;
      color: #ffffff !important;
      transform: translateY(-1px);
      box-shadow: 0 5px 12px rgba(42, 26, 10, 0.25);
    }

    .dl-alert-btn:active {
      transform: translateY(0);
    }

    /* Elegant Close Button */
    .dl-alert-close {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #2A1A0A;
      cursor: pointer;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .dl-alert-close:hover {
      background: rgba(42, 26, 10, 0.12);
      transform: rotate(90deg);
    }

    .dl-alert-close i {
      width: 16px;
      height: 16px;
    }

    /* Highly Adaptable Mobile Styling */
    @media (max-width: 768px) {
      .dl-alert-banner {
        font-size: 0.82rem;
        padding: 0.8rem 2.75rem 0.8rem 1rem;
      }
      
      .dl-alert-content {
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .dl-alert-buttons {
        margin-top: 0.1rem;
      }
      
      .dl-alert-btn {
        padding: 0.4rem 1rem; /* Even larger touch target on mobile */
        font-size: 0.8rem;
      }
    }
  `;
  document.head.appendChild(styleEl);
}

// Injects the banner element at the very top of document.body
function injectBanner() {
  if (document.getElementById('dalight-alert-banner')) return;

  const registerUrl = isInsidePages ? './register.html' : './pages/register.html';
  const loginUrl = isInsidePages ? './login.html' : './pages/login.html';

  const bannerHtml = `
    <div class="dl-alert-banner" id="dalight-alert-banner" role="alert">
      <div class="dl-alert-content">
        <span class="dl-alert-icon">✨</span>
        <p class="dl-alert-text">
          Nouveau chez <strong>DALIGHT</strong> ? Pour planifier vos rituels bien-être et simplifier vos achats :
        </p>
        <div class="dl-alert-buttons">
          <a href="${registerUrl}" class="dl-alert-btn">Créer un compte</a>
          <span style="font-size: 0.78rem; opacity: 0.7; font-weight: 600; color: #2A1A0A;">ou</span>
          <a href="${loginUrl}" class="dl-alert-btn">Se connecter</a>
        </div>
      </div>
      <button class="dl-alert-close" id="dl-alert-close-btn" aria-label="Fermer">
        <i data-lucide="x"></i>
      </button>
    </div>
  `;

  // Prepend to document.body so it sits cleanly at the very top
  document.body.insertAdjacentHTML('afterbegin', bannerHtml);

  // Initialize Lucide icon inside banner
  if (window.lucide) {
    lucide.createIcons();
  }

  const banner = document.getElementById('dalight-alert-banner');
  const closeBtn = document.getElementById('dl-alert-close-btn');

  // Smooth slide down animation
  requestAnimationFrame(() => {
    banner.classList.add('active');
  });

  closeBtn.addEventListener('click', () => {
    sessionStorage.setItem('dalight:popup_dismissed', 'true');
    banner.classList.remove('active');
    setTimeout(() => {
      banner.remove();
    }, 500);
  });
}
