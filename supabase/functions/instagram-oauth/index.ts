// Instagram OAuth Callback Handler
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, wallet_address } = await req.json();

    if (!code || !wallet_address) {
      return new Response(
        JSON.stringify({ error: 'Missing code or wallet_address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for access token via Meta Graph API
    const tokenResponse = await fetch(
      `https://api.instagram.com/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('INSTAGRAM_APP_ID')!,
          client_secret: Deno.env.get('INSTAGRAM_APP_SECRET')!,
          grant_type: 'authorization_code',
          redirect_uri: Deno.env.get('INSTAGRAM_REDIRECT_URI')!,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Instagram token exchange failed:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for token', details: errorData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, user_id } = tokenData;

    // Get long-lived token
    const longLivedTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${Deno.env.get('INSTAGRAM_APP_SECRET')}&access_token=${access_token}`
    );

    const longLivedData = await longLivedTokenResponse.json();
    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in; // 60 days

    // Get user profile
    const profileResponse = await fetch(
      `https://graph.instagram.com/${user_id}?fields=id,username&access_token=${longLivedToken}`
    );
    const profileData = await profileResponse.json();

    // Save to Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const { data, error } = await supabaseClient
      .from('users')
      .upsert({
        wallet_address,
        instagram_user_id: user_id,
        instagram_access_token: longLivedToken,
        instagram_username: profileData.username,
        instagram_token_expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'wallet_address'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save to database', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        instagram_username: profileData.username,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in instagram-oauth function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
