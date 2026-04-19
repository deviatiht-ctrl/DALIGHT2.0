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
  
  // Enable place order button
  document.getElementById('place-order-btn').disabled = false;
};

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
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        payment_method: selectedPaymentMethod,
        payment_status: selectedPaymentMethod === 'cash' || selectedPaymentMethod === 'bank' ? 'pending' : 'pending',
        subtotal: subtotal,
        tax: 0,
        total: subtotal,
        shipping_address: address,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        notes: document.getElementById('order-notes')?.value || null
      })
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
