/**
 * DALIGHT - Luxury Registration Pop-up Module
 * Injects a beautiful, modern glassmorphism registration modal for new users,
 * saving details locally to provide a seamless autofill booking and shopping experience.
 */

// Helper to determine if we are inside the /pages/ subdirectory
const isInsidePages = window.location.pathname.includes('/pages/');

// Path resolution helper
function getResolvePath(targetPath) {
  if (isInsidePages) {
    return targetPath.startsWith('../') ? targetPath : `../${targetPath}`;
  } else {
    return targetPath.replace(/^\.\.\//, './');
  }
}

export function initRegistrationPopup() {
  // 1. Exclude the pop-up on login, register, and admin pages to prevent annoying the user
  const currentPath = window.location.pathname.toLowerCase();
  const excludedPages = ['login.html', 'register.html', 'admin.html', 'admin/'];
  if (excludedPages.some(page => currentPath.includes(page))) {
    console.log('ℹ️ Registration pop-up skipped on this page.');
    return;
  }

  // 2. Check if the user is already registered (local storage or active Supabase session)
  const localProfile = localStorage.getItem('dalight:user_profile');
  const sessionDismissed = sessionStorage.getItem('dalight:popup_dismissed');

  if (localProfile || sessionDismissed === 'true') {
    console.log('ℹ️ User has profile or already dismissed popup for this session.');
    return;
  }

  // Delay the pop-up by 2.5 seconds to give the page time to load and allow a premium entrance
  setTimeout(async () => {
    // Perform an asynchronous check for Supabase session just in case
    try {
      const sb = window.dalightSupabase || window.supabaseClient;
      if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) {
          console.log('ℹ️ Active Supabase session found, skipping registration pop-up.');
          return;
        }
      }
    } catch (e) {
      console.warn('Could not check Supabase session for popup:', e);
    }

    // Double check that we didn't show it already or store it during the delay
    if (localStorage.getItem('dalight:user_profile') || sessionStorage.getItem('dalight:popup_dismissed')) {
      return;
    }

    injectStyles();
    injectModal();
  }, 2500);
}

// Injects the premium styling for the glassmorphism modal
function injectStyles() {
  if (document.getElementById('dalight-popup-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'dalight-popup-styles';
  styleEl.textContent = `
    /* Modal Wrapper Backdrop */
    .dl-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(30, 21, 14, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      padding: 1.5rem;
    }

    .dl-modal-overlay.active {
      opacity: 1;
    }

    /* Modal Card */
    .dl-modal-card {
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(212, 175, 55, 0.35);
      border-radius: 20px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 50px rgba(45, 30, 20, 0.15), 
                  0 0 0 1px rgba(212, 175, 55, 0.1) inset;
      padding: 2.5rem;
      position: relative;
      transform: translateY(40px) scale(0.95);
      transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
      color: #4A3728;
      overflow: hidden;
    }

    /* Soft Luxury Glow Background */
    .dl-modal-card::before {
      content: '';
      position: absolute;
      top: -150px;
      right: -150px;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }

    .dl-modal-overlay.active .dl-modal-card {
      transform: translateY(0) scale(1);
    }

    /* Close Button */
    .dl-modal-close-btn {
      position: absolute;
      top: 1.25rem;
      right: 1.25rem;
      background: none;
      border: none;
      color: #8b7355;
      cursor: pointer;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
      z-index: 10;
    }

    .dl-modal-close-btn:hover {
      background: rgba(74, 55, 40, 0.08);
      color: #4A3728;
      transform: rotate(90deg);
    }

    /* Brand Header */
    .dl-modal-header {
      text-align: center;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .dl-modal-logo {
      width: 70px;
      height: 70px;
      object-fit: contain;
      margin-bottom: 1rem;
      filter: drop-shadow(0 4px 10px rgba(212, 175, 55, 0.2));
    }

    .dl-modal-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.8rem;
      font-weight: 700;
      color: #4A3728;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }

    .dl-modal-subtitle {
      font-family: 'Montserrat', sans-serif;
      font-size: 0.9rem;
      line-height: 1.5;
      color: #7a6655;
      max-width: 90%;
      margin: 0 auto;
    }

    /* Forms */
    .dl-modal-form {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .dl-input-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .dl-input-group label {
      font-family: 'Montserrat', sans-serif;
      font-size: 0.8rem;
      font-weight: 600;
      color: #5c4737;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .dl-input-wrapper {
      position: relative;
    }

    .dl-input-wrapper i {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #8b7355;
      width: 18px;
      height: 18px;
      pointer-events: none;
    }

    .dl-input-field {
      width: 100%;
      padding: 0.875rem 1rem 0.875rem 2.75rem;
      border: 1px solid rgba(74, 55, 40, 0.18);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.7);
      color: #4A3728;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.95rem;
      transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
    }

    .dl-input-field:focus {
      outline: none;
      border-color: #D4AF37;
      background: #ffffff;
      box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
    }

    .dl-input-field::placeholder {
      color: #a89687;
    }

    /* Primary Gold Button */
    .dl-btn-submit {
      background: linear-gradient(135deg, #4A3728 0%, #302014 100%);
      border: 1px solid #4A3728;
      color: #ffffff !important;
      padding: 1rem;
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 1rem;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      box-shadow: 0 4px 15px rgba(74, 55, 40, 0.15);
      margin-top: 0.5rem;
    }

    .dl-btn-submit:hover {
      background: linear-gradient(135deg, #D4AF37 0%, #b89326 100%);
      border-color: #D4AF37;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(212, 175, 55, 0.25);
    }

    .dl-btn-submit:active {
      transform: translateY(0);
    }

    /* Secondary Dismiss Button */
    .dl-btn-dismiss {
      background: none;
      border: none;
      color: #8b7355;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      margin-top: 0.25rem;
      transition: color 0.2s;
      text-decoration: underline;
      text-underline-offset: 4px;
    }

    .dl-btn-dismiss:hover {
      color: #4A3728;
    }

    /* Success State View */
    .dl-success-state {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 1.5rem 0;
      animation: dlFadeScaleIn 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    }

    @keyframes dlFadeScaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .dl-success-icon-wrapper {
      width: 76px;
      height: 76px;
      background: rgba(34, 197, 94, 0.1);
      border: 2px solid #22c55e;
      color: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 25px rgba(34, 197, 94, 0.15);
    }

    .dl-success-icon-wrapper i {
      width: 36px;
      height: 36px;
    }

    .dl-success-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.8rem;
      font-weight: 700;
      color: #22c55e;
      margin-bottom: 0.75rem;
    }

    .dl-success-text {
      font-family: 'Montserrat', sans-serif;
      font-size: 0.95rem;
      color: #5c4737;
      line-height: 1.6;
      max-width: 90%;
    }
  `;
  document.head.appendChild(styleEl);
}

// Injects and handles the pop-up modal
function injectModal() {
  if (document.getElementById('dalight-registration-modal')) return;

  const logoUrl = getResolvePath('assets/images/logodaligth.png?v=2');

  const modalHtml = `
    <div class="dl-modal-overlay" id="dalight-registration-modal">
      <div class="dl-modal-card" role="dialog" aria-modal="true" aria-labelledby="dl-title">
        <button class="dl-modal-close-btn" id="dl-close-x" aria-label="Fermer">
          <i data-lucide="x"></i>
        </button>

        <!-- Dynamic Form View -->
        <div id="dl-form-view">
          <div class="dl-modal-header">
            <img class="dl-modal-logo" src="${logoUrl}" alt="DALIGHT Logo">
            <h2 class="dl-modal-title" id="dl-title">Créez votre Profil</h2>
            <p class="dl-modal-subtitle">Inscrivez-vous en quelques secondes pour planifier vos rituels Head Spa et simplifier vos achats.</p>
          </div>

          <form class="dl-modal-form" id="dl-popup-form">
            <div class="dl-input-group">
              <label for="dl-name-field">Nom Complet *</label>
              <div class="dl-input-wrapper">
                <i data-lucide="user"></i>
                <input type="text" id="dl-name-field" class="dl-input-field" placeholder="Ex: Jean Dupont" required autocomplete="name">
              </div>
            </div>

            <div class="dl-input-group">
              <label for="dl-email-field">Adresse E-mail *</label>
              <div class="dl-input-wrapper">
                <i data-lucide="mail"></i>
                <input type="email" id="dl-email-field" class="dl-input-field" placeholder="Ex: jean.dupont@gmail.com" required autocomplete="email">
              </div>
            </div>

            <div class="dl-input-group">
              <label for="dl-phone-field">Téléphone (WhatsApp) *</label>
              <div class="dl-input-wrapper">
                <i data-lucide="phone"></i>
                <input type="tel" id="dl-phone-field" class="dl-input-field" placeholder="Ex: +509 4747 7221" required autocomplete="tel">
              </div>
            </div>

            <button type="submit" class="dl-btn-submit">
              <i data-lucide="sparkles"></i> Créer mon profil
            </button>
            
            <button type="button" class="dl-btn-dismiss" id="dl-close-btn">
              Plus tard, merci
            </button>
          </form>
        </div>

        <!-- Success View (Hidden initially) -->
        <div id="dl-success-view" class="dl-success-state">
          <div class="dl-success-icon-wrapper">
            <i data-lucide="check-circle-2"></i>
          </div>
          <h3 class="dl-success-title">Profil Activé !</h3>
          <p class="dl-success-text">Votre compte a été préparé avec succès. Vos informations seront pré-remplies lors de votre réservation ou commande.</p>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Initialize Lucide icons inside the modal
  if (window.lucide) {
    lucide.createIcons();
  }

  const overlay = document.getElementById('dalight-registration-modal');
  const closeX = document.getElementById('dl-close-x');
  const closeBtn = document.getElementById('dl-close-btn');
  const form = document.getElementById('dl-popup-form');

  // Smooth entrance
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // Close handlers
  function dismissModal() {
    sessionStorage.setItem('dalight:popup_dismissed', 'true');
    closeModal();
  }

  function closeModal() {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
    }, 500);
  }

  closeX.addEventListener('click', dismissModal);
  closeBtn.addEventListener('click', dismissModal);
  
  // Close if clicking outside the modal card
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      dismissModal();
    }
  });

  // Handle Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const fullName = document.getElementById('dl-name-field').value.trim();
    const email = document.getElementById('dl-email-field').value.trim();
    const phone = document.getElementById('dl-phone-field').value.trim();

    if (!fullName || !email || !phone) return;

    // Smart-split the full name into firstName and lastName for reservation-v2.html compatibility
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create the premium local user profile object
    const profile = {
      fullName,
      firstName,
      lastName,
      email,
      phone,
      address: '',
      registeredAt: new Date().toISOString()
    };

    localStorage.setItem('dalight:user_profile', JSON.stringify(profile));

    // Instantly pre-fill the form on the active page if they are currently inside reservation or checkout!
    prefillCurrentPageForm(profile);

    // Show beautiful success animation state
    document.getElementById('dl-form-view').style.display = 'none';
    document.getElementById('dl-success-view').style.display = 'flex';

    if (window.toast) {
      toast.success('Profil enregistré', 'Vos informations ont été sauvegardées localement.');
    }

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      closeModal();
    }, 2200);
  });
}

// Seamlessly pre-fills fields on the current active page
function prefillCurrentPageForm(profile) {
  const page = document.body?.dataset?.page ?? '';
  console.log('🔄 Autoinjecting details into current page form. Page ID:', page);

  if (page === 'reservation-v2') {
    const emailField = document.getElementById('email');
    const firstNameField = document.getElementById('first-name');
    const lastNameField = document.getElementById('last-name');
    const phoneField = document.getElementById('phone');

    if (emailField && !emailField.value) emailField.value = profile.email;
    if (firstNameField && !firstNameField.value) firstNameField.value = profile.firstName;
    if (lastNameField && !lastNameField.value) lastNameField.value = profile.lastName;
    if (phoneField && !phoneField.value) phoneField.value = profile.phone;

    console.log('✅ Prefilled reservation-v2 fields instantly.');
  } else if (page === 'checkout') {
    const emailField = document.getElementById('customer-email');
    const nameField = document.getElementById('customer-name');
    const phoneField = document.getElementById('customer-phone');

    if (emailField && !emailField.value) emailField.value = profile.email;
    if (nameField && !nameField.value) nameField.value = profile.fullName;
    if (phoneField && !phoneField.value) phoneField.value = profile.phone;

    console.log('✅ Prefilled checkout fields instantly.');
  }
}
