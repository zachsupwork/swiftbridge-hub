import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Wallet, BarChart3, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/swap', label: 'Swap', icon: ArrowLeftRight },
  { path: '/portfolio', label: 'Portfolio', icon: Wallet },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gradient">SwiftSwap</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path === '/swap' && location.pathname === '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg bg-primary/10 -z-10"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Wallet Connect */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      style: {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {!connected ? (
                      <button
                        onClick={openConnectModal}
                        className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow"
                      >
                        Connect Wallet
                      </button>
                    ) : chain.unsupported ? (
                      <button
                        onClick={openChainModal}
                        className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium text-sm"
                      >
                        Wrong network
                      </button>
                    ) : (
                      <div className="hidden sm:flex items-center gap-2">
                        <button
                          onClick={openChainModal}
                          className="px-3 py-2 rounded-lg glass text-sm font-medium flex items-center gap-2 hover:bg-muted/50 transition-colors"
                        >
                          {chain.hasIcon && chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span className="hidden lg:inline">{chain.name}</span>
                        </button>

                        <button
                          onClick={openAccountModal}
                          className="px-3 py-2 rounded-lg glass text-sm font-medium hover:bg-muted/50 transition-colors"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }}
            </ConnectButton.Custom>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border overflow-hidden"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || 
                  (item.path === '/swap' && location.pathname === '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
