/**
 * DALIGHT — WhatsApp Service Module
 * Integration with CVISUAL WhatsApp Gateway (Fast Lane & Slow Lane Anti-Ban)
 */

export const CVISUAL_GATEWAY_URL = 'https://cvisual-whatsapp-gateway.onrender.com';

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
 * Sends a WhatsApp message via Server Proxy or Supabase Edge Function
 */
export async function sendWhatsAppMessage(options) {
  const {
    to,
    message,
    kind = 'receipt',
    mode = 'async',
    pdf_base64 = null,
    pdf_file_name = null,
    idempotencyKey = null
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
    // Fall through to Supabase Edge Function or direct gateway proxy
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

  // 3. Fallback: Direct call if admin token exists in localStorage (admin session)
  const adminApiKey = localStorage.getItem('cvisual_wa_api_key');
  if (adminApiKey) {
    const res = await fetch(`${CVISUAL_GATEWAY_URL}/api/v1/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminApiKey}`,
        'Content-Type': 'application/json',
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.message || 'Erreur lors de l\'envoi');
    return data;
  }

  throw new Error('Service WhatsApp non connecté. Démarrez le serveur backend ou connectez la clé dans l\'administration.');
}

/**
 * High-level helper: Send official booking confirmation + receipt PDF
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
  const spintaxThanks = '{Merci pour votre réservation|Nous avons le plaisir de confirmer votre moment de détente|Merci de votre confiance}';
  const siteUrl = 'https://dalightbeauty.com';

  const message = `${spintaxGreeting} *${clientName}* 🌿\n\n` +
    `${spintaxThanks} chez *DALIGHT* !\n\n` +
    `📋 *DÉTAILS DE VOTRE SOIN :*\n` +
    `• Prestation : *${serviceName}*\n` +
    `• Date : *${date}*\n` +
    `• Heure : *${time}*\n` +
    `• Montant : *${typeof price === 'number' ? '$' + price : price}*\n` +
    `• N° Réservation : *#${orderNumber}*\n\n` +
    `📍 *Adresse :* Delmas 65, Rue Durandisse #10, Port-au-Prince\n` +
    `📞 *Téléphone :* +509 4747-7221\n` +
    `🌐 *Site officiel :* ${siteUrl}\n\n` +
    `_Votre reçu officiel est joint à ce message en format PDF. Toute notre équipe vous attend pour un pur moment de relaxation !_ ✨`;

  return sendWhatsAppMessage({
    to: phone,
    message,
    kind: 'receipt', // Fast Lane
    mode: 'async',
    pdf_base64: pdfBase64,
    pdf_file_name: `Recu_DALIGHT_${orderNumber}.pdf`,
    idempotencyKey: `wa_recu_${orderNumber}`
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
      doc.text('✓ CONFIRMÉ & PAYÉ', 55, 153, { align: 'center' });
      doc.setFontSize(7.5);
      doc.text('DALIGHT BIEN-ÊTRE', 55, 160, { align: 'center' });

      // Terms & Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Conditions d\'annulation : Annulation ou report sans frais jusqu\'à 3h avant votre soin.', 105, 250, { align: 'center' });
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
