// ============================================
// DALIGHT — AI Assistant for Wood Therapy & Client Tracking
// Provides recommendations for exercises, diet, and automatic calculations
// Based on client session data (weight, measurements, service type)
// ============================================
(function () {
  'use strict';

  const WOOD_THERAPY_AREAS = {
    ventre: { name: 'Ventre / Abdomen', exercises: ['Planche 30s x3', 'Crunchs 15 x3', 'Gainage lateral 20s x2', 'Marche rapide 30min/jour'], diet: ['Reduire le sucre et les féculents le soir', 'Augmenter les proteines maigres (poulet, poisson)', 'Boire 1.5L d\'eau/jour', 'Eviter les boissons gazeuses'], tips: 'Le wood therapy sur le ventre aide a decomposer les cellules graisseuses. Combiner avec une alimentation faible en glucides le soir accelere les resultats.' },
    cuisses: { name: 'Cuisses', exercises: ['Squats 15 x3', 'Fentes 12 x3', 'Leg raises lateral 20 x3', 'Velo 20min'], diet: ['Privilegier les proteines', 'Legumes verts a chaque repas', 'Eviter les sucreries'], tips: 'Les massages profonds sur les cuisses favorisent la circulation lymphatique. Les exercices de renforcement musculaire tonifient et evitent le relachement.' },
    hanches: { name: 'Hanches / Taille', exercises: ['Russian twists 20 x3', 'Side bends 15 x3', 'Planche laterale 30s x2', 'Danse 30min'], diet: ['Reduire le sel (retention d\'eau)', 'The vert le matin', 'Eviter les aliments transformes'], tips: 'Le wood therapy cible les bourrelets lateraux. Les exercices de rotation torso affinent la taille.' },
    bras: { name: 'Bras', exercises: ['Pompes sur genoux 10 x3', 'Dumbbell curls 12 x3', 'Triceps dips 10 x3', 'Corde a sauter 5min'], diet: ['Proteines a chaque repas', 'Amandes et noix comme collation', 'Eviter l\'exces de glucides'], tips: 'Le wood therapy sur les bras aide a tonifier la peau. Combiner avec des exercices de resistance pour un resultat optimal.' },
    dos: { name: 'Dos', exercises: ['Superman 15 x3', 'Rowing 12 x3', 'Chat-vache 10 x3', 'Nage ou tirage 20min'], diet: ['Omega-3 (sardine, saumon)', 'Fruits rouges (antioxydants)', 'Hydratation adequate'], tips: 'Le wood therapy dorsal libere les tensions musculaires et ameliore la posture.' },
    fesses: { name: 'Fesses', exercises: ['Hip thrust 15 x3', 'Squats sumo 15 x3', 'Glute bridge 20 x3', 'Montee d\'escalier 10min'], diet: ['Proteines pour la masse musculaire', 'Patates douces en post-seance', 'Eviter le fast-food'], tips: 'Le wood therapy fessier restructure et raffermit. Les exercices de hip thrust sont les plus efficaces.' },
  };

  const GENERAL_DIET_TIPS = [
    'Petit-dejeuner: The ou cafe sans sucre, 2 oeufs, 1 fruit, 1 tranche de pain complet',
    'Dejeuner: Proteine (poulet/poisson), legumes verts, petite portion de riz',
    'Collation: Amandes (10-15) ou 1 fruit, the vert',
    'Diner: Soupe ou salade avec proteine, eviter les féculents le soir',
    'Hydratation: 1.5 a 2L d\'eau par jour, eviter les jus industriels',
    'Eviter: Sucre raffine, alcool, fritures, boissons gazeuses',
  ];

  const SERVICE_RECOMMENDATIONS = {
    'wood therapy': { focus: ['ventre', 'cuisses', 'hanches'], sessionsPerWeek: 2, restDays: 1 },
    'woodtherapy': { focus: ['ventre', 'cuisses', 'hanches'], sessionsPerWeek: 2, restDays: 1 },
    'massage': { focus: ['dos', 'fesses'], sessionsPerWeek: 1, restDays: 2 },
    'headspa': { focus: [], sessionsPerWeek: 1, restDays: 0, tips: 'Le head spa favorise la detente et la circulation cranienne. Aucun exercice specifique requis.' },
    'cryotherapie': { focus: ['ventre', 'cuisses'], sessionsPerWeek: 3, restDays: 1, tips: 'La cryotherapie complementaire au wood therapy maximise la reduction des graisses.' },
  };

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function getMeas(session, key) { return session && session.measurements ? (session.measurements[key] || null) : null; }

  function calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const h = heightCm / 100;
    const bmi = weightKg / (h * h);
    return { value: bmi.toFixed(1), category: bmi < 18.5 ? 'Insuffisant' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Surpoids' : 'Obesite' };
  }

  function calculateProgress(sessions) {
    if (!sessions || sessions.length < 2) return null;
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    const results = {};
    if (first.weight_kg && last.weight_kg) {
      const diff = last.weight_kg - first.weight_kg;
      results.weight = { diff: diff.toFixed(1), percent: ((diff / first.weight_kg) * 100).toFixed(1), perSession: (diff / sessions.length).toFixed(2) };
    }
    ['waist', 'hips', 'thigh', 'arm'].forEach(key => {
      const f = getMeas(first, key);
      const l = getMeas(last, key);
      if (f && l) {
        const diff = l - f;
        results[key] = { diff: diff.toFixed(1), percent: f > 0 ? ((diff / f) * 100).toFixed(1) : '0', perSession: (diff / sessions.length).toFixed(2) };
      }
    });
    return results;
  }

  function getRecommendations(serviceName, sessions) {
    const svcKey = (serviceName || '').toLowerCase().trim();
    const svc = SERVICE_RECOMMENDATIONS[svcKey] || { focus: ['ventre', 'cuisses'], sessionsPerWeek: 2, restDays: 1 };
    const progress = calculateProgress(sessions);
    const areas = svc.focus.map(k => WOOD_THERAPY_AREAS[k]).filter(Boolean);
    return { service: svcKey, areas, progress, sessionsPerWeek: svc.sessionsPerWeek, restDays: svc.restDays, extraTips: svc.tips || '' };
  }

  function generateReport(serviceName, sessions, clientName) {
    const recs = getRecommendations(serviceName, sessions);
    const progress = recs.progress;
    let html = '<div style="display:grid;gap:1rem;">';

    if (progress) {
      html += '<div class="card" style="padding:1rem;border-radius:12px;background:rgba(255,255,255,.04);">';
      html += '<div style="font-weight:700;font-size:1.1rem;margin-bottom:.5rem;">Calculs automatiques</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem;">';
      if (progress.weight) {
        const sign = parseFloat(progress.weight.diff) > 0 ? '+' : '';
        const color = parseFloat(progress.weight.diff) < 0 ? '#22c55e' : '#ef4444';
        html += `<div style="text-align:center;padding:.6rem;border-radius:8px;background:rgba(255,255,255,.03);"><div style="font-size:1.2rem;font-weight:700;color:${color};">${sign}${progress.weight.diff} kg</div><div style="font-size:.7rem;color:var(--muted,#9aa3b2);text-transform:uppercase;">Variation poids</div></div>`;
        html += `<div style="text-align:center;padding:.6rem;border-radius:8px;background:rgba(255,255,255,.03);"><div style="font-size:1.2rem;font-weight:700;color:${color};">${sign}${progress.weight.percent}%</div><div style="font-size:.7rem;color:var(--muted,#9aa3b2);text-transform:uppercase;">Pourcentage</div></div>`;
        html += `<div style="text-align:center;padding:.6rem;border-radius:8px;background:rgba(255,255,255,.03);"><div style="font-size:1.2rem;font-weight:700;color:${color};">${sign}${progress.weight.perSession} kg</div><div style="font-size:.7rem;color:var(--muted,#9aa3b2);text-transform:uppercase;">Par seance</div></div>`;
      }
      ['waist', 'hips', 'thigh', 'arm'].forEach(key => {
        if (progress[key]) {
          const labels = { waist: 'Ventre', hips: 'Hanches', thigh: 'Cuisse', arm: 'Bras' };
          const sign = parseFloat(progress[key].diff) > 0 ? '+' : '';
          const color = parseFloat(progress[key].diff) < 0 ? '#22c55e' : '#ef4444';
          html += `<div style="text-align:center;padding:.6rem;border-radius:8px;background:rgba(255,255,255,.03);"><div style="font-size:1.1rem;font-weight:700;color:${color};">${sign}${progress[key].diff} cm</div><div style="font-size:.7rem;color:var(--muted,#9aa3b2);text-transform:uppercase;">${labels[key]}</div></div>`;
        }
      });
      html += '</div></div>';
    }

    if (recs.areas.length) {
      html += '<div class="card" style="padding:1rem;border-radius:12px;background:rgba(255,255,255,.04);">';
      html += '<div style="font-weight:700;font-size:1.1rem;margin-bottom:.5rem;">Recommandations personnalisees</div>';
      recs.areas.forEach(area => {
        html += `<div style="margin-bottom:.8rem;padding-bottom:.8rem;border-bottom:1px solid rgba(255,255,255,.06);">`;
        html += `<div style="font-weight:600;color:var(--gold,#c9a227);margin-bottom:.3rem;">${esc(area.name)}</div>`;
        html += `<div style="font-size:.85rem;margin:.3rem 0;"><strong>Exercices:</strong> ${area.exercises.map(e => `<span style="display:inline-block;padding:.15rem .5rem;margin:.15rem;border-radius:6px;background:rgba(59,130,246,.12);color:#93c5fd;font-size:.78rem;">${esc(e)}</span>`).join('')}</div>`;
        html += `<div style="font-size:.85rem;margin:.3rem 0;"><strong>Alimentation:</strong> ${area.diet.map(d => `<span style="display:inline-block;padding:.15rem .5rem;margin:.15rem;border-radius:6px;background:rgba(34,197,94,.12);color:#86efac;font-size:.78rem;">${esc(d)}</span>`).join('')}</div>`;
        html += `<div style="font-size:.82rem;color:var(--muted,#9aa3b2);margin-top:.3rem;font-style:italic;">${esc(area.tips)}</div>`;
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<div class="card" style="padding:1rem;border-radius:12px;background:rgba(255,255,255,.04);">';
    html += '<div style="font-weight:700;font-size:1.1rem;margin-bottom:.5rem;">Plan alimentaire general</div>';
    html += '<div style="display:grid;gap:.3rem;">';
    GENERAL_DIET_TIPS.forEach(t => {
      html += `<div style="font-size:.85rem;padding:.4rem .6rem;border-radius:6px;background:rgba(255,255,255,.02);">${esc(t)}</div>`;
    });
    html += '</div></div>';

    if (recs.extraTips) {
      html += `<div class="card" style="padding:1rem;border-radius:12px;background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.2);"><div style="font-weight:600;color:var(--gold,#c9a227);margin-bottom:.3rem;">Conseil specifique</div><div style="font-size:.85rem;">${esc(recs.extraTips)}</div></div>`;
    }

    html += `<div style="font-size:.78rem;color:var(--muted,#9aa3b2);text-align:center;padding:.5rem;">Genere automatiquement par l'assistant DALIGHT AI</div>`;
    html += '</div>';
    return html;
  }

  function renderAssistant(container, serviceName, sessions, clientName) {
    const hasData = sessions && sessions.length > 0;
    container.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-title" style="display:flex;align-items:center;gap:.5rem;">
          <i data-lucide="brain-circuit" style="width:20px;height:20px;color:var(--gold,#c9a227);"></i>
          Assistant AI — Recommandations
        </div>
        <div style="color:var(--muted,#9aa3b2);font-size:.85rem;margin-bottom:.75rem;">
          Analyse automatique des donnees de ${esc(clientName || 'client')} pour le service: <strong>${esc(serviceName || 'N/A')}</strong>
        </div>
        ${hasData ? generateReport(serviceName, sessions, clientName) : '<div class="empty" style="padding:2rem;text-align:center;color:var(--muted,#9aa3b2);">Aucune seance enregistree. L\'assistant generera des recommandations des la premiere seance.</div>'}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  window.dalightAI = {
    renderAssistant,
    getRecommendations,
    calculateProgress,
    calculateBMI,
    generateReport,
  };
})();
