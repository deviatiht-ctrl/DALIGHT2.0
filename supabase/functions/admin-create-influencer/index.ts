// DALIGHT — Kreye kont influencer: auth user + pwofil (is_influencer) + lyen kòd promo.
// Admin bay email + modpas. Influencer konekte sou paj /pages/influencer.html.
// Sèvi ak SERVICE_ROLE_KEY (rete sou sèvè a). Sèlman admin ka rele li.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_EMAIL = 'laurorejeanclarens0@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Configuration serveur manquante')
    }

    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace('Bearer ', '')
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Verifye admin
    if (!callerToken) throw new Error('Non autorisé : token manquant')
    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(callerToken)
    if (callerErr || !callerData?.user) throw new Error('Non autorisé : session invalide')

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .maybeSingle()

    if (callerProfile?.role !== 'admin' && callerData.user.email !== ADMIN_EMAIL) {
      throw new Error('Non autorisé : accès admin requis')
    }

    const { email, password, full_name, phone, promo_code_id } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) throw new Error('Email influencer la requis')

    // Si kont la egziste deja, jis mak l influencer + lyen kòd la
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    let userId: string
    let alreadyExisted = false

    if (existingProfile) {
      userId = existingProfile.id
      alreadyExisted = true
      // Si admin bay modpas, mete l ajou
      if (password) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: String(password) })
      }
    } else {
      if (!password || String(password).length < 6) {
        throw new Error('Modpas la requis (omwen 6 karaktè) pou nouvo kont lan')
      }
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name: full_name || null, phone: phone || null },
      })
      if (createErr) throw createErr
      if (!created.user) throw new Error('Kreyasyon itilizatè a echwe')
      userId = created.user.id
    }

    // Mak pwofil la kòm influencer
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: normalizedEmail,
      full_name: full_name || null,
      phone: phone || null,
      role: 'user',
      is_influencer: true,
      updated_at: new Date().toISOString(),
    })
    if (profErr) throw profErr

    // Lyen kòd promo a ak influencer an (si yo bay id li)
    if (promo_code_id) {
      const { error: linkErr } = await supabaseAdmin
        .from('promo_codes')
        .update({
          owner_type: 'influencer',
          owner_email: normalizedEmail,
          owner_name: full_name || normalizedEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', promo_code_id)
      if (linkErr) throw linkErr
    }

    // Voye imèl ak idantifyan yo (pa bloke si li pa ale)
    if (!alreadyExisted && password) {
      try {
        const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#4A3728;">DALIGHT — Compte Influenceur</h2>
          <p>Bonjour ${full_name || ''},</p>
          <p>Votre compte influenceur DALIGHT est prêt. Voici vos identifiants :</p>
          <div style="background:#f9f7f5;border-left:4px solid #D4AF37;padding:16px;border-radius:8px;">
            <p><strong>Email :</strong> ${normalizedEmail}</p>
            <p><strong>Mot de passe :</strong> ${password}</p>
          </div>
          <p>Connectez-vous ici pour suivre vos commissions : <a href="https://dalightspa.com/pages/influencer.html">Espace Influenceur</a></p>
          <p style="color:#888;font-size:12px;">DALIGHT — Notification automatique</p></div>`
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
          body: JSON.stringify({ to: normalizedEmail, subject: 'DALIGHT — Votre compte influenceur', html }),
        })
      } catch (emailErr) {
        console.warn('Email identifiants non envoyé:', emailErr)
      }
    }

    return new Response(
      JSON.stringify({ success: true, alreadyExisted, userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('admin-create-influencer error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
