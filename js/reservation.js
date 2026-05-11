import { createOptionsForServices, getSupabase, getConfig } from './main.js?v=3.0.0';
import { sendReservationEmail } from './email-service.js';

let supabase = getSupabase();
const reservationForm = document.getElementById('reservation-form');
const serviceSelect = document.getElementById('service-select');
const hiddenServiceInput = document.getElementById('service');
const reservationMessage = document.getElementById('reservation-message');

// 🚀 ENHANCED WAITING - Fix Supabase timing issue
async function waitForSupabase() {
  console.log('🔄 Enhanced waitForSupabase() started...');
  
  // 🎯 INSTANT CHECK: Global ready signal from main.js
  if (window.dalightReady && window.dalightSupabase) {
    supabase = window.dalightSupabase;
    console.log('⚡ INSTANT: window.dalightReady=true + window.dalightSupabase found');
    return true;
  }
  
  // ⏳ FALLBACK: Extended polling (15s = 150 attempts)
  let attempts = 0;
  const maxAttempts = 150;
  while ((!supabase || !supabase.from) && attempts < maxAttempts) {
    console.log(`⏳ Polling attempt ${attempts + 1}/${maxAttempts}...`);
    await new Promise(resolve => setTimeout(resolve, 100));
    supabase = getSupabase();
    
    // 🔍 Check both local & global
    if (supabase || window.dalightSupabase) {
      supabase = supabase || window.dalightSupabase;
      console.log('✅ Supabase ready after', attempts * 100, 'ms');
      return true;
    }
    attempts++;
  }
  
  console.error('❌ Supabase FAILED after 15s - Auto-refreshing...');
  setMessage('error', 'Supabase pa konekte. Paj sa ap rafrechi otomatikman...');
  
  // 🔄 AUTO-REFRESH after 3s
  setTimeout(() => {
    window.location.reload();
  }, 3000);
  
  return false;
}

// Créer le popup de chargement/succès
function createReservationPopup() {
  const popup = document.createElement('div');
  popup.id = 'reservation-popup';
  popup.innerHTML = `
    <div class="popup-overlay"></div>
    <div class="popup-content">
      <div class="popup-spinner"></div>
      <p class="popup-message">Envoi en cours...</p>
    </div>
  `;
  popup.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    #reservation-popup .popup-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    #reservation-popup .popup-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 3rem 4rem;
      border-radius: 24px;
      text-align: center;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 0 0 1px rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      animation: popupFadeIn 0.3s ease-out;
    }
    #reservation-popup .popup-spinner {
      width: 70px;
      height: 70px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: rgba(212, 175, 55, 0.9);
      border-radius: 50%;
      margin: 0 auto 1.5rem;
      animation: spin 0.8s linear infinite;
      box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
    }
    #reservation-popup .popup-spinner.success {
      border: 3px solid rgba(74, 222, 128, 0.3);
      animation: successPulse 0.5s ease-out;
      background: rgba(74, 222, 128, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #reservation-popup .popup-spinner.success::after {
      content: '✓';
      font-size: 2.5rem;
      color: #4ade80;
      text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
    }
    #reservation-popup .popup-message {
      color: rgba(255, 255, 255, 0.95);
      font-size: 1.25rem;
      margin: 0;
      font-weight: 500;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      white-space: pre-line;
      line-height: 1.6;
    }
    #reservation-popup .popup-message.success {
      color: #4ade80;
      text-shadow: 0 0 20px rgba(74, 222, 128, 0.3);
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes popupFadeIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes successPulse {
      0% { transform: scale(0.8); opacity: 0; }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(popup);
  return popup;
}

function showPopup(message, isLoading = true) {
  let popup = document.getElementById('reservation-popup');
  if (!popup) {
    popup = createReservationPopup();
  }
  
  const spinner = popup.querySelector('.popup-spinner');
  const messageEl = popup.querySelector('.popup-message');
  
  if (isLoading) {
    spinner.classList.remove('success');
    messageEl.classList.remove('success');
  } else {
    spinner.classList.add('success');
    messageEl.classList.add('success');
  }
  
  messageEl.textContent = message;
  popup.style.display = 'block';
}

function hidePopup() {
  const popup = document.getElementById('reservation-popup');
  if (popup) {
    popup.style.display = 'none';
  }
}

function setMessage(type, text) {
  if (!reservationMessage) return;
  reservationMessage.className = `alert ${type}`;
  reservationMessage.textContent = text;
}

function setMinimumDate() {
  const dateField = document.getElementById('date');
  if (!dateField) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateField.min = today.toISOString().split('T')[0];
}

const ALL_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00',
];

function renderTimeSlots(bookedTimes = []) {
  const timeSelect = document.getElementById('time');
  const hint = document.getElementById('time-hint');
  if (!timeSelect) return;

  const booked = bookedTimes.map(t => (t || '').slice(0, 5));
  timeSelect.innerHTML = '<option value="">-- Choisir un créneau --</option>';

  ALL_SLOTS.forEach(slot => {
    const isBooked = booked.includes(slot);
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = isBooked ? `${slot} — Indisponible` : slot;
    opt.disabled = isBooked;
    if (isBooked) opt.style.color = '#aaa';
    timeSelect.appendChild(opt);
  });

  if (hint) hint.textContent = `${booked.length} créneau(x) déjà réservé(s) ce jour.`;
}

async function loadBookedSlots(date) {
  const timeSelect = document.getElementById('time');
  if (!timeSelect) return;

  timeSelect.innerHTML = '<option value="">Chargement...</option>';
  timeSelect.disabled = true;

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('time')
      .eq('date', date)
      .not('status', 'eq', 'CANCELLED');

    if (error) throw error;
    const bookedTimes = (data || []).map(r => r.time);
    renderTimeSlots(bookedTimes);
  } catch (e) {
    console.warn('Could not load booked slots:', e.message);
    renderTimeSlots([]);
  } finally {
    timeSelect.disabled = false;
  }
}

function initDateListener() {
  const dateField = document.getElementById('date');
  if (!dateField) return;
  dateField.addEventListener('change', async () => {
    if (!dateField.value) return;
    await waitForSupabase();
    await loadBookedSlots(dateField.value);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  
  // 🚀 Wait for Supabase (enhanced)
  console.log('📋 handleSubmit: Checking Supabase readiness...');
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not ready - handleSubmit blocked');
    return; // Auto-refresh will handle it
  }
  console.log('✅ Supabase confirmed ready in handleSubmit');
  

  const submitBtn = reservationForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setMessage('success', 'Submitting your reservation...');

  const formData = new FormData(reservationForm);
  const payload = {
    service: formData.get('service'),
    location: formData.get('location'),
    idType: formData.get('id_type'),
    idNumber: formData.get('id_number'),
    notes: formData.get('notes')?.trim() || '',
    date: formData.get('date'),
    time: formData.get('time'),
    paymentMethod: formData.get('payment_method') || null,
  };

  // Get the proof file
  const proofFile = document.getElementById('payment-proof')?.files[0];

  if (!payload.service || !payload.date || !payload.time || !payload.idType || !payload.idNumber) {
    setMessage('error', 'Veuillez remplir tous les champs obligatoires.');
    submitBtn.disabled = false;
    return;
  }

  if (!payload.paymentMethod) {
    setMessage('error', 'Veuillez choisir une méthode de paiement.');
    submitBtn.disabled = false;
    return;
  }

  if (!proofFile) {
    setMessage('error', 'Veuillez uploader une preuve de paiement (screenshot).');
    submitBtn.disabled = false;
    return;
  }

  // Afficher le popup de chargement
  showPopup('Envoi de votre réservation...');

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      hidePopup();
      window.location.href = './login.html';
      return;
    }

    // Upload payment proof to Supabase Storage
    let paymentProofUrl = null;
    const fileExt = proofFile.name.split('.').pop();
    const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
    const filePath = `proofs/${fileName}`;

    showPopup('Upload de la preuve de paiement...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, proofFile, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Échec de l\'upload de la preuve de paiement. Réessayez.');
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
    paymentProofUrl = urlData?.publicUrl || null;

    showPopup('Envoi de votre réservation...');
    const { error } = await supabase.from('reservations').insert({
      user_id: session.user.id,
      user_email: session.user.email,
      service: payload.service,
      location: payload.location,
      id_type: payload.idType,
      id_number: payload.idNumber,
      notes: payload.notes,
      date: payload.date,
      time: payload.time,
      status: 'PENDING',
      payment_method: payload.paymentMethod,
      payment_proof_url: paymentProofUrl,
    });

    if (error) {
      throw error;
    }

    // Send email notifications
    const config = getConfig();
    const emailData = {
      user_name: payload.userName || session.user.email,
      user_email: session.user.email,
      user_phone: payload.phone || '',
      service: payload.service,
      date: payload.date,
      time: payload.time,
      location: payload.location,
      notes: payload.notes,
      total_amount_usd: payload.totalUSD || '',
      total_amount_htg: payload.totalHTG || '',
    };

    // Send emails (non-blocking)
    sendReservationEmail(emailData, false); // to client
    sendReservationEmail(emailData, true);  // to admin

    reservationForm.reset();
    
    // Afficher le message de succès
    showPopup('Réservation reçue !\nEn attente de confirmation', false);
    
    // Rediriger vers orders.html après 2.5 secondes
    setTimeout(() => {
      window.location.href = './orders.html';
    }, 2500);
    
  } catch (error) {
    console.error(error);
    hidePopup();
    setMessage('error', error.message || 'Unable to submit reservation.');
    submitBtn.disabled = false;
  }
}

function initReservationPage() {
  if (!reservationForm) return;
  createOptionsForServices(serviceSelect);
  setMinimumDate();
  initDateListener();
  reservationForm.addEventListener('submit', handleSubmit);
}

initReservationPage();
