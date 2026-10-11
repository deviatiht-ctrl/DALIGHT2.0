// ============================================
// DALIGHT — Loyalty Cards Client JS
// Displays loyalty cards in "Mes Réservations" page
// ============================================

let loyaltyCards = [];
let loyaltyConfigs = [];

async function loadLoyaltyCards(supabase, userEmail) {
  if (!supabase || !userEmail) return [];

  try {
    const { data, error } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('client_email', userEmail)
      .order('created_at', { ascending: false });

    if (error) throw error;
    loyaltyCards = data || [];
    return loyaltyCards;
  } catch (err) {
    console.error('❌ Error loading loyalty cards:', err);
    return [];
  }
}

async function loadLoyaltyConfigs(supabase) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('loyalty_config')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    loyaltyConfigs = data || [];
    return loyaltyConfigs;
  } catch (err) {
    console.error('❌ Error loading loyalty configs:', err);
    return [];
  }
}

// Kòd parrainage kliyan: kreye/jwenn via RPC (37_promo_codes_system.sql)
async function getClientReferralCode(supabase, userEmail, userName) {
  if (!supabase || !userEmail) return null;
  try {
    const { data, error } = await supabase.rpc('get_or_create_referral_code', {
      p_email: userEmail,
      p_name: userName || null,
    });
    if (error) {
      console.warn('get_or_create_referral_code:', error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.warn('referral code error:', e);
    return null;
  }
}

function renderReferralBox(referralCode) {
  if (!referralCode) return '';
  return `
    <div class="lc-referral-box" style="margin:0 0 1rem;padding:1rem 1.25rem;border-radius:12px;background:linear-gradient(135deg,rgba(212,175,55,.15),rgba(74,55,40,.08));border:1px dashed #c9a227;">
      <div style="font-size:.85rem;font-weight:700;color:#c9a227;margin-bottom:.3rem;">🎁 Votre code de parrainage</div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
        <code style="font-size:1.1rem;font-weight:800;letter-spacing:1px;">${escapeHtmlLoyalty(referralCode)}</code>
        <button type="button" onclick="navigator.clipboard.writeText('${escapeHtmlLoyalty(referralCode)}').then(()=>{this.textContent='✓ Copié!';setTimeout(()=>this.textContent='Copier',1500);})" style="padding:.3rem .8rem;border-radius:8px;border:1px solid #c9a227;background:transparent;color:#c9a227;cursor:pointer;font-size:.8rem;font-weight:600;">Copier</button>
      </div>
      <div style="font-size:.78rem;color:rgba(0,0,0,.55);margin-top:.4rem;">
        Partagez ce code : vos filleuls obtiennent un rabais et <strong>vous gagnez des points</strong> à chaque service complété — votre carte VIP arrive plus vite !
      </div>
    </div>
  `;
}

function renderLoyaltySection(cards, referralCode) {
  // Si pa gen kat men gen kòd parrainage, montre kòd la kanmenm
  if ((!cards || cards.length === 0) && referralCode) {
    return `
      <div class="lc-section">
        <h2 class="lc-section-title">
          <i data-lucide="star" style="width:18px;height:18px;color:#c9a227;"></i>
          Programme de fidélité
        </h2>
        ${renderReferralBox(referralCode)}
      </div>
    `;
  }
  if (!cards || cards.length === 0) return '';

  const cardsHtml = cards.map(card => {
    const svcCount = card.services_count || card.stamps_count || 0;
    const stamps = [];
    for (let i = 0; i < 10; i++) {
      if (i < svcCount) {
        stamps.push('<span class="lc-stamp lc-stamp-on">✓</span>');
      } else {
        stamps.push('<span class="lc-stamp lc-stamp-off">' + (i + 1) + '</span>');
      }
    }
    if (svcCount > 10) {
      stamps.push('<span class="lc-stamp-count">' + svcCount + ' services</span>');
    }
    if (card.reward_earned && !card.reward_redeemed) {
      stamps.push('<span class="lc-stamp lc-stamp-reward"><i data-lucide="gift" style="width:16px;height:16px;"></i></span>');
    }

    const statusBadge = card.status === 'active'
      ? '<span class="lc-badge lc-badge-active">Active</span>'
      : card.status === 'redeemed'
        ? '<span class="lc-badge lc-badge-redeemed">Utilisée</span>'
        : '<span class="lc-badge lc-badge-expired">Expirée</span>';

    const tier = card.tier || 'bronze';
    const tierLabel = tier === 'premium' ? 'Premium' : tier === 'argent' ? 'Argent' : 'Bronze';
    const tierBadge = '<span class="lc-badge lc-badge-' + tier + '">' + tierLabel + '</span>';

    const discount = card.current_discount_pct || 0;
    const rewardInfo = card.reward_earned && !card.reward_redeemed
      ? '<div class="lc-reward-banner"><i data-lucide="gift" style="width:14px;height:14px;display:inline-block;vertical-align:-3px;margin-right:4px;"></i> ' + (discount > 0 ? 'Rabais ' + discount + '% débloqué!' : 'Récompense débloquée!') + ' ' + escapeHtmlLoyalty(card.reward_label || '') + '</div>'
      : '';

    const portalUrl = window.location.origin + '/loyalty-card.html?code=' + card.card_code;
    const loyaltyPageUrl = window.location.origin + '/pages/loyalty.html';
    const totalPts = card.total_points || card.points_balance || 0;

    return `
      <div class="lc-card tier-${tier}-card">
        <div class="lc-card-header">
          <div>
            <img src="../assets/images/logodaligth.png?v=2" alt="DALIGHT" style="height:30px;width:auto;display:block;margin-bottom:2px;filter:brightness(0) invert(1);">
            <div class="lc-subtitle">Carte de Fidélité</div>
          </div>
          <div style="display:flex;gap:.4rem;">${tierBadge}${statusBadge}</div>
        </div>
        <div class="lc-divider"></div>
        <div class="lc-service">${svcCount} service(s) complété(s)</div>
        <div class="lc-stamps">${stamps.join('')}</div>
        <div class="lc-progress">
          <span class="lc-count">${svcCount} / 10</span>
          <span class="lc-remaining">${Math.max(10 - svcCount, 0)} avant rabais max</span>
        </div>
        <div class="lc-points-row" style="display:flex;justify-content:space-between;margin-top:.6rem;font-size:.78rem;">
          <span style="color:#c9a227;font-weight:700;">${totalPts} pts</span>
          ${discount > 0 ? '<span style="color:#4ade80;font-weight:700;">Rabais ' + discount + '%</span>' : ''}
        </div>
        ${rewardInfo}
        <div class="lc-code">${escapeHtmlLoyalty(card.card_code)}</div>
        <a href="${portalUrl}" target="_blank" class="lc-view-link">Voir ma carte →</a>
        <a href="${loyaltyPageUrl}" class="lc-view-link" style="margin-top:.3rem;color:rgba(255,255,255,.4);font-size:.75rem;">Voir tous mes points →</a>
      </div>
    `;
  }).join('');

  const totalPoints = cards.reduce((sum, c) => sum + (c.total_points || c.points_balance || 0), 0);
  const tier = totalPoints >= 2000 ? 'premium' : totalPoints >= 500 ? 'argent' : 'bronze';
  const tierLabel = tier === 'premium' ? 'Premium' : tier === 'argent' ? 'Argent' : 'Bronze';

  return `
    <div class="lc-section">
      <h2 class="lc-section-title">
        <i data-lucide="star" style="width:18px;height:18px;color:#c9a227;"></i>
        Mes Cartes de Fidélité
        <span class="lc-badge lc-badge-${tier}" style="margin-left:.5rem;">${tierLabel} · ${totalPoints} pts</span>
      </h2>
      ${renderReferralBox(referralCode)}
      <div class="lc-grid">${cardsHtml}</div>
    </div>
  `;
}

function escapeHtmlLoyalty(value = '') {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}

export { loadLoyaltyCards, loadLoyaltyConfigs, renderLoyaltySection, getClientReferralCode };
