// ==============================================================================
// DALIGHT — CVISUAL WhatsApp Gateway Supabase Edge Function
// Dual-Lane Anti-Ban WhatsApp Automation Backend
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CVISUAL_BASE_URL = Deno.env.get('CVISUAL_WA_BASE_URL') || 'https://cvisual-whatsapp-gateway.onrender.com';
const CVISUAL_API_KEY = Deno.env.get('CVISUAL_WA_API_KEY') || 'cv_live_admin_6094ed1bf65bf0945706d3d7';

const FAST_LANE_KINDS = new Set(['receipt', 'welcome', 'otp', 'test', 'manual_direct']);
const SLOW_LANE_KINDS = new Set(['reminder', 'reminder_7d', 'reminder_2d', 'marketing', 'manual']);
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/\D/g, '');
  if (cleaned.length === 8) {
    return '509' + cleaned;
  }
  return cleaned;
}

function resolveSpintax(text: string): string {
  if (!text) return '';
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const choices = group.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'status', payload = {} } = body;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${CVISUAL_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'DALIGHT-Supabase-Edge/2.0',
    };

    let targetUrl = `${CVISUAL_BASE_URL}/api/v1/status`;
    let method = 'GET';
    let postData: string | null = null;

    if (action === 'me') {
      targetUrl = `${CVISUAL_BASE_URL}/api/v1/me`;
    } else if (action === 'status') {
      targetUrl = `${CVISUAL_BASE_URL}/api/v1/status`;
    } else if (action === 'check_numbers') {
      targetUrl = `${CVISUAL_BASE_URL}/api/v1/numbers/check`;
      method = 'POST';
      const phones = Array.isArray(payload.phones) ? payload.phones : [payload.phone];
      postData = JSON.stringify({ phones: phones.map(normalizePhoneNumber).filter((p: string) => p.length >= 8) });
    } else if (action === 'send') {
      targetUrl = `${CVISUAL_BASE_URL}/api/v1/messages/send`;
      method = 'POST';

      const to = normalizePhoneNumber(payload.to);
      const kind = payload.kind || 'receipt';
      const mode = payload.mode || 'async';

      if (SLOW_LANE_KINDS.has(kind) && mode === 'sync') {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Règle Anti-Ban Meta: La voie Slow Lane (kind="${kind}") DOIT utiliser mode="async". Mode "sync" interdit.`,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const message = resolveSpintax(payload.message || '');
      const reqPayload: Record<string, any> = {
        to,
        message,
        kind,
        mode,
      };

      if (payload.pdf_base64) {
        reqPayload.pdf_base64 = payload.pdf_base64.replace(/^data:application\/pdf;base64,/, '');
        reqPayload.pdf_file_name = payload.pdf_file_name || 'Recu_DALIGHT.pdf';
      }

      if (payload.idempotency_key) {
        headers['Idempotency-Key'] = payload.idempotency_key;
      }

      postData = JSON.stringify(reqPayload);
    } else if (action === 'messages') {
      const limit = payload.limit || 50;
      targetUrl = `${CVISUAL_BASE_URL}/api/v1/messages?limit=${limit}`;
    }

    const gatewayRes = await fetch(targetUrl, {
      method,
      headers,
      body: postData,
    });

    const data = await gatewayRes.json().catch(() => ({}));

    return new Response(JSON.stringify(data), {
      status: gatewayRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Internal Edge Function Error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
