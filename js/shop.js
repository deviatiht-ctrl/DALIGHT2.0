// Shop functionality
let supabase;
let allProducts = [];
let allCategories = [];

// Wait for Supabase to initialize
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
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U'
    );
    return true;
  }
  return false;
}

// Initialize shop
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🛍️ Shop initialized');
  
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase not available');
    return;
  }
  
  await loadCategories();
  await loadProducts();
  setupFilters();
  updateCartBadge();
});

// Load categories
async function loadCategories() {
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (error) throw error;
    
    allCategories = data || [];
    renderCategoryFilters();
    console.log(`✅ Loaded ${allCategories.length} categories`);
  } catch (error) {
    console.error('❌ Error loading categories:', error);
  }
}

// Render category filters
function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  container.innerHTML = allCategories.map(cat => `
    <label class="category-checkbox">
      <input type="checkbox" value="${cat.id}" class="category-filter">
      <span>${cat.name}</span>
    </label>
  `).join('');
}

// Load products
async function loadProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_categories (
          name
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allProducts = data || [];
    renderProducts(allProducts);
    console.log(`✅ Loaded ${allProducts.length} products`);
  } catch (error) {
    console.error('❌ Error loading products:', error);
    document.getElementById('products-grid').innerHTML = `
      <div class="empty-state">
        <p style="color: red;">Erreur lors du chargement des produits</p>
      </div>
    `;
  }
}

// Render products grid
const CART_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

function renderProducts(products) {
  const grid = document.getElementById('products-grid');

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🛍️</div>
        <h3>Aucun produit trouvé</h3>
        <p>Essayez de modifier vos filtres ou revenez plus tard.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => {
    const price = product.sale_price || product.price;
    const hasDiscount = product.sale_price && product.sale_price < product.price;
    const categoryName = product.product_categories?.name || 'Produit';

    // Calculate save amount for discount badge
    const saveAmount = hasDiscount ? (product.price - product.sale_price).toFixed(0) : 0;

    // Only show rating if product has real rating data
    const hasRating = product.rating && product.rating > 0;
    const stars = hasRating ? '★'.repeat(Math.floor(product.rating)) : '';

    return `
      <div class="product-card-modern">
        <div class="product-image-wrapper-modern">
          <img src="${product.image_urls?.[0] || 'https://via.placeholder.com/400x320?text=No+Image'}"
               alt="${product.name}"
               class="product-image-modern"
               loading="lazy"
               onerror="this.src='https://via.placeholder.com/400x320?text=No+Image'">
          ${hasDiscount ? `<div class="save-badge">SAVE ${saveAmount} HTG</div>` : ''}
        </div>
        <div class="product-info-modern">
          <h3 class="product-name-modern">${product.name}</h3>
          ${hasRating ? `<div class="product-rating-modern">
            <span class="stars">${stars}</span>
            ${product.review_count ? `<span class="review-count">(${product.review_count})</span>` : ''}
          </div>` : ''}
          <div class="product-price-modern">
            <span class="price-current">${price.toLocaleString()} HTG</span>
            ${hasDiscount ? `<span class="price-original">${product.price.toLocaleString()} HTG</span>` : ''}
          </div>
          <button class="btn-add-cart-modern" onclick="addToCart('${product.id}')" ${product.stock_quantity === 0 ? 'disabled' : ''}>
            ${product.stock_quantity === 0 ? 'Rupture de stock' : CART_ICON_SVG + ' Add to Cart'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Refresh Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Setup filters
function setupFilters() {
  // Search
  document.getElementById('search-input')?.addEventListener('input', debounce(applyFilters, 300));
  
  // Category filters
  document.getElementById('category-filters')?.addEventListener('change', applyFilters);
  
  // Price sort
  document.getElementById('price-sort')?.addEventListener('change', applyFilters);
  
  // Featured only
  document.getElementById('featured-only')?.addEventListener('change', applyFilters);
  
  // In stock only
  document.getElementById('in-stock-only')?.addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
  let filtered = [...allProducts];
  
  // Search
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.sku?.toLowerCase().includes(searchTerm) ||
      p.short_description?.toLowerCase().includes(searchTerm)
    );
  }
  
  // Categories
  const selectedCategories = Array.from(document.querySelectorAll('.category-filter:checked'))
    .map(cb => cb.value);
  if (selectedCategories.length > 0) {
    filtered = filtered.filter(p => selectedCategories.includes(p.category_id));
  }
  
  // Featured only
  if (document.getElementById('featured-only')?.checked) {
    filtered = filtered.filter(p => p.is_featured);
  }
  
  // In stock only
  if (document.getElementById('in-stock-only')?.checked) {
    filtered = filtered.filter(p => p.stock_quantity > 0);
  }
  
  // Price sort
  const priceSort = document.getElementById('price-sort')?.value;
  if (priceSort === 'asc') {
    filtered.sort((a, b) => (a.sale_price || a.price) - (b.sale_price || b.price));
  } else if (priceSort === 'desc') {
    filtered.sort((a, b) => (b.sale_price || b.price) - (a.sale_price || a.price));
  }
  
  renderProducts(filtered);
}

// Reset filters
window.resetFilters = function() {
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.category-filter').forEach(cb => cb.checked = false);
  document.getElementById('price-sort').value = '';
  document.getElementById('featured-only').checked = false;
  document.getElementById('in-stock-only').checked = false;
  renderProducts(allProducts);
};

// View product
window.viewProduct = function(productId) {
  window.location.href = `./product.html?id=${productId}`;
};

// Add to cart
window.addToCart = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  let cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  
  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    if (existingItem.quantity < product.stock_quantity) {
      existingItem.quantity++;
    } else {
      alert('Stock insuffisant');
      return;
    }
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.sale_price || product.price,
      image: product.image_urls?.[0] || '',
      quantity: 1,
      stock: product.stock_quantity
    });
  }
  
  localStorage.setItem('dalight_cart', JSON.stringify(cart));
  updateCartBadge();
  
  // Show success message
  alert(`✅ ${product.name} ajouté au panier!`);
};

// Update cart badge
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('dalight_cart') || '[]');
  const badge = document.getElementById('cart-badge');
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  if (totalItems > 0) {
    badge.textContent = totalItems;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// Utility: Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
