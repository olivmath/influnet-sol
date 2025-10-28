import { PublicKey, Transaction } from '@solana/web3.js';

// Adapta a wallet do Privy (Solana) para o formato esperado pelo AnchorProvider
export function toAnchorWallet(wallet: any) {
  if (!wallet) return wallet;
  const publicKey = new PublicKey(wallet.address);
  const standard = wallet.standardWallet;

  return {
    publicKey,
    async signTransaction(tx: Transaction) {
      if (!standard?.signTransaction) {
        throw new Error('Privy wallet does not support signTransaction');
      }
      return await standard.signTransaction(tx);
    },
    async signAllTransactions(txs: Transaction[]) {
      if (!standard?.signAllTransactions) {
        // Fallback: assinar uma por uma
        return await Promise.all(txs.map((tx) => standard.signTransaction(tx)));
      }
      return await standard.signAllTransactions(txs);
    },
  };
}