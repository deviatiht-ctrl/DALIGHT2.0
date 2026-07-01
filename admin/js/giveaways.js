// ============================================
// DALIGHT GIVEAWAYS / CONCOURS ADMIN
// ============================================

let currentGiveawayId = null;
let allGiveaways = [];
let allParticipants = [];
let flyerFileToUpload = null;

// Supabase Storage bucket name
const STORAGE_BUCKET = 'giveaways-flyers';

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminAuth();
  loadGiveaways();
  loadStats();
  lucide.createIcons();
});

// ============================================
// LOAD GIVEAWAYS
// ============================================

async function loadGiveaways() {
  try {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allGiveaways = data;
    renderGiveaways(data);
  } catch (err) {
    console.error('Error loading giveaways:', err);
    showToast('Erreur lors du chargement des concours', 'error');
  }
}

// ============================================
// RENDER GIVEAWAYS
// ============================================

function renderGiveaways(giveaways) {
  const grid = document.getElementById('giveaways-grid');
  
  if (!giveaways || giveaways.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;background:var(--glass-bg);border-radius:12px;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="64" height="64" style="color:var(--text-muted);margin-bottom:1rem;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
        </svg>
        <p style="color:var(--text-muted);">Aucun concours pour le moment</p>
        <button class="btn btn-primary" onclick="openGiveawayModal()" style="margin-top:1rem;">Créer un concours</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = giveaways.map(g => {
    const startDate = new Date(g.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const endDate = new Date(g.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isActive = g.is_active;
    const isExpired = new Date(g.end_date) < new Date();
    
    return `
      <div class="glass-card" style="overflow:hidden;">
        ${g.flyer_url ? `
          <div style="height:180px;background:url('${g.flyer_url}') center/cover no-repeat;position:relative;">
            <div style="position:absolute;top:10px;right:10px;padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:600;background:${isActive ? '#10b981' : isExpired ? '#ef4444' : '#6b7280'};color:white;">
              ${isActive ? 'Actif' : isExpired ? 'Expiré' : 'Inactif'}
            </div>
          </div>
        ` : `
          <div style="height:180px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;position:relative;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" width="64" height="64" style="color:white;opacity:0.5;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
            </svg>
            <div style="position:absolute;top:10px;right:10px;padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:600;background:${isActive ? '#10b981' : isExpired ? '#ef4444' : '#6b7280'};color:white;">
              ${isActive ? 'Actif' : isExpired ? 'Expiré' : 'Inactif'}
            </div>
          </div>
        `}
        <div style="padding:1.25rem;">
          <h3 style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;color:var(--text-primary);">${g.title}</h3>
          <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5;max-height:60px;overflow:hidden;text-overflow:ellipsis;">${g.description || 'Aucune description'}</p>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
            ${g.instagram_url ? `<a href="${g.instagram_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem;"><i data-lucide="instagram" width="14"></i> Instagram</a>` : ''}
            ${g.facebook_url ? `<a href="${g.facebook_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem;"><i data-lucide="facebook" width="14"></i> Facebook</a>` : ''}
            ${g.tiktok_url ? `<a href="${g.tiktok_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem;"><i data-lucide="music" width="14"></i> TikTok</a>` : ''}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:1rem;">
            <div><strong>Début:</strong> ${startDate}</div>
            <div><strong>Fin:</strong> ${endDate}</div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="viewParticipants('${g.id}')">
              <i data-lucide="users" width="14"></i> Participants
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editGiveaway('${g.id}')">
              <i data-lucide="edit" width="14"></i> Modifier
            </button>
            <button class="btn btn-secondary btn-sm" onclick="toggleActive('${g.id}', ${!g.is_active})" style="background:${g.is_active ? '#f59e0b' : '#10b981'};border-color:${g.is_active ? '#f59e0b' : '#10b981'};">
              <i data-lucide="${g.is_active ? 'pause' : 'play'}" width="14"></i> ${g.is_active ? 'Désactiver' : 'Activer'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteGiveaway('${g.id}')">
              <i data-lucide="trash-2" width="14"></i> Supprimer
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// ============================================
// LOAD STATS
// ============================================

async function loadStats() {
  try {
    // Total giveaways
    const { count: totalGiveaways } = await supabaseClient
      .from('giveaways')
      .select('*', { count: 'exact', head: true });

    // Active giveaways
    const { count: activeGiveaways } = await supabaseClient
      .from('giveaways')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Total participants
    const { count: totalParticipants } = await supabaseClient
      .from('giveaway_participants')
      .select('*', { count: 'exact', head: true });

    document.getElementById('total-giveaways').textContent = totalGiveaways || 0;
    document.getElementById('active-giveaways').textContent = activeGiveaways || 0;
    document.getElementById('total-participants').textContent = totalParticipants || 0;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function previewFlyer(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('flyer-preview');
      const img = document.getElementById('flyer-preview-img');
      img.src = e.target.result;
      preview.style.display = 'block';
      flyerFileToUpload = input.files[0];
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function openGiveawayModal(giveaway = null) {
  const modal = document.getElementById('modal-giveaway');
  const title = document.getElementById('modal-title');
  
  // Reset flyer file
  flyerFileToUpload = null;
  document.getElementById('flyer-preview').style.display = 'none';
  document.getElementById('g-flyer-file').value = '';
  
  if (giveaway) {
    title.textContent = 'Modifier le concours';
    currentGiveawayId = giveaway.id;
    document.getElementById('g-title').value = giveaway.title || '';
    document.getElementById('g-description').value = giveaway.description || '';
    document.getElementById('g-rules').value = giveaway.rules || '';
    document.getElementById('g-start-date').value = giveaway.start_date ? giveaway.start_date.slice(0, 16) : '';
    document.getElementById('g-end-date').value = giveaway.end_date ? giveaway.end_date.slice(0, 16) : '';
    document.getElementById('g-flyer-url').value = giveaway.flyer_url || '';
    
    // Parse JSON arrays to textareas
    document.getElementById('g-instagram-urls').value = Array.isArray(giveaway.instagram_urls) ? giveaway.instagram_urls.join('\n') : (giveaway.instagram_url || '');
    document.getElementById('g-facebook-urls').value = Array.isArray(giveaway.facebook_urls) ? giveaway.facebook_urls.join('\n') : (giveaway.facebook_url || '');
    document.getElementById('g-tiktok-urls').value = Array.isArray(giveaway.tiktok_urls) ? giveaway.tiktok_urls.join('\n') : (giveaway.tiktok_url || '');
    document.getElementById('g-twitter-urls').value = Array.isArray(giveaway.twitter_urls) ? giveaway.twitter_urls.join('\n') : (giveaway.twitter_url || '');
    
    document.getElementById('g-active').checked = giveaway.is_active || false;
    
    // Show existing flyer preview
    if (giveaway.flyer_url) {
      const preview = document.getElementById('flyer-preview');
      const img = document.getElementById('flyer-preview-img');
      img.src = giveaway.flyer_url;
      preview.style.display = 'block';
    }
  } else {
    title.textContent = 'Nouveau concours';
    currentGiveawayId = null;
    document.getElementById('g-title').value = '';
    document.getElementById('g-description').value = '';
    document.getElementById('g-rules').value = '';
    document.getElementById('g-start-date').value = '';
    document.getElementById('g-end-date').value = '';
    document.getElementById('g-flyer-url').value = '';
    document.getElementById('g-instagram-urls').value = '';
    document.getElementById('g-facebook-urls').value = '';
    document.getElementById('g-tiktok-urls').value = '';
    document.getElementById('g-twitter-urls').value = '';
    document.getElementById('g-active').checked = false;
  }
  
  modal.classList.add('active');
}

function closeGiveawayModal() {
  document.getElementById('modal-giveaway').classList.remove('active');
  currentGiveawayId = null;
  flyerFileToUpload = null;
}

function editGiveaway(id) {
  const giveaway = allGiveaways.find(g => g.id === id);
  if (giveaway) {
    openGiveawayModal(giveaway);
  }
}

// ============================================
// SAVE GIVEAWAY
// ============================================

async function uploadFlyer(file) {
  if (!file) return null;
  
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${STORAGE_BUCKET}/${fileName}`;
    
    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file);
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    
    return publicUrl;
  } catch (err) {
    console.error('Error uploading flyer:', err);
    throw new Error('Erreur lors de l\'upload du flyer');
  }
}

function parseUrls(textareaValue) {
  if (!textareaValue) return [];
  return textareaValue
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);
}

async function saveGiveaway() {
  const title = document.getElementById('g-title').value.trim();
  const description = document.getElementById('g-description').value.trim();
  const rules = document.getElementById('g-rules').value.trim();
  const startDate = document.getElementById('g-start-date').value;
  const endDate = document.getElementById('g-end-date').value;
  const currentFlyerUrl = document.getElementById('g-flyer-url').value.trim();
  const isActive = document.getElementById('g-active').checked;

  // Parse social media URLs from textareas
  const instagramUrls = parseUrls(document.getElementById('g-instagram-urls').value);
  const facebookUrls = parseUrls(document.getElementById('g-facebook-urls').value);
  const tiktokUrls = parseUrls(document.getElementById('g-tiktok-urls').value);
  const twitterUrls = parseUrls(document.getElementById('g-twitter-urls').value);

  if (!title) {
    showToast('Veuillez entrer un titre', 'error');
    return;
  }

  if (!startDate || !endDate) {
    showToast('Veuillez entrer les dates de début et de fin', 'error');
    return;
  }

  if (new Date(startDate) >= new Date(endDate)) {
    showToast('La date de fin doit être après la date de début', 'error');
    return;
  }

  try {
    const btn = document.getElementById('btn-save-giveaway');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    // Upload flyer if new file selected
    let flyerUrl = currentFlyerUrl;
    if (flyerFileToUpload) {
      flyerUrl = await uploadFlyer(flyerFileToUpload);
    }

    const giveawayData = {
      title,
      description,
      rules,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      flyer_url: flyerUrl || null,
      // Keep single URL fields for backward compatibility
      instagram_url: instagramUrls.length > 0 ? instagramUrls[0] : null,
      facebook_url: facebookUrls.length > 0 ? facebookUrls[0] : null,
      tiktok_url: tiktokUrls.length > 0 ? tiktokUrls[0] : null,
      twitter_url: twitterUrls.length > 0 ? twitterUrls[0] : null,
      // New JSON array fields
      instagram_urls: instagramUrls,
      facebook_urls: facebookUrls,
      tiktok_urls: tiktokUrls,
      twitter_urls: twitterUrls,
      is_active: isActive
    };

    let error;
    if (currentGiveawayId) {
      const { error: updateError } = await supabaseClient
        .from('giveaways')
        .update(giveawayData)
        .eq('id', currentGiveawayId);
      error = updateError;
    } else {
      const { error: insertError } = await supabaseClient
        .from('giveaways')
        .insert(giveawayData);
      error = insertError;
    }

    if (error) throw error;

    showToast(currentGiveawayId ? 'Concours modifié avec succès' : 'Concours créé avec succès', 'success');
    closeGiveawayModal();
    loadGiveaways();
    loadStats();
  } catch (err) {
    console.error('Error saving giveaway:', err);
    showToast(err.message || 'Erreur lors de l\'enregistrement', 'error');
  } finally {
    const btn = document.getElementById('btn-save-giveaway');
    btn.disabled = false;
    btn.textContent = 'Enregistrer';
  }
}

// ============================================
// TOGGLE ACTIVE
// ============================================

async function toggleActive(id, isActive) {
  try {
    const { error } = await supabaseClient
      .from('giveaways')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;

    showToast(isActive ? 'Concours activé' : 'Concours désactivé', 'success');
    loadGiveaways();
    loadStats();
  } catch (err) {
    console.error('Error toggling active:', err);
    showToast('Erreur lors de la modification', 'error');
  }
}

// ============================================
// DELETE GIVEAWAY
// ============================================

async function deleteGiveaway(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce concours? Tous les participants seront également supprimés.')) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('giveaways')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Concours supprimé avec succès', 'success');
    loadGiveaways();
    loadStats();
  } catch (err) {
    console.error('Error deleting giveaway:', err);
    showToast('Erreur lors de la suppression', 'error');
  }
}

// ============================================
// PARTICIPANTS
// ============================================

async function viewParticipants(giveawayId) {
  const modal = document.getElementById('modal-participants');
  const title = document.getElementById('participants-title');
  const table = document.getElementById('participants-table');
  
  const giveaway = allGiveaways.find(g => g.id === giveawayId);
  title.textContent = `Participants - ${giveaway ? giveaway.title : 'Concours'}`;
  
  table.innerHTML = '<tr><td colspan="7" class="text-center">Chargement...</td></tr>';
  modal.classList.add('active');

  try {
    const { data, error } = await supabaseClient
      .from('giveaway_participants')
      .select('*')
      .eq('giveaway_id', giveawayId)
      .order('vote_count', { ascending: false });

    if (error) throw error;
    
    allParticipants = data || [];

    if (!data || data.length === 0) {
      table.innerHTML = '<tr><td colspan="7" class="text-center">Aucun participant pour ce concours</td></tr>';
      return;
    }

    table.innerHTML = data.map(p => `
      <tr>
        <td><strong>${p.first_name} ${p.last_name}</strong></td>
        <td>${p.email}</td>
        <td>${p.instagram_username || '-'}</td>
        <td>
          <span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;background:${p.is_subscribed_instagram ? '#10b981' : '#ef4444'};color:white;">
            ${p.is_subscribed_instagram ? 'Oui' : 'Non'}
          </span>
        </td>
        <td>${p.tagged_friends_count || 0}</td>
        <td><strong>${p.vote_count || 0}</strong></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="viewVotes('${p.id}', '${p.first_name} ${p.last_name}')">
            <i data-lucide="eye" width="14"></i> Votes
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteParticipant('${p.id}')">
            <i data-lucide="trash-2" width="14"></i>
          </button>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error loading participants:', err);
    table.innerHTML = '<tr><td colspan="7" class="text-center">Erreur lors du chargement</td></tr>';
  }
}

function closeParticipantsModal() {
  document.getElementById('modal-participants').classList.remove('active');
}

// ============================================
// VOTES VERIFICATION
// ============================================

async function viewVotes(participantId, participantName) {
  const modal = document.getElementById('modal-votes');
  const title = document.getElementById('votes-title');
  const table = document.getElementById('votes-table');
  
  title.textContent = `Votes - ${participantName}`;
  table.innerHTML = '<tr><td colspan="7" class="text-center">Chargement...</td></tr>';
  modal.classList.add('active');
  
  try {
    const { data, error } = await supabaseClient
      .from('giveaway_votes')
      .select('*')
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      table.innerHTML = '<tr><td colspan="7" class="text-center">Aucun vote pour ce participant</td></tr>';
      return;
    }
    
    table.innerHTML = data.map(v => `
      <tr>
        <td><strong>${v.voter_instagram_username || '-'}</strong></td>
        <td>
          <span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;background:${v.voter_subscribed_instagram ? '#10b981' : '#ef4444'};color:white;">
            ${v.voter_subscribed_instagram ? 'Oui' : 'Non'}
          </span>
        </td>
        <td>${v.voter_liked_post ? 'Oui' : 'Non'}</td>
        <td>${v.voter_commented_post ? 'Oui' : 'Non'}</td>
        <td>
          <span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;background:${v.is_verified ? '#10b981' : '#f59e0b'};color:white;">
            ${v.is_verified ? 'Vérifié' : 'En attente'}
          </span>
        </td>
        <td>${new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
        <td>
          <button class="btn btn-${v.is_verified ? 'danger' : 'success'} btn-sm" onclick="toggleVoteVerification('${v.id}', ${!v.is_verified})">
            ${v.is_verified ? 'Annuler' : 'Vérifier'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading votes:', err);
    table.innerHTML = '<tr><td colspan="7" class="text-center">Erreur lors du chargement</td></tr>';
  }
}

function closeVotesModal() {
  document.getElementById('modal-votes').classList.remove('active');
}

async function toggleVoteVerification(voteId, verified) {
  try {
    const { error } = await supabaseClient
      .from('giveaway_votes')
      .update({ is_verified: verified })
      .eq('id', voteId);
    
    if (error) throw error;
    
    showToast(verified ? 'Vote vérifié' : 'Vérification annulée', 'success');
    // Reload current votes modal
    const modal = document.getElementById('modal-votes');
    if (modal.classList.contains('active')) {
      const title = document.getElementById('votes-title').textContent;
      const participantName = title.replace('Votes - ', '');
      // Find participant by name in current participants data
      const participant = allParticipants?.find(p => `${p.first_name} ${p.last_name}` === participantName);
      if (participant) {
        viewVotes(participant.id, participantName);
      }
    }
  } catch (err) {
    console.error('Error updating vote verification:', err);
    showToast('Erreur lors de la mise à jour', 'error');
  }
}

async function deleteParticipant(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce participant?')) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('giveaway_participants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Participant supprimé', 'success');
    loadStats();
    // Reload participants
    const modal = document.getElementById('modal-participants');
    if (modal.classList.contains('active')) {
      // Find current giveaway ID and reload
      const giveawayId = allGiveaways.find(g => g.id === currentGiveawayId)?.id;
      if (giveawayId) {
        viewParticipants(giveawayId);
      }
    }
  } catch (err) {
    console.error('Error deleting participant:', err);
    showToast('Erreur lors de la suppression', 'error');
  }
}
