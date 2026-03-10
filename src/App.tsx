import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { config } from "@/lib/wagmiConfig";
import { BitcoinWalletProvider, MultiWalletProvider } from "@/lib/wallets";
import { BalancesProvider } from "@/providers/BalancesProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SwapIntentDrawer } from "@/components/swap/SwapIntentDrawer";
import { WebSiteJsonLd } from "@/components/seo";
import Index from "./pages/Index";
import Portfolio from "./pages/Portfolio";
import Analytics from "./pages/Analytics";
import Earn from "./pages/Earn";
import Borrow from "./pages/Borrow";
import Market from "./pages/Market";
import Support from "./pages/Support";
import Docs from "./pages/Docs";
import NotFound from "./pages/NotFound";
import AaveReserveDetails from "./pages/aave/ReserveDetails";

const queryClient = new QueryClient();

function WalletProviders({ children }: { children: React.ReactNode }) {
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
          <BitcoinWalletProvider>
            <MultiWalletProvider>
              <BalancesProvider>
                {children}
              </BalancesProvider>
            </MultiWalletProvider>
          </BitcoinWalletProvider>
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
          <WebSiteJsonLd />
          <SwapIntentDrawer />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/swap" element={<Index />} />
            <Route path="/earn" element={<Earn />} />
            <Route path="/earn/aave/:chainId/:assetAddress" element={<AaveReserveDetails />} />
            <Route path="/borrow" element={<Navigate to="/earn" replace />} />
            <Route path="/market/:marketId" element={<Market />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/support" element={<Support />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProviders>
  </ErrorBoundary>
);

export default App;