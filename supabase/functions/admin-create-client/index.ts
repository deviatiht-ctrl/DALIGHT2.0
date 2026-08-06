// DALIGHT — Kreye kont + modpas pou yon kliyan ki poko genyen youn,
// pou admin ka kreye yon reservation manyèlman pou li.
// Sèvi ak SERVICE_ROLE_KEY (rete sou sèvè a, pa janm ekspoze bay kliyan).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Configuration serveur manquante (SUPABASE_URL / SERVICE_ROLE_KEY)')
    }

    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace('Bearer ', '')
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Verifye moun ki rele a se yon admin
    if (!callerToken) throw new Error('Non autorisé : token manquant')
    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(callerToken)
    if (callerErr || !callerData?.user) throw new Error('Non autorisé : session invalide')

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .maybeSingle()

    const isAdminEmail = callerData.user.email === 'laurorejeanclarens0@gmail.com'
    if (callerProfile?.role !== 'admin' && !isAdminEmail) {
      throw new Error('Non autorisé : accès admin requis')
    }

    // 2. Data kliyan
    const { email, full_name, phone } = await req.json()
    if (!email || !full_name) throw new Error('Email et nom du client requis')
    const normalizedEmail = String(email).trim().toLowerCase()

    // 3. Si kont deja egziste, retounen li san kreye yon lòt
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: true, alreadyExisted: true, profile: existingProfile }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Kreye nouvo kont auth ak modpas jenere otomatikman
    const password = generatePassword(10)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone || null },
    })
    if (createErr) throw createErr

    const newUser = created.user
    if (!newUser) throw new Error('Kreyasyon itilizatè a echwe')

    // 5. Kreye/Mete ajou pwofil la
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: newUser.id,
      email: normalizedEmail,
      full_name,
      phone: phone || null,
      role: 'user',
    })
    if (profileErr) throw profileErr

    // 6. Voye modpas la bay kliyan pa imèl (rezye send-email edge function nan)
    try {
      const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#4A3728;">Bienvenue chez DALIGHT</h2>
        <p>Bonjour ${full_name},</p>
        <p>Un compte a été créé pour vous afin de suivre votre réservation. Voici vos identifiants de connexion :</p>
        <div style="background:#f9f7f5;border-left:4px solid #D4AF37;padding:16px;border-radius:8px;">
          <p><strong>Email :</strong> ${normalizedEmail}</p>
          <p><strong>Mot de passe :</strong> ${password}</p>
        </div>
        <p>Connectez-vous sur notre site pour voir votre réservation. Nous vous recommandons de changer votre mot de passe après votre première connexion.</p>
        <p style="color:#888;font-size:12px;">DALIGHT — Notification automatique</p></div>`

      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
        body: JSON.stringify({ to: normalizedEmail, subject: 'Bienvenue chez DALIGHT — Vos identifiants', html }),
      })
    } catch (emailErr) {
      console.warn('Email identifiants non envoyé:', emailErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        alreadyExisted: false,
        profile: { id: newUser.id, email: normalizedEmail, full_name, phone: phone || null },
        generatedPassword: password,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('admin-create-client error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
