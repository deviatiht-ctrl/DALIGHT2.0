import { getSupabase } from './main.js?v=5.0.0';

// Get Supabase client - but it might not be initialized yet
let supabase = getSupabase();

// If supabase is not ready yet, wait for it
async function waitForSupabase() {
  let attempts = 0;
  while (!supabase && attempts < 50) {
    console.log('⏳ Waiting for Supabase to initialize...');
    await new Promise(resolve => setTimeout(resolve, 100));
    supabase = getSupabase();
    attempts++;
  }
  
  if (!supabase) {
    console.error('❌ Supabase failed to initialize after 5 seconds');
    return false;
  }
  
  console.log('✅ Supabase client available in auth.js');
  return true;
}

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');

function setMessage(target, type, text) {
  if (!target) return;
  target.className = `alert ${type}`;
  target.textContent = text;
}

async function handleLogin(event) {
  event.preventDefault();
  
  console.log('🔐 Login attempt started');
  
  // Wait for Supabase to be initialized
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not available');
    setMessage(loginMessage, 'error', 'Supabase is not configured. Check console for details.');
    return;
  }
  
  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const password = formData.get('password');

  console.log('📧 Attempting login for:', email);
  setMessage(loginMessage, 'success', 'Signing in...');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error('❌ Login failed:', error.message);
      setMessage(loginMessage, 'error', error.message);
      return;
    }
    
    console.log('✅ Login successful:', data.user?.email);
    console.log('📋 Session:', data.session ? 'Created' : 'Not created');
    
    // Sync profile from Supabase profiles table to localStorage instantly
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (profileData) {
        const nameParts = (profileData.full_name || '').split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const profile = {
          fullName: profileData.full_name || '',
          firstName,
          lastName,
          email: profileData.email || data.user.email || '',
          phone: profileData.phone || '',
          address: profileData.address || '',
          registeredAt: profileData.created_at || new Date().toISOString()
        };
        localStorage.setItem('dalight:user_profile', JSON.stringify(profile));
        console.log('🔄 Login profile synced successfully to localStorage:', profile);
      }
    } catch (err) {
      console.warn('Could not sync user profile on login:', err);
    }
    
    setMessage(loginMessage, 'success', 'Welcome back! Redirecting...');
    
    // Wait a bit for session to be fully saved
    setTimeout(async () => {
      console.log('🔄 Verifying session before redirect...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('✅ Session verified, checking redirect...');
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        if (redirect) {
          window.location.href = `./${redirect}`;
        } else {
          window.location.href = './services.html';
        }
      } else {
        console.error('❌ Session not found after login');
        setMessage(loginMessage, 'error', 'Erè: Session pa kreye. Eseye ankò.');
      }
    }, 800);
  } catch (err) {
    console.error('❌ Unexpected error during login:', err);
    setMessage(loginMessage, 'error', 'Erè enprevi: ' + err.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  
  console.log('📝 Register attempt started');
  
  // Wait for Supabase to be initialized
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not available');
    setMessage(registerMessage, 'error', 'Supabase is not configured. Check console for details.');
    return;
  }
  
  const formData = new FormData(registerForm);
  const email = formData.get('email');
  const password = formData.get('password');
  const fullName = formData.get('full_name');

  console.log('📧 Attempting registration for:', email);
  setMessage(registerMessage, 'success', 'Creating your profile...');

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      console.error('❌ Registration failed:', error.message);
      setMessage(registerMessage, 'error', error.message);
      return;
    }

    console.log('✅ Registration successful');
    
    // Save user profile locally instantly for auto-fill bookings & checkout
    try {
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const phone = formData.get('phone') || '';
      
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
      console.log('🔄 Registration profile saved successfully to localStorage:', profile);
    } catch (err) {
      console.warn('Could not save registration profile to localStorage:', err);
    }

    // AUTOMATIC LOGIN AFTER REGISTRATION
    setMessage(registerMessage, 'success', 'Compte créé ! Connexion automatique en cours...');
    
    try {
      console.log('🔐 Performing automatic background sign-in...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (!signInError && signInData?.session) {
        console.log('✅ Auto-signin successful!');
        setMessage(registerMessage, 'success', 'Connexion réussie ! Redirection en cours...');
        
        // Wait a bit for session to populate and redirect
        setTimeout(() => {
          const urlParams = new URLSearchParams(window.location.search);
          const redirect = urlParams.get('redirect');
          if (redirect) {
            window.location.href = `./${redirect}`;
          } else {
            window.location.href = './services.html';
          }
        }, 1000);
        return;
      }
    } catch (signInErr) {
      console.warn('Auto-login failed in background:', signInErr);
    }

    // Fallback if auto-login fails (e.g. email confirmation required)
    setMessage(registerMessage, 'success', 'Compte créé ! Veuillez vérifier vos e-mails pour valider votre compte.');
    registerForm.reset();
    setTimeout(() => {
      window.location.href = './login.html';
    }, 2000);
  } catch (err) {
    console.error('❌ Unexpected error during registration:', err);
    setMessage(registerMessage, 'error', 'Erè enprevi: ' + err.message);
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
  registerForm.addEventListener('submit', handleRegister);
}
