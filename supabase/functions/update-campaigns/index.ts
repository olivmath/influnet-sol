// Update Campaigns Oracle (Cronjob)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey } from "npm:@solana/web3.js@1.87.6";
import { AnchorProvider, Program, web3, Wallet } from "npm:@coral-xyz/anchor@0.29.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting campaign metrics update cronjob...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active campaigns from cache
    const { data: campaigns, error: campaignsError } = await supabaseClient
      .from('campaigns_cache')
      .select('*')
      .eq('status', 'Active');

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    console.log(`Found ${campaigns?.length || 0} active campaigns`);

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active campaigns to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const campaign of campaigns) {
      try {
        // Get user's Instagram token
        const { data: user, error: userError } = await supabaseClient
          .from('users')
          .select('instagram_access_token, instagram_user_id')
          .eq('wallet_address', campaign.influencer_wallet)
          .single();

        if (userError || !user?.instagram_access_token) {
          console.error(`No Instagram token for campaign ${campaign.campaign_pubkey}`);
          continue;
        }

        // Fetch Instagram metrics from Meta Graph API
        // This is a simplified example - you'll need to fetch posts and aggregate metrics
        const metricsResponse = await fetch(
          `https://graph.instagram.com/${user.instagram_user_id}/media?fields=like_count,comments_count,timestamp&access_token=${user.instagram_access_token}`
        );

        if (!metricsResponse.ok) {
          console.error(`Failed to fetch Instagram metrics for ${campaign.campaign_pubkey}`);
          continue;
        }

        const metricsData = await metricsResponse.json();

        // Aggregate metrics from posts
        let totalLikes = 0;
        let totalComments = 0;
        // TODO: Add views and shares calculation from Instagram API

        metricsData.data?.forEach((post: any) => {
          totalLikes += post.like_count || 0;
          totalComments += post.comments_count || 0;
        });

        // Update Solana smart contract
        const connection = new Connection(Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.devnet.solana.com');

        // Load oracle keypair from environment
        const oracleKeypair = Keypair.fromSecretKey(
          Uint8Array.from(JSON.parse(Deno.env.get('ORACLE_KEYPAIR_SECRET') ?? '[]'))
        );

        // TODO: Load program IDL and call update_campaign_metrics
        // This requires importing the IDL JSON and creating the Program instance

        console.log(`Updated campaign ${campaign.campaign_pubkey}: ${totalLikes} likes, ${totalComments} comments`);

        // Update cache
        await supabaseClient
          .from('campaigns_cache')
          .update({
            current_likes: totalLikes,
            current_comments: totalComments,
            last_metrics_update: new Date().toISOString(),
          })
          .eq('campaign_pubkey', campaign.campaign_pubkey);

        results.push({
          campaign_pubkey: campaign.campaign_pubkey,
          success: true,
          likes: totalLikes,
          comments: totalComments,
        });

      } catch (error) {
        console.error(`Error updating campaign ${campaign.campaign_pubkey}:`, error);
        results.push({
          campaign_pubkey: campaign.campaign_pubkey,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Campaign update completed',
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-campaigns function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
