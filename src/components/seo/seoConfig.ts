/**
 * Route-based SEO configuration
 * 
 * Each public route has unique title, description, keywords,
 * and a category for content strategy.
 */

const SITE_URL = 'https://cryptodefibridge.com';

export type SeoCategory = 'swap' | 'earn' | 'portfolio' | 'analytics' | 'info';

export interface RouteSeo {
  title: string;
  description: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  category: SeoCategory;
  h1: string;
  introText: string;
}

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Crypto DeFi Bridge | Cross-Chain DEX Aggregator, Swap & Bridge',
    description:
      'Non-custodial cross-chain swap & bridge aggregator. DEX aggregator with best-price routing across 15+ blockchains. Swap ETH, stablecoins, wrapped BTC & more with transparent fees.',
    primaryKeyword: 'crypto swap',
    secondaryKeywords: ['cross chain swap', 'crypto bridge', 'defi swap', 'cryptocurrency swap', 'trade crypto'],
    category: 'swap',
    h1: 'Cross-Chain Crypto Swap & Bridge',
    introText:
      'Crypto DeFi Bridge aggregates the best liquidity routes so you can swap and bridge tokens across Ethereum, Arbitrum, Base, Polygon, Optimism, and more — all from a single interface.',
  },
  '/earn': {
    title: 'DeFi Earn — Supply & Borrow Crypto | Crypto DeFi Bridge',
    description:
      'Earn yield by supplying crypto to DeFi lending markets. Borrow against your assets with competitive rates on Ethereum via Morpho Blue.',
    primaryKeyword: 'defi staking',
    secondaryKeywords: ['crypto vault', 'crypto staking', 'defi yield', 'liquid staking', 'crypto lending'],
    category: 'earn',
    h1: 'Earn Yield with DeFi Lending & Staking',
    introText:
      'Supply assets to battle-tested lending protocols and earn competitive APY. Borrow against your holdings at transparent rates — all non-custodial.',
  },
  '/portfolio': {
    title: 'DeFi Portfolio Tracker — Multi-Chain Balances | Crypto DeFi Bridge',
    description:
      'View your cross-chain DeFi portfolio in one dashboard. Track token balances across Ethereum, Arbitrum, Base, Polygon, and more.',
    primaryKeyword: 'defi portfolio',
    secondaryKeywords: ['crypto portfolio', 'multi chain wallet', 'token balances', 'cross chain tracker'],
    category: 'portfolio',
    h1: 'Your Cross-Chain DeFi Portfolio',
    introText:
      'Connect your wallet to see token balances across every supported chain, all in one place.',
  },
  '/analytics': {
    title: 'Swap Analytics & History — Track DeFi Trades | Crypto DeFi Bridge',
    description:
      'Review your swap history, success rates, and trading volume. Export transaction data and monitor your DeFi activity over time.',
    primaryKeyword: 'defi analytics',
    secondaryKeywords: ['crypto trade history', 'swap analytics', 'defi tracking', 'transaction history'],
    category: 'analytics',
    h1: 'DeFi Swap Analytics & Trade History',
    introText:
      'Monitor your trading performance with detailed swap analytics, completion rates, and exportable history.',
  },
  '/support': {
    title: 'Support — Help & FAQ | Crypto DeFi Bridge',
    description:
      'Get help with cross-chain swaps, failed transactions, and DeFi lending. Browse FAQs or contact our support team.',
    primaryKeyword: 'crypto defi bridge support',
    secondaryKeywords: ['defi help', 'swap support', 'crypto bridge FAQ'],
    category: 'info',
    h1: 'Help & Support',
    introText:
      'Find answers to common questions about swapping, bridging, and lending on Crypto DeFi Bridge.',
  },
  '/docs': {
    title: 'Documentation — How It Works | Crypto DeFi Bridge',
    description:
      'Learn how Crypto DeFi Bridge works: supported chains, fee structure, security practices, and risk disclosures for cross-chain DeFi.',
    primaryKeyword: 'crypto defi bridge docs',
    secondaryKeywords: ['defi documentation', 'cross chain bridge guide', 'defi risk disclosure'],
    category: 'info',
    h1: 'Technical Documentation',
    introText:
      'Understand the technology, supported networks, fees, and security behind Crypto DeFi Bridge.',
  },
};

export function getRouteSeo(pathname: string): RouteSeo {
  // Normalize: /swap → /
  const normalized = pathname === '/swap' ? '/' : pathname;
  return ROUTE_SEO[normalized] ?? ROUTE_SEO['/'];
}

export function getCanonicalUrl(pathname: string): string {
  const normalized = pathname === '/swap' ? '/' : pathname;
  return `${SITE_URL}${normalized === '/' ? '' : normalized}`;
}

export { SITE_URL };
