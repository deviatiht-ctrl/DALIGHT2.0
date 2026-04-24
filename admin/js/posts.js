// ============================================
// DALIGHT HEAD SPA - POSTS MANAGEMENT
// ============================================

let allPosts = [];

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const session = await window.adminCore?.checkAdminAuth();
  if (!session) return;
  
  initUploadModal();
  loadPosts();
  loadStats();
});

// ============================================
// LOAD DATA
// ============================================

async function loadPosts() {
  const { fetchPosts, formatDate } = window.adminCore;
  const grid = document.getElementById('posts-grid');
  
  try {
    allPosts = await fetchPosts();
    
    if (allPosts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <h3>Aucune vidéo</h3>
          <p>Commencez par uploader votre première vidéo</p>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = allPosts.map(post => `
      <div class="post-card" data-id="${post.id}">
        <div class="post-thumbnail">
          ${post.video_url ? `
            <video src="${post.video_url}" preload="metadata"></video>
            <div class="play-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          ` : `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: var(--admin-card);">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="opacity: 0.3;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </div>
          `}
        </div>
        <div class="post-info">
          <p class="post-caption">${post.caption || post.content || 'Sans description'}</p>
          <div class="post-meta">
            <span>${formatDate(post.created_at)}</span>
            <span class="post-likes">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="14" height="14">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
              ${post.likes || 0}
            </span>
          </div>
        </div>
        <div class="post-actions">
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="viewPost('${post.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            Voir
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deletePost('${post.id}')" title="Supprimer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Error loading posts:', err);
    grid.innerHTML = `
      <div class="text-center text-danger" style="grid-column: 1/-1; padding: 3rem;">
        Erreur lors du chargement des posts
      </div>
    `;
  }
}

async function loadStats() {
  const totalPostsEl = document.getElementById('total-posts');
  const totalLikesEl = document.getElementById('total-likes');
  const totalSubscribersEl = document.getElementById('total-subscribers');
  
  // Posts count
  if (totalPostsEl) {
    totalPostsEl.textContent = allPosts.length;
  }
  
  // Total likes
  if (totalLikesEl) {
    const totalLikes = allPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    totalLikesEl.textContent = totalLikes;
  }
  
  // Subscribers count
  if (totalSubscribersEl) {
    try {
      const { data } = await window.supabaseClient
        .from('subscribers')
        .select('id', { count: 'exact' });
      totalSubscribersEl.textContent = data?.length || 0;
    } catch (err) {
      totalSubscribersEl.textContent = '0';
    }
  }
}

// ============================================
// UPLOAD MODAL
// ============================================

function initUploadModal() {
  const uploadBtn = document.getElementById('upload-btn');
  const submitBtn = document.getElementById('submit-upload');
  
  if (uploadBtn) {
    uploadBtn.addEventListener('click', openUploadModal);
  }
  
  if (submitBtn) {
    submitBtn.addEventListener('click', handleUpload);
  }
}

window.openUploadModal = function() {
  document.getElementById('upload-modal').classList.add('active');
};

window.closeUploadModal = function() {
  document.getElementById('upload-modal').classList.remove('active');
  document.getElementById('upload-form').reset();
  document.getElementById('upload-progress').style.display = 'none';
};

async function handleUpload() {
  const fileInput = document.getElementById('video-file');
  const captionInput = document.getElementById('video-caption');
  const progressDiv = document.getElementById('upload-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const submitBtn = document.getElementById('submit-upload');
  
  const file = fileInput.files[0];
  if (!file) {
    window.adminCore.showToast('Veuillez sélectionner un fichier', 'error');
    return;
  }
  
  // Check file size (100MB max)
  if (file.size > 100 * 1024 * 1024) {
    window.adminCore.showToast('Le fichier est trop volumineux (max 100MB)', 'error');
    return;
  }
  
  submitBtn.disabled = true;
  progressDiv.style.display = 'block';
  
  try {
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    // Upload to Supabase Storage
    progressText.textContent = 'Upload en cours...';
    progressFill.style.width = '30%';
    
    const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
      .from('videos')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    
    progressFill.style.width = '70%';
    progressText.textContent = 'Création du post...';
    
    // Get public URL
    const { data: urlData } = window.supabaseClient.storage
      .from('videos')
      .getPublicUrl(filename);
    
    // Get current user
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    // Create post record
    const { error: postError } = await window.supabaseClient
      .from('posts')
      .insert({
        user_id: session.user.id,
        user_name: 'Admin',
        type: 'video',
        video_url: urlData.publicUrl,
        caption: captionInput.value || '',
        likes: 0,
        is_active: true
      });
    
    if (postError) throw postError;
    
    progressFill.style.width = '100%';
    progressText.textContent = 'Terminé !';
    
    window.adminCore.showToast('Vidéo uploadée avec succès !');
    
    setTimeout(() => {
      closeUploadModal();
      loadPosts();
      loadStats();
    }, 1000);
    
  } catch (err) {
    console.error('Upload error:', err);
    window.adminCore.showToast('Erreur lors de l\'upload: ' + err.message, 'error');
    progressDiv.style.display = 'none';
  } finally {
    submitBtn.disabled = false;
  }
}

// ============================================
// POST ACTIONS
// ============================================

window.viewPost = function(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post || !post.video_url) return;
  
  window.open(post.video_url, '_blank');
};

window.deletePost = async function(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce post ?')) return;
  
  try {
    const post = allPosts.find(p => p.id === id);
    
    // Delete from storage if video exists
    if (post?.video_url) {
      const filename = post.video_url.split('/').pop();
      await window.supabaseClient.storage
        .from('videos')
        .remove([filename]);
    }
    
    // Delete post record
    const { error } = await window.supabaseClient
      .from('posts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    window.adminCore.showToast('Post supprimé');
    loadPosts();
    loadStats();
    
  } catch (err) {
    console.error('Delete error:', err);
    window.adminCore.showToast('Erreur lors de la suppression', 'error');
  }
};

// Close modal on overlay click
document.getElementById('upload-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeUploadModal();
  }
});
