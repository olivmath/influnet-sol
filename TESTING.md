# 🧪 Guia de Teste - Influnest

Este guia mostra como testar o Influnest localmente do zero.

## 📋 Pré-requisitos

- Solana CLI instalado
- Anchor CLI 0.32.1 instalado
- Node.js 20+ e pnpm
- Conta Privy (gratuita em dashboard.privy.io)
- Conta Supabase (gratuita em supabase.com)

## 🚀 Setup Rápido

### 1. Criar Contas Necessárias

#### Privy
1. Acesse [dashboard.privy.io](https://dashboard.privy.io)
2. Crie um novo app
3. Em **Settings → Basics**, copie:
   - `App ID`
   - Crie um **Embedded Signer** e copie o `Signer ID`
4. Em **Settings → Networks**, habilite **Solana Devnet**
5. (Opcional) Em **Settings → Transaction Sponsorship**, habilite para gasless UX

#### Supabase
1. Acesse [supabase.com](https://supabase.com/dashboard)
2. Crie um novo projeto
3. Em **Settings → API**, copie:
   - `Project URL`
   - `anon/public key`
4. Aguarde o banco inicializar (~2 minutos)

### 2. Smart Contract (Anchor)

```bash
# Build o programa
anchor build

# Obter program ID
solana address -k target/deploy/influnest-keypair.json

# Atualizar program ID em lib.rs e Anchor.toml
# declare_id!("SEU_PROGRAM_ID_AQUI")
# influnest = "SEU_PROGRAM_ID_AQUI"

# Rebuild após atualizar IDs
anchor build

# Deploy no devnet
anchor deploy --provider.cluster devnet

# (Opcional) Rodar testes localmente
anchor test
```

### 3. Supabase (Database)

```bash
cd supabase

# Rodar migrations no projeto Supabase
# Copie o conteúdo de migrations/20241026000000_initial_schema.sql
# Cole no SQL Editor do Supabase Dashboard e execute
```

Ou via CLI:
```bash
# Login
npx supabase login

# Link ao projeto
npx supabase link --project-ref SEU_PROJECT_REF

# Push migrations
npx supabase db push
```

### 4. Frontend (Next.js)

```bash
cd frontend

# Instalar dependências
pnpm install

# Copiar .env
cp .env.example .env.local
```

Editar `.env.local`:
```env
# Privy (obrigatório)
NEXT_PUBLIC_PRIVY_APP_ID=seu-privy-app-id
NEXT_PUBLIC_PRIVY_SIGNER_ID=seu-signer-id

# Solana (obrigatório)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_INFLUNEST_PROGRAM_ID=seu-program-id-do-passo-2

# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key

# USDC Devnet (já preenchido)
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Instagram (opcional para MVP)
NEXT_PUBLIC_INSTAGRAM_APP_ID=deixe-vazio-por-enquanto
```

```bash
# Rodar frontend
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 🎯 Testando o Fluxo Completo

### Passo 1: Criar Oracle (Admin - uma vez)

Primeiro, você precisa inicializar o oracle no smart contract:

```bash
# Gerar keypair para o oracle
solana-keygen new -o oracle-keypair.json

# Obter o pubkey do oracle
solana-keygen pubkey oracle-keypair.json

# Inicializar oracle via Anchor (ajustar conforme seu setup)
# Você pode usar o script de teste ou fazer manualmente
```

**Nota**: Por enquanto, pule esta parte. O oracle é necessário para atualizar métricas, mas você pode testar criação e funding de campanhas sem ele.

### Passo 2: Login como Influencer

1. Abra [http://localhost:3000](http://localhost:3000)
2. Clique em **Login** (via Privy)
3. Escolha um método (Google, Email, etc.)
4. Privy cria uma embedded wallet Solana automaticamente

### Passo 3: Criar Campanha

1. Após login, vá para **/dashboard**
2. Clique em **+ New Campaign**
3. Preencha o formulário:
   - Nome: "Summer Product Launch"
   - Descrição: "Promote summer collection"
   - Instagram: "@yourinstagram"
   - Amount: 100 (USDC)
   - Deadline: 30 dias
   - Target Likes: 5000
   - Target Comments: 500
   - Target Views: 50000
   - Target Shares: 1000
4. Clique em **Create Campaign**
5. ✅ Campanha criada on-chain com status **Pending**

### Passo 4: Compartilhar Link com Marca

1. Na página da campanha, copie o link compartilhável
2. **Abra em aba anônima** (para simular outra pessoa)

### Passo 5: Brand Funda a Campanha

**IMPORTANTE**: Você precisa de USDC no devnet primeiro!

#### Obter USDC de Teste (Devnet)

```bash
# Instalar SPL Token CLI se não tiver
# Já vem com Solana CLI

# Sua wallet (brand)
# Obter o address da sua Privy wallet (mostra no dashboard)

# Ou usar uma wallet Phantom/Solflare no devnet

# Pegar SOL do devnet
solana airdrop 2 SUA_WALLET_ADDRESS --url devnet

# Criar conta USDC e mintar tokens de teste
# Use um faucet de USDC devnet ou:
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --url devnet
spl-token mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 100 --url devnet
```

Ou use um faucet online: [spl-token-faucet.com](https://spl-token-faucet.com)

#### Fundar a Campanha

1. Na aba anônima, acesse o link da campanha
2. Faça login com Privy (outra conta/email)
3. Verifique que tem USDC na wallet
4. Clique em **Fund 100 USDC**
5. Aprove a transação
6. ✅ Campanha agora está **Active**!

### Passo 6: Verificar no Dashboard

1. Volte para a aba do influencer
2. Vá para **/dashboard**
3. A campanha deve aparecer com status **Active**
4. Pode ver progresso (0% ainda, precisa do oracle atualizar)

## 🐛 Troubleshooting

### "Transaction simulation failed"
- Verifique se tem SOL suficiente para gas (mesmo com Privy sponsorship, pode precisar)
- Confirme que o program ID está correto no .env.local

### "Program error: Invalid account data"
- O program ID não bate com o deployed
- Rebuild e redeploy com `anchor build && anchor deploy`

### "Insufficient funds"
- Brand não tem USDC suficiente
- Use o faucet ou mint USDC de teste (veja acima)

### "Failed to fetch campaign"
- Campanha ainda não foi criada on-chain
- Aguarde alguns segundos após criar

### Privy não carrega
- Verifique `NEXT_PUBLIC_PRIVY_APP_ID` e `NEXT_PUBLIC_PRIVY_SIGNER_ID`
- Confirme que Solana devnet está habilitado no Privy Dashboard

## ✅ O que Testar

Funcionalidades prontas:
- ✅ Login com Privy (embedded wallet)
- ✅ Criar campanha on-chain
- ✅ Visualizar campanha
- ✅ Compartilhar link da campanha
- ✅ Brand fundar campanha com USDC
- ✅ Ver status mudar de Pending → Active

Funcionalidades que **ainda precisam** do oracle:
- ⏳ Atualizar métricas do Instagram
- ⏳ Pagamentos automáticos proporcionais
- ⏳ Completar campanha ao atingir 100%

Para testar pagamentos, você precisaria:
1. Implementar o oracle (Supabase Edge Function)
2. Ou chamar `update_campaign_metrics` manualmente via script

## 📝 Próximos Passos para MVP Completo

1. **Implementar Instagram OAuth** no frontend (página `/settings`)
2. **Fazer deploy das Edge Functions** no Supabase
3. **Configurar cronjob** (pg_cron) para rodar `update-campaigns` a cada 5 min
4. **Testar fluxo completo** com métricas reais do Instagram

## 🎉 Sucesso!

Se você conseguiu:
- ✅ Criar uma campanha
- ✅ Marca fundar com USDC
- ✅ Ver status Active on-chain

Parabéns! O core do protocolo está funcionando. 🚀

O sistema de pagamento automático já está no smart contract, só precisa do oracle atualizar as métricas para disparar.
