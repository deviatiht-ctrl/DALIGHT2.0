import { getSupabase } from '../js/main.js?v=5.0.0';
import { sendFollowEmail } from './email-service.js';

let supabase = getSupabase();

let currentUser = null;

async function waitForSupabase() {
  let attempts = 0;
  while (!supabase && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    supabase = getSupabase();
    attempts++;
  }
  
  if (!supabase) {
    console.error('❌ Supabase failed to initialize in follow.js');
    return false;
  }
  
  return true;
}

async function initFollowPage() {
  console.log('🚀 Initializing follow page...');
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Cannot initialize follow page - Supabase not ready');
    return;
  }
  
  console.log('✅ Supabase ready, getting current user...');
  currentUser = await getCurrentUser();
  console.log('👤 Current user:', currentUser);
  
  await loadSubscriberCount();
  await loadFeed();
  setupEventListeners();
  if (currentUser) {
    showSubscribeButton();
    configureReviewAccess();
  } else {
    showLoginPrompt();
    configureReviewAccess();
  }
}

async function getCurrentUser() {
  if (!supabase) {
    console.error('❌ Supabase is null in getCurrentUser');
    return null;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function isAdmin(userId) {
  // Assume there's a 'profiles' table with 'role' column
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

async function loadSubscriberCount() {
  const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
  document.getElementById('subscriber-count').textContent = count || 0;
}

async function loadFeed() {
  const { data: posts } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  const orderedPosts = posts || [];
  const videoPosts = orderedPosts.filter((post) => post.type === 'video');
  const reviewPosts = orderedPosts.filter((post) => post.type === 'review');
  await renderVideoFeed(videoPosts);
  renderReviewGallery(reviewPosts);
  updateSpotlightVideo(videoPosts);
}

async function renderVideoFeed(videos) {
  const feedContainer = document.getElementById('feed-posts');
  if (!feedContainer) return;
  feedContainer.innerHTML = '';

  if (!videos.length) {
    feedContainer.innerHTML = '<p class="video-feed__empty">Publiez une première capsule depuis l’admin pour alimenter le fil.</p>';
    return;
  }

  for (const post of videos) {
    const postElement = await createVideoCard(post);
    feedContainer.appendChild(postElement);
  }
}

async function createVideoCard(post) {
  const card = document.createElement('article');
  card.className = 'video-card';
  card.innerHTML = `
    <div class="video-card__media">
      <video src="${post.video_url}" playsinline controls preload="metadata"></video>
      <div class="video-card__badge">
        <span>DALIGHT Head Spa</span>
        <small>${new Date(post.created_at).toLocaleDateString()}</small>
      </div>
    </div>
    <div class="video-card__meta">
      <p>${post.caption || 'Capsule exclusive DALIGHT Head Spa'}</p>
      <div class="video-card__actions">
        <button class="like-btn" data-post-id="${post.id}">❤️ ${post.likes || 0}</button>
        <button class="share-btn" data-video-url="${encodeURIComponent(post.video_url)}" data-caption="${encodeURIComponent(post.caption || '')}">↗ Partager</button>
      </div>
    </div>
  `;
  return card;
}

async function deletePost(postId) {
  await supabase.from('posts').delete().eq('id', postId);
  loadFeed();
}

function setupEventListeners() {
  const subscribeBtn = document.getElementById('subscribe-btn');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', handleSubscribe);
  }
  const feedEl = document.getElementById('feed-posts');
  if (feedEl) {
    feedEl.addEventListener('click', handlePostActions);
  }

  // Review form (assume we add it to HTML)
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', handleReviewSubmit);
  }

  const reviewLoginCta = document.getElementById('review-login-cta');
  if (reviewLoginCta) {
    reviewLoginCta.addEventListener('click', () => {
      window.location.href = './login.html';
    });
  }
}

async function handleSubscribe() {
  console.log('🔘 Subscribe button clicked');
  console.log('👤 Current user:', currentUser);

  if (!currentUser) {
    console.log('⚠️ No user logged in, redirecting to login');
    window.location.href = './login.html';
    return;
  }

  try {
    console.log('📝 Attempting to subscribe user:', currentUser.id);
    const { data, error } = await supabase.from('subscribers').insert([{ user_id: currentUser.id }]);
    
    if (error) {
      console.error('❌ Subscribe error:', error);
      alert('Erè: ' + error.message);
      return;
    }

    console.log('✅ Subscribe successful:', data);
    loadSubscriberCount();
    updateSubscribeButton('Abonné', { disabled: true });
    
    // Send thank you email for following
    sendFollowEmail({
      email: currentUser.email,
      name: currentUser.user_metadata?.full_name || currentUser.email,
    });
  } catch (err) {
    console.error('❌ Subscribe exception:', err);
    alert('Erè: ' + err.message);
  }
}

async function handlePostActions(e) {
  if (e.target.classList.contains('like-btn')) {
    const postId = e.target.dataset.postId;
    await toggleLike(postId);
    return;
  }
  if (e.target.classList.contains('share-btn')) {
    const videoUrl = decodeURIComponent(e.target.dataset.videoUrl || '');
    const caption = decodeURIComponent(e.target.dataset.caption || '');
    shareVideo(videoUrl, caption);
  }
}

async function toggleLike(postId) {
  if (!currentUser) return;

  const { data: existingLike } = await supabase.from('likes').select('*').eq('post_id', postId).eq('user_id', currentUser.id).single();
  if (existingLike) {
    await supabase.from('likes').delete().eq('id', existingLike.id);
  } else {
    await supabase.from('likes').insert([{ post_id: postId, user_id: currentUser.id }]);
  }
  loadFeed();
}

function showCommentForm(postId) {
  // Implement comment form display and submission
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const content = e.target.content.value;
  await supabase.from('posts').insert([{ type: 'review', content, user_id: currentUser.id, user_name: currentUser.email }]);
  loadFeed();
  e.target.reset();
}

function showSubscribeButton() {
  // Check if already subscribed
  supabase.from('subscribers').select('*').eq('user_id', currentUser.id).single().then(({ data }) => {
    if (data) {
      updateSubscribeButton('Abonné', { disabled: true });
    }
  });
}

function showLoginPrompt() {
  updateSubscribeButton('Se connecter pour s\'abonner');
}

function updateSubscribeButton(label, { disabled = false } = {}) {
  const btn = document.getElementById('subscribe-btn');
  if (!btn) return;
  const labelEl = btn.querySelector('.btn-label');
  if (labelEl) {
    labelEl.textContent = label;
  } else {
    btn.textContent = label;
  }
  btn.disabled = disabled;
}

function configureReviewAccess() {
  const formSection = document.getElementById('review-form-section');
  const reviewForm = document.getElementById('review-form');
  const reviewLock = document.getElementById('review-lock');
  const textarea = document.getElementById('review-content');
  const submitBtn = reviewForm?.querySelector('button[type="submit"]');
  if (!formSection) return;

  if (currentUser) {
    formSection.classList.remove('locked');
    textarea?.removeAttribute('disabled');
    submitBtn?.removeAttribute('disabled');
    reviewLock?.setAttribute('hidden', true);
  } else {
    formSection.classList.add('locked');
    textarea?.setAttribute('disabled', 'true');
    submitBtn?.setAttribute('disabled', 'true');
    reviewLock?.removeAttribute('hidden');
  }
}

function renderReviewGallery(posts) {
  const gallery = document.getElementById('review-gallery');
  if (!gallery) return;
  gallery.innerHTML = '';
  const reviews = posts.slice(0, 4);
  if (!reviews.length) {
    gallery.innerHTML = '<p class="review-empty">Soyez le premier à partager votre expérience.</p>';
    return;
  }

  reviews.forEach((review) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="review-card__quote">“${truncateText(review.content, 220)}”</div>
      <div class="review-card__meta">
        <strong>${review.user_name || 'Client anonyme'}</strong>
        <span>${formatDate(review.created_at)}</span>
      </div>
    `;
    gallery.appendChild(card);
  });
}

function updateSpotlightVideo(videos) {
  const videoEl = document.getElementById('featured-video');
  const captionEl = document.getElementById('featured-video-caption');
  const dateEl = document.getElementById('featured-video-date');
  const emptyState = document.getElementById('featured-video-empty');
  if (!videoEl || !captionEl || !dateEl || !emptyState) return;

  const latestVideo = videos[0];
  if (!latestVideo) {
    videoEl.removeAttribute('src');
    videoEl.load();
    captionEl.textContent = 'Publiez une vidéo pour présenter vos rituels.';
    dateEl.textContent = 'Ajoutez une capsule via l\'interface admin.';
    emptyState.hidden = false;
    return;
  }

  videoEl.src = latestVideo.video_url;
  videoEl.load();
  captionEl.textContent = latestVideo.caption || 'Capsule exclusive DALIGHT Head Spa';
  dateEl.textContent = `Publié le ${formatDate(latestVideo.created_at)}`;
  emptyState.hidden = true;
}

function truncateText(text = '', maxLength = 200) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

function shareVideo(videoUrl, caption = '') {
  if (!videoUrl) return;
  const shareData = {
    title: 'Capsule DALIGHT Head Spa',
    text: caption || 'Découvrez ce rituel DALIGHT',
    url: videoUrl,
  };
  if (navigator.share) {
    navigator.share(shareData).catch(() => {
      /* ignore */
    });
  } else {
    navigator.clipboard?.writeText(videoUrl);
    alert('Lien vidéo copié. Partagez-le dans vos réseaux !');
  }
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

document.addEventListener('DOMContentLoaded', initFollowPage);
