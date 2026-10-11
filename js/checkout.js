// Checkout functionality
import { sendOrderEmail } from './email-service.js';
import { createPlopPayment, isAutomaticPlopPayment, isBankPayment } from './plop-payment.js';

let supabase;
let selectedPaymentMethod = null;
let selectedPaymentMethodObj = null;
let paymentMethodsList = [];
let appliedPromo = null; // { id, code, discount_type, discount_value, owner_type, owner_email }

// Wait for Supabase
async function waitForSupabase() {
  let attempts = 0;
  while (!window.dalightSupabase && !window.supabaseClient && !window.supabase && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  // Priorité: dalightSupabase (main.js) > supabaseClient > créer nouveau
  if (window.dalightSupabase) {
    supabase = window.dalightSupabase;
    return true;
  }
  if (window.supabaseClient) {
    supabase = window.supabaseClient;
    return true;
  }
  if (window.supabase?.createClient) {
    supabase = window.supabase.createClient(
      'https://rbwoiejztrkghfkpxquo.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U'
    );
    return true;
  }
  return false;
}

// Initialize checkout
document.addEventListener('DOMContentLoaded', async () => {
  console.log('💳 Checkout initialized');
  
  await waitForSupabase();
  loadOrderSummary();
  loadPaymentMethodsFromDB();

  // Kòd promo
  document.getElementById('btn-apply-promo')?.addEventListener('click', applyPromoCode);
  document.getElementById('promo-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
  });
  
  // Try to auto-fill if user has local profile or is logged in
  try {
    // 1. Try to pre-fill from localStorage user profile first
    const localProfileStr = localStorage.getItem('dalight:user_profile');
    if (localProfileStr) {
      const localProfile = JSON.parse(localProfileStr);
      if (localProfile) {
        const nameField = document.getElementById('customer-name');
        const emailField = document.getElementById('customer-email');
        const phoneField = document.getElementById('customer-phone');
        const addressField = document.getElementById('customer-address');

        if (nameField && !nameField.value) {
          nameField.value = localProfile.fullName || `${localProfile.firstName || ''} ${localProfile.lastName || ''}`.trim() || '';
        }
        if (emailField && !emailField.value) emailField.value = localProfile.email || '';
        if (phoneField && !phoneField.value) phoneField.value = localProfile.phone || '';
        if (addressField && !addressField.value) addressField.value = localProfile.address || '';
      }
    }

    // 2. Fallback / Merge with active Supabase session
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const emailField = document.getElementById('customer-email');
        const nameField = document.getElementById('customer-name');
        
        if (emailField && !emailField.value) emailField.value = session.user.email || '';
        if (nameField && !nameField.value) nameField.value = session.user.user_metadata?.full_name || '';
      }
    }
  } catch (error) {
    console.log('Error auto-filling customer details:', error);
  }
});

// Load order summary
function loadOrderSummary() {
  const cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  
  if (cart.length === 0) {
    alert('Votre panier est vide!');
    window.location.href = './shop.html';
    return;
  }
  
  const orderItemsContainer = document.getElementById('order-items');
  
  orderItemsContainer.innerHTML = cart.map(item => `
    <div class="order-item">
      <div>
        <strong>${item.name}</strong>
        <p style="color: #6b7280; font-size: 0.9rem;">x${item.quantity}</p>
      </div>
      <div style="font-weight: 600;">
        ${(item.price * item.quantity).toFixed(2)} HTG
      </div>
    </div>
  `).join('');
  
  refreshTotals();
}

function getCartSubtotal() {
  const cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCheckoutDiscount(subtotal) {
  if (!appliedPromo) return 0;
  let d = 0;
  if (appliedPromo.discount_type === 'percentage') d = Math.round(subtotal * Number(appliedPromo.discount_value) / 100);
  else if (appliedPromo.discount_type === 'fixed_htg') d = Math.round(Number(appliedPromo.discount_value));
  return Math.min(Math.max(d, 0), subtotal);
}

function refreshTotals() {
  const subtotal = getCartSubtotal();
  const discount = getCheckoutDiscount(subtotal);
  const total = subtotal - discount;
  document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} HTG`;
  document.getElementById('total').textContent = `${total.toFixed(2)} HTG`;
  const dRow = document.getElementById('discount-row');
  if (dRow) {
    dRow.style.display = discount > 0 ? 'flex' : 'none';
    if (discount > 0) {
      document.getElementById('promo-code-label').textContent = appliedPromo.code;
      document.getElementById('discount-amount').textContent = `-${discount.toFixed(2)} HTG`;
    }
  }
}

function showCheckoutPromoMsg(ok, text) {
  const el = document.getElementById('promo-message');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = ok ? '#16a34a' : '#dc2626';
  el.textContent = text;
}

async function applyPromoCode() {
  const input = document.getElementById('promo-code-input');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) { showCheckoutPromoMsg(false, 'Antre yon kòd promo.'); return; }
  if (!supabase) { showCheckoutPromoMsg(false, 'Connexion indisponible.'); return; }

  const btn = document.getElementById('btn-apply-promo');
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', code)
      .eq('is_active', true)
      .limit(1);
    if (error) throw error;
    const promo = data?.[0];
    if (!promo) { appliedPromo = null; showCheckoutPromoMsg(false, 'Kòd sa a pa valide.'); refreshTotals(); return; }
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      appliedPromo = null; showCheckoutPromoMsg(false, 'Kòd sa a ekspire.'); refreshTotals(); return;
    }
    if (promo.max_uses && promo.uses_count >= promo.max_uses) {
      appliedPromo = null; showCheckoutPromoMsg(false, 'Limit itilizasyon kòd sa a rive.'); refreshTotals(); return;
    }
    if (promo.applies_to && !['all', 'products'].includes(promo.applies_to)) {
      appliedPromo = null; showCheckoutPromoMsg(false, 'Kòd sa a valab pou sèvis sèlman.'); refreshTotals(); return;
    }
    const clientEmail = (document.getElementById('customer-email')?.value || '').toLowerCase();
    if (promo.owner_type === 'client' && promo.owner_email && promo.owner_email.toLowerCase() === clientEmail) {
      appliedPromo = null; showCheckoutPromoMsg(false, 'Ou pa ka itilize pwòp kòd parrainage ou.'); refreshTotals(); return;
    }

    appliedPromo = promo;
    const d = getCheckoutDiscount(getCartSubtotal());
    showCheckoutPromoMsg(true, `✓ Kòd "${promo.code}" aplike: −${d.toLocaleString()} HTG`);
    refreshTotals();
  } catch (err) {
    console.error('Promo validation error:', err);
    showCheckoutPromoMsg(false, 'Erè pandan validasyon kòd la.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Load payment methods dynamically from DB
async function loadPaymentMethodsFromDB() {
  const container = document.getElementById('payment-methods-container');
  if (!container) return;
  try {
    const { data, error } = await supabase.from('payment_methods').select('*').eq('is_active', true).order('sort_order');
    if (error) throw error;
    paymentMethodsList = data || [];
    renderPaymentMethodCards();
  } catch (err) {
    // Fallback: static MonCash only
    container.innerHTML = `<p style="color:#dc2626;font-size:.85rem;">Impossible de charger les modes de paiement. Exécutez 06_payment_methods.sql dans Supabase.</p>`;
  }
}

function renderPaymentMethodCards() {
  const container = document.getElementById('payment-methods-container');
  if (!paymentMethodsList.length) {
    container.innerHTML = '<p style="color:#6b7280;">Aucun mode de paiement configuré.</p>';
    return;
  }
  container.innerHTML = paymentMethodsList.map(pm => {
    const logo = pm.logo_url
      ? `<img src="${pm.logo_url}" alt="${pm.name}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;">`
      : `<div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#4a3728,#8b7355);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💳</div>`;
    return `<div class="payment-method" onclick="selectPayment('${pm.slug}')" data-method="${pm.slug}">
      ${logo}
      <div class="payment-method-info">
        <h3>${pm.name}</h3>
        <p>${pm.account_name ? `<strong>${pm.account_name}</strong> — ` : ''}${pm.account_number || pm.instructions?.split('\n')[0] || ''}</p>
      </div>
    </div>`;
  }).join('');
}

// Select payment method (dynamic)
window.selectPayment = function(slug) {
  selectedPaymentMethod = slug;
  selectedPaymentMethodObj = paymentMethodsList.find(p => p.slug === slug) || null;

  document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.payment-method[data-method="${slug}"]`)?.classList.add('selected');

  const proofSection  = document.getElementById('payment-proof-section');
  const detailBox     = document.getElementById('payment-detail-box');

  if (selectedPaymentMethodObj) {
    const pm = selectedPaymentMethodObj;
    // Show account detail
    if (detailBox) {
      document.getElementById('pm-detail-title').textContent = pm.name;
      document.getElementById('pm-detail-account').innerHTML = pm.account_name
        ? `<strong>${pm.account_name}</strong>${pm.account_number ? ' — <code style="font-size:1rem;">' + pm.account_number + '</code>' : ''}`
        : (pm.account_number || '');
      document.getElementById('pm-detail-instructions').textContent = pm.instructions || '';
      detailBox.style.display = 'block';
    }
    // Proof upload
    if (proofSection) {
      const requiresManualProof = isBankPayment(pm.slug) && pm.requires_proof;
      proofSection.style.display = requiresManualProof ? 'block' : 'none';
      const proofInput = document.getElementById('payment-proof');
      if (proofInput) proofInput.required = requiresManualProof;
    }
  }

  document.getElementById('place-order-btn').disabled = false;
};

// Handle payment proof file upload preview
document.addEventListener('DOMContentLoaded', () => {
  const proofInput = document.getElementById('payment-proof');
  if (proofInput) {
    proofInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          alert('Le fichier est trop volumineux. Taille maximum: 5MB');
          this.value = '';
          return;
        }

        // Show preview for images
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const preview = document.getElementById('proof-preview');
            const img = document.getElementById('proof-preview-img');
            img.src = e.target.result;
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          // For PDFs, just show filename
          const preview = document.getElementById('proof-preview');
          preview.innerHTML = `<p style="color: var(--marron-700);">📄 ${file.name}</p>`;
          preview.style.display = 'block';
        }
      }
    });
  }
});

// Place order
document.getElementById('place-order-btn')?.addEventListener('click', async () => {
  // Validate form
  const name = document.getElementById('customer-name').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();

  if (!name || !email || !phone || !address) {
    alert('Veuillez remplir tous les champs obligatoires');
    return;
  }

  if (!selectedPaymentMethod) {
    alert('Veuillez sélectionner un mode de paiement');
    return;
  }

  // Validate + upload proof (based on requires_proof from DB)
  let paymentProofUrl = null;
  const requiresProof = isBankPayment(selectedPaymentMethod) && (selectedPaymentMethodObj?.requires_proof ?? true);
  if (requiresProof) {
    const proofInput = document.getElementById('payment-proof');
    if (!proofInput?.files?.[0]) {
      alert('Veuillez télécharger une preuve de paiement (screenshot du reçu)');
      return;
    }
    try {
      const file = proofInput.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `payment-proofs/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, file);
      if (uploadError) {
        // Try fallback bucket
        const { error: e2 } = await supabase.storage.from('order-attachments').upload(filePath, file);
        if (e2) throw e2;
        const { data: u2 } = supabase.storage.from('order-attachments').getPublicUrl(filePath);
        paymentProofUrl = u2.publicUrl;
      } else {
        const { data: u1 } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
        paymentProofUrl = u1.publicUrl;
      }
    } catch (uploadErr) {
      console.error('Proof upload error:', uploadErr);
      alert('Erreur upload preuve. Vérifiez le bucket Supabase Storage.');
      return;
    }
  }

  const submitButton = document.getElementById('place-order-btn');
  submitButton.disabled = true;
  submitButton.textContent = 'Traitement en cours...';

  try {
    const cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = getCheckoutDiscount(subtotal);
    const total = subtotal - discountAmount;

    // Generate order number
    const orderNumber = 'DL-' + Date.now() + '-' + Math.random().toString(36).substring(7).toUpperCase();
    
    // Get user ID if logged in
    let userId = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      }
    } catch (error) {
      console.log('User not logged in, creating order without user_id');
    }
    
    // Create order
    const orderData = {
      user_id: userId,
      order_number: orderNumber,
      status: 'pending',
      payment_method: selectedPaymentMethod,
      payment_method_id: selectedPaymentMethodObj?.id || null,
      payment_status: 'pending',
      payment_proof_url: paymentProofUrl,
      subtotal: subtotal,
      tax: 0,
      total: total,
      promo_code: appliedPromo ? appliedPromo.code : null,
      discount_amount: discountAmount,
      shipping_address: address,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      notes: document.getElementById('order-notes')?.value || null
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // Create order items
    const orderItems = cart.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    }));
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);
    
    if (itemsError) throw itemsError;

    // Anrejistre itilizasyon kòd promo a
    if (appliedPromo) {
      try {
        await supabase.rpc('record_promo_use', {
          p_code: appliedPromo.code,
          p_reservation_id: null,
          p_order_id: order.id,
          p_client_email: email,
          p_discount_amount: discountAmount,
        });
      } catch (e) { console.warn('record_promo_use:', e); }
    }
    
    // Send email notifications
    const orderEmailData = {
      order_number: orderNumber,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      shipping_address: address,
      payment_method: selectedPaymentMethod,
      payment_status: selectedPaymentMethod === 'cash' || selectedPaymentMethod === 'bank' ? 'pending' : 'pending',
      subtotal: subtotal,
      total: total,
      discount_amount: discountAmount,
      promo_code: appliedPromo ? appliedPromo.code : null,
      notes: document.getElementById('order-notes')?.value || null,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    };
    
    // Send emails (non-blocking)
    sendOrderEmail(orderEmailData, false); // to client
    sendOrderEmail(orderEmailData, true);  // to admin
    
    if (isAutomaticPlopPayment(selectedPaymentMethod)) {
      const payment = await createPlopPayment(supabase, {
        refference_id: orderNumber,
        montant: total,
        payment_method: selectedPaymentMethod,
        context_type: 'order',
        context_id: order.id,
        redirect_url: window.location.href,
      });

      await supabase
        .from('orders')
        .update({
          plop_transaction_id: payment.transaction_id || null,
          plop_reference_id: orderNumber,
          payment_status: 'pending'
        })
        .eq('id', order.id);

      localStorage.removeItem('dalight_cart');
      window.location.href = payment.url;
      return;
    }

    localStorage.removeItem('dalight_cart');
    window.location.href = `./order-confirmation.html?order=${orderNumber}`;
    
  } catch (error) {
    console.error('❌ Error creating order:', error);
    alert('Erreur lors de la création de la commande: ' + error.message);
    submitButton.disabled = false;
    submitButton.textContent = 'Confirmer la commande';
  }
});
