"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

import { FullScreenLoader } from "@/components/ui/fullscreen-loader";

function Home() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.push('/dashboard');
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return <FullScreenLoader />;
  }

  return (
    <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 min-h-screen">
      <section className="w-full flex flex-col justify-center items-center h-screen relative px-4">
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-4xl">
          <h1 className="text-center text-white text-7xl md:text-8xl font-bold mb-6">
            Influnest
          </h1>
          <p className="text-center text-white text-2xl md:text-3xl font-light mb-4">
            Decentralized Influencer Marketing Platform
          </p>
          <p className="text-center text-white/80 text-lg md:text-xl mb-12 max-w-2xl">
            Connect influencers with brands on Solana. Transparent, milestone-based payments in USDC.
          </p>
          <button
            className="bg-white text-purple-700 font-bold text-xl px-12 py-4 rounded-full hover:bg-gray-100 transition-all shadow-2xl hover:shadow-xl transform hover:scale-105"
            onClick={() => {
              if (authenticated) {
                router.push('/dashboard');
              } else {
                login();
              }
            }}
          >
            {authenticated ? 'Go to Dashboard' : 'Get Started'}
          </button>
          <div className="mt-12 text-white/60 text-sm">
            Powered by Solana • Secured by Smart Contracts
          </div>
        </div>
      </section>

      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable={false}
        pauseOnHover
        limit={1}
        aria-label="Toast notifications"
        style={{ top: 58 }}
      />
    </div>
  );
}

export default Home;
