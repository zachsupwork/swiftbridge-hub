/**
 * Technical Documentation Page
 * 
 * Explains how the platform works, supported networks, fees, and risks
 */

import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Globe, 
  Wallet, 
  ArrowLeftRight, 
  TrendingUp,
  Shield,
  AlertTriangle,
  Percent,
  Lock,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SeoHead } from '@/components/seo';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SUPPORTED_CHAINS = [
  { name: 'Ethereum', id: 1, color: 'bg-blue-500' },
  { name: 'Arbitrum', id: 42161, color: 'bg-blue-400' },
  { name: 'Base', id: 8453, color: 'bg-blue-600' },
  { name: 'Polygon', id: 137, color: 'bg-purple-500' },
  { name: 'Optimism', id: 10, color: 'bg-red-500' },
  { name: 'BNB Chain', id: 56, color: 'bg-yellow-500' },
  { name: 'Avalanche', id: 43114, color: 'bg-red-600' },
  { name: 'Fantom', id: 250, color: 'bg-blue-500' },
  { name: 'Gnosis', id: 100, color: 'bg-green-500' },
];

const SECURITY_TIPS = [
  "Always verify you're on the correct domain: cryptodefibridge.com",
  "Never share your private keys or seed phrase with anyone",
  "Double-check transaction details before confirming",
  "Only approve contracts you trust",
  "Start with small amounts when using new features",
  "Bookmark the official site to avoid phishing",
];

function Section({ 
  icon: Icon, 
  title, 
  children 
}: { 
  icon: React.ElementType; 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      <div className="text-muted-foreground space-y-3">
        {children}
      </div>
    </div>
  );
}

export default function Docs() {
  return (
    <Layout>
      <SeoHead />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              <span className="text-gradient">Technical Documentation</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Learn how Crypto DeFi Bridge works, understand the technology, and stay safe.
            </p>
          </div>

          {/* What is CDB */}
          <Section icon={BookOpen} title="What is Crypto DeFi Bridge?">
            <p>
              Crypto DeFi Bridge is a <strong>non-custodial</strong> DeFi platform that combines:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Cross-chain Swap & Bridge:</strong> Instantly swap tokens across multiple blockchains using aggregated liquidity from top DEXs and bridges.</li>
              <li><strong>Earn (Lending/Borrowing):</strong> Supply assets to earn yield or borrow against your collateral using Morpho Blue protocol.</li>
            </ul>
            <p>
              We never hold your funds or private keys. All transactions execute directly between your wallet and the underlying smart contracts.
            </p>
          </Section>

          {/* Supported Networks */}
          <Section icon={Globe} title="Supported Networks">
            <p>We support 15+ EVM-compatible chains for swaps and bridges:</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {SUPPORTED_CHAINS.map((chain) => (
                <Badge
                  key={chain.id}
                  variant="outline"
                  className="px-3 py-1.5 flex items-center gap-2"
                >
                  <div className={cn("w-2 h-2 rounded-full", chain.color)} />
                  {chain.name}
                </Badge>
              ))}
              <Badge variant="outline" className="px-3 py-1.5 text-muted-foreground">
                + more
              </Badge>
            </div>
            <p className="mt-3 text-sm">
              For Earn (lending/borrowing), we currently support Ethereum, Base, and Arbitrum through Morpho Blue markets.
            </p>
          </Section>

          {/* How Swap Works */}
          <Section icon={ArrowLeftRight} title="How Swap & Bridge Works">
            <div className="space-y-3">
              <p><strong>1. Select tokens:</strong> Choose your source token/chain and destination token/chain.</p>
              <p><strong>2. Get quote:</strong> We aggregate routes from multiple DEXs and bridges (via LI.FI) to find you the best rate.</p>
              <p><strong>3. Review & confirm:</strong> See the exact amount you'll receive, fees included, before signing.</p>
              <p><strong>4. Execute:</strong> Approve (if needed) and confirm the swap in your wallet.</p>
              <p><strong>5. Track:</strong> Monitor your transaction until completion.</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 mt-4">
              <p className="text-sm">
                <strong>Liquidity sources:</strong> We aggregate liquidity from Uniswap, SushiSwap, Curve, Balancer, 1inch, Stargate, Hop, Across, and many more.
              </p>
            </div>
          </Section>

          {/* How Earn Works */}
          <Section icon={TrendingUp} title="How Earn Works">
            <p>
              Our Earn section is powered by <strong>Morpho Blue</strong>, a permissionless lending protocol.
            </p>
            <div className="space-y-3 mt-3">
              <p><strong>Supply:</strong> Deposit assets into lending markets to earn variable APY based on utilization.</p>
              <p><strong>Borrow:</strong> Provide collateral and borrow other assets. Your health factor determines liquidation risk.</p>
              <p><strong>LLTV (Liquidation Loan-to-Value):</strong> If your LTV reaches the LLTV threshold, your position may be liquidated.</p>
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mt-4">
              <p className="text-sm text-warning">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                <strong>Risk warning:</strong> Lending and borrowing carry inherent risks including smart contract risk, liquidation risk, and variable rates.
              </p>
            </div>
          </Section>

          {/* Fees */}
          <Section icon={Percent} title="Fees Explained">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-1">Swap & Bridge Fees</h4>
                <p className="text-sm">
                  Fees are included in the quoted price and consist of:
                </p>
                <ul className="list-disc list-inside text-sm ml-2 mt-1">
                  <li>Network gas fees (paid to validators)</li>
                  <li>Protocol fees (paid to DEXs/bridges used)</li>
                  <li>Service fee (our platform fee, shown transparently)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-1">Earn Fees</h4>
                <p className="text-sm">
                  A small platform fee (0.10%) applies to supply and borrow actions. This fee is shown clearly before you confirm any transaction.
                </p>
              </div>
            </div>
          </Section>

          {/* Risk Disclosure */}
          <Section icon={AlertTriangle} title="Risk Disclosure">
            <div className="space-y-3">
              <p><strong>Smart Contract Risk:</strong> All DeFi protocols rely on smart contracts which may contain bugs or vulnerabilities.</p>
              <p><strong>Liquidation Risk:</strong> When borrowing, if your collateral value drops or debt increases, you may be liquidated.</p>
              <p><strong>Price Risk:</strong> Cryptocurrency prices are highly volatile. The value of your assets can change rapidly.</p>
              <p><strong>Bridge Risk:</strong> Cross-chain bridges involve additional smart contract and security risks.</p>
              <p><strong>Variable Rates:</strong> APY rates on lending markets change based on supply and demand.</p>
            </div>
            <p className="text-sm mt-4 italic">
              Only invest what you can afford to lose. This is not financial advice.
            </p>
          </Section>

          {/* Security Tips */}
          <Section icon={Shield} title="Security Tips">
            <div className="grid gap-2">
              {SECURITY_TIPS.map((tip, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{tip}</span>
                </div>
              ))}
            </div>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mt-4">
              <p className="text-sm text-destructive">
                <Lock className="w-4 h-4 inline mr-2" />
                <strong>We will NEVER ask for your seed phrase or private keys.</strong> Anyone who does is a scammer.
              </p>
            </div>
          </Section>

          {/* External Resources */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Additional Resources</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://docs.morpho.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="text-sm">Morpho Documentation</span>
              </a>
              <a
                href="https://docs.li.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="text-sm">LI.FI Documentation</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
