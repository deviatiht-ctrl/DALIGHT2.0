// Follow this setup guide to integrate the Deno runtime into your workflow:
// https://deno.land/manual@v1.40.0/runtime/program_lifecycle

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, isAdmin } = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html')
    }

    // Send email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DALIGHT Head Spa <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: html,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Resend API error:', error)
      throw new Error(error.message || 'Failed to send email')
    }

    const data = await res.json()
    console.log('Email sent successfully:', data)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: data,
        message: 'Email sent successfully'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
