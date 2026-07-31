// ============================================
// DALIGHT — Loyalty Cards Admin JS
// ============================================
(function () {
  var sb = window.supabaseClient;
  var allConfigs = [];
  var allCards = [];
  var allServices = [];
  var currentCardId = null;

  async function init() {
    if (!sb) { setTimeout(init, 300); return; }
    await Promise.all([loadServices(), loadConfigs(), loadCards()]);
    renderConfigs();
    renderCards();
    populateServiceSelects();
  }

  // ---- Services ----
  async function loadServices() {
    var r = await sb.from('services').select('id,name,category').order('name');
    allServices = r.data || [];
  }

  // ---- Configs ----
  async function loadConfigs() {
    var r = await sb.from('loyalty_config').select('*').order('created_at', { ascending: false });
    allConfigs = r.data || [];
  }

  function renderConfigs() {
    var el = document.getElementById('configs-list');
    if (!allConfigs.length) {
      el.innerHTML = '<div class="card" style="text-align:center;padding:3rem;color:var(--admin-text-muted);">' +
        '<p style="font-size:1.1rem;margin-bottom:.5rem;">Aucun programme de fidélité configuré</p>' +
        '<p style="font-size:.85rem;">Cliquez sur "Configurer un service" pour créer un programme de fidélité pour un service.</p></div>';
      return;
    }
    el.innerHTML = allConfigs.map(function (c) {
      var badgeClass = c.reward_type === 'free_session' ? 'reward-free' :
        c.reward_type === 'percentage' ? 'reward-pct' :
          c.reward_type === 'points' ? 'reward-points' : 'reward-free-svc';
      var badgeText = c.reward_type === 'free_session' ? 'Séance gratuite' :
        c.reward_type === 'percentage' ? c.discount_pct + '% de réduction' :
          c.reward_type === 'points' ? c.points_per_session + ' pts/séance' : 'Service gratuit';
      var active = c.is_active;
      var displayName = c.service_id ? esc(c.service_name) : '<span style="color:var(--admin-accent);font-weight:700;">Tous les services</span>';
      return '<div class="card" style="margin-bottom:1rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;">' +
        '<div><div style="font-size:1.1rem;font-weight:600;color:#1e293b;">' + displayName + '</div>' +
        '<div style="margin-top:.4rem;display:flex;gap:.5rem;flex-wrap:wrap;">' +
        '<span class="reward-badge ' + badgeClass + '">' + badgeText + '</span>' +
        (c.reward_type === 'free_session' || c.reward_type === 'free_service' ? '<span class="reward-badge" style="background:var(--admin-muted-bg);color:var(--admin-text-muted);">Après ' + c.threshold + ' séances</span>' : '') +
        '<span class="reward-badge" style="background:var(--admin-muted-bg);color:var(--admin-text-muted);">Validité: ' + c.valid_months + ' mois</span>' +
        (active ? '<span class="reward-badge reward-free">Actif</span>' : '<span class="reward-badge" style="background:#fee2e2;color:#991b1b;">Inactif</span>') +
        '</div>' +
        (c.reward_label ? '<div style="margin-top:.5rem;font-size:.85rem;color:var(--admin-text-muted);">' + esc(c.reward_label) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:.5rem;">' +
        '<button class="btn btn-secondary btn-sm" onclick="editConfig(\'' + c.id + '\')">Modifier</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteConfig(\'' + c.id + '\')">Supprimer</button>' +
        '</div></div></div>';
    }).join('');
  }

  // ---- Cards ----
  async function loadCards() {
    var r = await sb.from('loyalty_cards').select('*').order('created_at', { ascending: false });
    allCards = r.data || [];
  }

  function renderCards() {
    var search = (document.getElementById('card-search')?.value || '').toLowerCase();
    var svcFilter = document.getElementById('card-filter-service')?.value || '';
    var statusFilter = document.getElementById('card-filter-status')?.value || '';

    var filtered = allCards.filter(function (c) {
      if (search && !((c.client_name || '').toLowerCase().includes(search) ||
        (c.client_email || '').toLowerCase().includes(search) ||
        (c.card_code || '').toLowerCase().includes(search))) return false;
      if (svcFilter && c.service_id !== svcFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    });

    var tbody = document.getElementById('cards-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucune carte trouvée.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function (c) {
      var stamps = '';
      var max = Math.min(c.total_required, 15);
      for (var i = 0; i < max; i++) {
        stamps += '<span class="stamp-dot ' + (i < c.stamps_count ? 'stamp-on' : 'stamp-off') + '">' + (i < c.stamps_count ? '✓' : (i + 1)) + '</span>';
      }
      if (c.total_required > 15) stamps += '<span style="font-size:.75rem;color:var(--admin-text-muted);margin-left:.3rem;">/' + c.total_required + '</span>';
      if (c.reward_earned && !c.reward_redeemed) stamps += '<span class="stamp-dot stamp-reward">★</span>';

      var statusBadge = c.status === 'active' ? '<span class="reward-badge reward-free">Actif</span>' :
        c.status === 'redeemed' ? '<span class="reward-badge" style="background:#dbeafe;color:#1e40af;">Utilisée</span>' :
          c.status === 'expired' ? '<span class="reward-badge" style="background:#fee2e2;color:#991b1b;">Expiré</span>' :
            '<span class="reward-badge" style="background:var(--admin-muted-bg);color:var(--admin-text-muted);">' + c.status + '</span>';

      return '<tr>' +
        '<td><div style="font-weight:600;">' + esc(c.client_name) + '</div><div style="font-size:.78rem;color:var(--admin-text-muted);">' + esc(c.client_email) + '</div></td>' +
        '<td>' + esc(c.service_name) + '</td>' +
        '<td><div style="display:flex;align-items:center;flex-wrap:wrap;">' + stamps + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);margin-top:.3rem;">' + c.stamps_count + ' / ' + c.total_required + '</div></td>' +
        '<td>' + (c.reward_earned ? (c.reward_redeemed ? '<span style="color:var(--admin-text-muted);">Utilisée</span>' : '<span style="color:var(--admin-success);font-weight:600;">★ Disponible!</span>') : '—') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td><span style="font-family:monospace;font-size:.78rem;">' + esc(c.card_code) + '</span></td>' +
        '<td><button class="btn btn-secondary btn-sm" onclick="viewCard(\'' + c.id + '\')">Voir</button></td>' +
        '</tr>';
    }).join('');
  }

  // ---- Config Modal ----
  function populateServiceSelects() {
    var sel = document.getElementById('cfg-service');
    var cardSel = document.getElementById('card-filter-service');
    sel.innerHTML = '<option value="all">Tous les services</option>' + allServices.map(function (s) {
      return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
    }).join('');
    cardSel.innerHTML = '<option value="">Tous les services</option>' + allServices.map(function (s) {
      return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
    }).join('');
  }

  window.openConfigModal = function () {
    document.getElementById('cfg-id').value = '';
    document.getElementById('config-title').textContent = 'Configurer la fidélité';
    Array.from(document.getElementById('cfg-service').options).forEach(function(o) { o.selected = false; });
    document.getElementById('cfg-reward-type').value = 'free_session';
    document.getElementById('cfg-threshold').value = 10;
    document.getElementById('cfg-pct').value = 10;
    document.getElementById('cfg-pps').value = 1;
    document.getElementById('cfg-label').value = '';
    document.getElementById('cfg-months').value = 12;
    document.getElementById('cfg-active').checked = true;
    toggleRewardFields();
    document.getElementById('modal-config').classList.add('active');
  };

  window.editConfig = function (id) {
    var c = allConfigs.find(function (x) { return x.id === id; });
    if (!c) return;
    document.getElementById('cfg-id').value = c.id;
    document.getElementById('config-title').textContent = 'Modifier — ' + c.service_name;
    Array.from(document.getElementById('cfg-service').options).forEach(function(o) {
      o.selected = (c.service_id && o.value === c.service_id) || (c.service_id === null && o.value === 'all');
    });
    document.getElementById('cfg-reward-type').value = c.reward_type;
    document.getElementById('cfg-threshold').value = c.threshold;
    document.getElementById('cfg-pct').value = c.discount_pct || 10;
    document.getElementById('cfg-pps').value = c.points_per_session || 1;
    document.getElementById('cfg-label').value = c.reward_label || '';
    document.getElementById('cfg-months').value = c.valid_months;
    document.getElementById('cfg-active').checked = c.is_active;
    toggleRewardFields();
    document.getElementById('modal-config').classList.add('active');
  };

  window.closeConfigModal = function () {
    document.getElementById('modal-config').classList.remove('active');
  };

  window.toggleRewardFields = function () {
    var type = document.getElementById('cfg-reward-type').value;
    document.getElementById('fg-threshold').style.display = (type === 'free_session' || type === 'free_service') ? '' : 'none';
    document.getElementById('fg-pct').style.display = type === 'percentage' ? '' : 'none';
    document.getElementById('fg-points').style.display = type === 'points' ? '' : 'none';
  };

  window.saveConfig = async function () {
    var id = document.getElementById('cfg-id').value || null;
    var sel = document.getElementById('cfg-service');
    var selectedIds = Array.from(sel.selectedOptions).map(function(o) { return o.value; }).filter(function(v) { return v && v !== 'all'; });
    var isAllServices = Array.from(sel.selectedOptions).some(function(o) { return o.value === 'all'; });
    if (!selectedIds.length && !isAllServices) { alert('Choisissez au moins un service'); return; }
    var type = document.getElementById('cfg-reward-type').value;
    var basePayload = {
      reward_type: type,
      threshold: parseInt(document.getElementById('cfg-threshold').value, 10) || 10,
      discount_pct: parseInt(document.getElementById('cfg-pct').value, 10) || 0,
      points_per_session: parseInt(document.getElementById('cfg-pps').value, 10) || 1,
      reward_label: document.getElementById('cfg-label').value.trim(),
      valid_months: parseInt(document.getElementById('cfg-months').value, 10) || 12,
      is_active: document.getElementById('cfg-active').checked,
      updated_at: new Date().toISOString(),
    };
    try {
      if (isAllServices) {
        // Upsert config for all services
        var configsToUpsert = allServices.map(function(svc) {
          return Object.assign({}, basePayload, { service_id: svc.id, service_name: svc.name });
        });
        if (id) {
          // Update existing config first
          var existingConfig = allConfigs.find(function(c) { return c.id === id; });
          if (existingConfig && existingConfig.service_id) {
            var r = await sb.from('loyalty_config').update(Object.assign({}, basePayload, { service_id: existingConfig.service_id, service_name: existingConfig.service_name })).eq('id', id);
            if (r.error) throw r.error;
          }
          // Upsert for all other services
          for (var i = 0; i < configsToUpsert.length; i++) {
            if (existingConfig && configsToUpsert[i].service_id === existingConfig.service_id) continue;
            var rr = await sb.from('loyalty_config').upsert(configsToUpsert[i], { onConflict: 'service_id' });
            if (rr.error) throw rr.error;
          }
        } else {
          for (var i2 = 0; i2 < configsToUpsert.length; i2++) {
            var rr2 = await sb.from('loyalty_config').upsert(configsToUpsert[i2], { onConflict: 'service_id' });
            if (rr2.error) throw rr2.error;
          }
        }
      } else {
        // Upsert one config per selected service
        for (var j = 0; j < selectedIds.length; j++) {
          var svcObj = allServices.find(function (s) { return s.id === selectedIds[j]; });
          var payload = Object.assign({}, basePayload, { service_id: selectedIds[j], service_name: svcObj ? svcObj.name : '' });
          if (id && j === 0) {
            var rUpd = await sb.from('loyalty_config').update(payload).eq('id', id);
            if (rUpd.error) throw rUpd.error;
          } else {
            var rUpsert = await sb.from('loyalty_config').upsert(payload, { onConflict: 'service_id' });
            if (rUpsert.error) throw rUpsert.error;
          }
        }
      }
      if (window.adminCore) window.adminCore.showToast('Configuration enregistrée', 'success');
      closeConfigModal();
      await loadConfigs();
      renderConfigs();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  window.deleteConfig = async function (id) {
    if (!confirm('Supprimer ce programme de fidélité ? Les cartes existantes resteront mais ne seront plus mises à jour.')) return;
    try {
      var r = await sb.from('loyalty_config').delete().eq('id', id);
      if (r.error) throw r.error;
      if (window.adminCore) window.adminCore.showToast('Programme supprimé', 'success');
      await loadConfigs();
      renderConfigs();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // ---- Card Detail Modal ----
  window.viewCard = function (id) {
    var c = allCards.find(function (x) { return x.id === id; });
    if (!c) return;
    currentCardId = id;
    var stamps = '';
    for (var i = 0; i < c.total_required; i++) {
      stamps += '<span class="stamp-dot ' + (i < c.stamps_count ? 'stamp-on' : 'stamp-off') + '" style="width:32px;height:32px;font-size:.8rem;">' + (i < c.stamps_count ? '✓' : (i + 1)) + '</span>';
    }
    var portalUrl = window.location.origin + '/loyalty-card.html?code=' + c.card_code;
    var body = '<div style="text-align:center;">' +
      '<div style="font-family:Playfair Display,serif;font-size:1.5rem;font-weight:700;color:var(--admin-accent);margin-bottom:.3rem;">DA<span style="color:var(--admin-text);">LIGHT</span></div>' +
      '<div style="font-size:.8rem;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem;">Carte de Fidélité</div>' +
      '<div style="font-size:1.1rem;font-weight:600;">' + esc(c.client_name) + '</div>' +
      '<div style="font-size:.85rem;color:var(--admin-text-muted);">' + esc(c.service_name) + '</div>' +
      '<div style="margin:1.2rem 0;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;">' + stamps + '</div>' +
      '<div style="font-size:.9rem;font-weight:600;color:' + (c.reward_earned ? 'var(--admin-success)' : 'var(--admin-text-muted)') + ';">' + (c.reward_earned ? '★ Récompense débloquée!' : c.stamps_count + ' / ' + c.total_required + ' séances') + '</div>' +
      '<div style="margin-top:1rem;font-family:monospace;font-size:.8rem;color:var(--admin-text-muted);">' + esc(c.card_code) + '</div>' +
      '<div style="margin-top:.8rem;"><a href="' + portalUrl + '" target="_blank" style="font-size:.8rem;color:var(--admin-accent);">' + portalUrl + '</a></div>' +
      '<div style="margin-top:.8rem;font-size:.78rem;color:var(--admin-text-muted);">Expire le ' + (c.expires_at ? new Date(c.expires_at).toLocaleDateString('fr-FR') : '—') + '</div>' +
      '</div>';
    document.getElementById('card-detail-body').innerHTML = body;
    document.getElementById('btn-redeem').style.display = (c.reward_earned && !c.reward_redeemed) ? '' : 'none';
    document.getElementById('modal-card').classList.add('active');
  };

  window.closeCardModal = function () {
    document.getElementById('modal-card').classList.remove('active');
    currentCardId = null;
  };

  window.redeemCard = async function () {
    if (!currentCardId) return;
    if (!confirm('Marquer la récompense comme utilisée ?')) return;
    try {
      var r = await sb.from('loyalty_cards').update({ reward_redeemed: true, status: 'redeemed', last_updated: new Date().toISOString() }).eq('id', currentCardId);
      if (r.error) throw r.error;
      await sb.from('loyalty_transactions').insert({ card_id: currentCardId, type: 'reward_redeemed', description: 'Récompense utilisée (admin)' });
      if (window.adminCore) window.adminCore.showToast('Récompense marquée comme utilisée', 'success');
      await loadCards();
      renderCards();
      closeCardModal();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  // ---- Tabs ----
  window.switchTab = function (tab) {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('content-' + tab).classList.add('active');
  };

  // ---- Backfill: process existing completed reservations ----
  window.backfillCards = async function () {
    var btn = document.getElementById('btn-backfill');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Vérification...'; }
    if (window.lucide) window.lucide.createIcons();
    try {
      var client = sb || window.supabaseClient;
      if (!client) {
        if (window.adminCore && window.adminCore.getSupabase) client = window.adminCore.getSupabase();
      }
      if (!client) throw new Error('Supabase non initialisé');
      var result = await client.rpc('backfill_loyalty_cards');
      if (result.error) throw result.error;
      var rows = result.data || [];
      var created = rows.filter(function(r) { return r.card_id !== null; }).length;
      var noConfig = rows.filter(function(r) { return r.status === 'no config'; }).length;
      var msg = created + ' carte(s) créée(s)/mise(s) à jour';
      if (noConfig > 0) msg += ', ' + noConfig + ' sans configuration';
      if (rows.length === 0 || (rows.length === 1 && rows[0].status === 'No pending reservations to process')) {
        msg = 'Aucune réservation terminée en attente. Tout est à jour!';
      }
      if (window.adminCore) window.adminCore.showToast(msg, 'success');
      else alert(msg);
      await loadCards();
      renderCards();
    } catch (err) {
      console.error('Backfill error:', err);
      if (window.adminCore) window.adminCore.showToast('Erreur: ' + err.message, 'error');
      else alert('Erreur: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw"></i> Vérifier réservations passées'; }
      if (window.lucide) window.lucide.createIcons();
    }
  };

  // ---- Utils ----
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
