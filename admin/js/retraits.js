// ============================================================
// DALIGHT — Admin Retraits (Withdrawals) + Revenue
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(r => setTimeout(r, 100));
  const session = await window.adminCore?.checkAdminAuth();
  if (!session) return;

  await Promise.all([loadRevenueStats(), loadWithdrawals()]);
  initWithdrawForm();
});

const getSb = () => window.adminCore.supabase;

// ── FORMAT HELPERS ──────────────────────────────────────────

function fmtHTG(n) {
  return Number(n || 0).toLocaleString('fr-HT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' HTG';
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

function statusBadge(s) {
  const map = {
    pending:   { cls: 'pending',   label: 'En attente' },
    success:   { cls: 'completed', label: 'Succès' },
    failed:    { cls: 'cancelled', label: 'Échoué' },
    cancelled: { cls: 'cancelled', label: 'Annulé' },
  };
  const info = map[s] || { cls: 'pending', label: s };
  return `<span class="status-badge ${info.cls}">${info.label}</span>`;
}

// ── REVENUE STATS ───────────────────────────────────────────

async function loadRevenueStats() {
  const sb = getSb();
  const now = new Date();
  const firstOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  try {
    // ── Lajan reyèl PLOP PLOP sèlman (moncash/natcash/kashpaw) ──
    const { data: txns, error: txErr } = await sb
      .from('dl_plop_transactions')
      .select('amount, payment_method, context_type, created_at, status');

    // Si table pa egziste encore, montre 0 san crash
    if (txErr) {
      console.warn('dl_plop_transactions non disponible:', txErr.message);
      const tbody = document.getElementById('service-revenue-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucune transaction PLOP PLOP — migration SQL requise</td></tr>`;
      setEl('stat-revenue-month', fmtHTG(0));
      setEl('stat-revenue-total', fmtHTG(0));
      setEl('stat-balance', fmtHTG(0));
    }

    const paid = txErr ? [] : (txns || []).filter(t => t.status === 'completed');

    const allRevenue = paid.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const thisMonthRevenue = paid
      .filter(t => t.created_at >= firstOfMonth && t.created_at < firstOfNextMonth)
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const lastMonthRevenue = paid
      .filter(t => t.created_at >= firstOfLastMonth && t.created_at < firstOfMonth)
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    // ── Retraits ──────────────────────────────────────────────────
    const { data: withdrawals } = await sb
      .from('dl_withdrawals')
      .select('montant, status');

    const totalWithdrawn = (withdrawals || [])
      .filter(w => w.status === 'success')
      .reduce((s, w) => s + parseFloat(w.montant || 0), 0);

    const pendingWithdrawn = (withdrawals || [])
      .filter(w => w.status === 'pending')
      .reduce((s, w) => s + parseFloat(w.montant || 0), 0);

    const balance = allRevenue - totalWithdrawn;

    // ── Stat cards ────────────────────────────────────────────────
    setEl('stat-revenue-month', fmtHTG(thisMonthRevenue));
    setEl('stat-revenue-total', fmtHTG(allRevenue));
    setEl('stat-withdrawn', fmtHTG(totalWithdrawn));
    setEl('stat-balance', fmtHTG(balance));
    setEl('stat-pending-withdraw', fmtHTG(pendingWithdrawn));

    const pct = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(0)
      : 0;
    const changeEl = document.getElementById('revenue-month-change');
    if (changeEl) {
      const pos = Number(pct) >= 0;
      changeEl.className = `stat-change ${pos ? 'positive' : 'negative'}`;
      changeEl.textContent = `${pos ? '+' : ''}${pct}% vs mois dernier`;
    }

    // ── Revenu pa méthode PLOP PLOP ───────────────────────────────
    const byMethod = {};
    paid.forEach(t => {
      const m = t.payment_method || 'Autre';
      if (!byMethod[m]) byMethod[m] = { count: 0, paid: 0 };
      byMethod[m].count++;
      byMethod[m].paid += parseFloat(t.amount) || 0;
    });

    const tbody = document.getElementById('service-revenue-tbody');
    if (tbody) {
      const rows = Object.entries(byMethod)
        .sort((a, b) => b[1].paid - a[1].paid)
        .map(([method, d]) => `
          <tr>
            <td><strong style="text-transform:capitalize;">${method}</strong></td>
            <td>${d.count}</td>
            <td style="color:var(--admin-success);font-weight:600;">${fmtHTG(d.paid)}</td>
            <td style="color:var(--admin-text-muted);">${fmtHTG(d.paid)}</td>
          </tr>
        `).join('');
      tbody.innerHTML = rows || `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucune transaction PLOP PLOP complétée</td></tr>`;
    }

  } catch (err) {
    console.error('Erreur chargement stats:', err);
    window.adminCore.showToast('Erreur chargement statistiques: ' + (err.message || err), 'error');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── WITHDRAWAL HISTORY ──────────────────────────────────────

async function loadWithdrawals() {
  const sb = getSb();
  const tbody = document.getElementById('withdrawals-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;"><div class="loading-spinner"></div> Chargement...</td></tr>`;

  try {
    const { data, error } = await sb
      .from('dl_withdrawals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucun retrait effectué</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(w => `
      <tr>
        <td><code style="font-size:.8rem;">${w.reference_id}</code></td>
        <td style="font-weight:600;color:var(--admin-accent);">${fmtHTG(w.montant)}</td>
        <td>${w.phone_number}</td>
        <td>
          <span style="text-transform:capitalize;background:var(--admin-accent-light);color:var(--admin-accent);padding:2px 8px;border-radius:20px;font-size:.8rem;font-weight:600;">
            ${w.payment_method}
          </span>
        </td>
        <td>${statusBadge(w.status)}</td>
        <td style="font-size:.85rem;color:var(--admin-text-muted);">${w.note || '—'}</td>
        <td style="font-size:.8rem;color:var(--admin-text-muted);">${fmtDate(w.created_at)}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Erreur chargement retraits:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-danger);">Erreur chargement</td></tr>`;
  }
}

// ── WITHDRAWAL FORM ─────────────────────────────────────────

function initWithdrawForm() {
  const form = document.getElementById('withdraw-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('withdraw-submit-btn');
    const montant = parseFloat(document.getElementById('withdraw-amount').value);
    const phone = document.getElementById('withdraw-phone').value.trim();
    const pm = document.getElementById('withdraw-method').value;
    const note = document.getElementById('withdraw-note').value.trim();

    if (!montant || montant < 20) {
      window.adminCore.showToast('Montant minimum: 20 HTG', 'error');
      return;
    }
    if (!phone) {
      window.adminCore.showToast('Numéro de téléphone requis', 'error');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Traitement...'; }

    const referenceId = 'WD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

    try {
      const sb = getSb();

      // Call Edge Function
      const { data: plopData, error: plopErr } = await sb.functions.invoke('plop-withdraw', {
        body: {
          reference_id: referenceId,
          montant,
          phone_number: phone,
          payment_method: pm,
        },
      });

      if (plopErr) throw new Error(plopErr.message || 'Erreur Edge Function');

      // Log complet pour debug dans la console
      console.log('[plop-withdraw] response:', plopData);
      if (plopData?.plop_raw) console.warn('[plop-withdraw] raw PLOP response:', plopData.plop_raw);

      const finalStatus = plopData?.status === true || plopData?.status === 'success' ? 'success' : 'failed';

      // Save in DB
      const { error: dbErr } = await sb.from('dl_withdrawals').insert({
        reference_id: referenceId,
        montant,
        phone_number: phone,
        payment_method: pm,
        status: finalStatus,
        note,
        plop_response: plopData || {},
      });

      if (dbErr) console.error('DB save error:', dbErr);

      if (finalStatus === 'success') {
        window.adminCore.showToast(`Retrait de ${fmtHTG(montant)} effectué avec succès !`);
        form.reset();
      } else {
        // Montre erè detaye — plop_raw si disponib
        const rawInfo = plopData?.plop_raw ? `\n\nRéponse brute: ${plopData.plop_raw}` : '';
        const endpointInfo = plopData?.endpoint_tried ? `\nEndpoint: ${plopData.endpoint_tried}` : '';
        const msg = (plopData?.message || 'Retrait échoué') + endpointInfo + rawInfo;
        window.adminCore.showToast(plopData?.message || 'Retrait échoué — voir console pour détails', 'error');
        console.error('[plop-withdraw] échec détaillé:', msg);
      }

      await Promise.all([loadRevenueStats(), loadWithdrawals()]);

    } catch (err) {
      console.error('Withdraw error:', err);
      window.adminCore.showToast(err.message || 'Erreur lors du retrait', 'error');

      // Save failed attempt
      try {
        await getSb().from('dl_withdrawals').insert({
          reference_id: referenceId,
          montant,
          phone_number: phone,
          payment_method: pm,
          status: 'failed',
          note: err.message || 'Erreur interne',
          plop_response: {},
        });
      } catch (_) {}

      await loadWithdrawals();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Effectuer le retrait'; }
    }
  });
}
