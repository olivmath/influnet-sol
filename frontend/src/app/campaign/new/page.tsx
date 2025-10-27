'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getProgram, getCampaignPDA } from '@/lib/anchor';
import { BN } from '@coral-xyz/anchor';
import { toast } from 'react-toastify';

export default function NewCampaign() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount_usdc: '',
    target_likes: '',
    target_comments: '',
    target_views: '',
    target_shares: '',
    deadline_days: '30',
    instagram_username: '',
  });
  const [loading, setLoading] = useState(false);

  const solanaWallet = wallets.find((w) => w.chainType === 'solana');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!solanaWallet) {
      toast.error('No Solana wallet found');
      return;
    }

    setLoading(true);

    try {
      const program = getProgram(solanaWallet);
      const now = Math.floor(Date.now() / 1000);
      const deadline = now + parseInt(formData.deadline_days) * 24 * 60 * 60;

      const campaignPDA = getCampaignPDA(
        new PublicKey(solanaWallet.address),
        now
      );

      const tx = await program.methods
        .createCampaign(
          formData.name,
          formData.description,
          new BN(parseFloat(formData.amount_usdc) * 1e6), // Convert to USDC decimals
          new BN(formData.target_likes),
          new BN(formData.target_comments),
          new BN(formData.target_views),
          new BN(formData.target_shares),
          new BN(deadline),
          formData.instagram_username
        )
        .accounts({
          campaign: campaignPDA,
          influencer: new PublicKey(solanaWallet.address),
        })
        .rpc();

      toast.success('Campaign created successfully!');
      router.push(`/campaign/${campaignPDA.toString()}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return <div>Please login first</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold cursor-pointer" onClick={() => router.push('/dashboard')}>
              Influnest
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold mb-8">Create New Campaign</h2>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Campaign Name</label>
            <input
              type="text"
              required
              maxLength={100}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Summer Product Launch"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              required
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Promote our new summer collection..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Instagram Username</label>
            <input
              type="text"
              required
              maxLength={50}
              value={formData.instagram_username}
              onChange={(e) => setFormData({ ...formData, instagram_username: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="@yourinstagram"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount (USDC)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount_usdc}
                onChange={(e) => setFormData({ ...formData, amount_usdc: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Deadline (days)</label>
              <input
                type="number"
                required
                min="1"
                value={formData.deadline_days}
                onChange={(e) => setFormData({ ...formData, deadline_days: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="30"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Target Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target Likes</label>
                <input
                  type="number"
                  min="0"
                  value={formData.target_likes}
                  onChange={(e) => setFormData({ ...formData, target_likes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Comments</label>
                <input
                  type="number"
                  min="0"
                  value={formData.target_comments}
                  onChange={(e) => setFormData({ ...formData, target_comments: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Views</label>
                <input
                  type="number"
                  min="0"
                  value={formData.target_views}
                  onChange={(e) => setFormData({ ...formData, target_views: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="50000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Shares</label>
                <input
                  type="number"
                  min="0"
                  value={formData.target_shares}
                  onChange={(e) => setFormData({ ...formData, target_shares: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="1000"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
