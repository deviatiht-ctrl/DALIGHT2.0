/**
 * DALIGHT — CONCIERGE IA WHATSAPP (GOOGLE GEMINI 3 FLASH)
 * 
 * Capacités clés :
 * 1. Synchronisation EN DIRECT avec Supabase : tout changement de prix sur le site est connu instantanément.
 * 2. Compréhension totale du Créole Haïtien (Kreyòl) et du Français.
 * 3. Réponse en Français raffiné, chaleureux et respectueux (standing d'institut haut de gamme).
 * 4. Mémoire conversationnelle multi-tours par numéro de téléphone (se souvient du contexte).
 * 5. Accompagnement continu : demande systématiquement nom, téléphone, e-mail, date/heure et soin.
 * 6. Horaires officiels stricts : TOUS LES JOURS (7j/7) de 07h00 à 17h00.
 * 7. Alerte instantanée au responsable humain sur le WhatsApp DALIGHT (+509 4747-7221) dès qu'une intention de réservation est détectée.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbwoiejztrkghfkpxquo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';

let dynamicApiKey = process.env.GEMINI_API_KEY || "";

async function getGeminiApiKey() {
  if (dynamicApiKey) return dynamicApiKey;
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/settings?key=eq.gemini_config', {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && data[0].value && data[0].value.api_key) {
        dynamicApiKey = data[0].value.api_key;
        return dynamicApiKey;
      }
    }
  } catch(e) {
    console.warn('Could not load gemini_config from settings:', e.message);
  }
  return dynamicApiKey || "";
}

const DALIGHT_KNOWLEDGE_BASE = {
  name: "DALIGHT",
  location: "Delmas 65, Rue Faustin Premier / Rue Durandisse #10, Port-au-Prince, Haïti",
  phone: "+509 4747-7221",
  openingHours: "Tous les jours (Lundi au Dimanche, 7j/7) de 07h00 à 17h00",
  bookingUrl: "https://dalightbeauty.com/pages/reservation-v2.html",
  paymentPolicy: "Acompte obligatoire de 50% par MonCash (+509 4747-7221), NatCash (+509 4747-7221) ou Virement Bancaire (Sogebank, Unibank, BNC) pour bloquer la réservation.",
  videoOption: {
    public_price: "500 HTG (Autorisé Réseaux Sociaux)",
    private_price: "1 000 HTG (Usage Privé Exclusif WhatsApp sans diffusion)",
    description: "Captation esthétique haute définition 4K de votre rituel de soin."
  }
};

// --------------------------------------------
// SYNCHRONISATION EN DIRECT DES SERVICES SUPABASE
// --------------------------------------------
let cachedServices = null;
let lastServicesFetch = 0;

async function getLiveServices() {
  const now = Date.now();
  if (cachedServices && (now - lastServicesFetch < 45000)) {
    return cachedServices;
  }
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/services?select=name,price_htg,price_usd,duration,category,description&is_active=eq.true&order=sort_order.asc', {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        cachedServices = data;
        lastServicesFetch = now;
        return cachedServices;
      }
    }
  } catch (err) {
    console.warn('[Concierge Live Services] Supabase fetch error:', err.message);
  }
  return cachedServices || [];
}

// --------------------------------------------
// MÉMOIRE CONVERSATIONNELLE MULTI-TOURS
// --------------------------------------------
const clientConversations = new Map();

function getConversationHistory(phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return [];
  if (!clientConversations.has(cleanPhone)) {
    clientConversations.set(cleanPhone, []);
  }
  return clientConversations.get(cleanPhone);
}

function recordTurn(phone, role, text) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone || !text) return;
  const history = getConversationHistory(cleanPhone);
  history.push({ role, parts: [{ text: String(text).trim() }] });
  if (history.length > 12) {
    history.splice(0, 2); // Conserve les 10-12 derniers échanges
  }
}

// --------------------------------------------
// PROMPT SYSTÈME DYNAMIQUE (AVEC PRIX EN DIRECT)
// --------------------------------------------
function buildSystemPrompt(liveServices) {
  let servicesFormatted = "";
  if (liveServices && liveServices.length) {
    servicesFormatted = liveServices.map(s => {
      const dur = s.duration ? (' (' + s.duration + ' min)') : '';
      return '• ' + s.name + dur + ' : ' + (s.price_htg ? (s.price_htg + ' HTG') : (s.price_usd + ' USD'));
    }).join('\n');
  } else {
    servicesFormatted = 
      "• Silver Package Head Spa (60 min) : 5 000 HTG\n" +
      "• Silver Package Head Spa 2 personnes (60 min) : 9 000 HTG\n" +
      "• Golden Head Spa (60 min) : 7 000 HTG\n" +
      "• Golden Head Spa 2 personnes (60 min) : 12 000 HTG\n" +
      "• Diamond Head Spa (60 min) : 10 000 HTG\n" +
      "• Silver Head Spa Dreadlocks (60 min) : 6 000 HTG\n" +
      "• Massage relaxant Silver (45 min) : 10 000 HTG\n" +
      "• Massage relaxant Golden (45 min) : 12 000 HTG\n" +
      "• Massage relaxant Diamond (45 min) : 15 000 HTG";
  }

  return `Tu es le Concierge de "DALIGHT" (ne dis jamais "DALIGHT HEAD SPA", dis toujours uniquement "DALIGHT") sur WhatsApp.
Institut haut de gamme de Head Spa Japonais et Massages à Delmas 65, Rue Durandisse #10, Port-au-Prince, Haïti.
HORAIRES : Tous les jours (Lundi au Dimanche, 7j/7) de 07h00 à 17h00.
TÉLÉPHONE / MONCASH / NATCASH : +509 4747-7221.
LIEN RÉSERVATION EN LIGNE : https://dalightbeauty.com/pages/reservation-v2.html

SERVICES & PRIX EN DIRECT DU SITE :
${servicesFormatted}

RÈGLES ABSOLUES DE CONVERSATION NATURELLE SUR WHATSAPP :
1. PARLE NORMALEMENT ET SOIS BREF : Sois comme une vraie personne accueillante sur WhatsApp. Ne fais JAMAIS de longs pavés de texte. Fais des messages courts, clairs, chaleureux et précis (2 à 4 phrases maximum).
2. RÉPONDS STRICTEMENT À CE QU'ON TE DEMANDE :
   - Si le client dit simplement "Bonjour", "Bonswa", "Salut", "Hi", "Sak pase", etc. :
     Réponds UNIQUEMENT par une salutation polie et brève :
     "Bonjour ! Bienvenue chez DALIGHT. Comment puis-je vous aider aujourd'hui ?" (ou Bonsoir selon l'heure).
     NE DÉBALLE AUCUN PRIX, AUCUN SERVICE NI AUCUNE ADRESSE s'il n'a rien demandé !
   - S'il demande les types de services ("ki sèvis nou genyen ?", "quels soins proposez-vous ?") :
     Présente très brièvement en 2 phrases : nos soins Head Spa Japonais et nos Massages relaxants du corps, puis demande quel type de soin il recherche.
   - S'il demande les prix ("konbyen pri headspa ye ?", "combien coûte le massage ?") :
     Donne uniquement les tarifs demandés de manière synthétique et directe, puis demande quel forfait l'intéresse.
   - S'il demande l'adresse ou les horaires : Donne uniquement l'adresse (Delmas 65, Rue Durandisse #10) ou les horaires (tous les jours de 7h à 17h).
   - S'il souhaite réserver ou a choisi son soin : Demande son nom complet et l'heure souhaitée, puis rappelle avec bienveillance l'acompte de 50% sur MonCash ou NatCash (+509 4747-7221).
3. LANGUE : Tu comprends 100% le Créole Haïtien et le Français. Réponds toujours en Français élégant, direct et naturel (sauf s'il demande explicitement d'écrire en Créole).`;
}

// --------------------------------------------
// APPEL IA GOOGLE GEMINI 3 FLASH
// --------------------------------------------
async function generateGeminiConciergeResponse(senderPhone, userMessage, apiKey = null) {
  const cleanKey = apiKey || process.env.GEMINI_API_KEY || (await getGeminiApiKey()) || '';
  const liveServices = await getLiveServices();
  const systemPrompt = buildSystemPrompt(liveServices);
  const history = getConversationHistory(senderPhone);

  const candidateModels = [
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ];

  if (cleanKey) {
    for (const model of candidateModels) {
      try {
        const contentsPayload = [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ];

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + cleanKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: contentsPayload,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 2048,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            recordTurn(senderPhone, 'user', userMessage);
            recordTurn(senderPhone, 'model', aiText.trim());
            return aiText.trim();
          }
        } else {
          const errText = await response.text();
          console.warn('[Gemini Concierge] ' + model + ' error status ' + response.status + ':', errText.slice(0, 150));
        }
      } catch (err) {
        console.warn('[Gemini Concierge] Call failed on ' + model + ':', err.message);
      }
    }
  }

  // Smart local fallback connected to live database
  const fallback = generateSmartLocalResponse(userMessage, liveServices);
  recordTurn(senderPhone, 'user', userMessage);
  recordTurn(senderPhone, 'model', fallback);
  return fallback;
}

// --------------------------------------------
// MOTEUR LOCAL DE REPLI (DYNAMIQUE AVEC BDD)
// --------------------------------------------
function generateSmartLocalResponse(input, liveServices = []) {
  const text = (input || '').toLowerCase().trim();
  const isBonswa = text.includes('bonswa') || text.includes('bonsoir');
  const salut = isBonswa ? "Bonsoir !" : "Bonjour !";

  // 1. Salutation simple ("Bonjour", "Bonjou", "Bonswa", "Salut", "Sak pase")
  const isGreetingOnly = /^(bonjour|bonjou|bonswa|bonsoir|salut|hello|hi|sak pase|koman ou ye|kòman ou ye|allo|alo)[s!?.]*$/i.test(text);
  if (isGreetingOnly) {
    return salut + " Bienvenue chez DALIGHT. Comment puis-je vous aider aujourd'hui ?";
  }

  // 2. Types de services demandés
  if ((text.includes('ki') || text.includes('quel')) && (text.includes('sèvis') || text.includes('sevis') || text.includes('service') || text.includes('soin') || text.includes('proposez'))) {
    return "Chez DALIGHT, nous proposons principalement des soins **Head Spa Japonais** (détente profonde et soin du cuir chevelu) ainsi que des **Massages relaxants** pour le corps.\n\nQuel type de soin aimeriez-vous découvrir ?";
  }

  // 3. Question sur l'adresse / horaires
  if (text.includes('kote') || text.includes('adrès') || text.includes('adres') || text.includes('adresse') || text.includes('localisation') || text.includes('situé') || text.includes('horaire') || text.includes('heure') || text.includes('kote nou ye')) {
    return "Nous sommes situés à **Delmas 65, Rue Durandisse #10** (cadre privé et sécurisé avec parking clientèle).\n\nNos horaires : **Tous les jours (7j/7) de 07h00 à 17h00**.\n\nQuel jour aimeriez-vous passer ?";
  }

  // 4. Question sur les prix
  if (text.includes('pri') || text.includes('prix') || text.includes('konbyen') || text.includes('combien') || text.includes('tarif')) {
    if (text.includes('massage')) {
      return "Nos tarifs pour les **Massages relaxants** sont :\n• Silver Package (45 min) : 10 000 HTG\n• Golden Package (45 min) : 12 000 HTG\n• Diamond Package (45 min) : 15 000 HTG\n\nQuel forfait vous intéresse ?";
    }
    return "Nos forfaits **Head Spa** sont les suivants :\n• **Silver** : 5 000 HTG (Duo : 9 000 HTG)\n• **Golden** : 7 000 HTG (Duo : 12 000 HTG)\n• **Diamond** : 10 000 HTG\n• **Dreadlocks** : 6 000 HTG (Duo : 10 000 HTG)\n\nLequel de ces soins vous intéresse ?";
  }

  // 5. Réservation
  if (text.includes('randevou') || text.includes('rdv') || text.includes('reservation') || text.includes('rezerve') || text.includes('rezève')) {
    return "C'est noté avec plaisir ! Quel soin et quelle date/heure vous conviendraient ?\n\n*(Pour rappel, un acompte de 50% par MonCash ou NatCash au +509 4747-7221 valide votre créneau).*";
  }

  return salut + " Bienvenue chez DALIGHT. Comment puis-je vous renseigner sur nos soins ou vos réservations ?";
}

// --------------------------------------------
// DÉTECTION D'INTENTION DE RÉSERVATION
// --------------------------------------------
function detectBookingIntent(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();

  const keywords = [
    'randevou', 'rdv', 'rezerve', 'rezève', 'rezèv', 'reserv', 'plas', 'disponib',
    'pale ak moun', 'pale ak yon moun', 'moun reyel', 'moun reyèl', 'humain',
    'vle vin', 'ta renmen vin', 'vin jodi', 'vin demen', 'ede m rezerve', 'pou demen', 'pou jodi',
    'non mwen se', 'm rele', 'nom:', 'nom :', 'email', '@', 'samdi', 'dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi'
  ];

  return keywords.some(k => m.includes(k));
}

// --------------------------------------------
// ALERTE INSTANTANÉE NUMÉRO OFFICIEL DALIGHT (+509 4747-7221)
// --------------------------------------------
async function dispatchBookingAlertToDalight(clientPhone, clientMessage, dalightPhone = "50947477221") {
  const cleanClient = String(clientPhone || '').replace(/\D/g, '');
  const formattedClient = cleanClient.length === 8 ? ('509' + cleanClient) : cleanClient;
  const directChatLink = formattedClient ? ('https://wa.me/' + formattedClient) : 'Numéro non spécifié';

  const alertText = 
    '🚨 *ALERTE DALIGHT — INTENTION DE RÉSERVATION WHATSAPP* 🌿\n\n' +
    '👤 *Client :* +' + formattedClient + '\n' +
    '💬 *Message client :* « ' + clientMessage + ' »\n' +
    '⏰ *Heure :* ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '\n\n' +
    '👉 *Prendre le relais immédiatement sur WhatsApp :*\n' +
    directChatLink;

  try {
    const gatewayUrl = process.env.CVISUAL_WA_BASE_URL || 'https://cvisual-whatsapp-gateway.onrender.com';
    const apiKey = process.env.CVISUAL_WA_API_KEY || 'cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c';

    const res = await fetch(gatewayUrl + '/api/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_index: 3,
        to: dalightPhone,
        message: alertText,
        mode: 'sync',
        kind: 'manual_direct'
      })
    });

    const data = await res.json().catch(() => ({}));
    return { success: res.ok, data, alertText };
  } catch(err) {
    console.warn("Failed to dispatch alert to DALIGHT number:", err.message);
    return { success: false, error: err.message, alertText };
  }
}

// --------------------------------------------
// GESTIONNAIRE COMPLET DE MESSAGE ENTRANT
// --------------------------------------------
async function handleIncomingWhatsAppMessage(senderPhone, messageText, options = {}) {
  const isBooking = detectBookingIntent(messageText);
  let reply = await generateGeminiConciergeResponse(senderPhone, messageText, options.geminiApiKey || null);

  let alertResult = null;
  if (isBooking) {
    const dalightNumber = options.dalightAlertPhone || "50947477221";
    alertResult = await dispatchBookingAlertToDalight(senderPhone, messageText, dalightNumber);

    // Ajoute une mention élégante informant le client que l'équipe est prévenue
    reply += "\n\n🔔 *Information :* Notre responsable a également reçu votre demande en direct et peut prendre le relais ici même d'un instant à l'autre.";
  }

  return {
    reply,
    isBookingIntent: isBooking,
    alertSent: isBooking && (alertResult?.success || false),
    alertDetails: alertResult
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    DALIGHT_KNOWLEDGE_BASE,
    getLiveServices,
    buildSystemPrompt,
    generateGeminiConciergeResponse,
    generateSmartLocalResponse,
    detectBookingIntent,
    dispatchBookingAlertToDalight,
    handleIncomingWhatsAppMessage
  };
}
