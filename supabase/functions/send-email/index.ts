// DALIGHT Email Service via Brevo.com (Sendinblue)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') || 'dalightbeauty15mai@gmail.com'
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') || 'DALIGHT Head Spa'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, isAdmin = false } = await req.json()

    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY not configured')
    }

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html')
    }

    // Brevo API endpoint
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
        subject: subject,
        htmlContent: html,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Brevo API error:', error)
      throw new Error(error.message || 'Failed to send email')
    }

    const data = await res.json()
    console.log('Email sent successfully via Brevo:', data)

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
