/* ADMIN PRODUCTS - COMPLETE FIXED VERSION 
   Loading + Modal + Design issues resolved
*/

// Get Supabase client from admin-core
let supabase = window.dalightAdminSupabase || window.supabaseClient || window.supabase;

// Global state
let allProducts = [];
let allCategories = [];
let selectedImages = [];
let editingProductId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for admin core to be ready
  if (!window.dalightAdminReady) {
    await new Promise(resolve => {
      const checkReady = setInterval(() => {
        if (window.dalightAdminReady) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
    });
  }
  
  supabase = window.dalightAdminSupabase || window.supabaseClient;
  
  await loadCategories();
  renderCategoriesList();
  await loadProducts();
  setupEventListeners();
});

// ============================================
// LOAD CATEGORIES
// ============================================

async function loadCategories() {
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('display_order');
    
    if (error) throw error;
    
    allCategories = data || [];
    populateCategoryFilters();
  } catch (error) {
    console.error('Error loading categories:', error);
    showToast('Erreur de chargement des catégories', 'error');
  }
}

function populateCategoryFilters() {
  const categoryFilter = document.getElementById('category-filter');
  const productCategory = document.getElementById('product-category');
  
  // Clear existing options except first
  if (categoryFilter) {
    categoryFilter.innerHTML = '<option value="">Toutes les catégories</option>';
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      categoryFilter.appendChild(option);
    });
  }
  
  if (productCategory) {
    productCategory.innerHTML = '<option value="">Sélectionner une catégorie</option>';
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      productCategory.appendChild(option);
    });
  }
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

function renderCategoriesList() {
  const container = document.getElementById('categories-list');
  if (!container) return;
  
  if (allCategories.length === 0) {
    container.innerHTML = '<span style="color: var(--admin-text-muted);">Aucune catégorie</span>';
    return;
  }
  
  container.innerHTML = allCategories.map(cat => `
    <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid var(--admin-border); border-radius: 8px;">
      <span style="font-weight: 500; font-size: 0.9rem;">${cat.name}</span>
      <span style="font-size: 0.75rem; color: var(--admin-text-muted);">(${cat.slug})</span>
      <button onclick="deleteCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')" 
              style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.2rem; margin-left: 0.25rem;"
              title="Supprimer cette catégorie">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');
}

function openCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('category-name')?.focus();
  }
}

function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('category-form')?.reset();
  }
}

async function createCategory(e) {
  e.preventDefault();
  
  const name = document.getElementById('category-name').value.trim();
  const slug = document.getElementById('category-slug').value.trim().toLowerCase();
  const order = parseInt(document.getElementById('category-order').value) || 0;
  
  if (!name || !slug) {
    showToast('Veuillez remplir tous les champs obligatoires', 'error');
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .insert([{ name, slug, display_order: order, is_active: true }])
      .select()
      .single();
    
    if (error) throw error;
    
    showToast('Catégorie créée avec succès', 'success');
    closeCategoryModal();
    
    // Refresh categories
    await loadCategories();
    renderCategoriesList();
  } catch (error) {
    console.error('Error creating category:', error);
    showToast(`Erreur: ${error.message}`, 'error');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${name}" ?\n\nLes produits associés ne seront plus dans cette catégorie.`)) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('Catégorie supprimée', 'success');
    
    // Refresh categories
    await loadCategories();
    renderCategoriesList();
  } catch (error) {
    console.error('Error deleting category:', error);
    showToast(`Erreur: ${error.message}`, 'error');
  }
}

// Make functions available globally
window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.deleteCategory = deleteCategory;

// ============================================
// LOAD PRODUCTS
// ============================================

async function loadProducts() {
  const tbody = document.getElementById('products-table');
  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem;">
        <div class="loading-spinner"></div>
        <p style="margin-top: 1rem; color: var(--admin-text-muted);">Chargement des produits...</p>
      </td>
    </tr>
  `;
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_categories(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allProducts = data || [];
    displayProducts(allProducts);
  } catch (error) {
    console.error('Error loading products:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--admin-danger);">
          Erreur de chargement des produits: ${error.message}
        </td>
      </tr>
    `;
    showToast('Erreur de chargement des produits', 'error');
  }
}

function displayProducts(products) {
  const tbody = document.getElementById('products-table');
  
  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem;">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
            <h3>Aucun produit trouvé</h3>
            <p>Cliquez sur "Ajouter un produit" pour commencer</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = products.map(product => {
    const imageUrl = product.image_urls && product.image_urls.length > 0 
      ? product.image_urls[0] 
      : null;
    
    const stockStatus = product.stock_quantity === 0 
      ? '<span style="color: var(--admin-danger);">Rupture de stock</span>'
      : product.stock_quantity < 10 
        ? `<span style="color: var(--admin-warning);">${product.stock_quantity} restants</span>`
        : `<span style="color: var(--admin-success);">${product.stock_quantity}</span>`;
    
    const activeStatus = product.is_active 
      ? '<span class="status-badge completed">Actif</span>'
      : '<span class="status-badge cancelled">Inactif</span>';
    
    const categoryName = product.product_categories?.name || 'Sans catégorie';
    
    const price = product.sale_price 
      ? `<span style="text-decoration: line-through; color: var(--admin-text-muted); font-size: 0.85rem;">${formatNumber(product.price)}</span><br>${formatNumber(product.sale_price)} HTG`
      : `${formatNumber(product.price)} HTG`;
    
    return `
      <tr>
        <td>
          ${imageUrl 
            ? `<img src="${imageUrl}" alt="${product.name}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="product-image-placeholder" style="display:none;">📦</div>`
            : `<div class="product-image-placeholder">📦</div>`
          }
        </td>
        <td>
          <div style="font-weight: 600;">${product.name}</div>
          ${product.is_featured ? '<span style="font-size: 0.75rem; color: var(--admin-accent);">⭐ Vedette</span>' : ''}
        </td>
        <td>${categoryName}</td>
        <td>${price}</td>
        <td>${stockStatus}</td>
        <td>${activeStatus}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-secondary btn-sm" onclick="editProduct('${product.id}')" title="Modifier">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.id}')" title="Supprimer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function formatNumber(num) {
  return Number(num).toLocaleString('fr-FR');
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openAddProductModal() {
  editingProductId = null;
  document.getElementById('modal-title').textContent = 'Ajouter un produit';
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-active').checked = true;
  selectedImages = [];
  updateImagePreview();
  
  const modal = document.getElementById('product-modal');
  modal.style.display = 'flex';
  modal.classList.add('active');
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  modal.style.display = 'none';
  modal.classList.remove('active');
  editingProductId = null;
  selectedImages = [];
}

async function editProduct(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) {
    showToast('Produit non trouvé', 'error');
    return;
  }
  
  editingProductId = productId;
  document.getElementById('modal-title').textContent = 'Modifier le produit';
  document.getElementById('product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-category').value = product.category_id || '';
  document.getElementById('product-price').value = product.price;
  document.getElementById('product-sale-price').value = product.sale_price || '';
  document.getElementById('product-stock').value = product.stock_quantity;
  document.getElementById('product-sku').value = product.sku || '';
  document.getElementById('product-short-desc').value = product.short_description || '';
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-featured').checked = product.is_featured;
  document.getElementById('product-active').checked = product.is_active;
  
  selectedImages = product.image_urls ? [...product.image_urls] : [];
  updateImagePreview();
  
  const modal = document.getElementById('product-modal');
  modal.style.display = 'flex';
  modal.classList.add('active');
}

async function deleteProduct(productId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit?')) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    
    if (error) throw error;
    
    showToast('Produit supprimé avec succès');
    await loadProducts();
  } catch (error) {
    console.error('Error deleting product:', error);
    showToast('Erreur lors de la suppression', 'error');
  }
}

// ============================================
// IMAGE HANDLING
// ============================================

function updateImagePreview() {
  const preview = document.getElementById('image-preview');
  if (!preview) return;
  
  preview.innerHTML = selectedImages.map((img, index) => `
    <div class="image-preview-item">
      <img src="${img}" alt="Image ${index + 1}">
      <button type="button" class="image-preview-remove" onclick="removeImage(${index})">×</button>
    </div>
  `).join('');
}

function removeImage(index) {
  selectedImages.splice(index, 1);
  updateImagePreview();
}

async function uploadImages(files) {
  const uploadedUrls = [];
  
  for (const file of files) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      
      uploadedUrls.push(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast(`Erreur upload: ${file.name}`, 'error');
    }
  }
  
  return uploadedUrls;
}

// ============================================
// FORM SUBMISSION
// ============================================

async function handleProductSubmit(event) {
  event.preventDefault();
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Enregistrement...';
  submitBtn.disabled = true;
  
  try {
    // Handle image uploads
    const imageFiles = document.getElementById('product-images').files;
    let imageUrls = [...selectedImages];
    
    if (imageFiles.length > 0) {
      const newUrls = await uploadImages(Array.from(imageFiles));
      imageUrls = [...imageUrls, ...newUrls];
    }
    
    const productData = {
      name: document.getElementById('product-name').value,
      category_id: document.getElementById('product-category').value || null,
      price: parseFloat(document.getElementById('product-price').value),
      sale_price: parseFloat(document.getElementById('product-sale-price').value) || null,
      stock_quantity: parseInt(document.getElementById('product-stock').value),
      sku: document.getElementById('product-sku').value || null,
      short_description: document.getElementById('product-short-desc').value || null,
      description: document.getElementById('product-description').value || null,
      image_urls: imageUrls,
      is_featured: document.getElementById('product-featured').checked,
      is_active: document.getElementById('product-active').checked,
      slug: document.getElementById('product-name').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    };
    
    let error;
    
    if (editingProductId) {
      // Update existing product
      const result = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProductId);
      error = result.error;
    } else {
      // Create new product
      const result = await supabase
        .from('products')
        .insert([productData]);
      error = result.error;
    }
    
    if (error) throw error;
    
    showToast(editingProductId ? 'Produit modifié avec succès' : 'Produit ajouté avec succès');
    closeProductModal();
    await loadProducts();
  } catch (error) {
    console.error('Error saving product:', error);
    showToast('Erreur lors de l\'enregistrement: ' + error.message, 'error');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// ============================================
// FILTERS & SEARCH
// ============================================

function setupEventListeners() {
  // Form submission
  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', handleProductSubmit);
  }
  
  // Image input
  const imageInput = document.getElementById('product-images');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      // Images will be uploaded on form submit
      const fileList = Array.from(e.target.files);
      showToast(`${fileList.length} image(s) sélectionée(s)`, 'info');
    });
  }
  
  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
  }
  
  // Category filter
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', filterProducts);
  }
  
  // Status filter
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', filterProducts);
  }
  
  // Category form
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', createCategory);
  }
  
  // Close modal on overlay click
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeProductModal();
      }
    });
  }
}

function filterProducts() {
  const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
  const categoryId = document.getElementById('category-filter')?.value || '';
  const statusValue = document.getElementById('status-filter')?.value;
  
  let filtered = allProducts;
  
  // Filter by search term
  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      (p.short_description && p.short_description.toLowerCase().includes(searchTerm)) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm))
    );
  }
  
  // Filter by category
  if (categoryId) {
    filtered = filtered.filter(p => p.category_id === categoryId);
  }
  
  // Filter by status
  if (statusValue !== '') {
    const isActive = statusValue === 'true';
    filtered = filtered.filter(p => p.is_active === isActive);
  }
  
  displayProducts(filtered);
}
