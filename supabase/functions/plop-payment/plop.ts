import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PLOP_BASE_URL = Deno.env.get('PLOP_BASE_URL') || 'https://plopplop.solutionip.app'
const PLOP_CLIENT_ID = Deno.env.get('PLOP_CLIENT_ID')
const PLOP_CLIENT_SECRET = Deno.env.get('PLOP_CLIENT_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function cleanBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ status: false, message: 'Méthode non autorisée' }, 405)
  }

  try {
    if (!PLOP_CLIENT_ID) {
      return jsonResponse({ status: false, message: 'PLOP_CLIENT_ID non configuré' }, 503)
    }

    const body = await req.json()
    const action = body.action || 'create'

    // ── VERIFY ──────────────────────────────────────────────────
    if (action === 'verify') {
      if (!body.refference_id) {
        return jsonResponse({ status: false, message: 'refference_id manquant' }, 400)
      }

      const res = await fetch(`${cleanBaseUrl(PLOP_BASE_URL)}/api/paiement-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: PLOP_CLIENT_ID,
          refference_id: body.refference_id,
        }),
      })

      const data = await res.json().catch(() => ({ status: false, message: 'Réponse PLOP PLOP invalide' }))
      return jsonResponse(data, res.status)
    }

    // ── WITHDRAW (Retrait) ───────────────────────────────────────
    if (action === 'withdraw') {
      if (!PLOP_CLIENT_SECRET) {
        return jsonResponse({ status: false, message: 'PLOP_CLIENT_SECRET non configuré' }, 503)
      }

      const amount = Number(body.montant)
      const phone = String(body.phone_number || '').trim()
      const refId = String(body.reference_id || '').trim()
      const pm = String(body.payment_method || 'moncash').toLowerCase()
      const allowedWithdraw = new Set(['moncash', 'natcash', 'kashpaw'])

      if (!refId || !Number.isFinite(amount) || amount < 20 || !phone) {
        return jsonResponse({ status: false, message: 'Paramètres retrait invalides' }, 400)
      }

      if (!allowedWithdraw.has(pm)) {
        return jsonResponse({ status: false, message: 'Méthode de retrait non supportée' }, 400)
      }

      const timestamp = Date.now().toString()
      const tokenPayload = `${PLOP_CLIENT_ID}:${refId}:${amount}:${pm}:${timestamp}`
      const token = await hmacSha256(PLOP_CLIENT_SECRET, tokenPayload)

      const res = await fetch(`${cleanBaseUrl(PLOP_BASE_URL)}/api/retrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: PLOP_CLIENT_ID,
          reference_id: refId,
          montant: amount,
          phone_number: phone,
          payment_method: pm,
          token,
          timestamp,
        }),
      })

      const data = await res.json().catch(() => ({ status: false, message: 'Réponse PLOP PLOP invalide' }))
      return jsonResponse(data, res.status)
    }

    // ── CREATE PAYMENT ──────────────────────────────────────────
    const amount = Number(body.montant)
    if (!body.refference_id || !Number.isFinite(amount) || amount < 20) {
      return jsonResponse({ status: false, message: 'Paramètres paiement invalides' }, 400)
    }

    const paymentMethod = String(body.payment_method || 'all').toLowerCase()
    const allowedMethods = new Set(['moncash', 'kashpaw', 'natcash', 'all'])

    const res = await fetch(`${cleanBaseUrl(PLOP_BASE_URL)}/api/paiement-marchand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLOP_CLIENT_ID,
        refference_id: body.refference_id,
        montant: amount,
        payment_method: allowedMethods.has(paymentMethod) ? paymentMethod : 'all',
      }),
    })

    const data = await res.json().catch(() => ({ status: false, message: 'Réponse PLOP PLOP invalide' }))
    return jsonResponse(data, res.status)
  } catch (error: unknown) {
    console.error('PLOP payment error:', error)
    const message = error instanceof Error ? error.message : 'Erreur interne paiement'
    return jsonResponse({ status: false, message }, 503)
  }
})
