'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignCache } from '@/lib/supabase';

export default function Dashboard() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('campaigns_cache')
          .select('*');

        if (error) {
          throw error;
        }

        setCampaigns(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ready && authenticated) {
      fetchCampaigns();
    }
  }, [ready, authenticated, user]);

  const solanaWallet = wallets.find((w: any) => w.chainType === 'solana');

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold">Influnest</h1>
            <div className="flex gap-4 items-center">
              <span className="text-sm text-gray-600">
                {solanaWallet?.address.slice(0, 4)}...{solanaWallet?.address.slice(-4)}
              </span>
              <button
                onClick={() => router.push('/settings')}
                className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">My Campaigns</h2>
          <button
            onClick={() => {
              console.log('Attempting to navigate to /campaign/new');
              router.push('/campaign/new');
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            + New Campaign
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">Loading campaigns...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-red-500 text-lg">Error: {error}</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No campaigns yet</p>
            <p className="text-gray-400">Create your first campaign to get started</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition"
                onClick={() => router.push(`/campaign/${campaign.id}`)}
              >
                <h3 className="font-bold text-xl mb-2">{campaign.campaign_pubkey}</h3>
                <p className="text-gray-600 text-sm mb-4">{campaign.influencer_wallet}</p>
                <div className="flex justify-between items-center">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {campaign.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
