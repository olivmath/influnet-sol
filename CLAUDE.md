# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Influnest** is a decentralized influencer marketing platform built on Solana that connects influencers with brands for Instagram campaigns. The platform uses smart contracts for transparent, milestone-based payments in USDC.

### Tech Stack
- **Smart Contract**: Anchor Framework v0.32.1 (Solana)
- **Frontend**: Next.js 15 + Privy.io + Tailwind CSS
- **Backend/Oracle**: Supabase Edge Functions (Deno)
- **Database**: Supabase PostgreSQL
- **Payments**: USDC (SPL Token)
- **Metrics**: Meta Graph API (Instagram)

### Architecture

```
influnest-sol/
├── programs/influnest/       # Solana smart contract (Anchor)
├── frontend/                 # Next.js app with Privy auth
├── supabase/                 # Edge Functions + Migrations
│   ├── functions/            # Oracle and API endpoints
│   └── migrations/           # Database schema
└── tests/                    # Anchor integration tests
```

## Key Workflows

### 1. Campaign Creation Flow
1. Influencer logs in with Privy (embedded Solana wallet)
2. Connects Instagram via OAuth (stored in Supabase)
3. Creates campaign on-chain with targets (likes, comments, views, shares)
4. Shares campaign link with brand

### 2. Campaign Funding Flow
1. Brand accesses campaign link (no account needed initially)
2. Connects wallet via Privy
3. Approves and deposits USDC to campaign vault
4. Campaign status changes from Pending → Active

### 3. Metrics Update & Payment Flow (Automated)
1. Supabase Edge Function runs as cronjob (every 5 minutes)
2. Fetches active campaigns from database
3. Pulls Instagram metrics via Meta Graph API
4. Calls smart contract `update_campaign_metrics` instruction
5. **Smart contract automatically transfers USDC** proportional to progress
   - Progress calculated from target metrics
   - Milestones at every 10% (10 total milestones)
   - Payment is incremental (only pays difference since last update)

### 4. Campaign Completion
- When metrics hit 100%, campaign marked as Completed
- If deadline expires without reaching 100%, brand can withdraw remaining USDC

## Smart Contract Architecture

### Program ID
`8yyV2rKoiBMBsiXhnJ4d64gDASdeMtQL8GFh8mH9e2Vk`

### Key Instructions

1. **initialize_oracle** - Admin sets authorized oracle pubkey
2. **create_campaign** - Influencer creates campaign (Pending status)
   - Seeds: `["campaign", influencer_pubkey, created_at_timestamp]`
3. **fund_campaign** - Brand deposits USDC, activates campaign
4. **add_post** - Influencer adds Instagram post URLs to campaign
5. **update_campaign_metrics** - Oracle updates metrics & pays automatically
   - Validates oracle signature
   - Calculates progress % from metrics
   - Transfers USDC proportionally (milestone-based)
6. **withdraw_expired_stake** - Brand recovers USDC if deadline passed
7. **cancel_campaign** - Influencer cancels if still Pending

### Account Structures

**Campaign** (PDA):
- Influencer wallet, Brand wallet
- Name, description, amount (USDC), deadline
- Target metrics: likes, comments, views, shares
- Current metrics (updated by oracle)
- Status: Pending | Active | Completed | Cancelled | Expired
- Posts array (Instagram URLs)
- amount_paid (tracks milestone payments)

**OracleConfig** (Global PDA):
- Authority (admin)
- Oracle pubkey (authorized to update metrics)

**Vault** (Associated Token Account):
- Holds USDC for each campaign
- Authority: Campaign PDA

## Database Schema (Supabase)

### users
- wallet_address (PK)
- instagram_user_id
- instagram_access_token (long-lived, 60 days)
- instagram_username
- instagram_token_expires_at

### campaigns_cache (optional)
- campaign_pubkey
- influencer_wallet
- last_metrics_update
- current metrics (likes, comments, views, shares)
- status

## Common Commands

### Smart Contract

```bash
# Build program
anchor build

# Run tests (requires local validator)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Generate new program keypair
solana-keygen new -o target/deploy/influnest-keypair.json
```

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Environment setup
cp .env.example .env.local
# Then edit .env.local with Privy, Supabase, Instagram credentials
```

### Supabase

```bash
cd supabase

# Initialize Supabase locally (optional)
supabase init

# Run migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy instagram-oauth
supabase functions deploy get-instagram-status
supabase functions deploy update-campaigns

# Set secrets for Edge Functions
supabase secrets set INSTAGRAM_APP_ID=xxx
supabase secrets set ORACLE_KEYPAIR_SECRET=[1,2,3,...]
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_SIGNER_ID=
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_INFLUNEST_PROGRAM_ID=8yyV2rKoiBMBsiXhnJ4d64gDASdeMtQL8GFh8mH9e2Vk
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
NEXT_PUBLIC_INSTAGRAM_APP_ID=
```

### Supabase Edge Functions
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=
SOLANA_RPC_URL=https://api.devnet.solana.com
ORACLE_KEYPAIR_SECRET=[bytes array]
```

## Important Implementation Details

### Progress Calculation
Progress is the **average** of all target metrics that are > 0:
- If target_likes = 5000 and current = 2500 → 50% for likes
- Average across all defined targets (likes, comments, views, shares)
- Result: 0-100%

### Milestone Payment Logic
- 10 milestones total (0-10)
- Milestones achieved = floor(progress / 10)
- Amount per milestone = total_amount / 10
- Only pays **delta** since last update (prevents double-payment)

Example:
- Total stake: 1000 USDC
- Progress: 35% → 3 milestones
- Should have paid: 300 USDC
- Already paid: 100 USDC
- **Transfers now**: 200 USDC

### PDA Seeds
- **Campaign**: `["campaign", influencer_pubkey, created_at_i64]`
- **OracleConfig**: `["oracle-config"]`
- **Vault**: Associated Token Account of Campaign PDA

### Privy Integration
- Embedded wallets (users don't need external wallet)
- Transaction sponsorship (gasless UX) - configure in Privy Dashboard
- Social login (Google, email, etc.)
- Solana network support enabled

### Instagram OAuth Flow
1. Frontend redirects to Instagram OAuth
2. User authorizes app
3. Callback sends code to Supabase Edge Function
4. Edge Function exchanges for long-lived token (60 days)
5. Stores in database linked to wallet address

## Deployment Checklist

1. **Smart Contract** (Solana Devnet/Mainnet)
   - [ ] Generate program keypair
   - [ ] Update program ID in lib.rs and Anchor.toml
   - [ ] Deploy with `anchor deploy`
   - [ ] Initialize oracle with `initialize_oracle`

2. **Supabase**
   - [ ] Create project
   - [ ] Run migrations (`supabase db push`)
   - [ ] Deploy Edge Functions
   - [ ] Set environment secrets
   - [ ] Configure pg_cron for update-campaigns (5 min interval)

3. **Frontend** (Vercel)
   - [ ] Create Privy app at dashboard.privy.io
   - [ ] Enable Solana network + transaction sponsorship
   - [ ] Create Supabase project
   - [ ] Set environment variables in Vercel
   - [ ] Deploy via `vercel`

4. **Instagram/Meta**
   - [ ] Create app at developers.facebook.com
   - [ ] Add Instagram Basic Display + Instagram Graph API
   - [ ] Configure OAuth redirect URIs
   - [ ] Request permissions: instagram_basic, instagram_manage_insights

## Known Limitations & Future Improvements

### Phase 1 (Current - MVP)
- USDC payments only
- Devnet deployment
- Manual Instagram post tracking
- 10% milestone intervals

### Phase 2 (Planned)
- PIX on/off ramp (Brazil)
- Mainnet deployment
- Automatic post detection
- Custom milestone percentages
- Multi-platform support (TikTok, YouTube)

## Troubleshooting

### "Oracle unauthorized" error
- Verify oracle pubkey matches OracleConfig
- Check oracle keypair is correctly loaded in Edge Function

### Instagram token expired
- Tokens last 60 days
- Implement refresh flow in Edge Function
- Show warning in frontend when < 7 days remaining

### Campaign creation fails with "Clock not available"
- This is expected in tests - Clock::get() requires on-chain environment
- Use anchor test validator or devnet for testing

### USDC transfer fails
- Verify brand has sufficient USDC balance
- Check USDC mint address matches devnet/mainnet
- Ensure token account is initialized

## Resources

- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Privy Docs](https://docs.privy.io)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Meta Graph API](https://developers.facebook.com/docs/instagram-api/)
