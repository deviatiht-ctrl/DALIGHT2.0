/**
 * DALIGHT — CVISUAL WhatsApp Gateway Client (Node.js)
 * Dual-Lane Routing & Anti-Ban Meta Meta-Compliant WhatsApp Integration
 * 
 * Specifications:
 * - Base URL: https://cvisual-whatsapp-gateway.onrender.com
 * - Auth: Bearer CVISUAL_WA_API_KEY
 * - Fast Lane (sync/async): receipt, welcome, otp, test, manual_direct
 * - Slow Lane (async only, 10-16 min pauses, max 25/day/SIM): reminder, reminder_7d, reminder_2d, marketing, manual
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Auto-load .env if present
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}
loadEnv();

const CVISUAL_BASE_URL = process.env.CVISUAL_WA_BASE_URL || 'https://cvisual-whatsapp-gateway.onrender.com';
const CVISUAL_API_KEY = process.env.CVISUAL_WA_API_KEY || 'cv_live_admin_6094ed1bf65bf0945706d3d7';

const FAST_LANE_KINDS = new Set(['receipt', 'welcome', 'otp', 'test', 'manual_direct']);
const SLOW_LANE_KINDS = new Set(['reminder', 'reminder_7d', 'reminder_2d', 'marketing', 'manual']);
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Normalizes phone numbers:
 * - Removes non-digits
 * - 8 local digits (ex: 47477221) -> auto-prefixed with 509 -> 50947477221
 * - Minimum 8, maximum 15 digits
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/\D/g, '');
  if (cleaned.length === 8) {
    return '509' + cleaned;
  }
  return cleaned;
}

/**
 * Resolves Spintax format: {Option 1|Option 2|Option 3}
 * Randomly picks one variation to make messages non-identical (Meta anti-spam).
 */
function resolveSpintax(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const choices = group.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

/**
 * Core HTTPS requester for CVISUAL Gateway
 */
function makeRequest(method, endpoint, payload = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, CVISUAL_BASE_URL);
    
    const headers = {
      'Authorization': `Bearer ${CVISUAL_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'DALIGHT-Backend/2.0',
      ...customHeaders
    };

    let postData = null;
    if (payload) {
      postData = JSON.stringify(payload);
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: headers,
      timeout: 30000 // 30s timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (e) {
          parsed = { raw: data };
        }

        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
        if (isSuccess) {
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } else {
          const err = new Error(parsed.detail || parsed.message || parsed.error || `HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.response = parsed;
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Gateway request timed out');
      err.statusCode = 504;
      reject(err);
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

class CvisualWhatsAppClient {
  constructor(apiKey = null, baseUrl = null) {
    this.apiKey = apiKey || CVISUAL_API_KEY;
    this.baseUrl = baseUrl || CVISUAL_BASE_URL;
  }

  /**
   * Health check (public)
   */
  async getHealth() {
    return makeRequest('GET', '/health');
  }

  /**
   * Tenant profile & usage stats
   */
  async getMe() {
    return makeRequest('GET', '/api/v1/me');
  }

  /**
   * Cluster availability & Dual-Lane capabilities
   */
  async getStatus() {
    return makeRequest('GET', '/api/v1/status');
  }

  /**
   * Check if phone numbers exist on WhatsApp
   * @param {string[]} phones - array of 1 to 50 phone numbers
   */
  async checkNumbers(phones) {
    const list = Array.isArray(phones) ? phones : [phones];
    const sanitized = list.map(normalizePhoneNumber).filter(p => p.length >= 8 && p.length <= 15);
    if (!sanitized.length) {
      throw new Error('Aucun numéro valide fourni pour la vérification');
    }
    return makeRequest('POST', '/api/v1/numbers/check', { phones: sanitized });
  }

  /**
   * Send a single message with Dual-Lane routing & Anti-Ban validation
   * @param {Object} options
   * @param {string} options.to - Recipient phone number
   * @param {string} options.message - Text content (supports Spintax {A|B})
   * @param {string} options.kind - Lane classification ('receipt', 'welcome', 'reminder', etc.)
   * @param {string} [options.mode='async'] - 'async' (default/recommended) or 'sync' (Fast Lane only)
   * @param {string} [options.pdf_base64] - Optional Base64 PDF attachment (max 10MB)
   * @param {string} [options.pdf_file_name] - Filename for PDF (ex: 'Recu_DALIGHT.pdf')
   * @param {string} [options.idempotencyKey] - Unique key to prevent duplicates (cached 15 min)
   * @param {boolean} [options.resolveSpintax=true] - Auto-resolve spintax before sending
   */
  async sendMessage(options) {
    const {
      to,
      message,
      kind = 'manual',
      mode = 'async',
      pdf_base64 = null,
      pdf_file_name = null,
      idempotencyKey = null,
      resolveSpintax: shouldResolve = true
    } = options;

    const normalizedPhone = normalizePhoneNumber(to);
    if (!normalizedPhone || normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      const err = new Error(`Format de téléphone invalide: "${to}". 8 à 15 chiffres requis.`);
      err.statusCode = 400;
      throw err;
    }

    if (!message || !message.trim()) {
      const err = new Error('Le message ne peut pas être vide.');
      err.statusCode = 400;
      throw err;
    }

    // Lane enforcement
    const isFast = FAST_LANE_KINDS.has(kind);
    const isSlow = SLOW_LANE_KINDS.has(kind);

    if (!isFast && !isSlow) {
      const err = new Error(`Type de message inconnu: "${kind}". Types autorisés: Fast Lane (${[...FAST_LANE_KINDS].join(', ')}), Slow Lane (${[...SLOW_LANE_KINDS].join(', ')}).`);
      err.statusCode = 422;
      throw err;
    }

    if (isSlow && mode === 'sync') {
      const err = new Error(`Règle Anti-Ban Meta: La voie Slow Lane (kind="${kind}") DOIT obligatoirement utiliser mode="async". Le mode "sync" est interdit.`);
      err.statusCode = 422;
      throw err;
    }

    // Resolve spintax
    const finalMessage = shouldResolve ? resolveSpintax(message) : message;

    // Validate PDF if present
    let cleanedPdf = null;
    if (pdf_base64) {
      cleanedPdf = pdf_base64.replace(/^data:application\/pdf;base64,/, '').trim();
      const approxBytes = Math.ceil((cleanedPdf.length * 3) / 4);
      if (approxBytes > MAX_PDF_BYTES) {
        const err = new Error(`PDF trop lourd (~${(approxBytes / (1024 * 1024)).toFixed(1)} MB). Taille maximale autorisée: 10 MB.`);
        err.statusCode = 413;
        throw err;
      }
    }

    const payload = {
      to: normalizedPhone,
      message: finalMessage,
      kind: kind,
      mode: mode
    };

    if (cleanedPdf) {
      payload.pdf_base64 = cleanedPdf;
      payload.pdf_file_name = pdf_file_name || 'Recu_DALIGHT.pdf';
    }

    const customHeaders = {};
    if (idempotencyKey) {
      customHeaders['Idempotency-Key'] = idempotencyKey;
    } else {
      // Auto-generate idempotency key based on destination, kind, and 5-minute bucket
      const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
      const hash = crypto.createHash('sha1').update(`${normalizedPhone}-${kind}-${bucket}`).digest('hex');
      customHeaders['Idempotency-Key'] = `wa_dalight_${hash}`;
    }

    return makeRequest('POST', '/api/v1/messages/send', payload, customHeaders);
  }

  /**
   * Bulk queue sending (up to 100 messages)
   */
  async sendBulk(messages) {
    if (!Array.isArray(messages) || !messages.length) {
      throw new Error('Tableau de messages vide ou invalide');
    }
    if (messages.length > 100) {
      throw new Error('Maximum 100 messages par lot');
    }

    const prepared = messages.map(m => ({
      to: normalizePhoneNumber(m.to),
      message: resolveSpintax(m.message),
      kind: m.kind || 'reminder',
      mode: 'async', // Bulk messages are always async
      ...(m.pdf_base64 ? { pdf_base64: m.pdf_base64.replace(/^data:application\/pdf;base64,/, ''), pdf_file_name: m.pdf_file_name || 'Document.pdf' } : {})
    }));

    return makeRequest('POST', '/api/v1/messages/send-bulk', { messages: prepared });
  }

  /**
   * Get message history
   */
  async getMessages(query = {}) {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    if (query.status) params.set('status', query.status);
    if (query.kind) params.set('kind', query.kind);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return makeRequest('GET', `/api/v1/messages${qs}`);
  }

  /**
   * Get specific message status
   */
  async getMessageStatus(id) {
    if (!id) throw new Error('ID message requis');
    return makeRequest('GET', `/api/v1/messages/${id}/status`);
  }

  /**
   * Cancel pending message
   */
  async cancelMessage(id) {
    if (!id) throw new Error('ID message requis');
    return makeRequest('POST', `/api/v1/messages/${id}/cancel`);
  }

  /**
   * Retry failed or cancelled message
   */
  async retryMessage(id) {
    if (!id) throw new Error('ID message requis');
    return makeRequest('POST', `/api/v1/messages/${id}/retry`);
  }

  /**
   * Webhook Signature Verification (HMAC-SHA256)
   */
  verifyWebhookSignature(rawBody, timestamp, signatureHeader, secret = null) {
    const sec = secret || process.env.CVISUAL_WEBHOOK_SECRET;
    if (!sec) {
      throw new Error('CVISUAL_WEBHOOK_SECRET non configuré pour la vérification');
    }
    if (!signatureHeader || !timestamp) {
      return false;
    }

    const expected = 'sha256=' + crypto.createHmac('sha256', sec).update(`${timestamp}.${rawBody}`).digest('hex');
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // ─── HIGH-LEVEL DALIGHT AUTOMATED TEMPLATE DISPATCHERS ───

  /**
   * 1. Confirmation de Réservation + Reçu PDF (Fast Lane)
   */
  async sendReservationReceipt(data) {
    const {
      phone,
      clientName = 'Client(e)',
      serviceName,
      date,
      time,
      price,
      orderNumber,
      pdfBase64 = null
    } = data;

    const spintaxGreeting = '{Bonjour|Bonsoir|Chère cliente}';
    const spintaxThanks = '{Merci pour votre confiance|Nous sommes enchantés de vous recevoir|Votre bien-être est notre priorité}';
    const siteUrl = process.env.DALIGHT_SITE_URL || 'https://dalightbeauty.com';

    const message = `${spintaxGreeting} *${clientName}* 🌿\n\n` +
      `${spintaxThanks}.\n` +
      `Votre réservation chez *DALIGHT* a bien été enregistrée !\n\n` +
      `📋 *DÉTAILS DU SOIN :*\n` +
      `• Soin : *${serviceName || 'Head Spa & Soin Capillaire'}*\n` +
      `• Date : *${date || 'À convenir'}*\n` +
      `• Heure : *${time || '09:00'}*\n` +
      `• Montant : *${price ? '$' + price : 'Confirmé'}*\n` +
      `• Référence : *#${orderNumber || 'DL-' + Math.floor(1000 + Math.random() * 9000)}*\n\n` +
      `📍 *Adresse :* Delmas 65, Rue Durandisse #10, Port-au-Prince\n` +
      `📞 *Contact :* +509 4747-7221\n` +
      `🌐 *Site web :* ${siteUrl}\n\n` +
      `_Veuillez trouver ci-joint votre reçu officiel en format PDF. À très bientôt pour votre moment de détente absolue !_ ✨`;

    return this.sendMessage({
      to: phone,
      message: message,
      kind: 'receipt',
      mode: 'async', // Fast Lane async
      pdf_base64: pdfBase64,
      pdf_file_name: `Recu_DALIGHT_${orderNumber || 'Confirmation'}.pdf`,
      idempotencyKey: `wa_receipt_${orderNumber || phone}_${Date.now()}`
    });
  }

  /**
   * 2. Rappel de Soin J-1 (Slow Lane)
   */
  async sendBookingReminder(data) {
    const {
      phone,
      clientName = 'Client(e)',
      serviceName,
      date = 'demain',
      time = 'votre heure prévue'
    } = data;

    const spintaxGreeting = '{Bonjour|Chère cliente|Douce journée}';
    const spintaxIntro = '{Petit rappel bienveillant|Nous avons le plaisir de vous rappeler}';
    const siteUrl = process.env.DALIGHT_SITE_URL || 'https://dalightbeauty.com';

    const message = `${spintaxGreeting} *${clientName}* ✨\n\n` +
      `${spintaxIntro} : votre rendez-vous de relaxation *DALIGHT* approche.\n\n` +
      `💆‍♀️ *Soin :* ${serviceName}\n` +
      `📅 *Date :* ${date}\n` +
      `⏰ *Heure :* ${time}\n` +
      `📍 *Lieu :* Delmas 65, Rue Durandisse #10\n\n` +
      `En cas d'imprévu, merci de nous contacter au moins 3h à l'avance au +509 4747-7221.\n` +
      `🌐 ${siteUrl}\n\n` +
      `_Hâte de prendre soin de vous !_ 🌿`;

    return this.sendMessage({
      to: phone,
      message: message,
      kind: 'reminder',
      mode: 'async' // Slow Lane MUST be async
    });
  }

  /**
   * 3. Message de Bienvenue & Carte de Fidélité (Fast Lane)
   */
  async sendWelcomeBonus(data) {
    const {
      phone,
      clientName = 'Client(e)',
      points = 100
    } = data;

    const spintaxWelcome = '{Bienvenue dans l\'univers|Heureux de vous compter parmi nous chez|Bienvenue chez}';
    const siteUrl = process.env.DALIGHT_SITE_URL || 'https://dalightbeauty.com';

    const message = `✨ ${spintaxWelcome} *DALIGHT* ! ✨\n\n` +
      `Chère *${clientName}*,\n` +
      `Votre espace membre a été activé avec succès. Pour célébrer votre première visite, *${points} points privilège* ont été crédités sur votre carte de fidélité.\n\n` +
      `Découvrez nos soins de détente bien-être et réservez vos futurs moments de relaxation en un clic :\n` +
      `🌐 ${siteUrl}/pages/services.html\n\n` +
      `_DALIGHT — L'art du bien-être et du soin d'exception à Port-au-Prince._ 🌿`;

    return this.sendMessage({
      to: phone,
      message: message,
      kind: 'welcome',
      mode: 'async'
    });
  }
}

// Singleton export
const defaultClient = new CvisualWhatsAppClient();

module.exports = {
  CvisualWhatsAppClient,
  defaultClient,
  normalizePhoneNumber,
  resolveSpintax,
  FAST_LANE_KINDS,
  SLOW_LANE_KINDS
};
