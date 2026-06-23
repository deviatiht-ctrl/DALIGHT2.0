// @ts-nocheck
// Supabase Edge Function — PLOP PLOP Retrait (Withdrawal)
// Deploy: supabase functions deploy plop-withdraw
// Secrets requis: PLOP_CLIENT_ID, PLOP_CLIENT_SECRET
// Optionnel:      PLOP_BASE_URL (défaut: https://plopplop.solutionip.app)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PLOP_BASE_URL    = (Deno.env.get('PLOP_BASE_URL') || 'https://plopplop.solutionip.app').replace(/\/+$/, '')
const PLOP_CLIENT_ID   = Deno.env.get('PLOP_CLIENT_ID')
const PLOP_CLIENT_SECRET = Deno.env.get('PLOP_CLIENT_SECRET')

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

async function hmac256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ status: false, message: 'Method not allowed' }, 405)

  try {
    // ── Vérifier secrets ────────────────────────────────────────
    if (!PLOP_CLIENT_ID || !PLOP_CLIENT_SECRET) {
      return json({
        status: false,
        message: 'PLOP_CLIENT_ID ou PLOP_CLIENT_SECRET non configuré dans Supabase Secrets',
      }, 503)
    }

    // ── Lire et valider le body ──────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ status: false, message: 'Body JSON invalide' }, 400)
    }

    const reference_id    = String(body.reference_id    || '').trim()
    const montant         = Number(body.montant)
    const phone_number    = String(body.phone_number    || '').trim()
    const payment_method  = String(body.payment_method  || 'moncash').toLowerCase()

    const ALLOWED = new Set(['moncash', 'natcash', 'kashpaw'])

    if (!reference_id) {
      return json({ status: false, message: 'reference_id requis' }, 400)
    }
    if (!Number.isFinite(montant) || montant < 20) {
      return json({ status: false, message: 'montant invalide (min 20)' }, 400)
    }
    if (!phone_number) {
      return json({ status: false, message: 'phone_number requis' }, 400)
    }
    if (!ALLOWED.has(payment_method)) {
      return json({ status: false, message: `payment_method invalide — utiliser: ${[...ALLOWED].join(', ')}` }, 400)
    }

    // ── Générer token HMAC-SHA256 ────────────────────────────────
    const timestamp   = Date.now().toString()
    const payload     = `${PLOP_CLIENT_ID}:${reference_id}:${montant}:${payment_method}:${timestamp}`
    const token       = await hmac256(PLOP_CLIENT_SECRET, payload)

    console.log(`[plop-withdraw] ref=${reference_id} montant=${montant} method=${payment_method} phone=${phone_number}`)

    // ── Appel API PLOP PLOP retrait ─────────────────────────────
    // Essaie /api/retrait-marchand (même convention que /api/paiement-marchand)
    const endpoint = `${PLOP_BASE_URL}/api/retrait-marchand`
    console.log(`[plop-withdraw] calling: ${endpoint}`)

    const plopRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:      PLOP_CLIENT_ID,
        reference_id,
        montant,
        phone_number,
        payment_method,
        token,
        timestamp,
      }),
    })

    // Toujours lire raw text d'abord pour debug
    const rawText = await plopRes.text()
    console.log(`[plop-withdraw] HTTP ${plopRes.status} raw:`, rawText.slice(0, 1000))

    let plopData: Record<string, unknown>
    try {
      plopData = JSON.parse(rawText)
    } catch {
      // Réponse non-JSON
      if (plopRes.ok) {
        // HTTP 200 + non-JSON = PLOP PLOP a accepté le retrait (répond "OK", "1", etc.)
        console.log(`[plop-withdraw] SUCCESS non-JSON (HTTP 200), raw: "${rawText.slice(0, 200)}"`)
        return json({
          status: true,
          message: 'Retrait accepté par PLOP PLOP',
          plop_raw: rawText.slice(0, 500),
        })
      }
      // HTTP non-200 + non-JSON = erreur réelle
      console.error(`[plop-withdraw] ERREUR non-JSON HTTP ${plopRes.status}: "${rawText.slice(0, 500)}"`)
      return json({
        status: false,
        message: `Retrait refusé par PLOP PLOP (HTTP ${plopRes.status})`,
        plop_raw: rawText.slice(0, 500),
        endpoint_tried: endpoint,
      })
    }

    console.log(`[plop-withdraw] parsed JSON:`, plopData)

    // Toujours HTTP 200 vers le client Supabase
    return json({ ...plopData, http_status: plopRes.status })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[plop-withdraw] error:', message)
    return json({ status: false, message }, 503)
  }
})
