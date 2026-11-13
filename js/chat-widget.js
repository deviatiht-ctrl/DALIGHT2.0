/**
 * DALIGHT Luxury Concierge & Assistant
 * Works seamlessly for all visitors and authenticated clients
 */

import { getSupabase } from './main.js?v=5.0.0';

let supabase = getSupabase();
let currentUser = null;
let currentReservationId = null;
let isInitialized = false;

const DALIGHT_INFO = {
  address: "Delmas 65, Rue Durandisse #10, Port-au-Prince, Haïti",
  phone: "+509 4747-7221",
  whatsappUrl: "https://wa.me/50947477221?text=Bonjour%20DALIGHT%2C%20je%20souhaite%20des%20renseignements%20sur%20vos%20soins",
  hours: "Du Mardi au Dimanche, de 7h00 à 17h00 (Fermé le Lundi)",
  services: [
    { name: "Head Spa Japonais Signature", price: "85 USD / 10 000 HTG", duration: "60 min" },
    { name: "Massage Thérapeutique & Relaxant", price: "70 USD / 8 500 HTG", duration: "75 min" },
    { name: "Wood Therapy Sculptante & Détox", price: "95 USD / 11 000 HTG", duration: "90 min" },
    { name: "Thérapie Crânienne & Éclat Visage", price: "65 USD / 8 000 HTG", duration: "60 min" },
    { name: "Abonnement Silver Package (4 séances/mois)", price: "15 830 HTG", duration: "Mensuel" },
    { name: "Abonnement Golden Luxury (4 séances/mois)", price: "21 240 HTG", duration: "Mensuel" }
  ]
};

async function waitForSupabase() {
  let attempts = 0;
  while (!supabase && attempts < 25) {
    await new Promise(r => setTimeout(r, 100));
    supabase = getSupabase() || window.dalightSupabase;
    attempts++;
  }
  return supabase || null;
}

export function initChatWidget() {
  const chatBubble = document.getElementById('chat-bubble');
  const chatWindow = document.getElementById('chat-window');
  const chatClose = document.getElementById('chat-close');
  const chatSend = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');

  if (!chatBubble || !chatWindow) return;

  // Prevent multiple initializations / double listeners
  if (chatBubble._hasChatInit) return;
  chatBubble._hasChatInit = true;

  // Make sure chat window is hidden by default
  chatWindow.classList.remove('open');
  chatWindow.style.display = 'none';
  chatBubble.style.display = 'flex';

  let outsideClickListener = null;

  function closeChat() {
    chatWindow.classList.remove('open');
    chatWindow.style.display = 'none';
    chatBubble.style.display = 'flex';
    if (outsideClickListener) {
      document.removeEventListener('click', outsideClickListener);
      outsideClickListener = null;
    }
  }

  async function openChat() {
    chatWindow.classList.add('open');
    chatWindow.style.display = 'flex';
    chatBubble.style.display = 'none';
    await startAssistant();

    // Attach outside click listener safely after click finishes
    setTimeout(() => {
      if (!outsideClickListener) {
        outsideClickListener = (event) => {
          if (!chatWindow.contains(event.target) && !chatBubble.contains(event.target)) {
            closeChat();
          }
        };
        document.addEventListener('click', outsideClickListener);
      }
    }, 150);
  }

  // Toggle chat window only when clicking the bubble
  chatBubble.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (chatWindow.classList.contains('open')) {
      closeChat();
    } else {
      openChat();
    }
  });

  // Close when clicking the little 'x' (cross)
  if (chatClose) {
    chatClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeChat();
    });
  }

  if (chatSend && chatInput) {
    chatSend.addEventListener('click', handleUserSend);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleUserSend();
    });
  }

  window.ChatWidget = {
    open: openChat,
    close: closeChat
  };
}

async function startAssistant() {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  if (isInitialized && messagesContainer.children.length > 0) return;
  isInitialized = true;

  // Try checking auth
  const sb = await waitForSupabase();
  if (sb) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        currentUser = session.user;
      }
    } catch (e) {
      console.warn('Session check skipped:', e);
    }
  }

  // Initial welcome message from DALIGHT Concierge
  const greeting = currentUser 
    ? `Bonjour <strong>${escapeHtml(currentUser.user_metadata?.full_name || currentUser.email)}</strong> ! ✨ Ravi de vous retrouver au DALIGHT. Comment puis-je vous guider aujourd'hui ?`
    : `Bonjour et bienvenue au <strong>DALIGHT</strong> ! 🌿 Je suis votre Assistant Privilège. Comment puis-je vous accompagner dans votre soin de détente de sérénité ?`;

  messagesContainer.innerHTML = '';
  addAssistantMessage(greeting, true);
}

function addAssistantMessage(text, showSuggestions = false) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message received';
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let suggestionsHtml = '';
  if (showSuggestions) {
    suggestionsHtml = `
      <div class="chat-quick-suggestions">
        <button class="chat-suggestion-btn" data-action="services">
          <i data-lucide="sparkles"></i>
          <span>Nos Soins &amp; Tarifs</span>
        </button>
        <button class="chat-suggestion-btn" data-action="booking">
          <i data-lucide="calendar"></i>
          <span>Prendre Rendez-vous</span>
        </button>
        <button class="chat-suggestion-btn" data-action="location">
          <i data-lucide="map-pin"></i>
          <span>Delmas 65</span>
        </button>
        <button class="chat-suggestion-btn" data-action="whatsapp">
          <i data-lucide="phone"></i>
          <span>WhatsApp Direct (+509 4747-7221)</span>
        </button>
      </div>
    `;
  }

  msgEl.innerHTML = `
    <div class="message-content">
      <p>${text}</p>
      ${suggestionsHtml}
      <span class="message-time">${now}</span>
    </div>
  `;

  messagesContainer.appendChild(msgEl);
  scrollToBottom();

  if (showSuggestions) {
    msgEl.querySelectorAll('.chat-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        handleSuggestionClick(btn.dataset.action);
      });
    });
  }

  if (window.lucide) lucide.createIcons();
}

function addUserMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message sent';
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  msgEl.innerHTML = `
    <div class="message-content">
      <p>${escapeHtml(text)}</p>
      <span class="message-time">${now}</span>
    </div>
  `;

  messagesContainer.appendChild(msgEl);
  scrollToBottom();
}

function handleSuggestionClick(action) {
  switch (action) {
    case 'services':
      addUserMessage("Quels sont vos soins et tarifs ?");
      setTimeout(() => {
        let resp = "✨ <strong>Voici nos soins signature les plus prisés :</strong><br><br>";
        DALIGHT_INFO.services.forEach(s => {
          resp += `• <strong>${s.name}</strong> (${s.duration}) : ${s.price}<br>`;
        });
        resp += `<br><a href="./services.html" class="spa-pill-btn" style="display:inline-block;padding:.45rem 1.1rem;font-size:.78rem;margin-top:.4rem;text-decoration:none;">Explorer Tous les Soins →</a>`;
        addAssistantMessage(resp, false);
      }, 400);
      break;

    case 'booking':
      addUserMessage("Comment prendre rendez-vous ?");
      setTimeout(() => {
        const resp = `📅 <strong>La réservation est simple et instantanée :</strong><br><br>
        1. Choisissez votre soin dans notre catalogue.<br>
        2. Sélectionnez votre date et heure idéale.<br>
        3. Confirmez en ligne ou réglez par Moncash / Natcash.<br><br>
        <a href="./services.html" class="spa-pill-btn" style="display:inline-block;padding:.45rem 1.1rem;font-size:.78rem;text-decoration:none;">Prendre Rendez-vous en Ligne →</a>`;
        addAssistantMessage(resp, false);
      }, 400);
      break;

    case 'location':
      addUserMessage("Où êtes-vous situés et quels sont vos horaires ?");
      setTimeout(() => {
        const resp = `📍 <strong>Notre Espace :</strong><br>${DALIGHT_INFO.address}<br><br>
        🕒 <strong>Horaires d'ouverture :</strong><br>${DALIGHT_INFO.hours}<br><br>
        📞 <strong>Téléphone :</strong> <a href="tel:+50947477221" style="color:var(--spa-taupe-rose);">${DALIGHT_INFO.phone}</a>`;
        addAssistantMessage(resp, false);
      }, 400);
      break;

    case 'whatsapp':
      addUserMessage("Je souhaite discuter sur WhatsApp.");
      setTimeout(() => {
        const resp = `💬 Notre équipe vous répond immédiatement sur WhatsApp :<br><br>
        <a href="${DALIGHT_INFO.whatsappUrl}" target="_blank" rel="noopener" class="spa-pill-btn" style="display:inline-block;padding:.5rem 1.2rem;font-size:.8rem;text-decoration:none;background:#25D366;color:#fff;">Ouvrir WhatsApp (+509 4747-7221) ↗</a>`;
        addAssistantMessage(resp, false);
      }, 400);
      break;
  }
}

function handleUserSend() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  addUserMessage(text);
  input.value = '';

  // Process question with intelligent keywords
  setTimeout(() => {
    respondToQuery(text);
  }, 500);
}

function respondToQuery(query) {
  const q = query.toLowerCase();

  if (q.includes('prix') || q.includes('tarif') || q.includes('combien') || q.includes('koban') || q.includes('pri')) {
    let resp = "Nos soins de détente Head Spa débutent à partir de <strong>$85 USD (10 000 HTG)</strong>, les massages à <strong>$70 USD (8 500 HTG)</strong>, et la Wood Therapy à <strong>$95 USD (11 000 HTG)</strong>.<br><br><a href='./services.html' style='color:var(--spa-taupe-rose);text-decoration:underline;'>Consulter tous les tarifs officiels →</a>";
    addAssistantMessage(resp, true);
  } else if (q.includes('rendez-vous') || q.includes('reserver') || q.includes('rezève') || q.includes('booking') || q.includes('dispo')) {
    let resp = "Vous pouvez réserver en ligne 24h/24 en choisissant votre soin et créneau horaire :<br><br><a href='./services.html' class='spa-pill-btn' style='display:inline-block;padding:.4rem 1rem;font-size:.78rem;text-decoration:none;'>Prendre Rendez-vous Maintenant →</a>";
    addAssistantMessage(resp, false);
  } else if (q.includes('adresse') || q.includes('kote') || q.includes('delmas') || q.includes('lieu') || q.includes('localisation')) {
    let resp = `Notre espace est situé à :<br><strong>${DALIGHT_INFO.address}</strong>.<br>Parking sécurisé sur place. 🌿`;
    addAssistantMessage(resp, false);
  } else if (q.includes('heure') || q.includes('ouvert') || q.includes('horaire') || q.includes('lè')) {
    let resp = `Nous vous accueillons <strong>${DALIGHT_INFO.hours}</strong>.`;
    addAssistantMessage(resp, false);
  } else if (q.includes('whatsapp') || q.includes('telephone') || q.includes('numero') || q.includes('rele')) {
    let resp = `Vous pouvez nous joindre directement au <a href="tel:+50947477221" style="color:var(--spa-taupe-rose);"><strong>${DALIGHT_INFO.phone}</strong></a> ou sur WhatsApp :<br><br><a href="${DALIGHT_INFO.whatsappUrl}" target="_blank" rel="noopener" class="spa-pill-btn" style="display:inline-block;padding:.4rem 1rem;font-size:.78rem;background:#25D366;color:#fff;text-decoration:none;">Discuter sur WhatsApp ↗</a>`;
    addAssistantMessage(resp, false);
  } else if (q.includes('bonjour') || q.includes('salut') || q.includes('bonsoir') || q.includes('alo') || q.includes('hello')) {
    let resp = "Bonjour ! Comment puis-je vous aider aujourd'hui ? Souhaitez-vous des détails sur nos soins de détente Head Spa ou prendre un rendez-vous ?";
    addAssistantMessage(resp, true);
  } else {
    let resp = "Merci pour votre message ! Notre espace est à votre écoute. Vous pouvez consulter notre carte des soins ou discuter directement avec un conseiller DALIGHT sur WhatsApp :<br><br><a href='" + DALIGHT_INFO.whatsappUrl + "' target='_blank' rel='noopener' class='spa-pill-btn' style='display:inline-block;padding:.45rem 1.1rem;font-size:.78rem;background:#25D366;color:#fff;text-decoration:none;'>Contacter sur WhatsApp (+509 4747-7221) ↗</a>";
    addAssistantMessage(resp, true);
  }

  // Also sync to Supabase if logged in
  if (supabase && currentUser) {
    try {
      supabase.from('chat_messages').insert({
        sender_email: currentUser.email,
        receiver_email: 'admin@dalightbeauty.com',
        message: query,
        sender_role: 'client'
      }).then();
    } catch (e) {
      console.warn('Could not sync to db:', e);
    }
  }
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Auto-init on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatWidget);
  } else {
    initChatWidget();
  }
}
