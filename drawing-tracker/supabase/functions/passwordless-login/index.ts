// Supabase Edge Function: passwordless-login
//
// Per the spec, only the XA Admin / Site Engineer account is password
// protected (default "0000", forced change on first login). Draftsman,
// DAAA and GPI accounts need "no password required" — but they still need
// a real, RLS-respecting Supabase Auth session so the workflow RPCs can
// tell who is calling them.
//
// This function is the bridge: given a profile id for a non-admin account,
// it uses the service-role key (never exposed to the browser) to mint a
// one-time magic-link OTP and immediately redeems it server-side, then
// hands the resulting session tokens back to the client. The client just
// calls supabase.auth.setSession(...) with them. No password ever exists
// for these accounts, and none is ever sent over the wire.
//
// Deploy with:
//   supabase functions deploy passwordless-login
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase platform — no extra secrets to set.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { profile_id } = await req.json()
    if (!profile_id) {
      return json({ error: 'profile_id is required' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('id', profile_id)
      .single()

    if (profileError || !profile) {
      return json({ error: 'Account not found' }, 404)
    }
    if (profile.role === 'xa_admin') {
      return json({ error: 'XA Admin / Site Engineer accounts require a password' }, 403)
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    })
    if (linkError || !link) {
      return json({ error: linkError?.message ?? 'Could not start sign-in' }, 500)
    }

    const otp = link.properties?.email_otp
    if (!otp) {
      return json({ error: 'Could not generate a sign-in token' }, 500)
    }

    // Redeem the OTP server-side with an anon-key client so we get back a
    // real session (access + refresh token) without ever exposing the OTP.
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
      email: profile.email,
      token: otp,
      type: 'magiclink',
    })
    if (verifyError || !verified.session) {
      return json({ error: verifyError?.message ?? 'Sign-in failed' }, 500)
    }

    return json({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      full_name: profile.full_name,
      role: profile.role,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
