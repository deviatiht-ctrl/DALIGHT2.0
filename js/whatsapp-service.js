/**
 * DALIGHT — WhatsApp Service Module
 * Integration with CVISUAL WhatsApp Gateway (Fast Lane & Slow Lane Anti-Ban)
 * Strictly zero emojis — Luxury DALIGHT standard
 */

export const CVISUAL_GATEWAY_URL = 'https://cvisual-whatsapp-gateway.onrender.com';
export const DALIGHT_CVISUAL_KEY = 'cv_live_c49cffb16d81c93c65e3458349643294ada76c645b16e40c';
export const MASTER_ADMIN_KEY = 'cv_live_admin_6094ed1bf65bf0945706d3d7';
export const DEFAULT_CVISUAL_KEY = DALIGHT_CVISUAL_KEY;
export const DEDICATED_LINE_INDEX = 3;

// Lane classifications
export const FAST_LANE_KINDS = ['receipt', 'welcome', 'otp', 'test', 'manual_direct'];
export const SLOW_LANE_KINDS = ['reminder', 'reminder_7d', 'reminder_2d', 'marketing', 'manual'];

/**
 * Normalizes a phone number to WhatsApp format:
 * - 8 local digits (ex: 47477221) -> 50947477221
 * - International without '+'
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/\D/g, '');
  if (cleaned.length === 8) {
    return '509' + cleaned;
  }
  return cleaned;
}

/**
 * Resolves Spintax: {Bonjour|Salut|Bonsoir}
 */
export function resolveSpintax(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const choices = group.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

/**
 * Formats gateway errors into clean, descriptive strings
 */
export function formatGatewayErrorMessage(status, data) {
  const detail = data?.detail || data?.message || data?.error || '';
  switch (status) {
    case 400:
      return `Format invalide (400) : ${detail || 'Numéro de téléphone incorrect ou champ manquant.'}`;
    case 401:
      return `Non autorisé (401) : Clé API WhatsApp invalide. Veuillez vérifier CVISUAL_WA_API_KEY.`;
    case 413:
      return `Fichier trop volumineux (413) : Le document PDF dépasse la taille maximale autorisée de 10 Mo.`;
    case 422:
      return `Anti-Ban Meta (422) : Les messages de relance (Slow Lane) doivent obligatoirement être envoyés en mode asynchrone (mode="async").`;
    case 429:
      return `Limite de quota (429) : Trop de messages envoyés ou quota journalier atteint pour la ligne.`;
    case 503:
      return `Ligne WhatsApp hors ligne (503) : La ligne #3 de DALIGHT n'est pas connectée. Veuillez scanner le QR code.`;
    default:
      return detail || `Erreur de passerelle WhatsApp (HTTP ${status}).`;
  }
}

/**
 * Verifies gateway connectivity and DALIGHT tenant info (GET /api/v1/me)
 */
export async function verifyGatewayConnection() {
  const apiKey = localStorage.getItem('cvisual_wa_api_key') || DEFAULT_CVISUAL_KEY;
  try {
    const res = await fetch(`${CVISUAL_GATEWAY_URL}/api/v1/me`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message
    };
  }
}

/**
 * Sends a WhatsApp message via Server Proxy, Supabase Edge Function, or Direct Gateway
 */
export async function sendWhatsAppMessage(options) {
  const {
    to,
    message,
    kind = 'receipt',
    mode = 'async',
    pdf_base64 = null,
    pdf_file_name = null,
    idempotencyKey = null,
    account_index = DEDICATED_LINE_INDEX
  } = options;

  const phone = normalizePhone(to);
  if (!phone || phone.length < 8) {
    throw new Error('Numéro de téléphone invalide (8 à 15 chiffres requis).');
  }

  // Anti-ban check
  if (SLOW_LANE_KINDS.includes(kind) && mode === 'sync') {
    throw new Error(`Règle Anti-Ban Meta: La voie Slow Lane ("${kind}") doit impérativement utiliser mode="async".`);
  }

  const finalMsg = resolveSpintax(message);
  const payload = {
    to: phone,
    message: finalMsg,
    kind,
    mode,
    account_index,
    pdf_base64: pdf_base64 ? pdf_base64.replace(/^data:application\/pdf;base64,/, '') : null,
    pdf_file_name: pdf_file_name || 'Recu_DALIGHT.pdf',
    idempotencyKey: idempotencyKey || `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  };

  // 1. Try local server endpoint first if available
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fall through
  }

  // 2. Try Supabase Edge Function
  if (window.supabase && typeof window.supabase.functions?.invoke === 'function') {
    try {
      const { data, error } = await window.supabase.functions.invoke('cvisual-whatsapp', {
        body: { action: 'send', payload }
      });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase Edge function unavailable:', e);
    }
  }

  // 3. Fallback: Direct call to CVISUAL Gateway using dedicated DALIGHT API key
  const activeApiKey = localStorage.getItem('cvisual_wa_api_key') || DEFAULT_CVISUAL_KEY;
  if (activeApiKey) {
    const res = await fetch(`${CVISUAL_GATEWAY_URL}/api/v1/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeApiKey}`,
        'Content-Type': 'application/json',
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const formatted = formatGatewayErrorMessage(res.status, data);
      throw new Error(formatted);
    }
    return data;
  }

  throw new Error('Service WhatsApp non disponible. Vérifiez la connexion de la passerelle.');
}

/**
 * 1. Confirmation officielle de Rendez-vous + Reçu PDF (Fast Lane)
 */
export async function sendReservationWhatsAppReceipt(order) {
  const {
    phone,
    clientName = 'Client(e)',
    serviceName = 'Head Spa Signature',
    date = 'Date à confirmer',
    time = '09:00',
    price = 85,
    orderNumber = 'DL-' + Math.floor(1000 + Math.random() * 9000),
    pdfBase64 = null
  } = order;

  const spintaxGreeting = '{Bonjour|Bonsoir|Chère cliente}';
  const spintaxThanks = '{Merci pour votre réservation|Nous avons le plaisir de confirmer votre soin|Merci de votre confiance}';
  const siteUrl = 'https://dalightbeauty.com';

  const message = '*DALIGHT — CONFIRMATION OFFICIELLE DE RENDEZ-VOUS*\n\n' +
    spintaxGreeting + ' *' + clientName + '*,\n\n' +
    spintaxThanks + ' chez *DALIGHT* ! Votre rendez-vous est officiellement CONFIRMÉ.\n\n' +
    'DÉTAILS DE VOTRE SOIN :\n' +
    '• Prestation : *' + serviceName + '*\n' +
    '• Date : *' + date + '*\n' +
    '• Heure : *' + time + '*\n' +
    '• Montant : *' + (typeof price === 'number' ? '$' + price : price) + '*\n' +
    '• N° Réservation : *#' + orderNumber + '*\n\n' +
    'Lieu : Delmas 65, Rue Durandisse #10, Port-au-Prince\n' +
    'Site officiel : ' + siteUrl + '\n\n' +
    'Pour toute question ou modification, vous pouvez nous répondre directement ici ou nous appeler au :\n' +
    '*+509 4747-7221*\n\n' +
    '_Votre reçu officiel est joint à ce message en format PDF. Toute notre équipe vous attend pour un moment d\'exception._\n';

  return sendWhatsAppMessage({
    to: phone,
    message,
    kind: 'receipt', // Fast Lane
    mode: 'async',
    account_index: DEDICATED_LINE_INDEX,
    pdf_base64: pdfBase64,
    pdf_file_name: `Recu_DALIGHT_${orderNumber}.pdf`,
    idempotencyKey: `wa_recu_${orderNumber}`
  });
}

/**
 * 2. Rappel de Rendez-vous J-1 (24h avant) (Slow Lane Anti-Ban)
 * Inclut la règle d'annulation et modifications 24h avant.
 */
export async function sendReservation24hReminderWhatsApp(reservation) {
  const {
    phone,
    clientName = 'Client(e)',
    serviceName = 'Head Spa & Soin DALIGHT',
    date = 'demain',
    time = 'votre heure prévue'
  } = reservation;

  const spintaxGreeting = '{Bonjour|Douce journée|Chère cliente}';
  const spintaxIntro = '{Rappel bienveillant|Nous vous rappelons}';
  const siteUrl = 'https://dalightbeauty.com';

  const message = '*DALIGHT — RAPPEL DE RENDEZ-VOUS (J-1)*\n\n' +
    spintaxGreeting + ' *' + clientName + '*,\n\n' +
    spintaxIntro + ' : votre rendez-vous chez *DALIGHT* est prévu demain.\n\n' +
    '• Soin : ' + serviceName + '\n' +
    '• Date : ' + date + '\n' +
    '• Heure : ' + time + '\n' +
    '• Lieu : Delmas 65, Rue Durandisse #10, Port-au-Prince\n\n' +
    'CONDITIONS D\'ANNULATION & D\'ACCUEIL :\n' +
    '- Toute modification ou annulation doit être effectuée au moins 24h à l\'avance au +509 4747-7221.\n' +
    '- Merci de vous présenter 10 à 15 minutes à l\'avance pour votre prise en charge sereine.\n\n' +
    'Notre équipe se réjouit de prendre soin de vous.\n' +
    siteUrl;

  return sendWhatsAppMessage({
    to: phone,
    message,
    kind: 'reminder', // Slow Lane
    mode: 'async',
    account_index: DEDICATED_LINE_INDEX,
    idempotencyKey: `wa_rem24h_${reservation.id || phone}_${date}`
  });
}

/**
 * 3. Alerte Départ & Retard (H-30 / H-45 min avant) (Fast Lane)
 * Rappel strict de la politique de ponctualité de DALIGHT :
 * - Retard = réduction proportionnelle du temps de soin
 * - > 15 min de retard sans préavis = créneau annulé/reprogrammé
 * - Arrivée 10 à 15 minutes avant recommandée à Delmas 65, Rue Durandisse #10
 */
export async function sendReservation30mAlertWhatsApp(reservation) {
  const {
    phone,
    clientName = 'Client(e)',
    serviceName = 'Head Spa DALIGHT',
    time = 'votre heure'
  } = reservation;

  const spintaxGreeting = '{Bonjour|Chère cliente}';
  const siteUrl = 'https://dalightbeauty.com';

  const message = '*DALIGHT — ALERTE RENDEZ-VOUS IMMINENT*\n\n' +
    spintaxGreeting + ' *' + clientName + '*,\n\n' +
    'Votre soin *' + serviceName + '* est prévu dans moins de 45 minutes (à *' + time + '*).\n\n' +
    'Adresse : Delmas 65, Rue Durandisse #10, Port-au-Prince\n' +
    'Contact salon : +509 4747-7221\n\n' +
    'RÈGLEMENT DE PONCTUALITÉ DALIGHT :\n' +
    '- Tout retard entraîne automatiquement une réduction proportionnelle de la durée de votre soin afin de respecter les créneaux suivants.\n' +
    '- Au-delà de 15 minutes de retard sans préavis, le rendez-vous pourra être reporté selon les disponibilités.\n' +
    '- Merci de prévoir votre trajet afin d\'arriver 10 à 15 minutes à l\'avance.\n\n' +
    'Nous vous attendons pour ce pur moment de détente.\n' +
    siteUrl;

  return sendWhatsAppMessage({
    to: phone,
    message,
    kind: 'manual_direct', // Fast Lane instant
    mode: 'async',
    account_index: DEDICATED_LINE_INDEX,
    idempotencyKey: `wa_alert30m_${reservation.id || phone}_${Date.now()}`
  });
}

/**
 * 4. Message de Bienvenue & Points Privilège (Fast Lane)
 */
export async function sendWelcomeBonusWhatsApp(client) {
  const {
    phone,
    clientName = 'Client(e)',
    points = 100
  } = client;

  const siteUrl = 'https://dalightbeauty.com';
  const message = '*DALIGHT — BIENVENUE DANS NOTRE UNIVERS*\n\n' +
    'Chère *' + clientName + '*,\n\n' +
    'Votre compte membre a été créé avec succès chez DALIGHT. Pour célébrer votre arrivée, *' + points + ' points privilège* ont été crédités sur votre carte de fidélité.\n\n' +
    'Découvrez nos soins et réservez en ligne :\n' +
    siteUrl + '/pages/services.html\n\n' +
    'Contact officiel : +509 4747-7221\n' +
    '_DALIGHT — L\'art du soin d\'exception à Port-au-Prince._';

  return sendWhatsAppMessage({
    to: phone,
    message,
    kind: 'welcome',
    mode: 'async',
    account_index: DEDICATED_LINE_INDEX,
    idempotencyKey: `wa_welcome_${phone}`
  });
}

/**
 * Generate a luxury DALIGHT branded PDF receipt on client side (using jsPDF)
 */
export function generateReceiptPDF(order) {
  return new Promise((resolve, reject) => {
    try {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        throw new Error('Bibliothèque jsPDF non chargée. Veuillez inclure jsPDF.');
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const {
        orderNumber = 'DL-' + Math.floor(1000 + Math.random() * 9000),
        clientName = 'Client(e) Privilège',
        clientPhone = '+509 4747-7221',
        clientEmail = 'contact@dalight.com',
        serviceName = 'Head Spa Signature & Massage Crânien',
        date = new Date().toLocaleDateString('fr-FR'),
        time = '10:00',
        price = 85,
        paymentMethod = 'MonCash / Espèces'
      } = order;

      // Dark Olive Header Band
      doc.setFillColor(34, 47, 29); // #222f1d
      doc.rect(0, 0, 210, 48, 'F');

      // Gold Accent Line
      doc.setFillColor(212, 175, 55); // #d4af37
      doc.rect(0, 48, 210, 2.5, 'F');

      // Title & Slogan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(250, 248, 245);
      doc.text('DALIGHT', 20, 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(194, 164, 144);
      doc.text('HEAD SPA · MASSAGE · BIEN-ÊTRE DE LUXE', 20, 29);
      doc.text('Delmas 65, Rue Durandisse #10 · Port-au-Prince · +509 4747-7221', 20, 36);
      doc.text('https://dalightbeauty.com', 20, 42);

      // Receipt Label on top right
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(212, 175, 55);
      doc.text('REÇU OFFICIEL', 190, 22, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(250, 248, 245);
      doc.text(`Réf : #${orderNumber}`, 190, 30, { align: 'right' });
      doc.text(`Émis le : ${date}`, 190, 38, { align: 'right' });

      // Client Box
      doc.setFillColor(248, 246, 242);
      doc.roundedRect(20, 60, 170, 32, 3, 3, 'F');
      doc.setDrawColor(220, 215, 205);
      doc.roundedRect(20, 60, 170, 32, 3, 3, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('INFORMATIONS CLIENT', 26, 68);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(clientName, 26, 76);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Téléphone : ${clientPhone}`, 26, 84);
      doc.text(`Paiement : ${paymentMethod}`, 115, 84);

      // Table Header
      doc.setFillColor(62, 74, 40); // Dark olive #3E4A28
      doc.rect(20, 102, 170, 9, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('DESCRIPTION DU SOIN', 25, 108);
      doc.text('DATE & HEURE', 120, 108);
      doc.text('TOTAL', 185, 108, { align: 'right' });

      // Table Row
      doc.setFillColor(255, 255, 255);
      doc.rect(20, 111, 170, 18, 'F');
      doc.setDrawColor(230, 230, 230);
      doc.line(20, 129, 190, 129);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(serviceName, 25, 120);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110, 110, 110);
      doc.text('Protocole personnalisé & hydrothérapie crânienne', 25, 125);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(50, 50, 50);
      doc.text(`${date} à ${time}`, 120, 122);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(34, 47, 29);
      doc.text(`$${price}.00`, 185, 122, { align: 'right' });

      // Total Box
      doc.setFillColor(248, 246, 242);
      doc.roundedRect(110, 140, 80, 30, 3, 3, 'F');
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.roundedRect(110, 140, 80, 30, 3, 3, 'D');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Sous-total :', 116, 149);
      doc.text(`$${price}.00`, 184, 149, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(34, 47, 29);
      doc.text('TOTAL PAYÉ :', 116, 161);
      doc.setTextColor(180, 130, 30);
      doc.text(`$${price}.00 USD`, 184, 161, { align: 'right' });

      // Stamp / Badge
      doc.setDrawColor(46, 133, 64);
      doc.setLineWidth(1);
      doc.roundedRect(25, 143, 60, 22, 2, 2, 'D');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(46, 133, 64);
      doc.text('CONFIRMÉ & PAYÉ', 55, 153, { align: 'center' });
      doc.setFontSize(7.5);
      doc.text('DALIGHT BIEN-ÊTRE', 55, 160, { align: 'center' });

      // Terms & Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Conditions d\'annulation : Annulation ou modification sans frais jusqu\'à 24h avant votre soin.', 105, 250, { align: 'center' });
      doc.text('Merci de votre fidélité et de votre confiance.', 105, 256, { align: 'center' });

      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.3);
      doc.line(40, 264, 170, 264);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text('DALIGHT · Port-au-Prince, Haïti · Document généré automatiquement par CVISUAL Gateway', 105, 272, { align: 'center' });

      const pdfBase64 = doc.output('datauristring');
      const filename = `Recu_DALIGHT_${orderNumber}.pdf`;

      resolve({
        doc,
        filename,
        base64: pdfBase64,
        rawBase64: pdfBase64.replace(/^data:application\/pdf;base64,/, ''),
        download: () => doc.save(filename)
      });
    } catch (err) {
      reject(err);
    }
  });
}
