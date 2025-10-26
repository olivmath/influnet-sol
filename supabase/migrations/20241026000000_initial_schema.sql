-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    instagram_user_id TEXT,
    instagram_access_token TEXT,
    instagram_username TEXT,
    instagram_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create campaigns_cache table (optional caching)
CREATE TABLE IF NOT EXISTS campaigns_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_pubkey TEXT UNIQUE NOT NULL,
    influencer_wallet TEXT NOT NULL,
    instagram_username TEXT,
    last_metrics_update TIMESTAMPTZ,
    current_likes BIGINT DEFAULT 0,
    current_comments BIGINT DEFAULT 0,
    current_views BIGINT DEFAULT 0,
    current_shares BIGINT DEFAULT 0,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_instagram ON users(instagram_user_id);
CREATE INDEX idx_campaigns_pubkey ON campaigns_cache(campaign_pubkey);
CREATE INDEX idx_campaigns_influencer ON campaigns_cache(influencer_wallet);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON campaigns_cache
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data"
ON users FOR SELECT
USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert their own data"
ON users FOR INSERT
WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update their own data"
ON users FOR UPDATE
USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Create policies for campaigns_cache (public read, service role write)
CREATE POLICY "Anyone can view campaigns"
ON campaigns_cache FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Service role can manage campaigns"
ON campaigns_cache FOR ALL
TO service_role
USING (true);
