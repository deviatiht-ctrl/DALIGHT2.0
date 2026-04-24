import { formatDate, formatTime, getSupabase, isAdminSession } from './main.js';

const supabase = getSupabase();

const tableBody = document.getElementById('admin-table');
const statusFilter = document.getElementById('status-filter');
const locationFilter = document.getElementById('location-filter');
const messageEl = document.getElementById('admin-message');
const metricTotal = document.getElementById('metric-total');
const metricPending = document.getElementById('metric-pending');
const metricToday = document.getElementById('metric-today');
const videoForm = document.getElementById('video-upload-form');
const videoInput = document.getElementById('video-file');
const videoCaptionInput = document.getElementById('video-caption');
const videoPreviewEl = document.getElementById('video-preview');
const VIDEO_BUCKET = 'videos';
const VIDEO_FOLDER = 'spotlight';
const LOCATION_FILTERS = {
  Spa: ['Spa', 'DALIGHT — Delmas 65', 'Delmas 65'],
};
const STATUS_TEMPLATES = {
  CONFIRMED: {
    subject: (reservation) =>
      `Votre réservation est confirmée – ${formatDate(reservation.date)} · ${formatTime(reservation.time)}`,
    body: (reservation) => `
Bonjour ${reservation.user_name || ''},

Votre réservation pour ${reservation.service} le ${formatDate(reservation.date)} à ${formatTime(reservation.time)} (${reservation.location}) est confirmée.

Merci de prévoir votre pièce d'identité et d'arriver 10 minutes en avance pour profiter du lounge hydratation.

À très bientôt,
DALIGHT
`.trim(),
  },
  COMPLETED: {
    subject: () => 'Merci pour votre rituel DALIGHT',
    body: (reservation) => `
Bonjour ${reservation.user_name || ''},

Nous espérons que votre séance de ${reservation.service} du ${formatDate(reservation.date)} vous a apporté détente et soulagement.

Partagez-nous vos impressions ou vos besoins pour la prochaine visite et nous ajusterons votre protocole.

Bien chaleureusement,
DALIGHT
`.trim(),
  },
  CANCELLED: {
    subject: () => 'Votre réservation a été annulée',
    body: (reservation) => `
Bonjour ${reservation.user_name || ''},

Votre réservation pour ${reservation.service} prévue le ${formatDate(reservation.date)} à ${formatTime(reservation.time)} a été annulée.

Pour reprogrammer ou obtenir de l’aide, écrivez-nous au 4747-7221 ou via dalightbeauty15mai@gmail.com.

L’équipe DALIGHT
`.trim(),
  },
};

function setMessage(type, text) {
  if (!messageEl) return;
  messageEl.hidden = !text;
  messageEl.className = `alert ${type}`;
  messageEl.textContent = text;
}

function renderRows(reservations = []) {
  if (!tableBody) return;
  tableBody.innerHTML = reservations
    .map((reservation) => {
      return `
        <tr>
          <td>${reservation.user_email || '—'}</td>
          <td>${reservation.service}</td>
          <td>${reservation.location}</td>
          <td>${formatDate(reservation.date)}</td>
          <td>${formatTime(reservation.time)}</td>
          <td>
            <select data-id="${reservation.id}" data-current-status="${reservation.status}" class="status-select">
              ${['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']
                .map((status) => `<option value="${status}" ${status === reservation.status ? 'selected' : ''}>${status}</option>`)
                .join('')}
            </select>
          </td>
          <td>${formatDate(reservation.updated_at || reservation.created_at)}</td>
        </tr>
      `;
    })
    .join('');
}

function applyMetrics(reservations = []) {
  const total = reservations.length;
  const pending = reservations.filter((r) => r.status === 'PENDING').length;
  const today = reservations.filter((r) => r.date === new Date().toISOString().split('T')[0]).length;
  metricTotal.textContent = total;
  metricPending.textContent = pending;
  metricToday.textContent = today;
}

function attachListeners(reservations = []) {
  tableBody?.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.dataset.id) return;
    const id = target.dataset.id;
    const newStatus = target.value;
    const oldStatus = target.dataset.currentStatus || target.value;

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setMessage('success', 'Reservation updated.');
      setTimeout(() => setMessage('', ''), 1500);

      target.dataset.currentStatus = newStatus;

      if (newStatus !== oldStatus) {
        openEmailDraft(id, newStatus);
      }
    } catch (err) {
      setMessage('error', err.message || 'Unable to update status.');
      // Reset the select to the old status on error
      target.value = oldStatus;
    }
  });

  statusFilter?.addEventListener('change', () => loadReservations());
  locationFilter?.addEventListener('change', () => loadReservations());
}

function initVideoUploader() {
  if (!videoForm || !supabase) return;
  videoInput?.addEventListener('change', handleVideoPreview);
  videoForm.addEventListener('submit', handleVideoUpload);
}

async function ensureAdminAccess() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session || !isAdminSession(session)) {
    window.location.href = './login.html';
    return null;
  }
  return session;
}

async function loadReservations() {
  if (!supabase) return;
  const session = await ensureAdminAccess();
  if (!session) return;

  try {
    const statusValue = statusFilter?.value ?? 'all';
    const locationValue = locationFilter?.value ?? 'all';

    let query = supabase
      .from('reservations')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (statusValue !== 'all') {
      query = query.eq('status', statusValue);
    }
    if (locationValue !== 'all') {
      const matchSet = LOCATION_FILTERS[locationValue] || [locationValue];
      query = query.in('location', matchSet);
    }

    const { data, error } = await query;
    if (error) throw error;

    renderRows(data);
    applyMetrics(data);
  } catch (err) {
    setMessage('error', err.message || 'Unable to load reservations.');
  }
}

function subscribeToChanges() {
  if (!supabase) return;
  const channel = supabase
    .channel('admin-reservations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => loadReservations())
    .subscribe();

  window.addEventListener('beforeunload', () => {
    supabase.removeChannel(channel);
  });
}

function handleVideoPreview() {
  if (!videoPreviewEl) return;
  const file = videoInput?.files?.[0];
  if (!file) {
    videoPreviewEl.setAttribute('hidden', true);
    videoPreviewEl.removeAttribute('src');
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  videoPreviewEl.src = objectUrl;
  videoPreviewEl.removeAttribute('hidden');
  videoPreviewEl.load();
}

async function uploadVideoFile(file) {
  const extension = file.name.split('.').pop() || 'mp4';
  const filePath = `${VIDEO_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'video/mp4',
  });
  if (error) throw error;
  const { data: urlData, error: urlError } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(filePath);
  if (urlError) throw urlError;
  return urlData.publicUrl;
}

async function handleVideoUpload(event) {
  event.preventDefault();
  if (!videoInput?.files?.length) {
    setMessage('error', 'Sélectionnez une vidéo à téléverser.');
    return;
  }
  const submitBtn = videoForm.querySelector('button[type="submit"]');
  const originalLabel = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Téléversement...';
  }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = './login.html';
      return;
    }

    const file = videoInput.files[0];
    const videoUrl = await uploadVideoFile(file);
    const caption = videoCaptionInput?.value?.trim() || '';
    const { error } = await supabase.from('posts').insert([
      {
        type: 'video',
        video_url: videoUrl,
        caption,
        user_id: session.user.id,
        user_name: session.user.email,
      },
    ]);
    if (error) throw error;

    setMessage('success', 'Vidéo publiée dans le fil Suivre.');
    videoForm.reset();
    handleVideoPreview();
  } catch (err) {
    console.error('Video upload failed:', err);
    setMessage('error', err.message || 'Impossible de publier la capsule.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel || 'Publier la capsule';
    }
  }
}

async function openEmailDraft(reservationId, newStatus) {
  try {
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error || !reservation) throw error;

    const template = STATUS_TEMPLATES[newStatus];
    if (!template || !reservation.user_email) return;

    const subject = encodeURIComponent(template.subject(reservation));
    const body = encodeURIComponent(template.body(reservation));
    const mailtoUrl = `mailto:${reservation.user_email}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
  } catch (err) {
    console.error('Failed to open email draft:', err);
    setMessage('error', 'Impossible de préparer le courriel, mais le statut a été mis à jour.');
  }
}

function initAdmin() {
  if (!tableBody || !supabase) return;
  attachListeners();
  initVideoUploader();
  loadReservations();
  subscribeToChanges();
}

initAdmin();
