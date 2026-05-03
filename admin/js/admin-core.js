// ============================================
// DALIGHT HEAD SPA - ADMIN CORE
// Shared functionality for all admin pages
// ============================================

const SUPABASE_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
const ADMIN_EMAILS = ['laurorejeanclarens0@gmail.com'];

// Initialize Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🚀 GLOBAL READY SIGNALS - Fix admin timing issue
window.dalightAdminSupabase = supabaseClient;
window.dalightAdminReady = true;

// Export for use in other modules  
window.supabaseClient = supabaseClient;
console.log('✅ Admin core: window.dalightAdminSupabase + window.dalightAdminReady=true');
window.ADMIN_EMAILS = ADMIN_EMAILS;

// Create adminCore object for pages that expect it (reservations.js compatibility)
window.adminCore = {
  supabase: supabaseClient,
  showToast: function(message, type = 'success') {
    // Simple toast fallback if showToast doesn't exist globally
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
      // You can add a simple alert fallback for critical errors
      if (type === 'error') {
        alert(message);
      }
    }
  }
};
console.log('✅ Admin core: window.adminCore initialized with supabase');

// ============================================
// AUTH CHECK
// ============================================

async function isAdminFromProfile(userId) {
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

async function checkAdminAuth() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
      redirectToLogin();
      return null;
    }
    
    const userEmail = session.user.email;
    const userId = session.user.id;
    
    // Check both hardcoded list and profiles table
    const isHardcodedAdmin = ADMIN_EMAILS.includes(userEmail);
    const isProfileAdmin = await isAdminFromProfile(userId);
    
    console.log('👑 Admin check - hardcoded:', isHardcodedAdmin, ', profile:', isProfileAdmin);
    
    if (!isHardcodedAdmin && !isProfileAdmin) {
      alert('Accès refusé. Vous n\'êtes pas administrateur.');
      window.location.href = '../index.html';
      return null;
    }
    
    // Update UI with user info
    updateUserInfo(session.user);
    
    return session;
  } catch (err) {
    console.error('Auth check error:', err);
    redirectToLogin();
    return null;
  }
}

function redirectToLogin() {
  window.location.href = '../pages/login.html';
}

function updateUserInfo(user) {
  const userName = document.getElementById('user-name');
  const userAvatar = document.getElementById('user-avatar');
  
  if (userName) {
    userName.textContent = user.email.split('@')[0];
  }
  
  if (userAvatar) {
    userAvatar.textContent = user.email.charAt(0).toUpperCase();
  }
}

// ============================================
// SIDEBAR & NAVIGATION
// ============================================

function initSidebar() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      }
    });
  }
}

// ============================================
// LOGOUT
// ============================================

function initLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = '../index.html';
    });
  }
}

// ============================================
// UTILITIES
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Prevent timezone shift for DATE strings like "2026-04-24"
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function formatCurrency(amount, currency = 'USD') {
  if (currency === 'HTG') {
    return `${Number(amount).toLocaleString()} HTG`;
  }
  return `$${Number(amount).toFixed(2)}`;
}

function getStatusBadge(status) {
  const statusMap = {
    'PENDING': { class: 'pending', text: 'En attente' },
    'CONFIRMED': { class: 'confirmed', text: 'Confirmé' },
    'COMPLETED': { class: 'completed', text: 'Terminé' },
    'CANCELLED': { class: 'cancelled', text: 'Annulé' },
    'NO_SHOW': { class: 'cancelled', text: 'Absent' }
  };
  
  const info = statusMap[status] || { class: 'pending', text: status };
  return `<span class="status-badge ${info.class}">${info.text}</span>`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function showToast(message, type = 'success') {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    `;
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 
                  type === 'error' ? 'rgba(248, 113, 113, 0.15)' : 
                  'rgba(251, 191, 36, 0.15)';
  const borderColor = type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 
                      type === 'error' ? 'rgba(248, 113, 113, 0.3)' : 
                      'rgba(251, 191, 36, 0.3)';
  const textColor = type === 'success' ? '#4ade80' : 
                    type === 'error' ? '#f87171' : 
                    '#fbbf24';
  
  toast.style.cssText = `
    background: ${bgColor};
    border: 1px solid ${borderColor};
    color: ${textColor};
    padding: 1rem 1.5rem;
    border-radius: 12px;
    backdrop-filter: blur(20px);
    animation: slideIn 0.3s ease;
    font-weight: 500;
  `;
  toast.textContent = message;
  
  // Add animation keyframes
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// EMAIL TEMPLATE LOADER (DB)
// ============================================

let _adminTplCache = null;
let _adminTplTime = 0;
const _ADMIN_TPL_TTL = 5 * 60 * 1000;

async function loadEmailTemplates() {
  if (_adminTplCache && Date.now() - _adminTplTime < _ADMIN_TPL_TTL) return _adminTplCache;
  try {
    const { data, error } = await supabaseClient.from('email_templates').select('*').eq('is_active', true);
    if (error) {
      console.warn('email_templates query error (table may not exist yet):', error.message);
      return null;
    }
    if (data && data.length > 0) {
      _adminTplCache = {};
      data.forEach(t => { _adminTplCache[t.template_key] = t; });
      _adminTplTime = Date.now();
      console.log('✅ Email templates loaded from DB:', Object.keys(_adminTplCache));
      return _adminTplCache;
    }
    console.warn('email_templates table exists but is empty');
    return null;
  } catch(e) {
    console.warn('email_templates load failed (using hardcoded fallback):', e.message || e);
    return null;
  }
}

function tplReplaceVars(str, vars) {
  if (!str) return '';
  let out = str;
  Object.entries(vars).forEach(([k, v]) => { out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || ''); });
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => vars[key] ? content : '');
  return out;
}

function buildFromDBTemplate(tpl, vars) {
  const accent = tpl.accent_color || '#D4AF37';
  const headerBg = tpl.header_bg || 'linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%)';
  const logoUrl = tpl.logo_url || '';
  const headerTitle = tplReplaceVars(tpl.header_title || 'DALIGHT Head Spa', vars);
  const headerSubtitle = tplReplaceVars(tpl.header_subtitle || '', vars);
  const greeting = tplReplaceVars(tpl.greeting || '', vars);
  const body = tplReplaceVars(tpl.body_html || '', vars);
  const footer = tplReplaceVars(tpl.footer_text || '', vars);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}
.email-wrapper{background:#f5f5f5;padding:20px}
.container{max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}
.header{background:${headerBg};color:white;padding:40px 30px;text-align:center}
.logo{max-width:150px;margin-bottom:20px;border-radius:8px}
.header h1{margin:10px 0 5px 0;font-size:28px;font-weight:600}
.header p{margin:0;font-size:16px;opacity:.9}
.content{background:#fff;padding:40px 30px}
.greeting{font-size:18px;color:#4A3728;margin-bottom:20px;font-weight:500}
.detail-box{background:#f9f7f5;border-left:4px solid ${accent};padding:20px;margin:25px 0;border-radius:8px}
.detail-row{margin:12px 0;display:flex;align-items:flex-start}
.label{font-weight:600;color:#4A3728;min-width:120px}
.value{color:#555;flex:1}
.info-box{background:#fff3cd;border-left:4px solid ${accent};padding:20px;margin:25px 0;border-radius:8px}
.alert-box{background:#fff3cd;border-left:4px solid ${accent};padding:20px;margin:0 0 25px 0;border-radius:8px}
.alert-box strong{color:#4A3728;font-size:16px}
.section-title{color:#4A3728;font-size:18px;font-weight:600;margin:25px 0 15px 0;border-bottom:2px solid ${accent};padding-bottom:8px}
.action-box{background:#e8f5e9;border-left:4px solid #4CAF50;padding:20px;margin:25px 0;border-radius:8px}
.action-box strong{color:#2e7d32}
.order-number{background:#f9f7f5;padding:15px;margin:20px 0;border-radius:8px;text-align:center;border-left:4px solid ${accent}}
.order-number strong{color:#4A3728;font-size:20px}
.contact-box{background:#f9f7f5;padding:25px;margin:25px 0;border-radius:8px;text-align:center}
.contact-item{margin:10px 0;color:#666}
.footer{background:#4A3728;color:white;text-align:center;padding:25px;font-size:14px}
.divider{height:1px;background:#e0e0e0;margin:25px 0}
</style></head><body>
<div class="email-wrapper"><div class="container">
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'">` : ''}
  <h1>${headerTitle}</h1>
  ${headerSubtitle ? `<p>${headerSubtitle}</p>` : ''}
</div>
<div class="content">
  ${greeting ? `<p class="greeting">${greeting}</p>` : ''}
  ${body}
  <div class="divider"></div>
  <div class="contact-box">
    <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
    <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
    <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
  </div>
</div>
<div class="footer">
  <p style="margin:0 0 10px 0;">${footer}</p>
  <p style="margin:0;font-size:12px;opacity:.8;">L'art du bien-être et de la relaxation</p>
</div>
</div></div></body></html>`;
}

async function tryAdminDBTemplate(templateKey, vars) {
  const templates = await loadEmailTemplates();
  if (!templates || !templates[templateKey]) return null;
  const tpl = templates[templateKey];
  return { subject: tplReplaceVars(tpl.subject, vars), html: buildFromDBTemplate(tpl, vars) };
}

// ============================================
// DATA FETCHING HELPERS
// ============================================

async function fetchReservations(filters = {}) {
  let query = supabaseClient
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.date) {
    query = query.eq('date', filters.date);
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching reservations:', error);
    return [];
  }
  
  return data || [];
}

async function fetchPosts(filters = {}) {
  let query = supabaseClient
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (filters.type) {
    query = query.eq('type', filters.type);
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
  
  return data || [];
}

async function fetchClients() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
  
  return data || [];
}

async function updateReservationStatus(id, status) {
  const { error } = await supabaseClient
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) {
    console.error('Error updating reservation:', error);
    throw error;
  }
  
  // Send status update email to client
  try {
    const reservation = await getReservationById(id);
    if (reservation && reservation.user_email) {
      console.log('📧 Sending status update email to:', reservation.user_email, 'status:', status);
      const emailSent = await sendStatusUpdateEmail(reservation, status);
      if (emailSent) {
        console.log('✅ Email sent successfully');
        showToast(`Email envoyé à ${reservation.user_email}`);
      } else {
        console.warn('⚠️ Email send returned false');
        showToast('Email non envoyé (vérifiez la console)', 'warning');
      }
    } else {
      console.warn('⚠️ No reservation or email found for id:', id);
    }
  } catch (emailError) {
    console.error('❌ Error sending status update email:', emailError);
    showToast('Erreur envoi email: ' + (emailError.message || 'Inconnu'), 'error');
    // Don't throw - status update should succeed even if email fails
  }
  
  return true;
}

async function getReservationById(id) {
  const { data, error } = await supabaseClient
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }
  
  return data;
}

async function sendStatusUpdateEmail(reservation, newStatus) {
  // Try DB template first
  const statusTemplateMap = {
    'CONFIRMED': 'status_confirmed',
    'CANCELLED': 'status_cancelled',
    'COMPLETED': 'status_completed',
  };
  const templateKey = statusTemplateMap[newStatus];
  const formattedDate = new Date(reservation.date).toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const vars = {
    client_name: reservation.user_name || reservation.user_email || '',
    client_email: reservation.user_email || '',
    service: reservation.service || '',
    date: formattedDate,
    time: reservation.time || '',
    location: reservation.location || '',
    notes: reservation.notes || '',
    year: new Date().getFullYear().toString(),
  };

  console.log('📧 tryAdminDBTemplate for key:', templateKey);
  const dbResult = templateKey ? await tryAdminDBTemplate(templateKey, vars) : null;
  console.log('📧 DB template result:', dbResult ? 'FOUND' : 'NOT FOUND (using fallback)');

  let subject, html;
  if (dbResult) {
    subject = dbResult.subject;
    html = dbResult.html;
  } else {
    // Hardcoded fallback
    const statusSubjects = {
      'CONFIRMED': '✓ Votre réservation est confirmée - DALIGHT Head Spa',
      'CANCELLED': '✗ Votre réservation a été annulée - DALIGHT Head Spa',
      'COMPLETED': '★ Merci pour votre visite - DALIGHT Head Spa',
    };
    const statusConfig = {
      'CONFIRMED': { icon:'✓', title:'Réservation Confirmée', color:'#4CAF50', bgColor:'#e8f5e9', message:'Bonne nouvelle! Votre réservation a été confirmée par notre équipe.' },
      'CANCELLED': { icon:'✗', title:'Réservation Annulée', color:'#f44336', bgColor:'#ffebee', message:'Votre réservation a été annulée. N\'hésitez pas à faire une nouvelle réservation.' },
      'COMPLETED': { icon:'★', title:'Merci pour votre visite!', color:'#2196F3', bgColor:'#e3f2fd', message:'Nous espérons que vous avez apprécié votre expérience chez DALIGHT Head Spa.' },
    };
    const config = statusConfig[newStatus] || statusConfig['CONFIRMED'];
    const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.png';
    subject = statusSubjects[newStatus] || 'Mise à jour de votre réservation - DALIGHT Head Spa';
    html = buildStatusUpdateEmailHTML(reservation, config, logoUrl, newStatus);
  }

  try {
    console.log('📧 Invoking send-email Edge Function to:', reservation.user_email, 'subject:', subject);
    const response = await supabaseClient.functions.invoke('send-email', {
      body: { to: reservation.user_email, subject, html, isAdmin: false },
    });
    console.log('📧 Edge Function full response:', response);
    
    if (response.error) {
      const errMsg = response.error?.message || response.error?.context?.message || JSON.stringify(response.error);
      console.error('❌ Edge Function error:', errMsg);
      throw new Error(errMsg);
    }
    
    // Check if the response data itself indicates failure
    if (response.data && response.data.success === false) {
      console.error('❌ Edge Function returned failure:', response.data.error);
      throw new Error(response.data.error || 'Edge Function failed');
    }
    
    console.log(`✅ Status update email sent successfully to ${reservation.user_email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending status update email:', error);
    return false;
  }
}

async function sendOrderEmail(order, isAdmin = false) {
  const adminEmail = 'laurorejeanclarens0@gmail.com';
  const templateKey = isAdmin ? 'order_admin' : 'order_client';
  const vars = {
    client_name: order.customer_name || '',
    client_email: order.customer_email || '',
    order_number: order.order_number || '',
    year: new Date().getFullYear().toString(),
  };

  const dbResult = await tryAdminDBTemplate(templateKey, vars);
  let subject, html;
  if (dbResult) {
    subject = dbResult.subject;
    html = dbResult.html;
  } else {
    subject = isAdmin ? '🔔 Nouvelle Commande Reçue' : '✓ Confirmation de Commande - DALIGHT Head Spa';
    const logoUrl = 'https://rbwoiejztrkghfkpxquo.supabase.co/storage/v1/object/public/assets/images/logodaligth.png';
    html = isAdmin ? buildAdminOrderEmailHTML(order, logoUrl) : buildClientOrderEmailHTML(order, logoUrl);
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke('send-email', {
      body: { to: isAdmin ? adminEmail : order.customer_email, subject, html, isAdmin },
    });
    if (error) { console.error('Edge Function error:', error); throw error; }
    console.log(`Order email sent successfully to ${isAdmin ? 'admin' : order.customer_email}`, data);
    return true;
  } catch (error) {
    console.error('Error sending order email:', error);
    return false;
  }
}

function buildStatusUpdateEmailHTML(data, config, logoUrl, newStatus) {
  const formattedDate = new Date(data.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { max-width: 150px; margin-bottom: 20px; border-radius: 8px; }
        .header h1 { margin: 10px 0 5px 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 0; font-size: 16px; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .status-banner { background: ${config.bgColor}; border-left: 4px solid ${config.color}; padding: 30px; margin: 0 0 25px 0; border-radius: 8px; text-align: center; }
        .status-icon { font-size: 48px; color: ${config.color}; margin-bottom: 15px; }
        .status-title { font-size: 24px; font-weight: 600; color: ${config.color}; margin: 0 0 10px 0; }
        .status-message { color: #666; font-size: 16px; margin: 0; }
        .greeting { font-size: 18px; color: #4A3728; margin: 25px 0 15px 0; font-weight: 500; }
        .detail-box { background: #f9f7f5; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .detail-row { margin: 12px 0; display: flex; align-items: flex-start; }
        .label { font-weight: 600; color: #4A3728; min-width: 120px; }
        .value { color: #555; flex: 1; }
        .info-box { background: #fff3cd; border-left: 4px solid #D4AF37; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .contact-box { background: #f9f7f5; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
        .contact-item { margin: 10px 0; color: #666; }
        .footer { background: #4A3728; color: white; text-align: center; padding: 25px; font-size: 14px; }
        .divider { height: 1px; background: #e0e0e0; margin: 25px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #D4AF37, #4A3728); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="DALIGHT Logo" class="logo" onerror="this.style.display='none'">
            <h1>DALIGHT Head Spa</h1>
            <p>Mise à jour de votre réservation</p>
          </div>
          <div class="content">
            <div class="status-banner">
              <div class="status-icon">${config.icon}</div>
              <h2 class="status-title">${config.title}</h2>
              <p class="status-message">${config.message}</p>
            </div>

            <p class="greeting">Cher(e) ${data.user_name || data.user_email},</p>
            
            <div class="detail-box">
              <div class="detail-row">
                <span class="label">Service:</span>
                <span class="value">${data.service}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="label">Heure:</span>
                <span class="value">${data.time}</span>
              </div>
              <div class="detail-row">
                <span class="label">Lieu:</span>
                <span class="value">${data.location}</span>
              </div>
              ${data.notes ? `
              <div class="detail-row">
                <span class="label">Notes:</span>
                <span class="value">${data.notes}</span>
              </div>
              ` : ''}
            </div>

            ${newStatus === 'CONFIRMED' ? `
            <div class="info-box">
              <strong>ℹ️ Informations importantes:</strong>
              <ul style="margin: 10px 0 0 0; color: #666; padding-left: 20px;">
                <li>Veuillez arriver 10 minutes avant votre rendez-vous</li>
                <li>Apportez une pièce d'identité valide</li>
                <li>En cas d'empêchement, merci de nous prévenir au moins 24h à l'avance</li>
              </ul>
            </div>
            ` : ''}

            ${newStatus === 'CANCELLED' ? `
            <div class="info-box">
              <strong>💡 Faire une nouvelle réservation:</strong>
              <p style="margin: 10px 0 0 0; color: #666;">Vous pouvez facilement faire une nouvelle réservation en visitant notre site web.</p>
              <a href="https://dalight-headspa.com/pages/services.html" class="cta-button">Réserver Maintenant</a>
            </div>
            ` : ''}

            ${newStatus === 'COMPLETED' ? `
            <div class="info-box">
              <strong>⭐ Votre avis compte pour nous!</strong>
              <p style="margin: 10px 0 0 0; color: #666;">Nous serions ravis de connaître votre expérience. N'hésitez pas à nous laisser un avis ou à nous recommander à vos proches.</p>
            </div>
            ` : ''}

            <div class="divider"></div>

            <p style="color: #666; margin-bottom: 20px;">Pour toute question ou modification, contactez-nous:</p>
            
            <div class="contact-box">
              <div class="contact-item">📞 <strong>+509 48 48 12 25</strong></div>
              <div class="contact-item">📍 <strong>Delmas 65, Faustin Premier Durandise #10</strong></div>
              <div class="contact-item">📧 <strong>laurorejeanclarens0@gmail.com</strong></div>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} <strong>DALIGHT Head Spa</strong>. Tous droits réservés.</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">L'art du bien-être et de la relaxation</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// PENDING COUNT BADGE
// ============================================

async function updatePendingBadge() {
  const badge = document.getElementById('pending-count');
  if (!badge) return;
  
  const reservations = await fetchReservations({ status: 'PENDING' });
  const count = reservations.length;
  
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

// ============================================
// INITIALIZE
// ============================================

async function initAdminCore() {
  const session = await checkAdminAuth();
  if (!session) return null;
  
  initSidebar();
  initLogout();
  updatePendingBadge();
  initRealtimeNotifications();
  
  return session;
}

// ============================================
// REALTIME NOTIFICATIONS (SOUND + BROWSER POPUP)
// ============================================

/**
 * Play a short "ding" notification sound generated via WebAudio
 * (no external file needed so it works offline and cross-browser).
 */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };
    // two-tone bell: C6 → E6
    playTone(1046.5, 0,    0.25);
    playTone(1318.5, 0.18, 0.35);
  } catch (e) {
    console.warn('Sound notification failed:', e);
  }
}

/**
 * Show a browser/OS notification. On mobile with PWA installed or
 * in a browser with permission, this appears as a real push-style
 * notification that can make the phone vibrate/ring.
 */
function showBrowserNotification(title, body, onClick) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '../assets/images/logodaligth.png',
      badge: '../assets/images/logodaligth.png',
      tag: 'dalight-admin-' + Date.now(),
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: false,
      silent: false
    });
    n.onclick = () => { window.focus(); if (onClick) onClick(); n.close(); };
  } catch (e) {
    console.warn('Browser notification failed:', e);
  }
}

/**
 * Ask user for notification permission once and cache the result.
 * Returns a promise resolving to the permission state.
 */
async function ensureNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const p = await Notification.requestPermission();
    return p;
  } catch { return 'denied'; }
}

/**
 * Show an in-page toast card for the notification so the admin sees
 * something even if browser notifications are blocked.
 */
function showInPageNotificationCard(title, body, href) {
  let host = document.getElementById('admin-notif-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'admin-notif-host';
    host.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:0.5rem;max-width:340px;';
    document.body.appendChild(host);
  }
  const card = document.createElement('div');
  card.style.cssText = 'background:linear-gradient(135deg,#d4af37,#b8941f);color:#1a1a1a;padding:0.9rem 1rem;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);cursor:pointer;animation:slideInRight 0.3s ease;font-size:0.88rem;';
  card.innerHTML = `<div style="font-weight:700;margin-bottom:0.25rem;">${title}</div><div style="font-size:0.82rem;opacity:0.85;">${body}</div>`;
  card.onclick = () => { if (href) window.location.href = href; card.remove(); };
  host.appendChild(card);
  setTimeout(() => card.remove(), 8000);
}

/**
 * Subscribe to Supabase Realtime on `reservations` and `messages` tables.
 * On every INSERT, play sound + show browser notification + in-page card.
 */
function initRealtimeNotifications() {
  // Request permission (non-blocking)
  ensureNotificationPermission().then(p => {
    console.log('📳 Notification permission:', p);
  });

  // Reservations channel
  supabaseClient
    .channel('admin-reservations')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reservations' },
      (payload) => {
        const r = payload.new || {};
        const title = '📅 Nouvelle réservation !';
        const body = `${r.user_name || r.user_email || 'Client'} — ${r.service || 'service'}`;
        playNotificationSound();
        showBrowserNotification(title, body, () => {
          window.location.href = 'reservations.html';
        });
        showInPageNotificationCard(title, body, 'reservations.html');
        updatePendingBadge();
      })
    .subscribe();

  // Messages channel (if table exists)
  supabaseClient
    .channel('admin-messages')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const m = payload.new || {};
        const title = '💬 Nouveau message';
        const body = `${m.name || m.email || 'Anonyme'}: ${(m.message || '').slice(0, 60)}`;
        playNotificationSound();
        showBrowserNotification(title, body, () => {
          window.location.href = 'messages.html';
        });
        showInPageNotificationCard(title, body, 'messages.html');
      })
    .subscribe();
}

// CSS for notification card animation
(function injectNotifCSS() {
  if (document.getElementById('dalight-notif-css')) return;
  const style = document.createElement('style');
  style.id = 'dalight-notif-css';
  style.textContent = `@keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
  document.head.appendChild(style);
})();

// Export functions
window.adminCore = {
  initAdminCore,
  checkAdminAuth,
  fetchReservations,
  fetchPosts,
  fetchClients,
  updateReservationStatus,
  getReservationById,
  sendStatusUpdateEmail,
  updatePendingBadge,
  formatDate,
  formatTime,
  formatCurrency,
  getStatusBadge,
  getInitials,
  showToast
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  initAdminCore();
});
