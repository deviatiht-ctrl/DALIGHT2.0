// Checkout functionality
import { sendOrderEmail } from './email-service.js';

let supabase;
let selectedPaymentMethod = null;

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

// Select payment method
window.selectPayment = function(method) {
  selectedPaymentMethod = method;

  // Update UI
  document.querySelectorAll('.payment-method').forEach(el => {
    el.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');

  // Show/hide payment proof section for MonCash/NatCash
  const proofSection = document.getElementById('payment-proof-section');
  const bankDetails = document.getElementById('bank-details');
  const appName = document.getElementById('payment-app-name');

  if (method === 'moncash' || method === 'natcash') {
    proofSection.style.display = 'block';
    bankDetails.style.display = 'none';
    appName.textContent = method === 'moncash' ? 'MonCash' : 'NatCash';
    document.getElementById('payment-proof').required = true;

    // Refresh Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
  } else if (method === 'bank') {
    proofSection.style.display = 'none';
    bankDetails.style.display = 'block';
    document.getElementById('payment-proof').required = false;
  } else {
    proofSection.style.display = 'none';
    bankDetails.style.display = 'none';
    document.getElementById('payment-proof').required = false;
  }

  // Enable place order button
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

  // Validate payment proof for MonCash/NatCash
  let paymentProofUrl = null;
  if (selectedPaymentMethod === 'moncash' || selectedPaymentMethod === 'natcash') {
    const proofInput = document.getElementById('payment-proof');
    if (!proofInput.files || !proofInput.files[0]) {
      alert('Veuillez télécharger une preuve de paiement (capture d\'écran du reçu)');
      return;
    }

    // Upload payment proof
    try {
      const file = proofInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-proof-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `payment-proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('order-attachments')
        .getPublicUrl(filePath);

      paymentProofUrl = publicUrl;
    } catch (uploadErr) {
      console.error('Error uploading payment proof:', uploadErr);
      alert('Erreur lors du téléchargement de la preuve de paiement. Veuillez réessayer.');
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
