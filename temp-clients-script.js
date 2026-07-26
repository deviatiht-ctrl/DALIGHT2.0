
    let allClients = [];
    let reservationCounts = {};
    let clientPhones = {};
    let sb = null;

    function getSupabase() {
      return window.adminCore?.supabase || window.dalightAdminSupabase || window.supabaseClient || null;
    }

    function displayError(msg) {
      const tbody = document.getElementById('clients-table');
      const countEl = document.getElementById('clients-count');
      const safe = String(msg).replace(/</g, '&lt;').replace(/&/g, '&amp;');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem; color:red;">' + safe + '</td></tr>';
      if (countEl) countEl.textContent = 'Erreur';
    }

    window.onerror = function(message, source, lineno, colno, error) {
      console.error('JS Error:', message, source, lineno, error);
      displayError('Erreur JS: ' + message + ' (ligne ' + lineno + ')');
      return false;
    };
    window.addEventListener('unhandledrejection', function(event) {
      console.error('Promise rejection:', event.reason);
      const reason = event.reason && event.reason.message ? event.reason.message : event.reason;
      displayError('Erreur async: ' + reason);
    });

    document.addEventListener('DOMContentLoaded', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (window.adminCore?.checkAdminAuth) {
        const session = await window.adminCore.checkAdminAuth();
        if (!session) return;
      }
      sb = getSupabase();
      loadClients();
      initSearch();
    });
    
    window.sendClientEmail = function(email, name, template) {
      if (!email) return alert("Ce client n'a pas d'email.");
      name = name || 'Cher(e) client(e)';
      const phone = '+509 4747-7221';
      const templates = {
        welcome: {
          subject: 'Bienvenue chez DALIGHT Spa',
          body: `Bonjour ${name},\n\nBienvenue dans la famille DALIGHT ! Nous sommes ravis de vous compter parmi nos clients.\n\nDécouvrez nos services signature : Head Spa, massages thérapeutiques, soins capillaires personnalisés et plus encore.\n\n✨ Réservez en ligne : https://dalightspa.com\n📞 Ou appelez-nous : ${phone}\n\nÀ très bientôt,\nL'équipe DALIGHT`
        },
        promo: {
          subject: '🎁 Offre spéciale DALIGHT Spa - Pour vous !',
          body: `Bonjour ${name},\n\nNous avons une offre spéciale rien que pour vous !\n\n[Décrivez votre offre ici]\n\nRéservez dès maintenant :\n📞 ${phone}\n📍 Delmas 65, Faustin Premier Durandise #10\n\nÀ très vite,\nL'équipe DALIGHT`
        },
        custom: {
          subject: 'DALIGHT Spa',
          body: `Bonjour ${name},\n\n`
        },
      };
      const t = templates[template] || templates.custom;
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
    };

    function initSearch() {
      const input = document.getElementById('search-input');
      if (input) {
        input.addEventListener('input', renderClients);
      }
    }
    
    async function loadClients() {
      const core = window.adminCore || {};

      try {
        if (typeof core.fetchClients === 'function') {
          allClients = await core.fetchClients();
        } else {
          const client = getSupabase();
          if (!client) throw new Error('Supabase non disponible');
          const { data, error } = await client
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          allClients = data || [];
        }

        let reservations = [];
        if (typeof core.fetchReservations === 'function') {
          reservations = await core.fetchReservations();
        } else {
          const client = getSupabase();
          const { data, error } = await client
            .from('reservations')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          reservations = data || [];
        }

        reservationCounts = {};
        clientPhones = {};
        reservations.forEach(r => {
          const email = r.user_email;
          reservationCounts[email] = (reservationCounts[email] || 0) + 1;
          if (r.phone && !clientPhones[email]) {
            clientPhones[email] = r.phone;
          }
        });

        document.getElementById('total-clients').textContent = allClients.length;

        const now = new Date();
        const activeEmails = new Set();
        reservations.forEach(r => {
          const date = new Date(r.created_at);
          if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
            activeEmails.add(r.user_email);
          }
        });
        document.getElementById('active-clients').textContent = activeEmails.size;

        renderClients();
      } catch (err) {
        console.error('Error loading clients:', err);
        displayError('Erreur chargement clients: ' + err.message);
      }
    }
    
    function renderClients() {
      const formatDate = window.adminCore?.formatDate || ((d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-');
      const getInitials = window.adminCore?.getInitials || ((n) => n ? n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2) : '?');
      const tbody = document.getElementById('clients-table');
      const searchInput = document.getElementById('search-input');
      const countEl = document.getElementById('clients-count');
      
      let filtered = [...allClients];
      
      if (searchInput && searchInput.value) {
        const search = searchInput.value.toLowerCase();
        filtered = filtered.filter(c => 
          (c.email && c.email.toLowerCase().includes(search)) ||
          (c.full_name && c.full_name.toLowerCase().includes(search))
        );
      }
      
      countEl.textContent = `${filtered.length} client${filtered.length > 1 ? 's' : ''}`;
      
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;">Aucun client trouvé</td></tr>';
        return;
      }
      
      tbody.innerHTML = filtered.map(c => `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar">${getInitials(c.full_name || c.email)}</div>
              <div style="font-weight: 500;">${c.full_name || 'Non renseigné'}</div>
            </div>
          </td>
          <td>${c.email}</td>
          <td>${c.phone || clientPhones[c.email] || '-'}</td>
          <td><span class="status-badge ${reservationCounts[c.email] ? 'completed' : 'pending'}">${reservationCounts[c.email] || 0} réservation(s)</span></td>
          <td>${formatDate(c.created_at)}</td>
          <td>
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" onclick="sendClientEmail('${c.email}','${(c.full_name||'').replace(/'/g,"\\'")}','welcome')" title="Bienvenue">👋 Bienvenue</button>
              <button class="btn btn-secondary btn-sm" onclick="sendClientEmail('${c.email}','${(c.full_name||'').replace(/'/g,"\\'")}','promo')" title="Promo">🎁 Promo</button>
              <button class="btn btn-secondary btn-sm" onclick="sendClientEmail('${c.email}','${(c.full_name||'').replace(/'/g,"\\'")}','custom')" title="Écrire">✉️ Écrire</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
    const BULK_TEMPLATES = { welcome: { subject: 'Bienvenue chez DALIGHT', body: `Bonjour {name},\n\nBienvenue dans la famille DALIGHT ! Nous sommes ravis de vous compter parmi nos clients.\n\nDécouvrez nos services signature : Head Spa, massages thérapeutiques, soins capillaires personnalisés et plus encore.\n\n✨ Réservez en ligne : https://dalightbeauty.com\n📞 Ou appelez-nous : +509 4747-7221\n\nÀ très bientôt,\nL'équipe DALIGHT` }, reminder: { subject: 'Votre bien-être compte pour DALIGHT', body: `Bonjour {name},\n\nCela fait un moment que nous ne vous avons pas vu(e) chez DALIGHT. Nous tenons à vous rappeler que votre confort et votre bien-être sont notre priorité.\n\nPrenez rendez-vous dès maintenant pour un moment de détente et de soin.\n\n📞 +509 4747-7221\n🌐 https://dalightbeauty.com\n\nAu plaisir de vous accueillir,\nL'équipe DALIGHT` }, promo: { subject: '🎁 Offre spéciale DALIGHT - Pour vous !', body: `Bonjour {name},\n\nNous avons une offre spéciale rien que pour vous !\n\n[Décrivez votre offre ici]\n\nRéservez dès maintenant :\n📞 +509 4747-7221\n📍 Delmas 65, Faustin Premier Durandisse #10\n\nÀ très vite,\nL'équipe DALIGHT` }, custom: { subject: 'DALIGHT Spa', body: `Bonjour {name},\n\n` } };
    function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function buildHtmlEmail(name, bodyText) { const escapedName = escapeHtml(name || 'Cher(e) client(e)'); const bodyHtml = escapeHtml(bodyText).replace(/\n/g, '<br>'); return `<!DOCTYPE html>\n<html>\n<head>\n<meta charset='utf-8'>\n<style>body { font-family: Montserrat, sans-serif; background: #f5f3f0; margin: 0; padding: 20px; } .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(74,55,40,0.1); } .header { background: linear-gradient(135deg, #4A3728 0%, #6B4F3B 100%); padding: 30px 40px; text-align: center; } .logo { max-width: 120px; height: auto; } .content { padding: 40px; color: #4A3728; } .greeting { font-size: 22px; font-weight: 600; margin-bottom: 20px; } .message { font-size: 16px; line-height: 1.7; color: #5a4a3a; margin-bottom: 25px; } .cta-button { display: inline-block; background: #D4AF37; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; } .footer { background: #4A3728; padding: 25px 40px; text-align: center; color: #e8e0d8; font-size: 14px; }</style>\n</head>\n<body>\n<div class='container'>\n<div class='header'><img src='https://raw.githubusercontent.com/deviatiht-ctrl/DALIGHT2.0/main/assets/images/logodaligth.png' alt='DALIGHT' class='logo'></div>\n<div class='content'>\n<p class='greeting'>Bonjour ${escapedName},</p>\n<p class='message'>${bodyHtml}</p>\n</div>\n<div class='footer'>\n<p>DALIGHT Head Spa · Delmas 65, Faustin Premier Durandisse #10, Haïti</p>\n<p>+509 4747-7221 · dalightbeauty15mai@gmail.com</p>\n<p>© ${new Date().getFullYear()} DALIGHT. Tous droits réservés.</p>\n</div>\n</div>\n</body>\n</html>`; }
    function openBulkEmailModal() { const modal = document.getElementById('bulk-email-modal'); modal.style.display = 'flex'; if (!document.getElementById('bulk-email-subject').value) applyBulkTemplate(); else updateBulkPreview(); }
    function closeBulkEmailModal() { document.getElementById('bulk-email-modal').style.display = 'none'; }
    function applyBulkTemplate() { const key = document.getElementById('bulk-email-template').value; const t = BULK_TEMPLATES[key] || BULK_TEMPLATES.custom; document.getElementById('bulk-email-subject').value = t.subject; document.getElementById('bulk-email-body').value = t.body; updateBulkPreview(); }
    function updateBulkPreview() { const subject = document.getElementById('bulk-email-subject').value; const body = document.getElementById('bulk-email-body').value; const previewName = 'Marie Exemple'; const personalized = body.replace(/{name}/g, previewName); const html = buildHtmlEmail(previewName, personalized); document.getElementById('bulk-email-preview').srcdoc = html; }
    async function sendBulkEmail() { const subject = document.getElementById('bulk-email-subject').value.trim(); const body = document.getElementById('bulk-email-body').value; if (!subject || !body) { window.adminCore?.showToast?.('Objet et message obligatoires.', 'error'); return; } const clients = allClients.filter(c => c.email); if (!clients.length) { window.adminCore?.showToast?.('Aucun client avec email trouvé.', 'error'); return; } if (!sb) { window.adminCore?.showToast?.('Supabase non connecté.', 'error'); return; } const sendBtn = document.getElementById('bulk-email-send-btn'); sendBtn.disabled = true; sendBtn.textContent = 'Envoi en cours...'; let sent = 0, failed = 0; try { for (const c of clients) { const name = c.full_name || 'Cher(e) client(e)'; const personalized = body.replace(/{name}/g, name); const html = buildHtmlEmail(name, personalized); const { error } = await sb.functions.invoke('send-email', { body: { to: c.email, subject, html, isAdmin: true } }); if (error) { console.error('Email failed for', c.email, error); failed++; } else { sent++; } } window.adminCore?.showToast?.(`${sent} email(s) envoyé(s)${failed ? ', ' + failed + ' échec(s)' : ''}`, failed ? 'error' : 'success'); closeBulkEmailModal(); } catch (err) { console.error(err); window.adminCore?.showToast?.('Erreur envoi : ' + err.message, 'error'); } finally { sendBtn.disabled = false; sendBtn.textContent = 'Envoyer à tous'; } }
  