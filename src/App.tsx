import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { config } from "@/lib/wagmiConfig";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Portfolio from "./pages/Portfolio";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
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
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/swap" replace />} />
                <Route path="/swap" element={<Index />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ErrorBoundary>
);

export default App;
