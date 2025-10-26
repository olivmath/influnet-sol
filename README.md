# Influnest

> Decentralized influencer marketing platform on Solana with automated milestone-based payments

Influnest connects influencers with brands for transparent, blockchain-verified Instagram marketing campaigns. Smart contracts ensure automatic payment distribution based on real engagement metrics.

## 🎯 Features

- **🔐 Privy Authentication** - Embedded Solana wallets with social login (no wallet installation needed)
- **💰 USDC Payments** - Transparent, milestone-based payments (10% increments)
- **📊 Instagram Integration** - Automated metrics tracking via Meta Graph API
- **⛓️ Solana Smart Contracts** - Trustless campaign management with Anchor
- **🤖 Oracle Automation** - Supabase Edge Functions update metrics every 5 minutes
- **🚀 Gasless Transactions** - Privy sponsors transaction fees for smooth UX

## 📁 Project Structure

```
influnest-sol/
├── programs/influnest/       # Anchor smart contract
│   ├── src/lib.rs           # Campaign logic, payment automation
│   └── Cargo.toml
├── frontend/                 # Next.js 15 + Privy
│   ├── src/app/             # App router pages
│   ├── package.json
│   └── .env.example
├── supabase/                # Backend & Oracle
│   ├── functions/           # Edge Functions (Deno)
│   │   ├── instagram-oauth/ # OAuth handler
│   │   ├── get-instagram-status/
│   │   └── update-campaigns/ # Cronjob oracle
│   ├── migrations/          # PostgreSQL schema
│   └── config.toml
├── tests/                   # Anchor integration tests
└── CLAUDE.md               # Complete architecture docs
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **Rust** 1.89.0 (via rust-toolchain.toml)
- **Anchor CLI** 0.32.1
- **Solana CLI** 1.18+
- **pnpm** package manager

### 1. Install Dependencies

```bash
# Install Anchor dependencies
yarn install

# Install frontend dependencies
cd frontend && pnpm install
```

### 2. Build Smart Contract

```bash
anchor build
```

### 3. Run Tests

```bash
anchor test
```

### 4. Setup Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your Privy and Supabase credentials
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

### Smart Contract Flow

1. **Create Campaign** - Influencer sets targets (likes, comments, views, shares) and USDC amount
2. **Fund Campaign** - Brand deposits USDC to vault, campaign activates
3. **Add Posts** - Influencer links Instagram posts to campaign
4. **Oracle Updates** - Supabase Edge Function fetches metrics → updates blockchain
5. **Auto-Payment** - Smart contract calculates progress → transfers USDC proportionally
6. **Completion** - 100% progress = campaign completed, or deadline expires

### Payment Logic

- **Milestones**: Every 10% progress (10 total milestones)
- **Calculation**: Average progress across all target metrics
- **Incremental**: Only pays difference since last update

Example:
- Campaign: 1000 USDC, targets 5000 likes
- Update 1: 2500 likes (50%) → Pay 500 USDC (5 milestones)
- Update 2: 3500 likes (70%) → Pay 200 USDC (2 more milestones)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Anchor 0.32.1 (Rust) |
| Frontend | Next.js 15 + Privy.io |
| Database | Supabase PostgreSQL |
| Oracle | Supabase Edge Functions (Deno) |
| Auth | Privy embedded wallets |
| Payments | USDC (SPL Token) |
| Metrics | Meta Graph API |
| Deployment | Vercel (Frontend) + Solana Devnet |

## 📚 Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation including:
- Detailed workflows
- Smart contract instructions
- Database schema
- Deployment checklist
- Troubleshooting guide

## 🔑 Environment Variables

### Frontend

```env
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

```env
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
SOLANA_RPC_URL=https://api.devnet.solana.com
ORACLE_KEYPAIR_SECRET=[1,2,3,...]
```

## 🛠️ Development

```bash
# Build smart contract
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run frontend
cd frontend && pnpm dev

# Deploy Supabase functions
cd supabase
supabase functions deploy update-campaigns
```

## 🚢 Deployment

1. **Smart Contract** → Solana Devnet/Mainnet
2. **Frontend** → Vercel
3. **Database & Functions** → Supabase
4. **Oracle** → Supabase pg_cron (5 min interval)

See [deployment checklist](./CLAUDE.md#deployment-checklist) for details.

## 🗺️ Roadmap

### Phase 1 (MVP) ✅
- [x] Anchor smart contract with USDC payments
- [x] Privy authentication
- [x] Instagram OAuth integration
- [x] Automated oracle updates
- [x] Milestone-based payments

### Phase 2 (Planned)
- [ ] PIX on/off ramp (Brazil)
- [ ] Mainnet deployment
- [ ] Custom milestone percentages
- [ ] Multi-platform (TikTok, YouTube)
- [ ] Campaign analytics dashboard

## 📄 License

ISC

## 🤝 Contributing

This is a proof-of-concept project. For production use, conduct thorough security audits.

## 📞 Support

- [Privy Documentation](https://docs.privy.io)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)

---

Built with ❤️ on Solana
