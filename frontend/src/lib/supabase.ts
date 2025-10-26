import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export type User = {
  id: string;
  wallet_address: string;
  instagram_user_id?: string;
  instagram_access_token?: string;
  instagram_username?: string;
  instagram_token_expires_at?: string;
  created_at: string;
  updated_at: string;
};

export type CampaignCache = {
  id: string;
  campaign_pubkey: string;
  influencer_wallet: string;
  instagram_username?: string;
  last_metrics_update?: string;
  current_likes: number;
  current_comments: number;
  current_views: number;
  current_shares: number;
  status?: string;
  created_at: string;
  updated_at: string;
};
