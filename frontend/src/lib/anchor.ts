import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from './idl.json';

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_INFLUNEST_PROGRAM_ID!);
export const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

export function getConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

export function getProgram(wallet: any) {
  const connection = getConnection();
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  return new Program(idl as any, provider);
}

// PDA helpers
export function getOracleConfigPDA() {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('oracle-config')],
    PROGRAM_ID
  );
  return pda;
}

export function getCampaignPDA(influencer: PublicKey, createdAt: number) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('campaign'),
      influencer.toBuffer(),
      Buffer.from(new BigInt64Array([BigInt(createdAt)]).buffer),
    ],
    PROGRAM_ID
  );
  return pda;
}

export async function getVaultTokenAccount(campaignPDA: PublicKey) {
  const { getAssociatedTokenAddress } = await import('@solana/spl-token');
  return getAssociatedTokenAddress(USDC_MINT, campaignPDA, true);
}
