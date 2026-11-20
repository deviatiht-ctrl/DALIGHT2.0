/**
 * DALIGHT — WhatsApp Gateway Local HTTP & Serverless API Handler
 * Secure Server-side proxy for CVISUAL WhatsApp Gateway API
 * Keeps CVISUAL_WA_API_KEY safe on server.
 */

const { defaultClient, normalizePhoneNumber, resolveSpintax, FAST_LANE_KINDS, SLOW_LANE_KINDS } = require('./cvisual-whatsapp-client');

async function handleWhatsAppRequest(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // Helper for JSON responses
  const sendJson = (status, payload) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end(JSON.stringify(payload));
  };

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  try {
    // 1. GET /api/whatsapp/status & me
    if (pathname === '/api/whatsapp/status' && method === 'GET') {
      const [statusRes, meRes] = await Promise.all([
        defaultClient.getStatus().catch(err => ({ data: { ok: false, error: err.message } })),
        defaultClient.getMe().catch(err => ({ data: { ok: false, error: err.message } }))
      ]);

      return sendJson(200, {
        ok: true,
        status: statusRes.data,
        me: meRes.data,
        serverTime: new Date().toISOString()
      });
    }

    // 2. POST /api/whatsapp/check (check numbers existence)
    if (pathname === '/api/whatsapp/check' && method === 'POST') {
      const body = await parseJsonBody(req);
      const phones = body.phones || (body.phone ? [body.phone] : []);
      const result = await defaultClient.checkNumbers(phones);
      return sendJson(200, result.data);
    }

    // 3. POST /api/whatsapp/send (send single message)
    if (pathname === '/api/whatsapp/send' && method === 'POST') {
      const body = await parseJsonBody(req);
      const {
        to,
        message,
        kind = 'receipt',
        mode = 'async',
        pdf_base64 = null,
        pdf_file_name = null,
        idempotencyKey = null
      } = body;

      const result = await defaultClient.sendMessage({
        to,
        message,
        kind,
        mode,
        pdf_base64,
        pdf_file_name,
        idempotencyKey
      });

      return sendJson(result.statusCode, {
        ok: true,
        ...result.data
      });
    }

    // 4. POST /api/whatsapp/send-receipt (helper with receipt structure)
    if (pathname === '/api/whatsapp/send-receipt' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await defaultClient.sendReservationReceipt(body);
      return sendJson(result.statusCode, {
        ok: true,
        ...result.data
      });
    }

    // 5. POST /api/whatsapp/send-reminder & send-reminder-24h
    if ((pathname === '/api/whatsapp/send-reminder' || pathname === '/api/whatsapp/send-reminder-24h') && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await defaultClient.sendReservationReminder24h(body);
      return sendJson(result.statusCode, {
        ok: true,
        ...result.data
      });
    }

    // 5b. POST /api/whatsapp/send-alert-30m (30-45 min arrival & lateness policy alert)
    if (pathname === '/api/whatsapp/send-alert-30m' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await defaultClient.sendReservationAlert30m(body);
      return sendJson(result.statusCode, {
        ok: true,
        ...result.data
      });
    }

    // 6. GET /api/whatsapp/messages (list history)
    if (pathname === '/api/whatsapp/messages' && method === 'GET') {
      const limit = url.searchParams.get('limit') || '50';
      const offset = url.searchParams.get('offset') || '0';
      const status = url.searchParams.get('status') || '';
      const kind = url.searchParams.get('kind') || '';

      const result = await defaultClient.getMessages({ limit, offset, status, kind });
      return sendJson(200, result.data);
    }

    // 7. POST /api/whatsapp/resolve-spintax (preview utility)
    if (pathname === '/api/whatsapp/resolve-spintax' && method === 'POST') {
      const body = await parseJsonBody(req);
      const text = body.text || '';
      return sendJson(200, {
        ok: true,
        original: text,
        resolved: resolveSpintax(text),
        variations: [
          resolveSpintax(text),
          resolveSpintax(text),
          resolveSpintax(text)
        ]
      });
    }

    // 8. POST /api/whatsapp/concierge-chat (AI Concierge with live prices & auto-reply)
    if ((pathname === '/api/whatsapp/concierge-chat' || pathname === '/api/whatsapp/webhook') && method === 'POST') {
      const body = await parseJsonBody(req);
      const phone = body.phone || body.from || body.sender || '';
      const message = body.message || body.text || body.body || '';

      const { handleIncomingWhatsAppMessage } = require('../api/whatsapp-ai-concierge');
      const result = await handleIncomingWhatsAppMessage(phone, message);

      // Auto-dispatch reply back to client ONLY if AI is enabled and reply generated
      if (body.dispatch_reply !== false && phone && result.reply && !result.aiDisabled) {
        let cleanTo = String(phone).replace(/\D/g, '');
        if (cleanTo.length === 8) cleanTo = '509' + cleanTo;
        await defaultClient.sendMessage({
          to: cleanTo,
          message: result.reply,
          kind: 'concierge_reply',
          mode: 'sync'
        }).catch(err => console.warn('Auto-reply dispatch notice:', err.message));
      }

      return sendJson(200, {
        ok: true,
        ...result
      });
    }

    // Unmatched API path
    sendJson(404, { ok: false, error: `Endpoint inconnu: ${pathname}` });
  } catch (err) {
    const status = err.statusCode || 500;
    sendJson(status, {
      ok: false,
      error: err.message,
      details: err.response || null
    });
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON invalide dans le corps de la requête'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  handleWhatsAppRequest
};
