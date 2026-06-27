// @ts-nocheck
// Supabase Edge Function — PLOP PLOP Retrait (Withdrawal) v2
// 3-step flow: auth → withdrawal-token (HMAC-SHA256) → withdraw
// Deploy:  supabase functions deploy plop-withdraw
// Secrets: PLOP_CLIENT_ID, PLOP_CLIENT_SECRET
// Optional: PLOP_BASE_URL (default: https://plopplop.solutionip.app)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BASE    = (Deno.env.get('PLOP_BASE_URL') || 'https://plopplop.solutionip.app').replace(/\/+$/, '')
const CLI_ID  = Deno.env.get('PLOP_CLIENT_ID')
const CLI_SEC = Deno.env.get('PLOP_CLIENT_SECRET')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function plopPost(endpoint: string, body: unknown, bearerToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  return { status: res.status, ok: res.ok, data }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, message: 'Method not allowed' }, 405)

  try {
    if (!CLI_ID || !CLI_SEC) {
      return json({ success: false, message: 'PLOP_CLIENT_ID ou PLOP_CLIENT_SECRET non configuré' }, 503)
    }

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ success: false, message: 'Body JSON invalide' }, 400) }

    const amount    = Number(body.amount)
    const method    = String(body.method   || '').toLowerCase()
    const recipient = String(body.recipient || '').trim()
    const reference = String(body.reference || '').trim()

    const ALLOWED = new Set(['moncash', 'natcash'])

    if (!reference)                              return json({ success: false, message: 'reference requis' }, 400)
    if (!recipient)                              return json({ success: false, message: 'recipient requis (509XXXXXXXX)' }, 400)
    if (!Number.isFinite(amount) || amount < 20) return json({ success: false, message: 'amount invalide (min 20 HTG)' }, 400)
    if (!ALLOWED.has(method))                    return json({ success: false, message: `method invalide — utiliser: ${[...ALLOWED].join(', ')}` }, 400)

    console.log(`[plop-withdraw] ref=${reference} amount=${amount} method=${method} recipient=${recipient}`)

    // ── Étape 1 : Authentification ────────────────────────────────
    const authStep = await plopPost('/api/auth/marchand', { client_id: CLI_ID, client_secret: CLI_SEC })
    if (!authStep.ok || !authStep.data?.token) {
      console.error('[plop-withdraw] auth failed:', authStep)
      return json({ success: false, message: 'Authentification Plop Plop échouée', detail: authStep.data }, authStep.status)
    }
    const marchandToken = String(authStep.data.token)
    console.log('[plop-withdraw] auth OK, token obtained')

    // ── Étape 2 : Jeton de retrait (HMAC-SHA256) ──────────────────
    const timestamp = Math.floor(Date.now() / 1000)
    const sigPayload = [amount, method, recipient, reference, timestamp].join('|')
    const withdrawal_signature = await hmacSha256(CLI_SEC, sigPayload)

    const wtStep = await plopPost('/api/auth/marchand/withdrawal-token', {
      amount, method, recipient, reference, timestamp, withdrawal_signature,
    }, marchandToken)

    if (!wtStep.ok || !wtStep.data?.withdrawal_token) {
      console.error('[plop-withdraw] withdrawal-token failed:', wtStep)
      const errCode = String(wtStep.data?.error_code || '')
      const msg = errCode === 'INVALID_SIGNATURE'
        ? 'Signature HMAC invalide — vérifiez PLOP_CLIENT_SECRET'
        : errCode === 'TIMESTAMP_EXPIRED'
        ? 'Timestamp expiré — relancez la requête'
        : wtStep.data?.message || 'Génération jeton retrait échouée'
      return json({ success: false, message: msg, error_code: errCode, detail: wtStep.data }, wtStep.status)
    }
    const withdrawalToken = String(wtStep.data.withdrawal_token)
    console.log('[plop-withdraw] withdrawal-token OK')

    // ── Étape 3 : Exécuter le retrait ─────────────────────────────
    const wdStep = await plopPost('/api/withdraw/marchand', {
      amount, method, recipient, reference,
    }, withdrawalToken)

    console.log(`[plop-withdraw] withdraw HTTP ${wdStep.status}:`, JSON.stringify(wdStep.data).slice(0, 500))

    if (wdStep.status === 409) {
      return json({ success: false, message: 'Référence déjà utilisée.', error_code: 'DUPLICATE_REFERENCE' }, 409)
    }

    return json({ ...wdStep.data, http_status: wdStep.status }, 200)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[plop-withdraw] fatal:', message)
    return json({ success: false, message }, 503)
  }
})
