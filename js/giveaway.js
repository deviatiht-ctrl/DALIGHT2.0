// ============================================
// DALIGHT GIVEAWAYS / CONCOURS PUBLIC
// ============================================

const SUPABASE_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentGiveaway = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  loadActiveGiveaways();
  handleReferralLink();
});

// ============================================
// LOAD ACTIVE GIVEAWAYS
// ============================================

async function loadActiveGiveaways() {
  try {
    const { data, error } = await supabaseClient
      .from('giveaways')
      .select('*')
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: true });

    if (error) throw error;

    const container = document.getElementById('giveaways-container');
    const noGiveaways = document.getElementById('no-giveaways');

    if (!data || data.length === 0) {
      container.style.display = 'none';
      noGiveaways.style.display = 'block';
      return;
    }

    noGiveaways.style.display = 'none';
    container.style.display = 'grid';

    const findLinkSection = document.getElementById('find-link-section');
    if (findLinkSection) findLinkSection.style.display = 'block';

    container.innerHTML = data.map(g => {
      const startDate = new Date(g.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const endDate = new Date(g.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="glass-card" style="overflow:hidden;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);display:flex;flex-direction:column;width:100%;">
          ${g.flyer_url ? `
            <div style="height:180px;background:url('${g.flyer_url}') center/cover no-repeat;position:relative;">
              <div style="position:absolute;bottom:0;left:0;right:0;height:50%;background:linear-gradient(to top,rgba(0,0,0,0.5),transparent);"></div>
            </div>
          ` : `
            <div style="height:180px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;">
              <i data-lucide="gift" style="width:60px;height:60px;color:white;opacity:0.5;"></i>
            </div>
          `}
          <div style="padding:1.25rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
              <i data-lucide="trophy" style="width:18px;height:18px;color:#667eea;"></i>
              <span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#667eea;">Concours</span>
            </div>
            <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;color:var(--text-primary);line-height:1.3;">${g.title}</h3>
            <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5;">${g.description || ''}</p>
            
            ${g.rules ? `
              <div style="margin-bottom:1rem;padding:0.75rem;background:#f8f9fa;border-radius:8px;border-left:3px solid #667eea;">
                <div style="font-size:0.8rem;color:var(--text-muted);white-space:pre-line;">${g.rules}</div>
              </div>
            ` : ''}
            
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem;display:flex;flex-direction:column;gap:0.35rem;">
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <i data-lucide="calendar" style="width:14px;height:14px;"></i>
                <span><strong>Début:</strong> ${startDate}</span>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <i data-lucide="flag" style="width:14px;height:14px;"></i>
                <span><strong>Fin:</strong> ${endDate}</span>
              </div>
            </div>
            
            <div style="margin-bottom:1rem;padding:0.75rem;background:#f8f9fa;border-radius:8px;">
              <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.03em;">Suivez-nous</div>
              <div style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.85rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <i class="fa-brands fa-instagram" style="width:16px;height:16px;color:#E1306C;font-size:1rem;"></i>
                  <span>@dalightbeauty</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <i class="fa-brands fa-facebook-f" style="width:16px;height:16px;color:#1877F2;font-size:1rem;"></i>
                  <span>DALIGHT Beauty</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <i class="fa-brands fa-tiktok" style="width:16px;height:16px;color:#000000;font-size:1rem;"></i>
                  <span>@dalightbeauty</span>
                </div>
              </div>
            </div>
            
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
              ${Array.isArray(g.instagram_urls) && g.instagram_urls.length > 0 ? g.instagram_urls.map((url, i) => `<a href="${url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#E1306C;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-instagram" style="font-size:0.9rem;"></i> IG ${i + 1}</a>`).join('') : (g.instagram_url ? `<a href="${g.instagram_url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#E1306C;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-instagram" style="font-size:0.9rem;"></i> Instagram</a>` : '')}
              ${Array.isArray(g.facebook_urls) && g.facebook_urls.length > 0 ? g.facebook_urls.map((url, i) => `<a href="${url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#1877F2;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-facebook-f" style="font-size:0.9rem;"></i> FB ${i + 1}</a>`).join('') : (g.facebook_url ? `<a href="${g.facebook_url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#1877F2;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-facebook-f" style="font-size:0.9rem;"></i> Facebook</a>` : '')}
              ${Array.isArray(g.tiktok_urls) && g.tiktok_urls.length > 0 ? g.tiktok_urls.map((url, i) => `<a href="${url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#000000;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-tiktok" style="font-size:0.9rem;"></i> TikTok ${i + 1}</a>`).join('') : (g.tiktok_url ? `<a href="${g.tiktok_url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#000000;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-tiktok" style="font-size:0.9rem;"></i> TikTok</a>` : '')}
              ${Array.isArray(g.twitter_urls) && g.twitter_urls.length > 0 ? g.twitter_urls.map((url, i) => `<a href="${url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#1DA1F2;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-x-twitter" style="font-size:0.9rem;"></i> X ${i + 1}</a>`).join('') : (g.twitter_url ? `<a href="${g.twitter_url}" target="_blank" class="btn" style="flex:1;min-width:110px;padding:0.5rem;background:#1DA1F2;color:white;border:none;border-radius:6px;text-align:center;text-decoration:none;font-size:0.8rem;font-weight:500;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fa-brands fa-x-twitter" style="font-size:0.9rem;"></i> Twitter</a>` : '')}
            </div>
            
            <button onclick="openRegistrationModal('${g.id}')" class="btn" style="width:100%;padding:0.75rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
              <i data-lucide="user-plus" style="width:18px;height:18px;"></i> Participer
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) {
      lucide.createIcons();
    }

    // Load leaderboard after giveaways are loaded
    loadLeaderboard(data.map(g => g.id));
  } catch (err) {
    console.error('Error loading giveaways:', err);
    const container = document.getElementById('giveaways-container');
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;">
        <p style="color:var(--text-muted);">Erreur lors du chargement des concours. Veuillez réessayer plus tard.</p>
      </div>
    `;
  }
}

// ============================================
// LEADERBOARD
// ============================================

async function loadLeaderboard(giveawayIds) {
  if (!giveawayIds || giveawayIds.length === 0) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('giveaway_participants')
      .select('id, first_name, last_name, vote_count, instagram_username, giveaway_id')
      .in('giveaway_id', giveawayIds)
      .order('vote_count', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const leaderboardSection = document.getElementById('leaderboard-section');
    const leaderboardContainer = document.getElementById('leaderboard-container');
    
    if (!data || data.length === 0) {
      leaderboardSection.style.display = 'none';
      return;
    }
    
    leaderboardSection.style.display = 'block';
    
    const maxVotes = Math.max(...data.map(p => p.vote_count || 0), 1);
    const goal = 100;

    // Top 3 podium
    const top3 = data.slice(0, 3);
    const podiumHTML = top3.length > 0 ? `
      <div class="giveaway-podium" style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;align-items:end;margin-bottom:2rem;">
        ${[1, 0, 2].map(idx => {
          if (!top3[idx]) return '';
          const p = top3[idx];
          const rank = idx + 1;
          const order = rank === 1 ? 2 : rank === 2 ? 1 : 3;
          const height = rank === 1 ? '180px' : rank === 2 ? '140px' : '120px';
          const color = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
          const medal = rank === 1 ? '1er' : rank === 2 ? '2e' : '3e';
          const percentage = Math.min((p.vote_count / goal) * 100, 100);
          return `
            <div class="podium-card" style="order:${order};background:linear-gradient(180deg,${color}22 0%,#fff 60%);border:2px solid ${color};border-radius:16px;padding:1rem;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
              <div style="font-size:1.4rem;font-weight:800;color:${color};margin-bottom:0.5rem;">${medal}</div>
              <div style="font-weight:700;font-size:1rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.first_name} ${p.last_name}</div>
              ${p.instagram_username ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem;">@${p.instagram_username}</div>` : '<div style="margin-bottom:0.75rem;"></div>'}
              <div style="font-size:1.5rem;font-weight:800;color:#667eea;margin-bottom:0.5rem;">${p.vote_count || 0}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem;">vote${p.vote_count > 1 ? 's' : ''}</div>
              <div style="height:${height};background:linear-gradient(180deg,${color} 0%,${color}88 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem;">
                <i data-lucide="${rank === 1 ? 'crown' : 'award'}" style="width:32px;height:32px;color:#fff;"></i>
              </div>
              <div style="width:100%;height:6px;background:#e9ecef;border-radius:999px;overflow:hidden;margin-bottom:0.25rem;">
                <div style="height:100%;width:${percentage}%;background:linear-gradient(90deg,#667eea 0%,#764ba2 100%);border-radius:999px;transition:width 1s ease;"></div>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);">Objectif 100 votes</div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    const listHTML = data.map((p, index) => {
      const rank = index + 1;
      const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#667eea';
      const percentage = Math.min((p.vote_count / goal) * 100, 100);
      const barWidth = Math.min((p.vote_count / maxVotes) * 100, 100);
      const isTop3 = rank <= 3;
      return `
        <div class="glass-card" style="padding:1rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;flex-direction:column;gap:0.75rem;${isTop3 ? 'border:2px solid ' + rankColor + '66;' : ''}">
          <div style="display:flex;align-items:center;gap:1rem;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:1rem;flex:1;min-width:0;">
              <div style="width:44px;height:44px;border-radius:50%;background:${rankColor};color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.95rem;flex-shrink:0;${rank === 1 ? 'box-shadow:0 0 0 4px ' + rankColor + '33;' : ''}">
                ${rank === 1 ? '<i data-lucide="crown" style="width:22px;height:22px;"></i>' : rank}
              </div>
              <div style="min-width:0;">
                <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.first_name} ${p.last_name}</div>
                ${p.instagram_username ? `<div style="font-size:0.8rem;color:var(--text-muted);">@${p.instagram_username}</div>` : ''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:1.2rem;font-weight:800;color:#667eea;">${p.vote_count || 0}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">vote${p.vote_count > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style="width:100%;height:8px;background:#e9ecef;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${barWidth}%;background:linear-gradient(90deg,#667eea 0%,#764ba2 100%);border-radius:999px;transition:width 1s ease;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:var(--text-muted);">
            <span>Progression</span>
            <span>${Math.round(percentage)}% de l'objectif</span>
          </div>
          <button onclick="openVoteModal('${p.id}', '${p.first_name} ${p.last_name}')" style="padding:0.6rem 0.75rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.3rem;">
            <i data-lucide="heart" style="width:14px;height:14px;"></i> Voter pour ce participant
          </button>
        </div>
      `;
    }).join('');

    leaderboardContainer.innerHTML = podiumHTML + listHTML;
    
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Error loading leaderboard:', err);
  }
}

// ============================================
// REGISTRATION MODAL
// ============================================

function openRegistrationModal(giveawayId) {
  const modal = document.getElementById('registration-modal');
  const title = document.getElementById('modal-giveaway-title');
  const description = document.getElementById('modal-giveaway-description');
  const rules = document.getElementById('reg-rules');
  
  // Load giveaway details
  supabaseClient
    .from('giveaways')
    .select('*')
    .eq('id', giveawayId)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        console.error('Error loading giveaway:', error);
        alert('Erreur lors du chargement du concours');
        return;
      }
      
      currentGiveaway = data;
      title.textContent = data.title;
      description.textContent = data.description || '';
      rules.innerHTML = data.rules ? `<strong>Règles:</strong><br>${data.rules.replace(/\n/g, '<br>')}` : '';
      document.getElementById('reg-giveaway-id').value = data.id;
      
      modal.style.display = 'flex';
    });
}

function closeRegistrationModal() {
  document.getElementById('registration-modal').style.display = 'none';
  document.getElementById('registration-form').reset();
  currentGiveaway = null;
}

// ============================================
// SUBMIT REGISTRATION
// ============================================

async function submitRegistration(event) {
  event.preventDefault();
  
  const giveawayId = document.getElementById('reg-giveaway-id').value;
  const firstName = document.getElementById('reg-first-name').value.trim();
  const lastName = document.getElementById('reg-last-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  const instagramUsername = document.getElementById('reg-instagram').value.trim();
  const facebookUsername = document.getElementById('reg-facebook').value.trim();
  const tiktokUsername = document.getElementById('reg-tiktok').value.trim();
  const isSubscribedInstagram = document.getElementById('reg-subscribed-instagram').checked;
  const isSubscribedFacebook = document.getElementById('reg-subscribed-facebook').checked;
  const isSubscribedTiktok = document.getElementById('reg-subscribed-tiktok').checked;
  const taggedFriendsCount = parseInt(document.getElementById('reg-tagged-friends').value) || 0;
  
  // Validation: Must be subscribed to at least one social media
  if (!isSubscribedInstagram && !isSubscribedFacebook && !isSubscribedTiktok) {
    alert('Vous devez vous abonner à au moins un de nos réseaux sociaux pour participer!');
    return;
  }
  
  // Validation: If not subscribed to Instagram, vote won't be valid
  if (!isSubscribedInstagram) {
    const confirm = window.confirm('Attention: Si vous n\'êtes pas abonné à Instagram, votre vote ne sera pas valide. Voulez-vous continuer quand même?');
    if (!confirm) return;
  }
  
  // Generate unique vote key
  const uniqueVoteKey = `${giveawayId}-${email}-${Date.now()}`;
  
  const participantData = {
    giveaway_id: giveawayId,
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone || null,
    address: address || null,
    instagram_username: instagramUsername || null,
    facebook_username: facebookUsername || null,
    tiktok_username: tiktokUsername || null,
    is_subscribed_instagram: isSubscribedInstagram,
    is_subscribed_facebook: isSubscribedFacebook,
    is_subscribed_tiktok: isSubscribedTiktok,
    tagged_friends_count: taggedFriendsCount,
    vote_count: 0,
    unique_vote_key: uniqueVoteKey
  };
  
  try {
    const { error } = await supabaseClient
      .from('giveaway_participants')
      .insert(participantData);
    
    if (error) {
      // Check if email already registered for this giveaway
      if (error.code === '23505') {
        alert('Cet email est déjà inscrit à ce concours!');
        return;
      }
      throw error;
    }
    
    showSuccessModal(uniqueVoteKey, 0, firstName);
    closeRegistrationModal();
  } catch (err) {
    console.error('Error submitting registration:', err);
    alert('Erreur lors de l\'inscription. Veuillez réessayer.');
  }
}

// ============================================
// SUCCESS MODAL AFTER REGISTRATION
// ============================================

function showSuccessModal(voteKey, voteCount, participantName) {
  const modal = document.getElementById('success-modal');
  const referralLink = generateReferralLink(voteKey);
  const goal = 100;
  const percentage = Math.min((voteCount / goal) * 100, 100);
  
  document.getElementById('success-vote-count').textContent = `${voteCount} vote${voteCount > 1 ? 's' : ''}`;
  document.getElementById('success-progress-bar').style.width = `${percentage}%`;
  document.getElementById('success-referral-link').value = referralLink;
  
  const shareText = encodeURIComponent(`Votez pour moi au concours DALIGHT!\n\n${referralLink}`);
  document.getElementById('success-share-whatsapp').href = `https://wa.me/?text=${shareText}`;
  document.getElementById('success-share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;
  document.getElementById('success-share-twitter').href = `https://twitter.com/intent/tweet?text=${shareText}`;
  
  modal.style.display = 'flex';
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeSuccessModal() {
  document.getElementById('success-modal').style.display = 'none';
}

function generateReferralLink(voteKey) {
  const url = new URL(window.location.href);
  url.searchParams.set('ref', voteKey);
  return url.toString();
}

function copyReferralLink() {
  const input = document.getElementById('success-referral-link');
  input.select();
  input.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(input.value).then(() => {
    alert('Lien copié!');
  }).catch(() => {
    document.execCommand('copy');
    alert('Lien copié!');
  });
}

async function retrieveReferralLink() {
  const emailInput = document.getElementById('find-link-email');
  const resultDiv = document.getElementById('find-link-result');
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    alert('Veuillez entrer votre email.');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('giveaway_participants')
      .select('id, first_name, last_name, unique_vote_key, vote_count, giveaway_id')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      resultDiv.innerHTML = `
        <div style="padding:1rem;background:#fff0f0;border:1px solid #ffcdd2;border-radius:8px;color:#c62828;font-size:0.9rem;">
          <i data-lucide="alert-circle" style="width:16px;height:16px;vertical-align:-3px;margin-right:0.3rem;"></i>
          Aucun participant trouvé avec cet email.
        </div>
      `;
      resultDiv.style.display = 'block';
      if (window.lucide) lucide.createIcons();
      return;
    }

    resultDiv.innerHTML = data.map(p => {
      const link = generateReferralLink(p.unique_vote_key);
      return `
        <div style="padding:1rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:0.75rem;">
          <div style="font-weight:700;color:#0369a1;margin-bottom:0.3rem;">${p.first_name} ${p.last_name}</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;">${p.vote_count || 0} vote${p.vote_count > 1 ? 's' : ''}</div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <input type="text" value="${link}" readonly style="flex:1;min-width:200px;padding:0.6rem;border:1px solid #ddd;border-radius:8px;font-size:0.85rem;background:#fff;" onclick="this.select()">
            <button onclick="copyLostLink(this)" data-link="${link}" style="padding:0.6rem 1rem;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:0.3rem;">
              <i data-lucide="copy" style="width:16px;height:16px;"></i> Copier
            </button>
          </div>
        </div>
      `;
    }).join('');
    resultDiv.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error retrieving referral link:', err);
    alert('Erreur lors de la recherche. Veuillez réessayer.');
  }
}

function copyLostLink(btn) {
  const link = btn.dataset.link;
  navigator.clipboard.writeText(link).then(() => {
    alert('Lien copié!');
  }).catch(() => {
    document.execCommand('copy');
    alert('Lien copié!');
  });
}

// ============================================
// VOTE MODAL
// ============================================

function openVoteModal(participantId, participantName) {
  const modal = document.getElementById('vote-modal');
  document.getElementById('vote-participant-name').textContent = `Vote pour ${participantName}`;
  document.getElementById('vote-participant-id').value = participantId;
  modal.style.display = 'flex';
}

function closeVoteModal() {
  document.getElementById('vote-modal').style.display = 'none';
  document.getElementById('vote-form').reset();
}

// ============================================
// SUBMIT VOTE
// ============================================

async function submitVote(event) {
  event.preventDefault();
  
  const participantId = document.getElementById('vote-participant-id').value;
  const voterInstagram = document.getElementById('voter-instagram').value.trim().replace(/^@/, '');
  const isSubscribedInstagram = document.getElementById('voter-subscribed-instagram').checked;
  const likedPost = document.getElementById('voter-liked-post').checked;
  const commentedPost = document.getElementById('voter-commented-post').checked;
  
  if (!voterInstagram) {
    alert('Veuillez entrer votre nom d\'utilisateur Instagram.');
    return;
  }
  
  if (!isSubscribedInstagram) {
    alert('Vous devez suivre notre compte Instagram pour que votre vote soit valide.');
    return;
  }
  
  try {
    // Check if this Instagram username already voted for this participant
    const { data: existingVote, error: voteCheckError } = await supabaseClient
      .from('giveaway_votes')
      .select('*')
      .eq('participant_id', participantId)
      .eq('voter_instagram_username', voterInstagram)
      .single();
    
    if (existingVote) {
      alert('Vous avez déjà voté pour ce participant avec ce compte Instagram!');
      return;
    }
    
    // Record the vote
    const { error: voteError } = await supabaseClient
      .from('giveaway_votes')
      .insert({
        participant_id: participantId,
        voter_instagram_username: voterInstagram,
        voter_subscribed_instagram: isSubscribedInstagram,
        voter_liked_post: likedPost,
        voter_commented_post: commentedPost,
        is_verified: false
      });
    
    if (voteError) throw voteError;
    
    // Increment participant vote count
    const { data: currentParticipant, error: fetchError } = await supabaseClient
      .from('giveaway_participants')
      .select('vote_count')
      .eq('id', participantId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const newVoteCount = (currentParticipant.vote_count || 0) + 1;
    const { error: updateError } = await supabaseClient
      .from('giveaway_participants')
      .update({ vote_count: newVoteCount })
      .eq('id', participantId);
    
    if (updateError) throw updateError;
    
    // Refresh leaderboard to show updated vote count
    const { data: giveawayParticipant } = await supabaseClient
      .from('giveaway_participants')
      .select('giveaway_id')
      .eq('id', participantId)
      .single();
    
    if (giveawayParticipant) {
      loadLeaderboard([giveawayParticipant.giveaway_id]);
    }
    
    alert('Vote enregistré! Il sera vérifié manuellement par notre équipe.');
    closeVoteModal();
  } catch (err) {
    console.error('Error submitting vote:', err);
    alert('Erreur lors du vote. Veuillez réessayer.');
  }
}

// ============================================
// REFERRAL LINK HANDLING
// ============================================

async function handleReferralLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const refKey = urlParams.get('ref');
  
  if (!refKey) return;
  
  try {
    const { data: participant, error } = await supabaseClient
      .from('giveaway_participants')
      .select('id, first_name, last_name, vote_count, giveaway_id')
      .eq('unique_vote_key', refKey)
      .single();
    
    if (error || !participant) {
      console.log('Referral participant not found');
      return;
    }
    
    // Show vote modal for this participant
    openVoteModal(participant.id, `${participant.first_name} ${participant.last_name}`);
  } catch (err) {
    console.error('Error handling referral link:', err);
  }
}

// Make functions globally available
window.openRegistrationModal = openRegistrationModal;
window.closeRegistrationModal = closeRegistrationModal;
window.submitRegistration = submitRegistration;
window.closeSuccessModal = closeSuccessModal;
window.copyReferralLink = copyReferralLink;
window.retrieveReferralLink = retrieveReferralLink;
window.copyLostLink = copyLostLink;
window.openVoteModal = openVoteModal;
window.closeVoteModal = closeVoteModal;
window.submitVote = submitVote;
