// Cart functionality
document.addEventListener('DOMContentLoaded', () => {
  console.log('🛒 Cart initialized');
  loadCart();
});

// Load cart
function loadCart() {
  const cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  const cartItemsContainer = document.getElementById('cart-items');
  const cartSummary = document.getElementById('cart-summary');
  
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h2>Votre panier est vide</h2>
        <p style="color: #6b7280; margin: 1rem 0;">Ajoutez des produits pour commencer</p>
        <a href="./shop.html" class="btn" style="display: inline-block; margin-top: 1rem;">
          Aller à la boutique
        </a>
      </div>
    `;
    cartSummary.style.display = 'none';
    return;
  }
  
  // Render cart items
  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.image || 'https://via.placeholder.com/100'}" 
           alt="${item.name}" 
           class="cart-item-image"
           onerror="this.src='https://via.placeholder.com/100'">
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <p style="color: #059669; font-weight: 700; font-size: 1.2rem;">
          ${item.price} HTG
        </p>
        <div class="quantity-control">
          <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
          <span style="font-weight: 600; min-width: 40px; text-align: center;">${item.quantity}</span>
          <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
          <button onclick="removeItem('${item.id}')" style="margin-left: 1rem; background: none; border: none; color: #ef4444; cursor: pointer;">
            🗑️ Supprimer
          </button>
        </div>
      </div>
      <div style="text-align: right;">
        <p style="font-weight: 700; font-size: 1.2rem;">
          ${item.price * item.quantity} HTG
        </p>
      </div>
    </div>
  `).join('');
  
  // Calculate totals
  calculateTotals();
  cartSummary.style.display = 'block';
}

// Update quantity
window.updateQuantity = function(productId, change) {
  let cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  const item = cart.find(i => i.id === productId);
  
  if (!item) return;
  
  const newQuantity = item.quantity + change;
  
  if (newQuantity <= 0) {
    removeItem(productId);
    return;
  }
  
  if (newQuantity > item.stock) {
    alert('Stock insuffisant');
    return;
  }
  
  item.quantity = newQuantity;
  localStorage.setItem('dalight_cart', JSON.stringify(cart));
  loadCart();
};

// Remove item
window.removeItem = function(productId) {
  let cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  cart = cart.filter(i => i.id !== productId);
  localStorage.setItem('dalight_cart', JSON.stringify(cart));
  loadCart();
};

// Calculate totals
function calculateTotals() {
  const cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = 0; // 0% tax
  const total = subtotal + tax;
  
  document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} HTG`;
  document.getElementById('total').textContent = `${total.toFixed(2)} HTG`;
}

// Clear cart
window.clearCart = function() {
  if (confirm('Vider le panier?')) {
    localStorage.removeItem('dalight_cart');
    loadCart();
  }
};
