# Influnest Frontend

Frontend application for Influnest - an influencer marketing campaign platform built on Solana.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Authentication**: Privy.io (Solana embedded wallets)
- **Blockchain**: Solana (Anchor)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (package manager)
- Privy account ([dashboard.privy.io](https://dashboard.privy.io))
- Supabase project ([supabase.com](https://supabase.com))

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your credentials:
   - Privy App ID and Signer ID from Privy Dashboard
   - Supabase URL and Anon Key from Supabase Project Settings
   - Instagram App ID from Meta Developer Console

4. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── page.tsx      # Landing page
│   │   ├── dashboard/    # Influencer dashboard
│   │   ├── campaign/     # Campaign pages
│   │   └── settings/     # User settings (Instagram connect)
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and configurations
│   │   ├── anchor/       # Anchor program instance
│   │   └── supabase/     # Supabase client
│   └── types/            # TypeScript types
├── public/               # Static assets
└── package.json
```

## Key Features

- **Privy Auth**: Embedded Solana wallets with social login
- **Campaign Management**: Create and track marketing campaigns
- **Instagram Integration**: Connect Instagram for metrics tracking
- **USDC Payments**: Automatic milestone-based payments
- **Real-time Updates**: Campaign metrics via Supabase

## Development

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Learn More

- [Privy Documentation](https://docs.privy.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Anchor Documentation](https://www.anchor-lang.com/)
