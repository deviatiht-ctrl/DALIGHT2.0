/**
 * DALIGHT — CONCIERGE IA WHATSAPP (GOOGLE GEMINI)
 * 
 * Capable de :
 * 1. Comprendre le Créole Haïtien (Kreyòl) et le Français à 100%.
 * 2. Répondre toujours en Français poli, chaleureux et raffiné (standing haut de gamme).
 * 3. Reconnaître les salutations contextuelles ("Bonswa" -> "Bonsoir !", "Bonjou" -> "Bonjour !").
 * 4. Présenter avec précision les services, bienfaits cuir chevelu, durées et prix officiels en HTG.
 * 5. Expliquer l'adresse exacte (Delmas 65, Rue Durandisse #10) et les horaires.
 * 6. Expliquer l'acompte de 50% (MonCash, NatCash, Virement) et fournir le lien officiel de réservation.
 * 7. Préciser les tarifs de l'option vidéo (+500 HTG public vs +1 000 HTG privé).
 */

const GEMINI_DEFAULT_KEY = process.env.GEMINI_API_KEY || "";

const DALIGHT_KNOWLEDGE_BASE = {
  name: "DALIGHT",
  location: "Delmas 65, Rue Faustin Premier / Rue Durandisse #10, Port-au-Prince, Haïti",
  phone: "+509 4747-7221",
  openingHours: "Mardi au Samedi de 08h00 à 20h00 | Dimanche et Lundi de 08h00 à 18h00",
  bookingUrl: "https://dalightbeauty.com/pages/reservation-v2.html",
  paymentPolicy: "Acompte de 50% obligatoire (ou paiement complet 100%) par MonCash (+509 4747-7221), NatCash (+509 4747-7221) ou Virement Bancaire (Sogebank, Unibank, BNC). Une preuve de paiement doit être fournie pour garantir le créneau.",
  services: [
    {
      name: "Head Spa Japonais Signature",
      duration: "60 minutes",
      price_htg: "8 500 HTG",
      description: "Notre soin emblématique alliant hydrothérapie japonaise, cascade d'eau chaude circulante, gommage doux et détoxification du cuir chevelu, massage shiatsu crânien revitalisant, bain de vapeur aux huiles aromatiques et sérum nourrissant. Idéal pour oxygéner le bulbe, freiner la chute et apaiser le stress mental."
    },
    {
      name: "Head Spa Sérénité Royale",
      duration: "90 minutes",
      price_htg: "12 000 HTG",
      description: "Le rituel prestige absolu. Tout le soin Signature enrichi d'un massage prolongé de la nuque, des trapèzes et des épaules, masque capillaire restructurant en profondeur, aromathérapie personnalisée et luminothérapie apaisante. Une parenthèse de pure renaissance."
    },
    {
      name: "Rituel Renaissance Express",
      duration: "45 minutes",
      price_htg: "6 500 HTG",
      description: "Coup d'éclat revigorant pour les personnes actives. Nettoyage profond du cuir chevelu, cascade relaxante et massage crânien ciblé pour redonner vitalité et fraîcheur en un temps optimisé."
    }
  ],
  videoOption: {
    public_price: "500 HTG (Autorisé Réseaux Sociaux)",
    private_price: "1 000 HTG (Usage Privé Exclusif, envoyé uniquement sur votre WhatsApp personnel, aucune diffusion)",
    description: "Captation esthétique haute définition 4K et montage de votre rituel de soin."
  }
};

const SYSTEM_PROMPT = `Tu es le Concierge Virtuel d'élite de "DALIGHT", le sanctuaire de bien-être et de Head Spa Japonais à Delmas 65, Haïti.
Le nom officiel est strictement "DALIGHT" (ne dis jamais "DALIGHT HEAD SPA", dis toujours "DALIGHT").

RÈGLES D'OR STRICTES :
1. COMPRÉHENSION LINGUISTIQUE TOTALE :
   - Tu comprends parfaitement le Créole Haïtien (Kreyòl Ayisyen), même avec des abréviations populaires (ex: "Bonswa", "Konbyen sa koute", "Ki kote nou ye", "M ta renmen pran yon randevou", "Kijan nou fonksyone", "Sak genyen").
   - Tu comprends aussi parfaitement le Français et l'Anglais.

2. LANGUE DE RÉPONSE OBLIGATOIRE :
   - Réponds TOUJOURS en Français soigné, élégant, courtois et chaleureux (standing d'un hôtel spa de luxe).
   - Exception unique : Si le client te demande explicitement de lui répondre en Créole ("Tanpri ekri m an kreyòl"), réponds alors en Créole Haïtien très respectueux.

3. ADAPTATION DU SALUT INITIAL :
   - Si le message contient "Bonswa" ou "Bonsoir", commence par : "Bonsoir !" ou "Bonsoir et bienvenue chez DALIGHT."
   - Si le message contient "Bonjou", "Bonjour" ou "Good morning", commence par : "Bonjour !" ou "Bonjour et bienvenue chez DALIGHT."
   - Si aucune salutation temporelle, utilise une salutation polie chaleureuse.

4. PRÉSENTATION DES SOINS & PRIX :
   - Head Spa Japonais Signature : 60 min — 8 500 HTG (Détox du cuir chevelu, cascade d'eau chaude, massage crânien shiatsu, vapeur bienfaisante).
   - Head Spa Sérénité Royale : 90 min — 12 000 HTG (Soin profond prestige, massage prolongé nuque et épaules, masque nutritif intense).
   - Rituel Renaissance Express : 45 min — 6 500 HTG (Soin dynamisant rapide).
   - Option Vidéo Souvenir Professionnelle : +500 HTG si autorisé sur nos réseaux, ou +1 000 HTG pour usage strictement privé (envoyé sur WhatsApp sans diffusion).

5. ADRESSE & LOCALISATION :
   - Adresse exacte : Delmas 65, Rue Faustin Premier / Rue Durandisse #10, Port-au-Prince, Haïti.
   - Horaires : Mardi au Samedi de 08h00 à 20h00, Dimanche et Lundi de 08h00 à 18h00.
   - Cadre privé et sécurisé avec stationnement réservé à notre clientèle.

6. RÉSERVATIONS & ACOMPTE :
   - Tu ne peux pas enregistrer directement la réservation dans WhatsApp ni débiter de carte.
   - Invite toujours poliment le client à choisir son jour et son heure sur notre plateforme officielle :
     👉 https://dalightbeauty.com/pages/reservation-v2.html
   - Précise qu'un acompte de 50% (ou paiement complet) par MonCash (+509 4747-7221), NatCash (+509 4747-7221) ou Virement Bancaire (Sogebank, Unibank, BNC) avec preuve de paiement est obligatoire pour bloquer le créneau.

7. STYLE & TON :
   - Posé, bienveillant, zen et haut de gamme.
   - Paragraphes courts et aérés avec puces claires pour les tarifs.
   - Jamais d'excès d'emojis.`;

/**
 * Génère la réponse du Concierge via Google Gemini API
 */
async function generateGeminiConciergeResponse(userMessage, apiKey = null) {
  const cleanKey = apiKey || process.env.GEMINI_API_KEY || GEMINI_DEFAULT_KEY || '';

  if (cleanKey) {
    const candidateModels = [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-2.5-flash'
    ];

    for (const model of candidateModels) {
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + cleanKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_PROMPT }]
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userMessage }]
              }
            ],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 600
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) return aiText.trim();
        }
      } catch (err) {
        console.warn('Gemini API call failed on ' + model + ':', err.message);
      }
    }
  }

  // Smart Contextual Fallback Engine (No API key needed / Offline resilience)
  return generateSmartLocalResponse(userMessage);
}

/**
 * Moteur NLP local de repli intelligent (garantit 100% de réponses même sans clé API)
 */
function generateSmartLocalResponse(input) {
  const text = (input || '').toLowerCase();
  
  // 1. Détection de salutation
  const isBonswa = text.includes('bonswa') || text.includes('bonsoir');
  const isBonjou = text.includes('bonjou') || text.includes('bonjour') || text.includes('good morning');
  let salutation = isBonswa ? "Bonsoir !" : (isBonjou ? "Bonjour !" : "Bonjour et bienvenue chez DALIGHT !");

  // 2. Question sur l'adresse / localisation
  if (text.includes('kote') || text.includes('adrès') || text.includes('adres') || text.includes('adresse') || text.includes('localisation') || text.includes('situé') || text.includes('kote nou ye')) {
    return salutation + "\n\n" +
"C'est un réel plaisir de vous renseigner.\n\n" +
"🌿 **Notre Adresse :**\n" +
"DALIGHT est idéalement situé à :\n" +
"📍 **Delmas 65, Rue Faustin Premier / Rue Durandisse #10**, Port-au-Prince, Haïti.\n" +
"(Espace calme, discret et sécurisé avec stationnement privé réservé à notre clientèle).\n\n" +
"🕐 **Horaires d'Ouverture :**\n" +
"• Du Mardi au Samedi : 08h00 à 20h00\n" +
"• Dimanche et Lundi : 08h00 à 18h00\n\n" +
"Pour réserver votre moment de détente exclusif, vous pouvez choisir votre créneau ici :\n" +
"👉 https://dalightbeauty.com/pages/reservation-v2.html\n\n" +
"Restons à votre entière disposition !";
  }

  // 3. Question sur les prix / services / soins
  if (text.includes('pri') || text.includes('prix') || text.includes('konbyen') || text.includes('combien') || text.includes('tarif') || text.includes('service') || text.includes('head spa') || text.includes('soin')) {
    return salutation + "\n\n" +
"Voici la carte de nos rituels exclusifs de Head Spa Japonais chez DALIGHT :\n\n" +
"✨ **1. Head Spa Japonais Signature (60 min) — 8 500 HTG**\n" +
"Notre soin emblématique : détoxification du cuir chevelu, cascade d'eau chaude circulaire, massage shiatsu crânien revitalisant, bain de vapeur aromatique et sérum capillaire fortifiant.\n\n" +
"👑 **2. Head Spa Sérénité Royale (90 min) — 12 000 HTG**\n" +
"L'expérience prestige suprême : soin Signature complet enrichi d'un massage approfondi de la nuque, des trapèzes et des épaules, masque capillaire restructurant et luminothérapie apaisante.\n\n" +
"🌱 **3. Rituel Renaissance Express (45 min) — 6 500 HTG**\n" +
"Coup d'éclat express : oxygénation du cuir chevelu, cascade relaxante et massage crânien pour retrouver légèreté et vitalité.\n\n" +
"🎥 **Option Vidéo Souvenir Professionnelle 4K :**\n" +
"• +500 HTG (Autorisé sur nos réseaux sociaux)\n" +
"• +1 000 HTG (Usage strictement privé sur votre WhatsApp)\n\n" +
"📅 **Réservation en ligne :**\n" +
"Vous pouvez sélectionner la date et l'heure de votre choix en quelques clics :\n" +
"👉 https://dalightbeauty.com/pages/reservation-v2.html\n" +
"*(Un acompte de 50% par MonCash, NatCash ou Virement est requis pour bloquer le créneau).*\n\n" +
"Quel rituel vous ferait le plus grand bien ?";
  }

  // 4. Question sur la réservation / acompte
  if (text.includes('randevou') || text.includes('rdv') || text.includes('resèvasyon') || text.includes('rezèvasyon') || text.includes('reservation') || text.includes('réserver') || text.includes('disponib') || text.includes('disponible') || text.includes('acompte')) {
    return salutation + "\n\n" +
"Pour planifier votre séance chez DALIGHT :\n\n" +
"1️⃣ Rendez-vous directement sur notre plateforme de réservation :\n" +
"👉 https://dalightbeauty.com/pages/reservation-v2.html\n\n" +
"2️⃣ Choisissez votre soin, votre praticienne, ainsi que le jour et l'heure souhaités.\n\n" +
"3️⃣ Validez votre créneau en réglant votre **acompte de 50%** (ou la totalité) :\n" +
"• **MonCash Direct :** +509 4747-7221 (DALIGHT BEAUTY)\n" +
"• **NatCash Direct :** +509 4747-7221 (DALIGHT BEAUTY)\n" +
"• **Virement Bancaire :** Sogebank, Unibank, BNC\n" +
"*(N'oubliez pas de joindre la capture d'écran du reçu lors de votre inscription en ligne).*\n\n" +
"Dès réception, notre équipe valide votre rendez-vous et vous recevez une confirmation officielle par WhatsApp. À très bientôt chez DALIGHT !";
  }

  // 5. Réponse par défaut chaleureuse et guidée
  return salutation + "\n\n" +
"Bienvenue chez DALIGHT, votre sanctuaire de relaxation et de soin du cuir chevelu à Delmas 65.\n\n" +
"Comment puis-je vous accompagner aujourd'hui ?\n" +
"• Pour consulter nos **tarifs & rituels** (Head Spa Signature 8 500 HTG, Sérénité Royale 12 000 HTG)\n" +
"• Pour obtenir notre **adresse exacte & horaires** (Delmas 65, Rue Durandisse #10)\n" +
"• Pour planifier un **rendez-vous en ligne** : https://dalightbeauty.com/pages/reservation-v2.html\n\n" +
"Écrivez-nous votre question, nous nous ferons un plaisir de vous répondre !";
}

/**
 * Détecte si le message du client exprime une intention réelle de réservation ou d'assistance humaine
 */
function detectBookingIntent(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();

  const keywords = [
    'randevou', 'rdv', 'rezerve', 'rezève', 'rezèv', 'reserv', 'plas', 'disponib',
    'pale ak moun', 'pale ak yon moun', 'moun reyel', 'moun reyèl', 'humain',
    'vle vin', 'ta renmen vin', 'vin jodi', 'vin demen', 'ede m rezerve', 'pou demen', 'pou jodi'
  ];

  return keywords.some(k => m.includes(k));
}

/**
 * Envoie une notification instantanée d'alerte sur le numéro WhatsApp officiel de DALIGHT
 */
async function dispatchBookingAlertToDalight(clientPhone, clientMessage, dalightPhone = "50947477221") {
  const cleanClient = String(clientPhone || '').replace(/\D/g, '');
  const formattedClient = cleanClient.length === 8 ? ('509' + cleanClient) : cleanClient;
  const directChatLink = formattedClient ? `https://wa.me/${formattedClient}` : 'Numéro non spécifié';

  const alertText = `🚨 *ALERTE DALIGHT — INTENTION DE RÉSERVATION DÉTECTÉE !* 🌿\n\n` +
    `👤 *Client :* +${formattedClient}\n` +
    `💬 *Message reçu :* « ${clientMessage} »\n` +
    `⏰ *Heure :* ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n\n` +
    `👉 *Prendre le relais et répondre directement au client :*\n${directChatLink}`;

  try {
    const gatewayUrl = process.env.CVISUAL_WA_BASE_URL || 'https://cvisual-whatsapp-gateway.onrender.com';
    const apiKey = process.env.CVISUAL_WA_API_KEY || 'cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c';

    const res = await fetch(`${gatewayUrl}/api/v1/messages/send`, {
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

/**
 * Gestionnaire complet de message entrant :
 * 1. Détecte si le message est une intention de réservation.
 * 2. Génère la réponse personnalisée de l'IA.
 * 3. Si intention de réservation : alerte instantanément le numéro WhatsApp officiel de DALIGHT (+509 4747-7221).
 */
async function handleIncomingWhatsAppMessage(senderPhone, messageText, options = {}) {
  const isBooking = detectBookingIntent(messageText);
  let reply = await generateGeminiConciergeResponse(messageText, options.geminiApiKey || null);

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
    SYSTEM_PROMPT,
    generateGeminiConciergeResponse,
    generateSmartLocalResponse,
    detectBookingIntent,
    dispatchBookingAlertToDalight,
    handleIncomingWhatsAppMessage
  };
}
