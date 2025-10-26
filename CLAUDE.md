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
├── programs/influnest/           # Solana smart contract (Anchor)
│   ├── src/lib.rs               # 540 lines - Complete implementation
│   └── Cargo.toml
├── frontend/                     # Next.js app with Privy auth
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Landing page (Privy starter)
│   │   │   ├── dashboard/       # Influencer dashboard
│   │   │   │   └── page.tsx     # Campaign list view
│   │   │   ├── campaign/
│   │   │   │   ├── new/         # Create campaign form
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/        # Campaign details + funding
│   │   │   │       └── page.tsx
│   │   │   └── settings/        # (To implement: Instagram OAuth)
│   │   └── lib/
│   │       ├── anchor.ts        # Program helpers & PDAs
│   │       ├── supabase.ts      # Database client & types
│   │       └── idl.json         # Program interface (placeholder)
│   ├── package.json
│   └── .env.example
├── supabase/
│   ├── functions/               # Edge Functions (Oracle)
│   │   ├── instagram-oauth/index.ts
│   │   ├── get-instagram-status/index.ts
│   │   └── update-campaigns/index.ts
│   ├── migrations/
│   │   └── 20241026000000_initial_schema.sql
│   ├── config.toml
│   └── .env.example
├── tests/
│   └── influnest.ts            # Complete integration tests
├── CLAUDE.md                   # This file
├── TESTING.md                  # Step-by-step testing guide
├── README.md                   # Project overview
├── Anchor.toml
└── Cargo.toml
```

## Implementation Status

### ✅ Completed

**Smart Contract (programs/influnest/src/lib.rs)**
- ✅ All 8 instructions fully implemented
- ✅ SPL Token integration (USDC)
- ✅ Automatic proportional payments
- ✅ PDA-based campaign management
- ✅ Oracle validation
- ✅ Comprehensive error handling
- ✅ Complete test suite

**Frontend (Next.js)**
- ✅ Privy authentication integration
- ✅ Dashboard page (`/dashboard`)
- ✅ Create campaign page (`/campaign/new`)
- ✅ Campaign detail page (`/campaign/[id]`)
- ✅ Anchor program integration (`lib/anchor.ts`)
- ✅ Supabase client (`lib/supabase.ts`)
- ✅ Responsive UI with Tailwind

**Backend/Oracle (Supabase)**
- ✅ Database migrations (users, campaigns_cache)
- ✅ Edge Function: instagram-oauth
- ✅ Edge Function: get-instagram-status
- ✅ Edge Function: update-campaigns (oracle)

**Testing & Documentation**
- ✅ Anchor integration tests
- ✅ Complete CLAUDE.md
- ✅ TESTING.md guide
- ✅ README.md

### ⏳ To Implement (for full MVP)

- ⏳ Settings page with Instagram OAuth UI
- ⏳ Deploy Edge Functions to Supabase
- ⏳ Configure pg_cron for oracle cronjob
- ⏳ Generate real IDL from built program
- ⏳ Add post management UI
- ⏳ Campaign metrics visualization

## Key Workflows

### 1. Campaign Creation Flow
1. Influencer logs in with Privy (embedded Solana wallet created automatically)
2. *(Optional)* Connects Instagram via OAuth in `/settings`
3. Goes to `/campaign/new` and fills form
4. Frontend calls `create_campaign` instruction
5. Campaign created on-chain with status **Pending**
6. Campaign link generated: `/campaign/[pubkey]`

### 2. Campaign Funding Flow
1. Brand receives campaign link from influencer
2. Opens link (can be unauthenticated initially)
3. Sees campaign details on `/campaign/[id]`
4. Connects wallet via Privy
5. Clicks "Fund X USDC" button
6. Frontend calls `fund_campaign` instruction
7. USDC transferred from brand → vault
8. Campaign status changes: **Pending → Active**

### 3. Metrics Update & Payment Flow (Automated)
1. Supabase Edge Function `update-campaigns` runs via pg_cron (every 5 min)
2. Queries database for active campaigns
3. For each campaign:
   - Fetches Instagram metrics via Meta Graph API
   - Calculates progress from current vs target metrics
   - Calls `update_campaign_metrics` instruction with oracle signature
4. **Smart contract automatically transfers USDC** proportional to progress:
   - Progress calculated from target metrics
   - Milestones at every 10% (10 total milestones)
   - Payment is incremental (only pays difference since last update)
5. Campaign marked **Completed** when progress reaches 100%

### 4. Campaign Completion
- When metrics hit 100%, campaign status → **Completed**
- If deadline expires without reaching 100%, brand can call `withdraw_expired_stake`
- Remaining USDC returned to brand

## Smart Contract Architecture

### Program ID
Default: `8yyV2rKoiBMBsiXhnJ4d64gDASdeMtQL8GFh8mH9e2Vk`

**Important**: This ID must be updated after deploying:
1. Deploy program: `anchor deploy`
2. Get new program ID: `solana address -k target/deploy/influnest-keypair.json`
3. Update `declare_id!()` in lib.rs
4. Update `influnest =` in Anchor.toml
5. Update `NEXT_PUBLIC_INFLUNEST_PROGRAM_ID` in frontend/.env.local
6. Rebuild: `anchor build`

### Key Instructions

1. **initialize_oracle** - Admin sets authorized oracle pubkey
   - Accounts: OracleConfig (PDA), Authority (signer)
   - Creates global oracle configuration

2. **create_campaign** - Influencer creates campaign
   - Seeds: `["campaign", influencer_pubkey, created_at_i64]`
   - Status: Pending
   - Stores: name, description, targets, deadline, Instagram username

3. **fund_campaign** - Brand deposits USDC, activates campaign
   - Transfers USDC from brand → vault (ATA of campaign PDA)
   - Status: Pending → Active
   - Records brand wallet

4. **add_post** - Influencer adds Instagram post URLs
   - Requires: Campaign Active, influencer signature
   - Stores: post_id, post_url, added_at
   - Max 50 posts per campaign

5. **update_campaign_metrics** - Oracle updates metrics & pays automatically
   - Validates oracle signature against OracleConfig
   - Updates: current_likes, current_comments, current_views, current_shares
   - Calculates progress % (average of all target metrics)
   - Calculates milestones achieved (progress / 10)
   - **Automatically transfers** USDC proportional to milestones
   - Marks Completed if progress >= 100%

6. **withdraw_expired_stake** - Brand recovers USDC after deadline
   - Requires: deadline passed, brand signature
   - Transfers remaining USDC from vault → brand
   - Status: Active → Expired

7. **cancel_campaign** - Influencer cancels before funding
   - Requires: Status Pending, influencer signature
   - Status: Pending → Cancelled

8. **update_oracle** - Admin updates oracle pubkey
   - Requires: authority signature
   - Updates OracleConfig.oracle

### Account Structures

**Campaign** (PDA):
```rust
pub struct Campaign {
    pub influencer: Pubkey,
    pub brand: Pubkey,
    pub name: String,           // max 100 chars
    pub description: String,    // max 500 chars
    pub amount_usdc: u64,       // in lamports (6 decimals)
    pub amount_paid: u64,       // tracks cumulative payments
    pub target_likes: u64,
    pub target_comments: u64,
    pub target_views: u64,
    pub target_shares: u64,
    pub current_likes: u64,     // updated by oracle
    pub current_comments: u64,
    pub current_views: u64,
    pub current_shares: u64,
    pub deadline_ts: i64,       // Unix timestamp
    pub instagram_username: String, // max 50 chars
    pub status: CampaignStatus,
    pub created_at: i64,
    pub posts: Vec<Post>,       // max 50 posts
    pub bump: u8,
}
```

**OracleConfig** (Global PDA):
```rust
pub struct OracleConfig {
    pub authority: Pubkey,  // can update oracle
    pub oracle: Pubkey,     // authorized to update metrics
    pub bump: u8,
}
```

**Post**:
```rust
pub struct Post {
    pub post_id: String,    // max 100 chars
    pub post_url: String,   // max 200 chars
    pub added_at: i64,
}
```

**CampaignStatus** (Enum):
- `Pending` - Created, awaiting funding
- `Active` - Funded, running
- `Completed` - Reached 100% progress
- `Cancelled` - Cancelled before funding
- `Expired` - Deadline passed

**Vault** (Associated Token Account):
- Token: USDC
- Authority: Campaign PDA
- Holds campaign funds

## Frontend Implementation

### Pages

**`/` (Landing)**
- Privy starter template
- Login button
- Shows wallet creation flow

**`/dashboard`**
- Protected route (requires authentication)
- Lists influencer's campaigns
- "New Campaign" button
- Shows campaign cards with status badges

**`/campaign/new`**
- Form with fields:
  - Name, Description
  - Instagram username
  - Amount (USDC), Deadline (days)
  - Target metrics (likes, comments, views, shares)
- Calls `program.methods.createCampaign()`
- Redirects to campaign detail on success

**`/campaign/[id]`**
- Public page (can view without login)
- Shows campaign details, metrics, progress bar
- If Pending: Shows "Fund" button for brands
- If Active: Shows current metrics vs targets
- Share link with copy button
- Handles `fund_campaign` transaction

### Key Libraries

**`lib/anchor.ts`**
```typescript
// Exports
export const PROGRAM_ID: PublicKey
export const USDC_MINT: PublicKey
export const RPC_URL: string

export function getConnection(): Connection
export function getProgram(wallet): Program
export function getOracleConfigPDA(): PublicKey
export function getCampaignPDA(influencer, createdAt): PublicKey
export function getVaultTokenAccount(campaignPDA): Promise<PublicKey>
```

**`lib/supabase.ts`**
```typescript
export const supabase: SupabaseClient
export type User = { ... }
export type CampaignCache = { ... }
```

**`lib/idl.json`**
- Placeholder IDL for development
- **Must be replaced** with actual IDL after `anchor build`
- Generated IDL location: `target/idl/influnest.json`

### Getting Real IDL

After deploying the program:
```bash
anchor build
cp target/idl/influnest.json frontend/src/lib/idl.json
```

## Database Schema (Supabase)

### users
```sql
- id: UUID (PK)
- wallet_address: TEXT UNIQUE (Solana wallet)
- instagram_user_id: TEXT
- instagram_access_token: TEXT (long-lived, 60 days)
- instagram_username: TEXT
- instagram_token_expires_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### campaigns_cache (optional)
```sql
- id: UUID (PK)
- campaign_pubkey: TEXT UNIQUE (Solana campaign address)
- influencer_wallet: TEXT
- instagram_username: TEXT
- last_metrics_update: TIMESTAMPTZ
- current_likes: BIGINT
- current_comments: BIGINT
- current_views: BIGINT
- current_shares: BIGINT
- status: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## Common Commands

### Smart Contract

```bash
# Build program
anchor build

# Run tests (local validator + tests)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Get program ID
solana address -k target/deploy/influnest-keypair.json

# Generate new program keypair (if needed)
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

# Start production server
pnpm start

# Environment setup
cp .env.example .env.local
# Then edit .env.local with your credentials
```

### Supabase

```bash
# Initialize Supabase CLI
npx supabase login

# Link to project
npx supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
npx supabase db push

# Or manually copy SQL from migrations/ to Supabase SQL Editor

# Deploy Edge Functions
npx supabase functions deploy instagram-oauth
npx supabase functions deploy get-instagram-status
npx supabase functions deploy update-campaigns

# Set secrets for Edge Functions
npx supabase secrets set INSTAGRAM_APP_ID=xxx
npx supabase secrets set INSTAGRAM_APP_SECRET=xxx
npx supabase secrets set ORACLE_KEYPAIR_SECRET=[1,2,3,...]
```

## Environment Variables

### Frontend (.env.local)
```env
# Privy (Required)
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_PRIVY_SIGNER_ID=your-signer-id

# Solana (Required)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_INFLUNEST_PROGRAM_ID=8yyV2rKoiBMBsiXhnJ4d64gDASdeMtQL8GFh8mH9e2Vk

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# USDC (Devnet mint address)
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Instagram (Optional for now)
NEXT_PUBLIC_INSTAGRAM_APP_ID=your-instagram-app-id
NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI=http://localhost:3000/settings
```

### Supabase Edge Functions (.env)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

INSTAGRAM_APP_ID=your-instagram-app-id
INSTAGRAM_APP_SECRET=your-instagram-app-secret
INSTAGRAM_REDIRECT_URI=https://your-domain.com/api/instagram/callback

SOLANA_RPC_URL=https://api.devnet.solana.com
ORACLE_KEYPAIR_SECRET=[1,2,3,...]  # Array of bytes from oracle keypair
```

## Important Implementation Details

### Progress Calculation
Progress is the **average** of all target metrics that are > 0:
```rust
// Example calculation in lib.rs:273-290
if target_likes > 0 {
    likes_progress = (current_likes / target_likes) * 100
    progress_sum += likes_progress
    metrics_count += 1
}
// ... repeat for comments, views, shares
average_progress = progress_sum / metrics_count
```

Result: 0-100%

### Milestone Payment Logic
Located in `update_campaign_metrics` (lib.rs:111-184):

```rust
// Calculate milestones (0-10)
let milestones_achieved = progress / 10;

// Amount that should have been paid total
let total_should_be_paid = (amount_usdc * milestones_achieved) / 10;

// Only pay the difference
let amount_to_transfer = total_should_be_paid - amount_paid;

if amount_to_transfer > 0 {
    // Transfer USDC from vault to influencer
    token::transfer(ctx, amount_to_transfer)?;
    campaign.amount_paid += amount_to_transfer;
}
```

Example:
- Total stake: 1000 USDC
- Progress: 35% → 3 milestones
- Should have paid: 300 USDC (3 × 100)
- Already paid: 100 USDC (from previous update)
- **Transfers now**: 200 USDC

### PDA Seeds
- **Campaign**: `["campaign", influencer_pubkey, created_at_i64_bytes]`
- **OracleConfig**: `["oracle-config"]`
- **Vault**: Associated Token Account of Campaign PDA with USDC mint

### Privy Integration
- **Embedded wallets**: Users don't need Phantom/Solflare
- **Social login**: Google, Email, Twitter, etc.
- **Transaction sponsorship**: Enable in Privy Dashboard for gasless UX
- **Solana support**: Must enable Solana network in Privy settings

Configuration in `src/providers/providers.tsx`:
```typescript
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
  config={{
    supportedChains: [solanaDevnet],
    embeddedWallets: {
      createOnLogin: 'all-users',
    },
  }}
>
```

### Instagram OAuth Flow
1. User clicks "Connect Instagram" in `/settings`
2. Frontend redirects to Instagram OAuth URL
3. User authorizes app on Instagram
4. Instagram redirects back with `code` parameter
5. Frontend sends code to Supabase Edge Function `/instagram-oauth`
6. Edge Function exchanges code for long-lived token (60 days)
7. Stores token in `users` table linked to wallet_address
8. Frontend shows success + Instagram username

## Testing Guide

See **[TESTING.md](./TESTING.md)** for complete step-by-step testing instructions.

Quick test flow:
1. Deploy smart contract to devnet
2. Configure Privy app
3. Setup Supabase database
4. Run frontend locally
5. Create campaign as influencer
6. Fund campaign as brand (requires devnet USDC)

## Deployment Checklist

### 1. Smart Contract (Solana Devnet/Mainnet)
- [ ] Build: `anchor build`
- [ ] Deploy: `anchor deploy --provider.cluster devnet`
- [ ] Get program ID: `solana address -k target/deploy/influnest-keypair.json`
- [ ] Update program ID in lib.rs and Anchor.toml
- [ ] Rebuild: `anchor build`
- [ ] Copy IDL: `cp target/idl/influnest.json frontend/src/lib/idl.json`
- [ ] Initialize oracle: Call `initialize_oracle` instruction
- [ ] Fund oracle wallet with SOL for gas

### 2. Supabase
- [ ] Create project at supabase.com
- [ ] Run migrations (copy SQL to SQL Editor or use CLI)
- [ ] Deploy Edge Functions:
  - `npx supabase functions deploy instagram-oauth`
  - `npx supabase functions deploy get-instagram-status`
  - `npx supabase functions deploy update-campaigns`
- [ ] Set environment secrets via CLI or Dashboard
- [ ] Configure pg_cron for update-campaigns (5 min interval)
- [ ] Test Edge Functions via Supabase Dashboard

### 3. Frontend (Vercel)
- [ ] Create Privy app at dashboard.privy.io
- [ ] Enable Solana Devnet network
- [ ] (Optional) Enable transaction sponsorship
- [ ] Copy Privy App ID and Signer ID
- [ ] Create Supabase project (from step 2)
- [ ] Copy Supabase URL and anon key
- [ ] Set all environment variables in Vercel
- [ ] Deploy: `vercel` or connect GitHub repo
- [ ] Test production deployment

### 4. Instagram/Meta (Optional for MVP)
- [ ] Create app at developers.facebook.com
- [ ] Add Instagram Basic Display product
- [ ] Add Instagram Graph API product
- [ ] Configure OAuth redirect URIs
- [ ] Request permissions: `instagram_basic`, `instagram_manage_insights`
- [ ] Get App ID and App Secret
- [ ] Test OAuth flow in production

## Known Limitations & Future Improvements

### Phase 1 (Current - MVP)
- ✅ USDC payments on Solana
- ✅ Devnet deployment
- ✅ Manual Instagram post tracking (via add_post)
- ✅ 10% milestone intervals (fixed)
- ⏳ Oracle needs deployment
- ⏳ Instagram OAuth UI not implemented

### Phase 2 (Planned)
- PIX on/off ramp for Brazil
- Mainnet deployment
- Automatic post detection (webhook from Instagram)
- Custom milestone percentages
- Multi-platform support (TikTok, YouTube, Twitter)
- Campaign analytics dashboard
- Dispute resolution mechanism
- Multi-sig brand wallets
- Campaign templates

## Troubleshooting

### Smart Contract Issues

**"Program error: Invalid account data"**
- Program ID mismatch between deployment and code
- Solution: Update `declare_id!()` in lib.rs and rebuild

**"Clock not available" in tests**
- `Clock::get()` requires on-chain environment
- Solution: Use `anchor test` (starts local validator) or deploy to devnet

**"Oracle unauthorized"**
- Oracle pubkey doesn't match OracleConfig
- Solution: Verify oracle initialization and keypair

### Frontend Issues

**"Transaction simulation failed"**
- Insufficient SOL for gas
- Program ID incorrect
- Account not initialized
- Solution: Check wallet balance, verify .env.local

**"Failed to fetch campaign"**
- Campaign doesn't exist on-chain
- Wrong network (mainnet vs devnet)
- Solution: Verify campaign was created, check RPC URL

**Privy not loading**
- Missing or invalid App ID/Signer ID
- Solana network not enabled
- Solution: Check Privy Dashboard settings

### USDC Issues

**"Insufficient funds"**
- Brand doesn't have USDC
- Solution: Get devnet USDC from faucet (see TESTING.md)

**"Token account not initialized"**
- USDC account doesn't exist for user
- Solution: Create associated token account first

### Instagram OAuth Issues

**"Invalid redirect URI"**
- Redirect URI not configured in Meta app
- Solution: Add redirect URI in Meta Developer Console

**"Token expired"**
- Instagram tokens last 60 days
- Solution: Implement token refresh in Edge Function

## Performance Considerations

- Campaign PDAs are deterministic (can be derived client-side)
- Vault token accounts created on-demand (`init_if_needed`)
- Oracle updates batched (processes all campaigns in one cronjob)
- Frontend uses Supabase for caching (reduces RPC calls)
- Privy handles transaction retries automatically

## Security Notes

- Oracle validation prevents unauthorized metric updates
- Campaign PDA ensures unique campaigns per influencer+timestamp
- Vault authority = Campaign PDA (only contract can transfer)
- Brand signature required for funding
- Influencer signature required for campaign creation/management
- Deadline enforcement prevents indefinite campaigns

## Resources

- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Privy Docs](https://docs.privy.io)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Meta Graph API](https://developers.facebook.com/docs/instagram-api/)
- [SPL Token Program](https://spl.solana.com/token)
- [Testing Guide](./TESTING.md)
