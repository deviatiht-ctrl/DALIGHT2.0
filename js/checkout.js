// Checkout functionality
import { sendOrderEmail } from './email-service.js';

let supabase;
let selectedPaymentMethod = null;
let selectedPaymentMethodObj = null;
let paymentMethodsList = [];

// Wait for Supabase
async function waitForSupabase() {
  let attempts = 0;
  while (!window.supabase && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  if (window.supabase) {
    const { createClient } = window.supabase;
    supabase = createClient(
      'https://rbwoiejztrkghfkpxquo.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwNjI3NzIsImV4cCI6MjA1MjYzODc3Mn0.J5rKmKxZQJ8vN5F8qR3kL9mP2nO4wX6yT7uV0sA1bCc'
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
  
  // Try to auto-fill if user is logged in
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      document.getElementById('customer-email').value = session.user.email || '';
      document.getElementById('customer-name').value = session.user.user_metadata?.full_name || '';
    }
  } catch (error) {
    console.log('User not logged in');
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
  
  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} HTG`;
  document.getElementById('total').textContent = `${subtotal.toFixed(2)} HTG`;
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
      proofSection.style.display = pm.requires_proof ? 'block' : 'none';
      const proofInput = document.getElementById('payment-proof');
      if (proofInput) proofInput.required = pm.requires_proof;
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
  const requiresProof = selectedPaymentMethodObj?.requires_proof ?? (selectedPaymentMethod === 'moncash' || selectedPaymentMethod === 'natcash');
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
      total: subtotal,
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
      total: subtotal,
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
    
    // Handle payment
    if (selectedPaymentMethod === 'moncash') {
      // TODO: Integrate MonCash API
      alert('Redirection vers MonCash... (API à configurer)');
    } else if (selectedPaymentMethod === 'natcash') {
      // TODO: Integrate NatCash API
      alert('Redirection vers NatCash... (API à configurer)');
    }
    
    // Clear cart
    localStorage.removeItem('dalight_cart');
    
    // Redirect to confirmation
    window.location.href = `./order-confirmation.html?order=${orderNumber}`;
    
  } catch (error) {
    console.error('❌ Error creating order:', error);
    alert('Erreur lors de la création de la commande: ' + error.message);
    submitButton.disabled = false;
    submitButton.textContent = 'Confirmer la commande';
  }
});
