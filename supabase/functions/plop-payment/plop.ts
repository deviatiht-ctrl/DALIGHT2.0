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
      return jsonResponse({ ...data, plop_http_status: res.status })
    }

    // ── RECONCILE (safety net) ──────────────────────────────────
    // Verifies every pending PLOP reservation server-side and confirms/cancels it.
    // Works even if the customer never returned to the site after paying.
    if (action === 'reconcile') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!supabaseUrl || !serviceKey) {
        return jsonResponse({ status: false, message: 'Service non configuré' }, 503)
      }

      const dbHeaders = {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      }

      // Pending PLOP reservations from the last 7 days
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const listUrl = `${supabaseUrl}/rest/v1/reservations` +
        `?select=id,payment_reference,created_at` +
        `&payment_status=eq.pending` +
        `&payment_reference=not.is.null` +
        `&plop_client_id=is.null` +
        `&payment_method=in.(moncash,natcash,kashpaw)` +
        `&created_at=gte.${encodeURIComponent(since)}` +
        `&limit=25`

      const listRes = await fetch(listUrl, { headers: dbHeaders })
      const rows = await listRes.json().catch(() => [])
      if (!Array.isArray(rows) || rows.length === 0) {
        return jsonResponse({ status: true, checked: 0, confirmed: 0 })
      }

      let confirmed = 0
      for (const row of rows) {
        try {
          const vRes = await fetch(`${cleanBaseUrl(PLOP_BASE_URL)}/api/paiement-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: PLOP_CLIENT_ID,
              refference_id: row.payment_reference,
            }),
          })
          const v = await vRes.json().catch(() => null)
          if (v && v.trans_status === 'ok') {
            const isFull = String(row.payment_reference).endsWith('-FULL')
            await fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${row.id}`, {
              method: 'PATCH',
              headers: dbHeaders,
              body: JSON.stringify({
                status: 'CONFIRMED',
                payment_status: isFull ? 'fully_paid' : 'deposit_paid',
                plop_transaction_id: v.id_transaction || null,
                plop_client_id: v.id_client || null,
              }),
            })
            confirmed++
          }
        } catch (_) {
          // Network error on one row must not block the others
        }
      }

      return jsonResponse({ status: true, checked: rows.length, confirmed })
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

    const plopPayload: Record<string, unknown> = {
      client_id: PLOP_CLIENT_ID,
      refference_id: body.refference_id,
      montant: amount,
      payment_method: allowedMethods.has(paymentMethod) ? paymentMethod : 'all',
    }

    // Optional redirect URL so the customer comes back to the merchant page after payment
    const redirectUrl = body.redirect_url || body.return_url || body.callback_url
    if (redirectUrl && typeof redirectUrl === 'string') {
      plopPayload.redirect_url = redirectUrl
    }

    const res = await fetch(`${cleanBaseUrl(PLOP_BASE_URL)}/api/paiement-marchand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plopPayload),
    })

    const data = await res.json().catch(() => ({ status: false, message: 'Réponse PLOP PLOP invalide' }))
    return jsonResponse({ ...data, plop_http_status: res.status })
  } catch (error: unknown) {
    console.error('PLOP payment error:', error)
    const message = error instanceof Error ? error.message : 'Erreur interne paiement'
    return jsonResponse({ status: false, message }, 503)
  }
})
