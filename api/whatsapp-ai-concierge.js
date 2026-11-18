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
      const dur = s.duration ? (s.duration + ' min') : '45-60 min';
      const desc = s.description ? (' (' + s.description.replace(/\n+/g, ' ').slice(0, 120) + ')') : '';
      return '• ' + s.name + ' (' + dur + ') : ' + (s.price_htg ? (s.price_htg + ' HTG') : (s.price_usd + ' USD')) + desc;
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

  return `Tu es le Concierge Virtuel d'élite de "DALIGHT" (ne dis jamais "DALIGHT HEAD SPA", dis toujours uniquement "DALIGHT").
Sanctuaire de bien-être, Head Spa Japonais et Massages thérapeutiques à Delmas 65, Port-au-Prince, Haïti.

INFORMATIONS OFFICIELLES CERTIFIÉES :
- NOM OFFICIEL : Strictement "DALIGHT"
- HORAIRES D'OUVERTURE : TOUS LES JOURS (Lundi au Dimanche, 7 jours sur 7) de 07h00 à 17h00 (7h du matin à 5h de l'après-midi).
- ADRESSE EXACTE : Delmas 65, Rue Faustin Premier / Rue Durandisse #10, Port-au-Prince, Haïti. Cadre privé, haut de gamme et sécurisé avec stationnement réservé.
- TÉLÉPHONE / WHATSAPP OFFICIEL : +509 4747-7221.
- ACOMPTE EXIGÉ : Un acompte obligatoire de 50% (ou la totalité) doit être réglé pour garantir et bloquer le créneau via :
  • MonCash Direct : +509 4747-7221 (DALIGHT BEAUTY)
  • NatCash Direct : +509 4747-7221 (DALIGHT BEAUTY)
  • Virement Bancaire : Sogebank, Unibank, BNC
- LIEN OFFICIEL DE RÉSERVATION EN LIGNE : https://dalightbeauty.com/pages/reservation-v2.html
- OPTION VIDÉO SOUVENIR 4K : +500 HTG (Réseaux sociaux) ou +1 000 HTG (Usage privé exclusif WhatsApp).

CARTE OFFICIELLE DES SOINS & PRIX ACTUELS (EN DIRECT DU SITE) :
${servicesFormatted}

RÈGLES D'INTERACTION ET DE VENTE :
1. COMPRÉHENSION : Tu comprends à 100% le Créole Haïtien (Kreyòl) et le Français.
2. LANGUE DE RÉPONSE : Réponds TOUJOURS en Français élégant, bienveillant, distingué et chaleureux. Exception : Si le client te demande explicitement de parler en Créole ("Ekri m an kreyòl"), réponds-lui alors en Créole soigné et très respectueux.
3. SALUTATION CONTEXTUELLE :
   - Commence par "Bonjour !" le matin ou en journée.
   - Si le message contient "Bonswa" ou "Bonsoir", commence par "Bonsoir !".
4. PRIX EXACTS : Donne TOUJOURS les prix exacts en HTG de la liste ci-dessus. Ne devine jamais un prix différent.
5. CONTINUITÉ & CONVERSION DE LA CONVERSATION :
   - Ne te contente pas de donner un prix et de t'arrêter.
   - Poursuis TOUJOURS l'échange en guidant le client vers sa réservation.
   - Demande-lui poliment :
     1. Son nom et prénom
     2. Son numéro de téléphone de contact
     3. Son adresse e-mail
     4. La date et l'heure souhaitées pour son soin
6. BIENFAITS & EXPERTISE : Explique brièvement les bienfaits (détoxification du cuir chevelu, cascade d'eau chaude circulante, massage shiatsu crânien relaxant, stimulation de la pousse des cheveux).
7. RAPPEL ACOMPTE : Rappelle avec bienveillance que le créneau est confirmé dès réception de l'acompte de 50% sur MonCash ou NatCash au +509 4747-7221.`;
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
  const text = (input || '').toLowerCase();
  
  const isBonswa = text.includes('bonswa') || text.includes('bonsoir');
  const isBonjou = text.includes('bonjou') || text.includes('bonjour') || text.includes('good morning');
  let salutation = isBonswa ? "Bonsoir !" : (isBonjou ? "Bonjour !" : "Bonjour et bienvenue chez DALIGHT !");

  // 1. Question sur l'adresse / horaires
  if (text.includes('kote') || text.includes('adrès') || text.includes('adres') || text.includes('adresse') || text.includes('localisation') || text.includes('situé') || text.includes('horaire') || text.includes('heure') || text.includes('kote nou ye')) {
    return salutation + "\n\n" +
"C'est un plaisir de vous renseigner sur **DALIGHT** :\n\n" +
"📍 **Notre Adresse :**\n" +
"Delmas 65, Rue Faustin Premier / Rue Durandisse #10, Port-au-Prince, Haïti.\n" +
"(Sanctuaire privé, calme et sécurisé avec stationnement réservé à notre clientèle).\n\n" +
"🕐 **Horaires d'Ouverture :**\n" +
"• **Tous les jours (Lundi au Dimanche, 7j/7) de 07h00 à 17h00** (7h du matin à 5h de l'après-midi).\n\n" +
"Afin de vous accueillir dans les meilleures conditions, quel jour et à quelle heure souhaiteriez-vous réserver votre soin ?";
  }

  // 2. Question sur les prix / services / soins
  if (text.includes('pri') || text.includes('prix') || text.includes('konbyen') || text.includes('combien') || text.includes('tarif') || text.includes('service') || text.includes('head spa') || text.includes('soin') || text.includes('massage')) {
    let serviceListStr = "";
    if (liveServices && liveServices.length) {
      serviceListStr = liveServices.slice(0, 8).map(s => {
        return "✨ **" + s.name + "** (" + (s.duration ? s.duration + ' min' : '45-60 min') + ") — **" + (s.price_htg ? (s.price_htg + ' HTG') : (s.price_usd + ' USD')) + "**";
      }).join('\n');
    } else {
      serviceListStr = 
        "✨ **Silver Package Head Spa (60 min)** — **5 000 HTG**\n" +
        "✨ **Golden Head Spa (60 min)** — **7 000 HTG**\n" +
        "✨ **Diamond Head Spa (60 min)** — **10 000 HTG**\n" +
        "✨ **Silver Head Spa Dreadlocks (60 min)** — **6 000 HTG**\n" +
        "✨ **Massage relaxant Silver (45 min)** — **10 000 HTG**\n" +
        "✨ **Massage relaxant Golden (45 min)** — **12 000 HTG**";
    }

    return salutation + "\n\n" +
"Voici les tarifs de nos soins exclusifs chez **DALIGHT** :\n\n" +
serviceListStr + "\n\n" +
"🎥 **Option Vidéo Souvenir 4K :** +500 HTG (réseaux sociaux) ou +1 000 HTG (usage privé WhatsApp).\n\n" +
"💳 **Acompte de 50% obligatoire** par MonCash ou NatCash au **+509 4747-7221** pour garantir votre créneau.\n\n" +
"Pour préparer au mieux votre venue, pouvez-vous me communiquer :\n" +
"1️⃣ Votre **nom complet** ?\n" +
"2️⃣ Votre **numéro de téléphone** & **adresse e-mail** ?\n" +
"3️⃣ La **date et l'heure** souhaitées ?";
  }

  // 3. Question sur la réservation / acompte
  if (text.includes('randevou') || text.includes('rdv') || text.includes('resèvasyon') || text.includes('rezèvasyon') || text.includes('reservation') || text.includes('réserver') || text.includes('disponib') || text.includes('disponible') || text.includes('acompte')) {
    return salutation + "\n\n" +
"Pour réserver votre moment de détente chez **DALIGHT** :\n\n" +
"1️⃣ Vous pouvez réserver directement en ligne :\n" +
"👉 https://dalightbeauty.com/pages/reservation-v2.html\n\n" +
"2️⃣ Ou me transmettre directement ici :\n" +
"• Votre **nom et prénom**\n" +
"• Votre **numéro de téléphone**\n" +
"• Votre **adresse e-mail**\n" +
"• Le **soin désiré** ainsi que la **date et l'heure**\n\n" +
"3️⃣ Règlement de l'**acompte de 50%** pour bloquer le créneau :\n" +
"• **MonCash Direct :** +509 4747-7221 (DALIGHT BEAUTY)\n" +
"• **NatCash Direct :** +509 4747-7221 (DALIGHT BEAUTY)\n" +
"• **Virement :** Sogebank, Unibank, BNC\n\n" +
"Quel soin vous ferait le plus plaisir ?";
  }

  // 4. Réponse d'accueil par défaut
  return salutation + "\n\n" +
"Bienvenue chez **DALIGHT**, votre institut d'excellence et sanctuaire de Head Spa à Delmas 65 (Rue Durandisse #10).\n\n" +
"🕐 **Horaires :** Ouvert tous les jours (7j/7) de **07h00 à 17h00**.\n\n" +
"Comment puis-je vous accompagner aujourd'hui ?\n" +
"• Pour découvrir nos **tarifs & forfaits** (Head Spa à partir de 5 000 HTG, Massages...)\n" +
"• Pour réserver directement : https://dalightbeauty.com/pages/reservation-v2.html\n\n" +
"Dites-moi tout, je suis à votre entière écoute !";
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
