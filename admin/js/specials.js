// ============================================
// SPECIALS ADMIN LOGIC
// ============================================

let allSpecials = [];
let specialServices = [];
let editingSpecialId = null;

const specialModal = document.getElementById('special-modal');
const specialsGrid = document.getElementById('specials-grid');

// Load specials grid on page load (non-blocking)
document.addEventListener('DOMContentLoaded', () => {
  wireSpecialUI();
  setTimeout(() => { loadSpecials(); }, 200);
});

function wireSpecialUI() {
  const addBtn = document.getElementById('add-special-btn');
  if (!addBtn) return;
  addBtn.addEventListener('click', async () => {
    await loadServicesForSpecials();
    openSpecialModal();
  });
  document.getElementById('special-modal-close').addEventListener('click', closeSpecialModal);
  document.getElementById('special-modal-cancel').addEventListener('click', closeSpecialModal);
  document.getElementById('special-form').addEventListener('submit', handleSpecialSave);
  document.getElementById('special-flyer').addEventListener('change', handleFlyerPreview);
  specialModal.addEventListener('click', (e) => { if (e.target === specialModal) closeSpecialModal(); });
}

async function loadServicesForSpecials() {
  try {
    const { data, error } = await window.supabaseClient
      .from('services')
      .select('id, name, price_htg, price_usd')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    specialServices = data || [];
  } catch (err) {
    console.error('Error loading services for specials:', err);
  }
}

async function loadSpecials() {
  try {
    const { data, error } = await window.supabaseClient
      .from('dl_specials_with_services')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    allSpecials = data || [];
    renderSpecialsGrid();
  } catch (err) {
    console.error('Error loading specials:', err);
    specialsGrid.innerHTML = '<div class="text-center text-danger" style="grid-column:1/-1;padding:2rem;">Erreur de chargement. Exécutez <code>19_specials_system.sql</code>.</div>';
  }
}

function renderSpecialsGrid() {
  if (allSpecials.length === 0) {
    specialsGrid.innerHTML = '<div class="text-center text-muted" style="grid-column:1/-1;padding:2rem;">Aucun special. Cliquez « + Nouveau Special » pour commencer.</div>';
    return;
  }

  specialsGrid.innerHTML = allSpecials.map(s => `
    <div class="glass-card" style="padding:0;overflow:hidden;">
      ${s.flyer_url ? `<img src="${s.flyer_url}" alt="${esc(s.title)}" style="width:100%;height:160px;object-fit:cover;">` : ''}
      <div style="padding:1.25rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem;">
          <h4 style="font-size:1rem;font-weight:600;margin:0;">${esc(s.title)}</h4>
          <span class="status-badge ${s.is_active ? 'completed' : 'cancelled'}" style="font-size:.75rem;">${s.is_active ? 'Actif' : 'Inactif'}</span>
        </div>
        ${s.description ? `<p class="text-muted" style="font-size:.85rem;margin-bottom:.75rem;max-height:3em;overflow:hidden;">${esc(s.description)}</p>` : ''}
        <div style="font-size:.8rem;color:var(--admin-text-muted);margin-bottom:.75rem;">
          ${formatDate(s.start_date)}${s.end_date ? ' → ' + formatDate(s.end_date) : ''}
        </div>
        ${s.services && s.services.length > 0 ? `
          <div style="font-size:.8rem;margin-bottom:.75rem;">
            <strong>${s.services.length} service(s)</strong>:
            ${s.services.slice(0, 2).map(sv => `<span class="status-badge confirmed" style="font-size:.7rem;padding:.2rem.4rem;margin-right:.25rem;">${esc(sv.service_name)}</span>`).join('')}
            ${s.services.length > 2 ? `<span class="text-muted">+${s.services.length - 2}</span>` : ''}
          </div>
        ` : ''}
        <div style="display:flex;gap:.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="editSpecial('${s.id}')" style="flex:1;">Modifier</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteSpecial('${s.id}', '${esc(s.title)}')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function openSpecialModal(id = null) {
  editingSpecialId = id || null;
  document.getElementById('special-modal-title').textContent = id ? 'Modifier Special' : 'Nouveau Special';
  document.getElementById('special-form').reset();
  document.getElementById('special-id').value = '';
  document.getElementById('special-active').checked = true;
  document.getElementById('special-flyer-preview').innerHTML = '';
  document.getElementById('special-start-date').value = new Date().toISOString().split('T')[0];

  // Render services checkboxes
  renderServicesCheckboxes(id);

  if (id) {
    const s = allSpecials.find(x => x.id === id);
    if (!s) return;
    document.getElementById('special-id').value = s.id;
    document.getElementById('special-title').value = s.title;
    document.getElementById('special-description').value = s.description || '';
    document.getElementById('special-start-date').value = s.start_date;
    document.getElementById('special-end-date').value = s.end_date || '';
    document.getElementById('special-active').checked = s.is_active;
    if (s.flyer_url) {
      document.getElementById('special-flyer-preview').innerHTML = `<img src="${s.flyer_url}" style="max-height:120px;border-radius:8px;">`;
    }
    // Pre-check services
    if (s.services) {
      s.services.forEach(sv => {
        const cb = document.getElementById(`service-check-${sv.service_id}`);
        if (cb) {
          cb.checked = true;
          document.getElementById(`service-discount-type-${sv.service_id}`).value = sv.discount_type;
          document.getElementById(`service-discount-value-${sv.service_id}`).value = sv.discount_value;
        }
      });
    }
  }

  specialModal.classList.add('active');
}

function closeSpecialModal() {
  specialModal.classList.remove('active');
  editingSpecialId = null;
}

function renderServicesCheckboxes(specialId = null) {
  const container = document.getElementById('special-services-container');

  const servicesList = specialServices.length === 0
    ? '<div class="text-muted" style="font-size:.85rem;padding:.5rem 0;">Aucun service disponible — créez-en un ci-dessous.</div>'
    : specialServices.map(svc => `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--admin-border);">
        <input type="checkbox" id="service-check-${svc.id}" value="${svc.id}" style="width:16px;height:16px;cursor:pointer;">
        <div style="flex:1;">
          <div style="font-size:.85rem;font-weight:500;">${esc(svc.name)}</div>
          <div class="text-muted" style="font-size:.75rem;">${Number(svc.price_htg).toLocaleString()} HTG</div>
        </div>
        <select id="service-discount-type-${svc.id}" style="font-size:.75rem;padding:.3rem .5rem;border-radius:6px;border:1px solid var(--admin-border);background:#fff;">
          <option value="percentage">% off</option>
          <option value="fixed">HTG off</option>
        </select>
        <input type="number" id="service-discount-value-${svc.id}" placeholder="0" min="0" style="width:65px;font-size:.75rem;padding:.3rem .4rem;border-radius:6px;border:1px solid var(--admin-border);">
      </div>
    `).join('');

  container.innerHTML = `
    ${servicesList}
    <div style="margin-top:.75rem;">
      <button type="button" onclick="toggleNewServiceForm()" style="font-size:.8rem;color:var(--admin-accent);background:none;border:1px dashed var(--admin-accent);border-radius:8px;padding:.4rem .8rem;cursor:pointer;width:100%;">
        + Créer un nouveau service
      </button>
      <div id="new-service-form" style="display:none;margin-top:.75rem;background:var(--admin-muted-bg);border-radius:10px;padding:.75rem;">
        <div style="font-size:.8rem;font-weight:600;margin-bottom:.5rem;color:var(--admin-accent);">Nouveau service</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
          <input type="text" id="ns-name" placeholder="Nom du service *" style="font-size:.8rem;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--admin-border);">
          <input type="text" id="ns-duration" placeholder="Durée (ex: 60 min)" style="font-size:.8rem;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--admin-border);">
          <input type="number" id="ns-price-htg" placeholder="Prix HTG *" min="0" style="font-size:.8rem;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--admin-border);">
          <input type="number" id="ns-price-usd" placeholder="Prix USD" min="0" step="0.01" style="font-size:.8rem;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--admin-border);">
        </div>
        <textarea id="ns-description" placeholder="Description (optionnel)" rows="2" style="width:100%;font-size:.8rem;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--admin-border);resize:vertical;box-sizing:border-box;margin-bottom:.5rem;"></textarea>
        <div style="display:flex;gap:.5rem;">
          <button type="button" onclick="saveNewServiceFromSpecial()" class="btn btn-primary btn-sm" style="font-size:.8rem;">Créer & Ajouter</button>
          <button type="button" onclick="toggleNewServiceForm()" class="btn btn-secondary btn-sm" style="font-size:.8rem;">Annuler</button>
        </div>
      </div>
    </div>
  `;
}

function toggleNewServiceForm() {
  const form = document.getElementById('new-service-form');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveNewServiceFromSpecial() {
  const name = document.getElementById('ns-name').value.trim();
  const duration = document.getElementById('ns-duration').value.trim();
  const priceHtg = parseFloat(document.getElementById('ns-price-htg').value);
  const priceUsd = parseFloat(document.getElementById('ns-price-usd').value) || 0;
  const description = document.getElementById('ns-description').value.trim();

  if (!name || !priceHtg) {
    alert('Nom et prix HTG requis');
    return;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from('services')
      .insert({
        name,
        duration: duration || '—',
        price_htg: priceHtg,
        price_usd: priceUsd,
        description,
        is_active: true,
        is_featured: false,
        sort_order: 999
      })
      .select('id, name, price_htg, price_usd')
      .single();
    if (error) throw error;

    // Ajoute nan liste a
    specialServices.push(data);
    // Re-render checkboxes epi pre-check nouvo service a
    renderServicesCheckboxes();
    const cb = document.getElementById(`service-check-${data.id}`);
    if (cb) cb.checked = true;

    window.adminCore?.showToast('Service créé et ajouté');

    // Refresh aussi catalogue services la nan background
    if (typeof loadServices === 'function') loadServices();

  } catch (err) {
    alert('Erreur: ' + (err.message || 'Impossible de créer'));
  }
}

function handleFlyerPreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('special-flyer-preview').innerHTML = `<img src="${ev.target.result}" style="max-height:120px;border-radius:8px;">`;
  };
  reader.readAsDataURL(file);
}

async function handleSpecialSave(e) {
  e.preventDefault();
  const title = document.getElementById('special-title').value.trim();
  const description = document.getElementById('special-description').value.trim();
  const startDate = document.getElementById('special-start-date').value;
  const endDate = document.getElementById('special-end-date').value || null;
  const isActive = document.getElementById('special-active').checked;
  const flyerFile = document.getElementById('special-flyer').files[0];

  if (!title || !startDate) {
    alert('Titre et date début requis');
    return;
  }

  // Collect selected services with discounts
  const selectedServices = [];
  specialServices.forEach(svc => {
    const cb = document.getElementById(`service-check-${svc.id}`);
    if (cb && cb.checked) {
      const type = document.getElementById(`service-discount-type-${svc.id}`).value;
      const value = parseFloat(document.getElementById(`service-discount-value-${svc.id}`).value) || 0;
      selectedServices.push({ service_id: svc.id, discount_type: type, discount_value: value });
    }
  });

  try {
    let flyerUrl = null;
    if (flyerFile) {
      const fileName = `special-${Date.now()}-${flyerFile.name}`;
      const { data: uploadData, error: uploadError } = await window.supabaseClient
        .storage
        .from('specials-flyers')
        .upload(fileName, flyerFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = window.supabaseClient
        .storage
        .from('specials-flyers')
        .getPublicUrl(fileName);
      flyerUrl = publicUrl;
    } else if (editingSpecialId) {
      // Keep existing flyer if not uploading new one
      const existing = allSpecials.find(x => x.id === editingSpecialId);
      flyerUrl = existing?.flyer_url || null;
    }

    const specialData = {
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
      flyer_url: flyerUrl,
    };

    let specialId = editingSpecialId;
    if (editingSpecialId) {
      const { error } = await window.supabaseClient
        .from('dl_specials')
        .update(specialData)
        .eq('id', editingSpecialId);
      if (error) throw error;
    } else {
      const { data, error } = await window.supabaseClient
        .from('dl_specials')
        .insert(specialData)
        .select('id')
        .single();
      if (error) throw error;
      specialId = data.id;
    }

    // Delete old special_services for this special
    await window.supabaseClient
      .from('dl_special_services')
      .delete()
      .eq('special_id', specialId);

    // Insert new special_services
    if (selectedServices.length > 0) {
      const { error: svError } = await window.supabaseClient
        .from('dl_special_services')
        .insert(selectedServices.map(s => ({ ...s, special_id: specialId })));
      if (svError) throw svError;
    }

    closeSpecialModal();
    await loadSpecials();
    window.adminCore?.showToast('Special enregistré');
  } catch (err) {
    console.error('Save error:', err);
    alert('Erreur: ' + (err.message || 'Impossible d\'enregistrer'));
  }
}

async function editSpecial(id) {
  openSpecialModal(id);
}

async function deleteSpecial(id, title) {
  if (!confirm(`Supprimer le special "${title}" ?`)) return;
  try {
    const { error } = await window.supabaseClient
      .from('dl_specials')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await loadSpecials();
    window.adminCore?.showToast('Special supprimé');
  } catch (err) {
    console.error('Delete error:', err);
    alert('Erreur: ' + err.message);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
