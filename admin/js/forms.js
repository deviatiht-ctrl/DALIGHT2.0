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

const PRACTITIONER_FIELDS = [
  { section: '7. Diagnostic du praticien', fields: [
    { label: 'Analyse du cuir chevelu', type: 'textarea' },
    { label: 'Type de soin recommandé', type: 'textarea' },
    { label: 'Fréquence des séances', type: 'textarea' }
  ]},
  { section: '8. Plan de traitement', fields: [
    { label: 'Soin effectué', type: 'textarea' },
    { label: 'Durée', type: 'text' },
    { label: 'Techniques utilisées', type: 'checkbox', options: ['Massage', 'Gommage', 'Sérum', 'Autre'] }
  ]},
  { section: '9. Conseils après soin / recommandations', fields: [
    { label: 'Conseils après soin / recommandations', type: 'textarea' }
  ]}
];
const PRACTITIONER_LABELS = new Set(PRACTITIONER_FIELDS.flatMap(g => g.fields.map(f => f.label)));
const STATUS_OPTIONS = [
  { value: 'en attente', label: 'En attente (non consulté)' },
  { value: 'consulté', label: 'Consulté' },
  { value: 'traitement terminé', label: 'Traitement terminé' },
  { value: 'envoyé au client', label: 'Envoyé au client' }
];
const STATUS_COLORS = {
  'en attente': '#f59e0b',
  'consulté': '#3b82f6',
  'traitement terminé': '#10b981',
  'envoyé au client': '#8b5cf6'
};

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
      `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#dc2626;">Erreur: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function getPractitionerValue(submission, label) {
  const pd = Array.isArray(submission?.practitioner_data) ? submission.practitioner_data : [];
  const found = pd.find(p => p.label === label);
  if (found) return found.value;
  const ans = Array.isArray(submission?.answers) ? submission.answers : [];
  const a = ans.find(x => x.label === label);
  return a ? a.value : '';
}

function isDiagnosticSubmission(s) {
  if (!s) return false;
  if ((s.form_type || '').includes('diagnostic')) return true;
  if ((s.form_title || '').toLowerCase().includes('diagnostic')) return true;
  const ans = Array.isArray(s.answers) ? s.answers : [];
  return PRACTITIONER_LABELS.size && ans.some(a => PRACTITIONER_LABELS.has(a.label));
}

function statusBadge(status) {
  const color = STATUS_COLORS[status] || '#6b7280';
  return `<span class="status-badge" style="background:${color};color:#fff;border-radius:20px;padding:3px 10px;font-size:.72rem;font-weight:600;white-space:nowrap;">${escapeHtml(status || 'en attente')}</span>`;
}

function renderSubmissions() {
  const q = (document.getElementById('submission-search')?.value || '').toLowerCase().trim();
  const statusFilter = (document.getElementById('submission-status-filter')?.value || '').toLowerCase();
  const tbody = document.getElementById('submissions-table');
  let list = allSubmissions;
  if (q) {
    list = list.filter(s =>
      (s.client_name || '').toLowerCase().includes(q) ||
      (s.client_email || '').toLowerCase().includes(q) ||
      (s.client_phone || '').toLowerCase().includes(q) ||
      (s.reference_number || '').toLowerCase().includes(q)
    );
  }
  if (statusFilter) {
    list = list.filter(s => (s.status || 'en attente').toLowerCase() === statusFilter);
  }
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">${q || statusFilter ? 'Aucun résultat.' : 'Aucun formulaire rempli pour le moment.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => {
    const d = new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const status = s.status || 'en attente';
    return `
      <tr>
        <td><span class="ref-chip">${escapeHtml(s.reference_number || '')}</span></td>
        <td><strong>${escapeHtml(s.client_name || '—')}</strong></td>
        <td style="font-size:.82rem;">${escapeHtml(s.client_email || '')}${s.client_phone ? '<br>' + escapeHtml(s.client_phone) : ''}</td>
        <td>${escapeHtml(s.form_title || '')}${s.form_type ? `<br><span class="fb-type-badge">${escapeHtml(s.form_type)}</span>` : ''}</td>
        <td style="font-size:.82rem;">${escapeHtml(s.service_name || '—')}</td>
        <td style="font-size:.8rem;">${d}</td>
        <td>${statusBadge(status)}</td>
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

  const pd = Array.isArray(s.practitioner_data) ? s.practitioner_data : [];
  const pdHtml = pd.length ? pd.map(a => {
    let val = a.value;
    if (Array.isArray(val)) val = val.join(', ');
    return `<div class="sub-answer"><div class="q">${escapeHtml(a.label)}</div><div class="a">${escapeHtml(val || '—')}</div></div>`;
  }).join('') : '<p style="color:var(--admin-text-muted);">Aucune donnée praticien pour le moment.</p>';

  return `
    <div style="border:1px solid var(--admin-border);border-radius:10px;overflow:hidden;">
      <div style="background:var(--admin-muted-bg);padding:1rem;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
          <div>
            <div style="font-size:1.05rem;font-weight:700;">${escapeHtml(s.form_title || 'Formulaire')}</div>
            ${s.form_type ? `<span class="fb-type-badge">${escapeHtml(s.form_type)}</span>` : ''}
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            ${statusBadge(s.status || 'en attente')}
            <span class="ref-chip" style="height:fit-content;">${escapeHtml(s.reference_number || '')}</span>
          </div>
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
    </div>
    ${isDiagnosticSubmission(s) ? `
    <div style="border:1px solid var(--admin-border);border-radius:10px;overflow:hidden;margin-top:1rem;">
      <div style="background:var(--admin-muted-bg);padding:1rem;">
        <div style="font-weight:700;color:#4A3728;">Diagnostic & plan du praticien</div>
      </div>
      <div style="padding:.5rem 1rem;">
        ${pdHtml}
      </div>
    </div>` : ''}`;
}

function renderPractitionerEditForm(s) {
  return PRACTITIONER_FIELDS.map(group => {
    const fieldsHtml = group.fields.map(f => {
      const val = getPractitionerValue(s, f.label);
      const inputId = `pract-${slugLabel(f.label)}`;
      let control = '';
      if (f.type === 'textarea') {
        control = `<textarea class="form-control" id="${inputId}" rows="3">${escapeHtml(val || '')}</textarea>`;
      } else if (f.type === 'text') {
        control = `<input type="text" class="form-control" id="${inputId}" value="${escapeHtml(val || '')}">`;
      } else if (f.type === 'checkbox') {
        const checked = Array.isArray(val) ? val : (val ? String(val).split(',').map(x => x.trim()) : []);
        control = (f.options || []).map(o => {
          const isChecked = checked.includes(o);
          return `<label style="display:flex;align-items:center;gap:.4rem;padding:.35rem 0;cursor:pointer;"><input type="checkbox" value="${escapeHtml(o)}" ${isChecked ? 'checked' : ''}> ${escapeHtml(o)}</label>`;
        }).join('');
      }
      return `
        <div class="form-group" style="margin-bottom:.75rem;">
          <label class="form-label" style="font-size:.82rem;">${escapeHtml(f.label)}</label>
          ${control}
        </div>`;
    }).join('');
    return `
      <div style="font-weight:700;color:#4A3728;margin:1rem 0 .5rem;padding-bottom:.35rem;border-bottom:1px solid var(--admin-border);">${escapeHtml(group.section)}</div>
      ${fieldsHtml}`;
  }).join('');
}

function slugLabel(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function collectPractitionerData() {
  const data = [];
  PRACTITIONER_FIELDS.forEach(group => {
    group.fields.forEach(f => {
      const inputId = `pract-${slugLabel(f.label)}`;
      let value = '';
      if (f.type === 'checkbox') {
        value = Array.from(document.querySelectorAll(`#${inputId} input[type=checkbox]:checked`)).map(c => c.value);
      } else {
        const el = document.getElementById(inputId);
        value = el ? el.value.trim() : '';
      }
      data.push({ label: f.label, type: f.type, value });
    });
  });
  return data;
}

function viewSubmission(id) {
  const s = allSubmissions.find(x => x.id === id);
  if (!s) return;
  currentSubmission = s;
  if ((s.status || 'en attente') === 'en attente') {
    updateSubmissionStatus(id, 'consulté');
  }
  const detail = document.getElementById('submission-detail');
  detail.innerHTML = buildSubmissionHtml(s) + (isDiagnosticSubmission(s) ? `
    <div id="practitioner-edit" style="margin-top:1rem;border:1px solid var(--admin-border);border-radius:10px;padding:1rem;background:var(--admin-muted-bg);">
      <h4 style="margin:0 0 .75rem;font-size:1rem;color:#4A3728;">Remplir / modifier le diagnostic du praticien</h4>
      ${renderPractitionerEditForm(s)}
      <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;">
        <button class="btn btn-primary" id="btn-save-pract" onclick="savePractitionerData('${s.id}')"><i data-lucide="save"></i> Enregistrer le diagnostic</button>
        <button class="btn btn-secondary" onclick="sendDiagnosticToClient('${s.id}')"><i data-lucide="send"></i> Envoyer au client</button>
      </div>
    </div>` : '');
  document.getElementById('modal-submission').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

async function savePractitionerData(id) {
  const s = allSubmissions.find(x => x.id === id);
  if (!s) return;
  const btn = document.getElementById('btn-save-pract');
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  try {
    const practitioner_data = collectPractitionerData();
    const status = s.status === 'envoyé au client' ? s.status : 'traitement terminé';
    const { error } = await supabaseClient
      .from('form_submissions')
      .update({ practitioner_data, status })
      .eq('id', id);
    if (error) throw error;
    s.practitioner_data = practitioner_data;
    s.status = status;
    renderSubmissions();
    viewSubmission(id);
    showToast('Diagnostic enregistré', 'success');
  } catch (err) {
    console.error('savePractitionerData error:', err);
    showToast('Erreur: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Enregistrer le diagnostic'; if (window.lucide) lucide.createIcons(); }
  }
}

async function updateSubmissionStatus(id, status) {
  const s = allSubmissions.find(x => x.id === id);
  if (!s) return;
  try {
    const { error } = await supabaseClient.from('form_submissions').update({ status }).eq('id', id);
    if (error) throw error;
    s.status = status;
    renderSubmissions();
    showToast('Statut mis à jour', 'success');
  } catch (err) {
    console.error('updateSubmissionStatus error:', err);
    showToast('Erreur: ' + err.message, 'error');
  }
}

function closeSubmissionModal() {
  document.getElementById('modal-submission').classList.remove('active');
  currentSubmission = null;
}

function buildDiagnosticBody(s) {
  const d = new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let body = `Bonjour ${s.client_name || 'cher(e) client(e)'},\n\n`;
  body += `Voici le récapitulatif de votre diagnostic / soin DALIGHT du ${d}.\n\n`;
  const pd = Array.isArray(s.practitioner_data) ? s.practitioner_data : [];
  if (pd.length) {
    body += `--- Diagnostic du praticien ---\n`;
    pd.forEach(p => {
      let val = Array.isArray(p.value) ? p.value.join(', ') : (p.value || '—');
      body += `${p.label}: ${val}\n`;
    });
  }
  body += `\nÀ très bientôt,\nL'équipe DALIGHT`;
  return body;
}

async function sendDiagnosticToClient(id) {
  const s = allSubmissions.find(x => x.id === id);
  if (!s) return;
  if (!s.client_email) { showToast('Email client manquant.', 'error'); return; }

  // Make sure data is saved first
  const practitioner_data = collectPractitionerData();
  const hasData = practitioner_data.some(p => {
    const v = p.value;
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
  if (!hasData) { showToast('Remplissez au moins un champ praticien avant d\'envoyer.', 'error'); return; }

  // Persist latest values and mark as sent
  await savePractitionerData(id);

  const subject = `Votre diagnostic / soin DALIGHT — ${s.reference_number || ''}`;
  const htmlBody = buildDiagnosticEmailHtml(s);

  try {
    const response = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: s.client_email,
        subject,
        html: htmlBody,
        isAdmin: false
      }
    });
    if (response.error) throw response.error;
    if (response.data && response.data.success === false) throw new Error(response.data.error || 'Échec envoi');
    await updateSubmissionStatus(id, 'envoyé au client');
    showToast('Diagnostic envoyé au client', 'success');
  } catch (err) {
    console.warn('sendDiagnosticToClient edge function failed, fallback mailto:', err);
    const body = encodeURIComponent(buildDiagnosticBody(s));
    const mailto = `mailto:${encodeURIComponent(s.client_email)}?subject=${encodeURIComponent(subject)}&body=${body}`;
    window.location.href = mailto;
  }
}

function buildDiagnosticEmailHtml(s) {
  const d = new Date(s.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const pd = Array.isArray(s.practitioner_data) ? s.practitioner_data : [];
  const rows = pd.map(p => {
    let val = Array.isArray(p.value) ? p.value.join(', ') : (p.value || '—');
    return `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;width:40%;">${escapeHtml(p.label)}</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(val)}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;color:#333;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">
  <div style="background:linear-gradient(135deg,#4A3728 0%,#6B4F3B 100%);color:#fff;padding:30px;text-align:center;">
    <h2 style="margin:0;">DALIGHT — Votre diagnostic / soin</h2>
    <p style="margin:8px 0 0;opacity:.9;">${escapeHtml(s.service_name || '')} · ${d}</p>
  </div>
  <div style="padding:30px;">
    <p>Bonjour ${escapeHtml(s.client_name || 'cher(e) client(e)')},</p>
    <p>Voici le récapitulatif de votre diagnostic / soin.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">${rows || '<tr><td style="padding:8px;">Aucune donnée</td></tr>'}</table>
    <p style="margin-top:24px;">À très bientôt,<br><strong>L'équipe DALIGHT</strong></p>
  </div>
</div>
</body></html>`;
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
