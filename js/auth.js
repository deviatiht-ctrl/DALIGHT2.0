import { getSupabase } from './main.js';

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
    
    setMessage(loginMessage, 'success', 'Welcome back! Redirecting...');
    
    // Wait a bit for session to be fully saved
    setTimeout(async () => {
      console.log('🔄 Verifying session before redirect...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('✅ Session verified, redirecting to reservation');
        window.location.href = './reservation.html';
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
    setMessage(registerMessage, 'success', 'Account created! Check your email to verify.');
    registerForm.reset();
    setTimeout(() => {
      window.location.href = './login.html';
    }, 1200);
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
