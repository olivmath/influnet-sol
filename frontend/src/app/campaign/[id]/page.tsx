'use client';

import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getProgram, getVaultTokenAccount, USDC_MINT } from '@/lib/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { toast } from 'react-toastify';

export default function CampaignDetail() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useSolanaWallets();
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);

  const campaignId = params.id as string;
  const solanaWallet = wallets.find((w) => w.chainType === 'solana');

  useEffect(() => {
    if (ready && campaignId) {
      fetchCampaign();
    }
  }, [ready, campaignId]);

  const fetchCampaign = async () => {
    try {
      const program = getProgram(solanaWallet || {} as any);
      const campaignPDA = new PublicKey(campaignId);
      const campaignData = await program.account.campaign.fetch(campaignPDA);

      setCampaign({
        pubkey: campaignId,
        ...campaignData,
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleFundCampaign = async () => {
    if (!solanaWallet || !campaign) {
      toast.error('Please connect your wallet');
      return;
    }

    setFunding(true);

    try {
      const program = getProgram(solanaWallet);
      const campaignPDA = new PublicKey(campaignId);

      // Get brand's USDC token account
      const brandTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        new PublicKey(solanaWallet.address)
      );

      // Get vault token account
      const vaultTokenAccount = await getVaultTokenAccount(campaignPDA);

      const tx = await program.methods
        .fundCampaign()
        .accounts({
          campaign: campaignPDA,
          brand: new PublicKey(solanaWallet.address),
          brandTokenAccount,
          vaultTokenAccount,
          usdcMint: USDC_MINT,
        })
        .rpc();

      toast.success('Campaign funded successfully!');
      fetchCampaign();
    } catch (error: any) {
      console.error('Error funding campaign:', error);
      toast.error(error.message || 'Failed to fund campaign');
    } finally {
      setFunding(false);
    }
  };

  const getStatusColor = (status: any) => {
    if (status.pending) return 'bg-yellow-100 text-yellow-800';
    if (status.active) return 'bg-green-100 text-green-800';
    if (status.completed) return 'bg-blue-100 text-blue-800';
    if (status.cancelled) return 'bg-red-100 text-red-800';
    if (status.expired) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: any) => {
    if (status.pending) return 'Pending';
    if (status.active) return 'Active';
    if (status.completed) return 'Completed';
    if (status.cancelled) return 'Cancelled';
    if (status.expired) return 'Expired';
    return 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Campaign not found</p>
      </div>
    );
  }

  const amountUSDC = campaign.amountUsdc.toNumber() / 1e6;
  const amountPaid = campaign.amountPaid.toNumber() / 1e6;
  const progress = ((amountPaid / amountUSDC) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1
              className="text-2xl font-bold cursor-pointer"
              onClick={() => router.push(authenticated ? '/dashboard' : '/')}
            >
              Influnest
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">{campaign.name}</h2>
              <p className="text-gray-600">{campaign.description}</p>
            </div>
            <span className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(campaign.status)}`}>
              {getStatusText(campaign.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold">{amountUSDC} USDC</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600">{amountPaid} USDC</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all"
                style={{ width: `${Math.min(parseFloat(progress), 100)}%` }}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Target Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Likes</p>
                <p className="text-xl font-semibold">
                  {campaign.currentLikes.toNumber()} / {campaign.targetLikes.toNumber()}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Comments</p>
                <p className="text-xl font-semibold">
                  {campaign.currentComments.toNumber()} / {campaign.targetComments.toNumber()}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Views</p>
                <p className="text-xl font-semibold">
                  {campaign.currentViews.toNumber()} / {campaign.targetViews.toNumber()}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Shares</p>
                <p className="text-xl font-semibold">
                  {campaign.currentShares.toNumber()} / {campaign.targetShares.toNumber()}
                </p>
              </div>
            </div>
          </div>

          {campaign.status.pending && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600 mb-4">
                This campaign is awaiting funding. Fund it to activate.
              </p>
              <button
                onClick={handleFundCampaign}
                disabled={funding || !solanaWallet}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
              >
                {funding ? 'Funding...' : `Fund ${amountUSDC} USDC`}
              </button>
              {!solanaWallet && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Please connect your wallet to fund this campaign
                </p>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Campaign ID:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">{campaignId.slice(0, 8)}...{campaignId.slice(-8)}</code>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
              <span>Instagram:</span>
              <span className="font-semibold">{campaign.instagramUsername}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <h3 className="font-bold text-xl mb-4">Share this campaign</h3>
          <p className="text-gray-600 mb-4">
            Share this link with brands to receive funding:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/campaign/${campaignId}`}
              className="flex-1 px-4 py-2 border rounded-lg bg-gray-50"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/campaign/${campaignId}`);
                toast.success('Link copied!');
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
