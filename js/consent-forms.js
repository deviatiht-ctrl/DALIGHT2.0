// ============================================
// DALIGHT — Consent Forms (client side)
// Fill / sign / submit / download consent forms
// linked to paid reservations.
// ============================================

let _stylesInjected = false;

const PRACTITIONER_LABELS = new Set([
  'Analyse du cuir chevelu',
  'Type de soin recommandé',
  'Fréquence des séances',
  'Soin effectué',
  'Durée',
  'Techniques utilisées',
  'Conseils après soin / recommandations'
]);

function isPractitionerField(label = '') {
  if (PRACTITIONER_LABELS.has(label)) return true;
  const lower = label.toLowerCase();
  return lower.includes('diagnostic du praticien') ||
    lower.includes('plan de traitement') ||
    lower.includes('conseils après soin');
}

function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const css = `
  .cf-overlay{position:fixed;inset:0;background:rgba(30,20,12,.55);backdrop-filter:blur(4px);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto;animation:cfFade .2s ease;}
  @keyframes cfFade{from{opacity:0}to{opacity:1}}
  .cf-modal{background:#fff;border-radius:18px;max-width:640px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden;animation:cfSlide .3s cubic-bezier(.175,.885,.32,1.275);margin:auto;}
  @keyframes cfSlide{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:none}}
  .cf-head{background:linear-gradient(135deg,#4A3728 0%,#6B4F3B 100%);color:#fff;padding:1.5rem 1.75rem;position:relative;}
  .cf-head h2{font-family:'Playfair Display',serif;font-size:1.4rem;color:#fff;margin:0 0 .25rem;}
  .cf-head p{margin:0;font-size:.85rem;color:#fff;opacity:.85;}
  .cf-head .cf-type{display:inline-block;margin-top:.5rem;background:rgba(212,175,55,.9);color:#3a2a1a;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:20px;}
  .cf-close{position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1.3rem;cursor:pointer;line-height:1;}
  .cf-close:hover{background:rgba(255,255,255,.28);}
  .cf-body{padding:1.5rem 1.75rem;max-height:60vh;overflow-y:auto;}
  .cf-intro{background:#faf6f0;border-left:3px solid #D4AF37;padding:.85rem 1rem;border-radius:0 8px 8px 0;font-size:.88rem;color:#5a4a3a;line-height:1.6;margin-bottom:1.25rem;white-space:pre-line;}
  .cf-field{margin-bottom:1.1rem;}
  .cf-field label.cf-q{display:block;font-weight:600;color:#3a2a1a;font-size:.92rem;margin-bottom:.4rem;}
  .cf-field .cf-req{color:#dc2626;margin-left:.2rem;}
  .cf-field input[type=text],.cf-field input[type=date],.cf-field textarea,.cf-field select{width:100%;padding:.7rem .85rem;border:1.5px solid #e5ddd3;border-radius:10px;font-size:.92rem;font-family:inherit;transition:border-color .15s;box-sizing:border-box;}
  .cf-field input[type=text]:focus,.cf-field textarea:focus,.cf-field select:focus,.cf-field input[type=date]:focus{outline:none;border-color:#D4AF37;}
  .cf-field textarea{resize:vertical;min-height:80px;}
  .cf-opt{display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .75rem;border:1.5px solid #eee6db;border-radius:10px;margin-bottom:.5rem;cursor:pointer;font-size:.9rem;color:#4a3d30;transition:all .15s;}
  .cf-opt:hover{border-color:#D4AF37;background:#fdfaf5;}
  .cf-opt input{margin-top:.15rem;width:16px;height:16px;accent-color:#4A3728;}
  .cf-opt.cf-checked{border-color:#4A3728;background:#faf6f0;}
  .cf-section-title{font-family:'Playfair Display',serif;font-size:1.1rem;color:#4A3728;margin:1.25rem 0 .5rem;padding-bottom:.35rem;border-bottom:1px solid #eee6db;}
  .cf-sign-wrap{border:1.5px dashed #d9cebf;border-radius:12px;background:#fdfbf8;padding:.5rem;}
  .cf-sign-canvas{width:100%;height:170px;border-radius:8px;background:#fff;touch-action:none;cursor:crosshair;display:block;}
  .cf-sign-actions{display:flex;justify-content:space-between;align-items:center;margin-top:.4rem;}
  .cf-sign-actions small{color:#9a8f86;font-size:.78rem;}
  .cf-btn{border:none;border-radius:10px;font-weight:600;font-size:.92rem;padding:.8rem 1.4rem;cursor:pointer;display:inline-flex;align-items:center;gap:.5rem;transition:all .15s;}
  .cf-btn-primary{background:#4A3728;color:#fff;}
  .cf-btn-primary:hover{background:#5C4432;}
  .cf-btn-primary:disabled{opacity:.6;cursor:not-allowed;}
  .cf-btn-ghost{background:transparent;color:#7a6a58;border:1.5px solid #e5ddd3;}
  .cf-btn-ghost:hover{background:#f7f2ec;}
  .cf-foot{padding:1.1rem 1.75rem;border-top:1px solid #f0e9e0;display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;}
  .cf-err{color:#dc2626;font-size:.82rem;margin-top:.3rem;}
  .cf-success{text-align:center;padding:2.5rem 1.75rem;}
  .cf-success .cf-check{width:72px;height:72px;border-radius:50%;background:#e6f9ee;color:#15803d;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:2.2rem;}
  .cf-success h2{font-family:'Playfair Display',serif;color:#4A3728;margin:0 0 .5rem;}
  .cf-success .cf-ref{font-family:monospace;background:#4A3728;color:#fff;padding:4px 12px;border-radius:8px;display:inline-block;margin:.5rem 0 1.25rem;}
  .cf-readonly{background:#f7f2ec;border-radius:8px;padding:.6rem .85rem;font-size:.92rem;color:#4a3d30;white-space:pre-line;}
  `;
  const style = document.createElement('style');
  style.id = 'cf-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// ── Data loading ────────────────────────────────────────────
export async function loadConsentData(supabase, userId) {
  const result = { templates: [], submissions: [], serviceMap: {} };
  try {
    const [tplRes, subRes, svcRes] = await Promise.all([
      supabase.from('form_templates').select('*').eq('is_active', true),
      supabase.from('form_submissions').select('*').eq('user_id', userId),
      supabase.from('services').select('id, category'),
    ]);
    if (!tplRes.error) result.templates = tplRes.data || [];
    if (!subRes.error) result.submissions = subRes.data || [];
    if (!svcRes.error) {
      result.serviceMap = Object.fromEntries((svcRes.data || []).map(s => [s.id, s.category]));
    }
  } catch (err) {
    console.warn('loadConsentData error (tables may not exist yet):', err.message);
  }
  return result;
}

function reservationServiceNames(reservation) {
  const names = [];
  if (Array.isArray(reservation.services)) {
    reservation.services.forEach(s => { if (s && s.name) names.push(String(s.name).toLowerCase()); });
  }
  if (reservation.service) names.push(String(reservation.service).toLowerCase());
  return names;
}

function reservationCategories(reservation, serviceMap = {}) {
  const cats = [];
  if (Array.isArray(reservation.services)) {
    reservation.services.forEach(s => { if (s && s.category) cats.push(String(s.category).toLowerCase()); });
  }
  const dbCat = serviceMap[reservation.service_id];
  if (dbCat) cats.push(String(dbCat).toLowerCase());
  if (reservation.service_category) cats.push(String(reservation.service_category).toLowerCase());
  return [...new Set(cats)];
}

// Find the best matching template for a reservation.
export function matchTemplate(reservation, templates, serviceMap = {}) {
  if (!templates || !templates.length) return null;
  const names = reservationServiceNames(reservation);
  const cats = reservationCategories(reservation, serviceMap);

  // 1. Specific service-id match (exact)
  let match = templates.find(t => !t.applies_to_all && t.service_id &&
    t.service_id === reservation.service_id);
  if (match) return match;

  // 2. Specific service-name match (fallback)
  match = templates.find(t => !t.applies_to_all && t.service_name &&
    names.some(n => n.includes(t.service_name.toLowerCase()) || t.service_name.toLowerCase().includes(n)));
  if (match) return match;

  // 3. Category match
  match = templates.find(t => !t.applies_to_all && t.service_category &&
    cats.some(c => c === t.service_category.toLowerCase()));
  if (match) return match;

  // 4. Applies to all
  match = templates.find(t => t.applies_to_all);
  return match || null;
}

export function findSubmission(reservation, submissions) {
  if (!submissions) return null;
  return submissions.find(s => s.reservation_id === reservation.id) || null;
}

// ── Signature pad ───────────────────────────────────────────
function initSignaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  // Scale for crisp lines
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1a1a';

  let drawing = false, hasInk = false, last = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => { drawing = true; last = pos(e); e.preventDefault(); };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; hasInk = true; e.preventDefault();
  };
  const end = () => { drawing = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return {
    clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; },
    isEmpty: () => !hasInk,
    toDataURL: () => canvas.toDataURL('image/png'),
  };
}

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Render a single field control ───────────────────────────
function renderFieldControl(f, idx) {
  if (isPractitionerField(f.label)) return '';
  const req = f.required ? '<span class="cf-req">*</span>' : '';
  if (f.type === 'section') {
    return `<div class="cf-section-title" data-field-index="${idx}" data-type="section" data-label="${esc(f.label)}">${esc(f.label)}</div>`;
  }
  let control = '';
  if (f.type === 'text') {
    control = `<input type="text" data-input>`;
  } else if (f.type === 'textarea') {
    control = `<textarea data-input></textarea>`;
  } else if (f.type === 'date') {
    control = `<input type="date" data-input>`;
  } else if (f.type === 'select') {
    control = `<select data-input><option value="">— Choisir —</option>${(f.options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  } else if (f.type === 'radio') {
    control = (f.options || []).map(o => `
      <label class="cf-opt"><input type="radio" name="cf-${idx}" value="${esc(o)}" data-input>${esc(o)}</label>`).join('');
  } else if (f.type === 'checkbox') {
    control = (f.options || []).map(o => `
      <label class="cf-opt"><input type="checkbox" value="${esc(o)}" data-input>${esc(o)}</label>`).join('');
  } else if (f.type === 'consent') {
    control = `<label class="cf-opt"><input type="checkbox" data-input value="oui"> Oui, j'accepte</label>`;
  } else if (f.type === 'signature') {
    return `
      <div class="cf-field" data-field-index="${idx}" data-type="signature" data-label="${esc(f.label)}" data-required="${f.required ? 1 : 0}">
        <label class="cf-q">${esc(f.label)} ${req}</label>
        <div class="cf-sign-wrap">
          <canvas class="cf-sign-canvas" data-signature></canvas>
          <div class="cf-sign-actions">
            <small>Signez avec votre doigt ou votre souris</small>
            <button type="button" class="cf-btn cf-btn-ghost" data-clear-sign style="padding:.4rem .9rem;font-size:.82rem;">Effacer</button>
          </div>
        </div>
        <div class="cf-err" data-err hidden></div>
      </div>`;
  }
  return `
    <div class="cf-field" data-field-index="${idx}" data-type="${f.type}" data-label="${esc(f.label)}" data-required="${f.required ? 1 : 0}">
      <label class="cf-q">${esc(f.label)} ${req}</label>
      ${control}
      <div class="cf-err" data-err hidden></div>
    </div>`;
}

// ── Read only view (already submitted) ──────────────────────
function renderReadOnly(submission) {
  const answers = Array.isArray(submission.answers) ? submission.answers : [];
  return answers.map(a => {
    if (isPractitionerField(a.label)) return '';
    if (a.type === 'section') return `<div class="cf-section-title">${esc(a.label)}</div>`;
    let val = a.value;
    if (Array.isArray(val)) val = val.join(', ');
    if (a.type === 'consent') val = (val === true || val === 'oui' || val === 'true') ? '✓ Accepté' : (val || '—');
    return `<div class="cf-field"><label class="cf-q">${esc(a.label)}</label><div class="cf-readonly">${esc(val || '—')}</div></div>`;
  }).join('') + (submission.signature_data ? `
    <div class="cf-field"><label class="cf-q">Signature</label>
    <img src="${submission.signature_data}" style="max-width:280px;border:1px solid #e5ddd3;border-radius:8px;background:#fff;"></div>` : '');
}

function closeModal() {
  const ov = document.getElementById('cf-overlay');
  if (ov) ov.remove();
}

// ── Main entry: open the consent modal ──────────────────────
export function openConsentModal({ supabase, reservation, template, submission, onSubmitted }) {
  injectStyles();
  closeModal();

  const alreadySubmitted = !!submission;
  const fields = Array.isArray(template?.fields) ? template.fields : [];

  const overlay = document.createElement('div');
  overlay.className = 'cf-overlay';
  overlay.id = 'cf-overlay';

  const bodyHtml = alreadySubmitted
    ? renderReadOnly(submission)
    : `${template.description ? `<div class="cf-intro">${esc(template.description)}</div>` : ''}
       ${fields.map((f, i) => renderFieldControl(f, i)).join('')}`;

  overlay.innerHTML = `
    <div class="cf-modal" role="dialog" aria-modal="true">
      <div class="cf-head">
        <button class="cf-close" data-close aria-label="Fermer">&times;</button>
        <h2>${esc(template?.title || submission?.form_title || 'Formulaire')}</h2>
        <p>${esc(reservation.service || '')}</p>
        ${(template?.form_type || submission?.form_type) ? `<span class="cf-type">${esc(template?.form_type || submission?.form_type)}</span>` : ''}
        ${alreadySubmitted ? `<span class="cf-type" style="background:#e6f9ee;color:#15803d;">Déjà rempli · ${esc(submission.reference_number)}</span>` : ''}
      </div>
      <div class="cf-body" id="cf-body">${bodyHtml}</div>
      <div class="cf-foot">
        ${alreadySubmitted
          ? `<button class="cf-btn cf-btn-ghost" data-close>Fermer</button>
             <button class="cf-btn cf-btn-primary" data-download>Télécharger / Imprimer</button>`
          : `<button class="cf-btn cf-btn-ghost" data-close>Annuler</button>
             <button class="cf-btn cf-btn-primary" data-submit>Signer &amp; envoyer</button>`}
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Signature pads
  const sigPads = {};
  overlay.querySelectorAll('[data-signature]').forEach(canvas => {
    const fieldEl = canvas.closest('[data-field-index]');
    const idx = fieldEl.dataset.fieldIndex;
    sigPads[idx] = initSignaturePad(canvas);
    fieldEl.querySelector('[data-clear-sign]')?.addEventListener('click', () => sigPads[idx].clear());
  });

  // Option highlighting
  overlay.addEventListener('change', (e) => {
    const opt = e.target.closest('.cf-opt');
    if (e.target.type === 'radio') {
      const name = e.target.name;
      overlay.querySelectorAll(`input[name="${name}"]`).forEach(r => r.closest('.cf-opt')?.classList.toggle('cf-checked', r.checked));
    } else if (e.target.type === 'checkbox' && opt) {
      opt.classList.toggle('cf-checked', e.target.checked);
    }
  });

  // Close handlers
  overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Download (already submitted)
  const dlBtn = overlay.querySelector('[data-download]');
  if (dlBtn) dlBtn.addEventListener('click', () => downloadSubmission(submission));

  // Submit
  const submitBtn = overlay.querySelector('[data-submit]');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => handleSubmit({ supabase, reservation, template, fields, sigPads, overlay, submitBtn, onSubmitted }));
  }
}

function collectAndValidate(fields, overlay, sigPads) {
  const answers = [];
  let firstError = null;

  overlay.querySelectorAll('[data-field-index]').forEach(el => {
    const idx = el.dataset.fieldIndex;
    const type = el.dataset.type;
    const label = el.dataset.label;
    const required = el.dataset.required === '1';
    const errEl = el.querySelector('[data-err]');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

    if (type === 'section') { answers.push({ field_id: idx, label, type, value: '' }); return; }

    let value;
    if (type === 'checkbox') {
      value = Array.from(el.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
    } else if (type === 'radio') {
      const checked = el.querySelector('input[type=radio]:checked');
      value = checked ? checked.value : '';
    } else if (type === 'consent') {
      const c = el.querySelector('input[type=checkbox]');
      value = c && c.checked ? 'oui' : '';
    } else if (type === 'signature') {
      const pad = sigPads[idx];
      value = pad && !pad.isEmpty() ? pad.toDataURL() : '';
    } else {
      const input = el.querySelector('[data-input]');
      value = input ? input.value.trim() : '';
    }

    // Validation
    const isEmpty = (Array.isArray(value) ? value.length === 0 : !value) ||
      (type === 'consent' && value !== 'oui');
    if (required && isEmpty) {
      if (errEl) {
        errEl.textContent = type === 'consent' ? 'Vous devez accepter pour continuer.'
          : type === 'signature' ? 'Votre signature est requise.'
          : 'Ce champ est obligatoire.';
        errEl.hidden = false;
      }
      if (!firstError) firstError = el;
    }

    if (type !== 'signature') {
      answers.push({ field_id: idx, label, type, value });
    } else {
      answers.push({ field_id: idx, label, type, value: value ? '✓ Signé' : '' });
    }
  });

  return { answers, firstError };
}

async function handleSubmit({ supabase, reservation, template, fields, sigPads, overlay, submitBtn, onSubmitted }) {
  const { answers, firstError } = collectAndValidate(fields, overlay, sigPads);
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Extract signature (first signature field, if any)
  let signatureData = '';
  const sigIdx = fields.findIndex(f => f.type === 'signature');
  if (sigIdx !== -1) {
    const el = overlay.querySelector(`[data-field-index="${sigIdx}"]`);
    const pad = sigPads[sigIdx];
    if (pad && !pad.isEmpty()) signatureData = pad.toDataURL();
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi…';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const record = {
      form_template_id: template.id,
      reservation_id: reservation.id,
      user_id: user?.id || reservation.user_id || null,
      client_name: reservation.user_name || '',
      client_email: reservation.user_email || '',
      client_phone: reservation.phone || '',
      service_name: reservation.service || '',
      form_title: template.title || '',
      form_type: template.form_type || '',
      answers,
      signature_data: signatureData,
    };

    const { data, error } = await supabase.from('form_submissions').insert([record]).select().single();
    if (error) throw error;

    // Success screen
    const modal = overlay.querySelector('.cf-modal');
    modal.innerHTML = `
      <div class="cf-success">
        <div class="cf-check">✓</div>
        <h2>Formulaire envoyé !</h2>
        <p style="color:#7a6a58;">Merci. Votre formulaire de consentement a bien été enregistré.</p>
        <div class="cf-ref">${esc(data.reference_number)}</div>
        <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;">
          <button class="cf-btn cf-btn-ghost" data-close>Fermer</button>
          <button class="cf-btn cf-btn-primary" data-download>Télécharger / Imprimer</button>
        </div>
      </div>`;
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
    modal.querySelector('[data-download]')?.addEventListener('click', () => downloadSubmission(data));
    if (typeof onSubmitted === 'function') onSubmitted(data);
  } catch (err) {
    console.error('submit consent error:', err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Signer & envoyer';
    alert('Erreur lors de l\'envoi : ' + err.message);
  }
}

// ── Download / print a submission ───────────────────────────
export function downloadSubmission(s) {
  const answers = Array.isArray(s.answers) ? s.answers : [];
  const rows = answers.map(a => {
    if (a.type === 'section') return `<h3 style="margin:18px 0 4px;color:#4A3728;">${esc(a.label)}</h3>`;
    let val = a.value;
    if (Array.isArray(val)) val = val.join(', ');
    if (a.type === 'consent') val = (val === 'oui' || val === true || val === 'true') ? 'Accepté' : (val || '—');
    return `<div style="margin-bottom:10px;"><div style="font-weight:600;color:#3a2a1a;">${esc(a.label)}</div><div style="color:#333;">${esc(val || '—')}</div></div>`;
  }).join('');
  const d = new Date(s.submitted_at || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>${esc(s.reference_number || 'Formulaire')}</title>
    <style>body{font-family:'Montserrat',Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 24px;color:#1a1a1a;}
    h1{font-family:'Playfair Display',serif;color:#4A3728;margin:0;}.head{border-bottom:2px solid #D4AF37;padding-bottom:14px;margin-bottom:18px;}
    .ref{font-family:monospace;background:#4A3728;color:#fff;padding:4px 12px;border-radius:6px;display:inline-block;margin-top:8px;}
    .meta{font-size:14px;color:#555;line-height:1.9;margin-bottom:18px;}</style></head>
    <body>
      <div class="head"><h1>DALIGHT — ${esc(s.form_title || 'Formulaire de consentement')}</h1><span class="ref">${esc(s.reference_number || '')}</span></div>
      <div class="meta">
        <div><strong>Client:</strong> ${esc(s.client_name || '—')}</div>
        <div><strong>Email:</strong> ${esc(s.client_email || '—')}</div>
        <div><strong>Téléphone:</strong> ${esc(s.client_phone || '—')}</div>
        <div><strong>Service:</strong> ${esc(s.service_name || '—')}</div>
        <div><strong>Rempli le:</strong> ${d}</div>
      </div>
      ${rows}
      ${s.signature_data ? `<div style="margin-top:22px;"><div style="font-weight:600;color:#3a2a1a;">Signature:</div><img src="${s.signature_data}" style="max-width:280px;border:1px solid #ccc;border-radius:8px;"></div>` : ''}
      <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
    </body></html>`);
  win.document.close();
}
