// DALIGHT — Admin jere kliyan: modifye (non, email, telefòn) oswa siprime kont lan.
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

    // Verifye moun ki rele a se yon admin
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

    const { action, id, full_name, email, phone } = await req.json()
    if (!id) throw new Error('ID kliyan an requis')

    // Pa janm siprime/modifye kont admin prensipal la
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', id)
      .maybeSingle()
    if (target?.email === ADMIN_EMAIL || target?.role === 'admin') {
      throw new Error('Ou pa ka modifye/siprime yon kont administratè')
    }

    if (action === 'update') {
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null

      // Mete ajou auth user la (email login + metadata)
      const authPayload: Record<string, unknown> = {}
      if (normalizedEmail) authPayload.email = normalizedEmail
      if (full_name || phone) {
        authPayload.user_metadata = { full_name: full_name || '', phone: phone || null }
      }
      if (Object.keys(authPayload).length) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, authPayload)
        if (authErr) throw authErr
      }

      // Mete ajou pwofil la
      const profilePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (full_name !== undefined) profilePayload.full_name = full_name
      if (normalizedEmail) profilePayload.email = normalizedEmail
      if (phone !== undefined) profilePayload.phone = phone || null

      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .update(profilePayload)
        .eq('id', id)
      if (profErr) throw profErr

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete') {
      // Siprime kont auth lan — CASCADE siprime pwofil la tou
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(id)
      if (delErr) throw delErr

      // Sekou: efase pwofil la si trigger la pa t fè l
      await supabaseAdmin.from('profiles').delete().eq('id', id)

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Action enkoni: ' + action)
  } catch (error) {
    console.error('admin-manage-client error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
