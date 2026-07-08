// ============================================
// DALIGHT — FORMULAIRES DE CONSENTEMENT (ADMIN)
// ============================================

let allTemplates = [];
let allSubmissions = [];
let allServices = [];
let allCategories = [];
let currentFields = [];       // form builder state
let currentTemplateId = null;
let currentSubmission = null; // for print

const FIELD_TYPES = [
  { value: 'text',      label: 'Texte court' },
  { value: 'textarea',  label: 'Texte long' },
  { value: 'radio',     label: 'Choix unique' },
  { value: 'checkbox',  label: 'Choix multiple (cases)' },
  { value: 'select',    label: 'Menu déroulant' },
  { value: 'consent',   label: 'Case de consentement' },
  { value: 'date',      label: 'Date' },
  { value: 'signature', label: 'Signature' },
  { value: 'section',   label: 'Titre / Paragraphe' },
];

const TYPE_LABEL = FIELD_TYPES.reduce((a, t) => { a[t.value] = t.label; return a; }, {});
const NEEDS_OPTIONS = ['radio', 'checkbox', 'select'];

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminAuth();
  await Promise.all([loadServices(), loadCategories()]);
  await Promise.all([loadTemplates(), loadSubmissions()]);
  if (window.lucide) lucide.createIcons();
});

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  const newBtn = document.getElementById('btn-new-template');
  if (newBtn) newBtn.style.display = tab === 'templates' ? '' : 'none';
}

function escapeHtml(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================
// SERVICES (pour le dropdown d'association)
// ============================================
async function loadServices() {
  try {
    const { data, error } = await supabaseClient
      .from('services')
      .select('id, name, category')
      .order('sort_order');
    if (error) throw error;
    allServices = data || [];
    const sel = document.getElementById('t-service');
    if (sel) {
      sel.innerHTML = '<option value="">— Choisir un service —</option>' +
        allServices.map(s => `<option value="${s.id}" data-category="${escapeHtml(s.category || '')}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('loadServices error:', err);
  }
}

async function loadCategories() {
  try {
    const { data, error } = await supabaseClient
      .from('services')
      .select('category')
      .order('category');
    if (error) throw error;
    const cats = [...new Set((data || []).map(s => s.category).filter(Boolean))];
    allCategories = cats;
    const sel = document.getElementById('t-category');
    if (sel) {
      sel.innerHTML = '<option value="">— Choisir une catégorie —</option>' +
        cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
  } catch (err) {
    console.error('loadCategories error:', err);
  }
}

function getTemplateScope(t) {
  if (!t) return 'all';
  if (t.applies_to_all) return 'all';
  if (t.service_id) return 'service';
  if (t.service_category) return 'category';
  return 'all';
}

function toggleScopeFields() {
  const scope = document.getElementById('t-scope').value;
  document.getElementById('t-category-wrap').hidden = scope !== 'category';
  document.getElementById('t-service-wrap').hidden = scope !== 'service';
  if (scope !== 'category') document.getElementById('t-category').value = '';
  if (scope !== 'service') document.getElementById('t-service').value = '';
}

// ============================================
// TEMPLATES — LOAD & RENDER
// ============================================
async function loadTemplates() {
  try {
    const { data, error } = await supabaseClient
      .from('form_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    allTemplates = data || [];
    renderTemplates();
  } catch (err) {
    console.error('loadTemplates error:', err);
    document.getElementById('templates-grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#dc2626;">Erreur: ${escapeHtml(err.message)}<br><small>Avez-vous exécuté 23_consent_forms.sql ?</small></div>`;
  }
}

function renderTemplates() {
  const grid = document.getElementById('templates-grid');
  if (!allTemplates.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;background:var(--admin-muted-bg);border-radius:12px;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="56" height="56" style="color:var(--admin-text-muted);margin-bottom:1rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <p style="color:var(--admin-text-muted);">Aucun modèle de formulaire pour le moment</p>
        <button class="btn btn-primary" onclick="openTemplateModal()" style="margin-top:1rem;">Créer un modèle</button>
      </div>`;
    return;
  }
  grid.innerHTML = allTemplates.map(t => {
    const scope = t.applies_to_all
      ? 'Tous les services'
      : (t.service_category
          ? 'Catégorie : ' + t.service_category
          : (t.service_name || '—'));
    const nbFields = Array.isArray(t.fields) ? t.fields.filter(f => f.type !== 'section').length : 0;
    const nbSubs = allSubmissions.filter(s => s.form_template_id === t.id).length;
    return `
      <div class="glass-card" style="padding:1.25rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;">
          <h3 style="font-size:1.05rem;font-weight:600;margin:0;">${escapeHtml(t.title)}</h3>
          <span style="padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:600;background:${t.is_active ? '#10b981' : '#6b7280'};color:#fff;white-space:nowrap;">${t.is_active ? 'Actif' : 'Inactif'}</span>
        </div>
        ${t.form_type ? `<span class="fb-type-badge">${escapeHtml(t.form_type)}</span>` : ''}
        <p style="font-size:.85rem;color:var(--admin-text-muted);margin:.6rem 0;line-height:1.5;max-height:48px;overflow:hidden;">${escapeHtml(t.description || 'Aucune description')}</p>
        <div style="font-size:.78rem;color:var(--admin-text-muted);margin-bottom:1rem;">
          <div><strong>Portée:</strong> ${escapeHtml(scope)}</div>
          <div><strong>Questions:</strong> ${nbFields} &nbsp;·&nbsp; <strong>Remplis:</strong> ${nbSubs}</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="editTemplate('${t.id}')"><i data-lucide="edit"></i> Modifier</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleTemplateActive('${t.id}', ${!t.is_active})" style="background:${t.is_active ? '#f59e0b' : '#10b981'};color:#fff;border-color:transparent;"><i data-lucide="${t.is_active ? 'pause' : 'play'}"></i> ${t.is_active ? 'Désactiver' : 'Activer'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${t.id}')"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

// ============================================
// TEMPLATE MODAL + FORM BUILDER
// ============================================
function openTemplateModal(template = null) {
  currentTemplateId = template?.id || null;
  document.getElementById('template-modal-title').textContent = template ? 'Modifier le modèle' : 'Nouveau modèle';
  document.getElementById('t-id').value = template?.id || '';
  document.getElementById('t-title').value = template?.title || '';
  document.getElementById('t-type').value = template?.form_type || '';
  document.getElementById('t-description').value = template?.description || '';
  document.getElementById('t-active').checked = template ? !!template.is_active : true;

  const scope = getTemplateScope(template);
  document.getElementById('t-scope').value = scope;
  document.getElementById('t-category').value = template?.service_category || '';
  document.getElementById('t-service').value = template?.service_id || '';
  toggleScopeFields();

  currentFields = template && Array.isArray(template.fields)
    ? JSON.parse(JSON.stringify(template.fields))
    : [
        { id: genId(), label: 'Je confirme que les informations fournies sont exactes.', type: 'consent', required: true, options: [] },
      ];
  renderFields();
  document.getElementById('modal-template').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeTemplateModal() {
  document.getElementById('modal-template').classList.remove('active');
  currentTemplateId = null;
  currentFields = [];
}

function genId() {
  return 'f' + Math.random().toString(36).substring(2, 9);
}

function addField() {
  currentFields.push({ id: genId(), label: '', type: 'text', required: false, options: [] });
  renderFields();
}

window.updateFieldLabel = (i, val) => { currentFields[i].label = val; };
window.updateFieldRequired = (i, val) => { currentFields[i].required = val; };
window.updateFieldOptions = (i, val) => {
  currentFields[i].options = val.split('\n').map(s => s.trim()).filter(Boolean);
};
window.updateFieldType = (i, val) => { currentFields[i].type = val; renderFields(); };
window.removeField = (i) => { currentFields.splice(i, 1); renderFields(); };
window.moveField = (i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= currentFields.length) return;
  [currentFields[i], currentFields[j]] = [currentFields[j], currentFields[i]];
  renderFields();
};

function renderFields() {
  const box = document.getElementById('fields-builder');
  if (!currentFields.length) {
    box.innerHTML = `<p style="color:var(--admin-text-muted);font-size:.85rem;text-align:center;padding:1rem;">Aucune question. Cliquez sur « Ajouter une question ».</p>`;
    return;
  }
  box.innerHTML = currentFields.map((f, i) => {
    const typeOptions = FIELD_TYPES.map(t => `<option value="${t.value}" ${f.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
    const showOptions = NEEDS_OPTIONS.includes(f.type);
    const isSection = f.type === 'section';
    return `
      <div class="fb-field-row">
        <div class="fb-field-head">
          <span class="fb-type-badge">${TYPE_LABEL[f.type] || f.type}</span>
          <span style="margin-left:auto;display:flex;gap:.25rem;">
            <button class="btn btn-secondary btn-sm" title="Monter" onclick="moveField(${i},-1)"><i data-lucide="arrow-up"></i></button>
            <button class="btn btn-secondary btn-sm" title="Descendre" onclick="moveField(${i},1)"><i data-lucide="arrow-down"></i></button>
            <button class="btn btn-danger btn-sm" title="Supprimer" onclick="removeField(${i})"><i data-lucide="trash-2"></i></button>
          </span>
        </div>
        <div class="form-group" style="margin-bottom:.6rem;">
          <label class="form-label" style="font-size:.78rem;">${isSection ? 'Titre / Texte à afficher' : 'Question / Libellé'}</label>
          <input class="form-control" value="${escapeHtml(f.label)}" oninput="updateFieldLabel(${i}, this.value)" placeholder="${isSection ? 'Ex: Informations médicales' : 'Ex: Avez-vous des allergies ?'}">
        </div>
        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
          <div class="form-group" style="margin:0;flex:1;min-width:180px;">
            <label class="form-label" style="font-size:.78rem;">Type de champ</label>
            <select class="form-control" onchange="updateFieldType(${i}, this.value)">${typeOptions}</select>
          </div>
          ${isSection ? '' : `
          <label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:500;margin-top:1.1rem;">
            <input type="checkbox" ${f.required ? 'checked' : ''} onchange="updateFieldRequired(${i}, this.checked)" style="width:15px;height:15px;"> Obligatoire
          </label>`}
        </div>
        ${showOptions ? `
        <div class="fb-options form-group" style="margin-top:.6rem;margin-bottom:0;">
          <label class="form-label" style="font-size:.78rem;">Options (une par ligne)</label>
          <textarea class="form-control" rows="3" oninput="updateFieldOptions(${i}, this.value)" placeholder="Option 1&#10;Option 2&#10;Option 3">${escapeHtml((f.options || []).join('\n'))}</textarea>
        </div>` : ''}
      </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

async function saveTemplate() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) { showToast('Le titre est obligatoire', 'error'); return; }

  // Clean fields
  const fields = currentFields
    .filter(f => (f.label || '').trim() !== '')
    .map(f => ({
      id: f.id || genId(),
      label: f.label.trim(),
      type: f.type,
      required: f.type === 'section' ? false : !!f.required,
      options: NEEDS_OPTIONS.includes(f.type) ? (f.options || []) : [],
    }));

  if (!fields.length) { showToast('Ajoutez au moins une question', 'error'); return; }

  const scope = document.getElementById('t-scope').value;
  const serviceSel = document.getElementById('t-service');
  const serviceOpt = serviceSel.options[serviceSel.selectedIndex];
  const categorySel = document.getElementById('t-category');
  const categoryOpt = categorySel.options[categorySel.selectedIndex];

  const payload = {
    title,
    form_type: document.getElementById('t-type').value.trim(),
    description: document.getElementById('t-description').value.trim(),
    applies_to_all: scope === 'all',
    service_id: scope === 'service' ? (serviceSel.value || null) : null,
    service_name: scope === 'service' ? (serviceOpt?.dataset.name || '') : '',
    service_category: scope === 'category' ? (categorySel.value || '') : '',
    is_active: document.getElementById('t-active').checked,
    fields,
  };

  const btn = document.getElementById('btn-save-template');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  try {
    let error;
    const id = document.getElementById('t-id').value;
    if (id) {
      ({ error } = await supabaseClient.from('form_templates').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('form_templates').insert([payload]));
    }
    if (error) throw error;
    showToast('Modèle enregistré', 'success');
    closeTemplateModal();
    await loadTemplates();
  } catch (err) {
    console.error('saveTemplate error:', err);
    showToast('Erreur: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Enregistrer';
  }
}

function editTemplate(id) {
  const t = allTemplates.find(x => x.id === id);
  if (t) openTemplateModal(t);
}

async function toggleTemplateActive(id, makeActive) {
  try {
    const { error } = await supabaseClient.from('form_templates').update({ is_active: makeActive }).eq('id', id);
    if (error) throw error;
    await loadTemplates();
  } catch (err) {
    showToast('Erreur: ' + err.message, 'error');
  }
}

async function deleteTemplate(id) {
  if (!confirm('Supprimer ce modèle de formulaire ? Les formulaires déjà remplis seront conservés.')) return;
  try {
    const { error } = await supabaseClient.from('form_templates').delete().eq('id', id);
    if (error) throw error;
    showToast('Modèle supprimé', 'success');
    await loadTemplates();
  } catch (err) {
    showToast('Erreur: ' + err.message, 'error');
  }
}

// ============================================
// SUBMISSIONS — LOAD, SEARCH, VIEW, PRINT
// ============================================
async function loadSubmissions() {
  try {
    const { data, error } = await supabaseClient
      .from('form_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    allSubmissions = data || [];
    renderSubmissions();
    renderTemplates(); // refresh counts
  } catch (err) {
    console.error('loadSubmissions error:', err);
    document.getElementById('submissions-table').innerHTML =
      `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#dc2626;">Erreur: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderSubmissions() {
  const q = (document.getElementById('submission-search')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('submissions-table');
  let list = allSubmissions;
  if (q) {
    list = allSubmissions.filter(s =>
      (s.client_name || '').toLowerCase().includes(q) ||
      (s.client_email || '').toLowerCase().includes(q) ||
      (s.client_phone || '').toLowerCase().includes(q) ||
      (s.reference_number || '').toLowerCase().includes(q)
    );
  }
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">${q ? 'Aucun résultat.' : 'Aucun formulaire rempli pour le moment.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => {
    const d = new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <tr>
        <td><span class="ref-chip">${escapeHtml(s.reference_number || '')}</span></td>
        <td><strong>${escapeHtml(s.client_name || '—')}</strong></td>
        <td style="font-size:.82rem;">${escapeHtml(s.client_email || '')}${s.client_phone ? '<br>' + escapeHtml(s.client_phone) : ''}</td>
        <td>${escapeHtml(s.form_title || '')}${s.form_type ? `<br><span class="fb-type-badge">${escapeHtml(s.form_type)}</span>` : ''}</td>
        <td style="font-size:.82rem;">${escapeHtml(s.service_name || '—')}</td>
        <td style="font-size:.8rem;">${d}</td>
        <td><button class="btn btn-secondary btn-sm" onclick="viewSubmission('${s.id}')"><i data-lucide="eye"></i> Voir</button></td>
      </tr>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function buildSubmissionHtml(s) {
  const d = new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const answers = Array.isArray(s.answers) ? s.answers : [];
  const answersHtml = answers.map(a => {
    if (a.type === 'section') {
      return `<div style="font-weight:700;color:#4A3728;margin:.8rem 0 .2rem;">${escapeHtml(a.label)}</div>`;
    }
    let val = a.value;
    if (Array.isArray(val)) val = val.join(', ');
    if (a.type === 'consent') val = (val === true || val === 'true' || val === 'oui') ? '✓ Accepté' : (val || '—');
    return `<div class="sub-answer"><div class="q">${escapeHtml(a.label)}</div><div class="a">${escapeHtml(val || '—')}</div></div>`;
  }).join('');

  return `
    <div style="border:1px solid var(--admin-border);border-radius:10px;overflow:hidden;">
      <div style="background:var(--admin-muted-bg);padding:1rem;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
          <div>
            <div style="font-size:1.05rem;font-weight:700;">${escapeHtml(s.form_title || 'Formulaire')}</div>
            ${s.form_type ? `<span class="fb-type-badge">${escapeHtml(s.form_type)}</span>` : ''}
          </div>
          <span class="ref-chip" style="height:fit-content;">${escapeHtml(s.reference_number || '')}</span>
        </div>
        <div style="margin-top:.75rem;font-size:.85rem;color:#444;line-height:1.7;">
          <div><strong>Client:</strong> ${escapeHtml(s.client_name || '—')}</div>
          <div><strong>Email:</strong> ${escapeHtml(s.client_email || '—')}</div>
          <div><strong>Téléphone:</strong> ${escapeHtml(s.client_phone || '—')}</div>
          <div><strong>Service:</strong> ${escapeHtml(s.service_name || '—')}</div>
          <div><strong>Rempli le:</strong> ${d}</div>
        </div>
      </div>
      <div style="padding:.5rem 1rem;">
        ${answersHtml || '<p style="color:var(--admin-text-muted);">Aucune réponse.</p>'}
      </div>
      ${s.signature_data ? `
        <div style="padding:1rem;border-top:1px solid var(--admin-border);">
          <div style="font-weight:600;font-size:.85rem;margin-bottom:.4rem;">Signature du client</div>
          <img src="${s.signature_data}" alt="Signature" style="max-width:280px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;">
        </div>` : ''}
    </div>`;
}

function viewSubmission(id) {
  const s = allSubmissions.find(x => x.id === id);
  if (!s) return;
  currentSubmission = s;
  document.getElementById('submission-detail').innerHTML = buildSubmissionHtml(s);
  document.getElementById('modal-submission').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeSubmissionModal() {
  document.getElementById('modal-submission').classList.remove('active');
  currentSubmission = null;
}

function printSubmission() {
  if (!currentSubmission) return;
  const s = currentSubmission;
  const win = window.open('', '_blank');
  const answers = Array.isArray(s.answers) ? s.answers : [];
  const rows = answers.map(a => {
    if (a.type === 'section') return `<h3 style="margin:16px 0 4px;color:#4A3728;">${escapeHtml(a.label)}</h3>`;
    let val = a.value;
    if (Array.isArray(val)) val = val.join(', ');
    if (a.type === 'consent') val = (val === true || val === 'true' || val === 'oui') ? 'Accepté' : (val || '—');
    return `<div style="margin-bottom:10px;"><div style="font-weight:600;">${escapeHtml(a.label)}</div><div style="color:#333;">${escapeHtml(val || '—')}</div></div>`;
  }).join('');
  const d = new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  win.document.write(`
    <html><head><title>${escapeHtml(s.reference_number)}</title>
    <style>body{font-family:Inter,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 24px;color:#1a1a1a;}h1{color:#4A3728;}.head{border-bottom:2px solid #D4AF37;padding-bottom:12px;margin-bottom:16px;}.meta{font-size:14px;color:#555;line-height:1.8;margin-bottom:16px;}.ref{font-family:monospace;background:#4A3728;color:#fff;padding:3px 10px;border-radius:6px;}</style>
    </head><body>
      <div class="head">
        <h1>DALIGHT — ${escapeHtml(s.form_title || 'Formulaire')}</h1>
        <span class="ref">${escapeHtml(s.reference_number)}</span>
      </div>
      <div class="meta">
        <div><strong>Client:</strong> ${escapeHtml(s.client_name || '—')}</div>
        <div><strong>Email:</strong> ${escapeHtml(s.client_email || '—')}</div>
        <div><strong>Téléphone:</strong> ${escapeHtml(s.client_phone || '—')}</div>
        <div><strong>Service:</strong> ${escapeHtml(s.service_name || '—')}</div>
        <div><strong>Rempli le:</strong> ${d}</div>
      </div>
      ${rows}
      ${s.signature_data ? `<div style="margin-top:20px;"><div style="font-weight:600;">Signature:</div><img src="${s.signature_data}" style="max-width:280px;border:1px solid #ccc;border-radius:8px;"></div>` : ''}
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
  win.document.close();
}
