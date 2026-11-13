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
    /* Premium Alert Banner Styling — Compact & High Contrast */
    .dl-alert-banner {
      background: linear-gradient(90deg, #182010 0%, #222b17 50%, #182010 100%) !important;
      color: #FAF8F5 !important;
      border-bottom: 1px solid rgba(212, 175, 55, 0.35) !important;
      padding: 0.45rem 2.5rem 0.45rem 1rem;
      position: relative;
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: var(--spa-font-sans, 'Outfit', sans-serif);
      font-size: 0.8rem;
      font-weight: 400;
      text-align: center;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
      opacity: 0;
      transform: translateY(-100%);
      transition: all 0.45s cubic-bezier(0.19, 1, 0.22, 1);
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
      gap: 0.65rem;
      flex-wrap: wrap;
      width: 100%;
      max-width: 1100px;
    }

    .dl-alert-text {
      margin: 0;
      color: #FAF8F5 !important;
      font-size: 0.8rem !important;
      line-height: 1.35;
    }

    .dl-alert-text strong {
      color: #D4AF37 !important;
      font-weight: 600;
    }

    .dl-alert-buttons {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    /* Compact Pill Buttons */
    .dl-alert-btn {
      background: rgba(212, 175, 55, 0.15);
      color: #D4AF37 !important;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.74rem;
      font-weight: 600;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      transition: all 0.2s ease;
      text-decoration: none !important;
      border: 1px solid rgba(212, 175, 55, 0.35);
      cursor: pointer;
    }

    .dl-alert-btn:hover {
      background: #D4AF37;
      border-color: #D4AF37;
      color: #12180c !important;
      transform: translateY(-1px);
    }

    .dl-alert-btn.primary {
      background: #D4AF37;
      color: #12180c !important;
      border-color: #D4AF37;
    }

    .dl-alert-btn.primary:hover {
      background: #FAF8F5;
      color: #12180c !important;
      border-color: #FAF8F5;
    }

    /* Subtle Close Button */
    .dl-alert-close {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: rgba(250, 248, 245, 0.75);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .dl-alert-close:hover {
      color: #FAF8F5;
      background: rgba(255, 255, 255, 0.1);
    }

    .dl-alert-close i,
    .dl-alert-close svg {
      width: 15px;
      height: 15px;
    }

    /* Compact Mobile Styling */
    @media (max-width: 768px) {
      .dl-alert-banner {
        font-size: 0.74rem;
        padding: 0.4rem 2rem 0.4rem 0.75rem;
      }
      
      .dl-alert-content {
        gap: 0.35rem;
      }

      .dl-alert-text {
        font-size: 0.74rem !important;
      }
      
      .dl-alert-btn {
        padding: 0.2rem 0.55rem;
        font-size: 0.7rem;
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
        <p class="dl-alert-text">
          Nouveau chez <strong>DALIGHT</strong> ? Planifiez vos soins de détente :
        </p>
        <div class="dl-alert-buttons">
          <a href="${registerUrl}" class="dl-alert-btn primary">Créer un compte</a>
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

  const dismissBanner = () => {
    sessionStorage.setItem('dalight:popup_dismissed', 'true');
    banner.classList.remove('active');
    setTimeout(() => {
      banner.remove();
    }, 450);
  };

  // Smooth slide down animation
  requestAnimationFrame(() => {
    banner.classList.add('active');
  });

  // User click close
  closeBtn.addEventListener('click', dismissBanner);

  // Auto-dismiss after 7.5 seconds so it doesn't stay permanently
  const autoTimer = setTimeout(() => {
    if (document.body.contains(banner)) {
      dismissBanner();
    }
  }, 7500);

  // Clear autoTimer if user interacts
  closeBtn.addEventListener('click', () => clearTimeout(autoTimer));
}
