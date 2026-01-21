import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

// Solana wallet imports
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

// Sui wallet imports
import { createNetworkConfig, SuiClientProvider, WalletProvider as SuiWalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";

import { config } from "@/lib/wagmiConfig";
import { BitcoinWalletProvider, MultiWalletProvider } from "@/lib/wallets";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Portfolio from "./pages/Portfolio";
import Analytics from "./pages/Analytics";
import Earn from "./pages/Earn";
import NotFound from "./pages/NotFound";
import { useMemo } from "react";

const queryClient = new QueryClient();

// Solana cluster endpoint
const SOLANA_ENDPOINT = "https://api.mainnet-beta.solana.com";

// Sui network config
const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl("mainnet") },
  testnet: { url: getFullnodeUrl("testnet") },
});

function WalletProviders({ children }: { children: React.ReactNode }) {
  // Solana wallets
  const solanaWallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'hsl(199, 89%, 48%)',
            accentColorForeground: 'hsl(222, 47%, 6%)',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
        >
          <ConnectionProvider endpoint={SOLANA_ENDPOINT}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>
                <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
                  <SuiWalletProvider autoConnect>
                    <BitcoinWalletProvider>
                      <MultiWalletProvider>
                        {children}
                      </MultiWalletProvider>
                    </BitcoinWalletProvider>
                  </SuiWalletProvider>
                </SuiClientProvider>
              </WalletModalProvider>
            </SolanaWalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <WalletProviders>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/swap" replace />} />
            <Route path="/swap" element={<Index />} />
            <Route path="/earn" element={<Earn />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProviders>
  </ErrorBoundary>
);

export default App;
