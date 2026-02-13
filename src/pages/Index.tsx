import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SwapCard } from '@/components/swap/SwapCard';
import { SeoHead, SeoContentBlock } from '@/components/seo';
import { motion } from 'framer-motion';

const Index = () => {
  return (
    <Layout>
      <SeoHead />
      <div className="container mx-auto px-4">
        <SeoContentBlock>
          <h1>Cross-Chain Crypto Swap &amp; Bridge</h1>
          <p>
            Crypto DeFi Bridge is a non-custodial <strong>cross-chain swap</strong> and <strong>crypto bridge</strong> aggregator.
            Swap tokens across Ethereum, Arbitrum, Base, Polygon, Optimism, BNB Chain, Avalanche, and more — all from one interface
            with transparent fees and optimized routing.
          </p>
          <h2>How Does a Cross-Chain Crypto Swap Work?</h2>
          <p>
            A <strong>cryptocurrency swap</strong> lets you exchange one token for another without a centralized exchange.
            When the tokens live on different blockchains, a <strong>crypto bridge</strong> moves value between networks.
            Crypto DeFi Bridge aggregates DEX and bridge liquidity to find the best route for every trade —
            so you always get competitive pricing whether you're swapping ETH to USDC on Arbitrum or bridging
            MATIC to Base.
          </p>
          <h2>Why Use a DeFi Swap Aggregator?</h2>
          <p>
            Instead of manually comparing prices on Uniswap, SushiSwap, or individual bridges, our aggregator
            queries multiple sources simultaneously and presents the optimal <strong>cross-chain swap</strong> route.
            This saves time, reduces slippage, and often results in better net output for the trader.
          </p>
          <h2>Trade Crypto Non-Custodially</h2>
          <p>
            Every swap executes directly between your wallet and the underlying smart contracts.
            Crypto DeFi Bridge never holds your private keys or tokens. You approve, you sign, you control.
          </p>
          <p>
            Looking to earn yield on your idle assets? Visit our{' '}
            <Link to="/earn">DeFi staking &amp; lending</Link> page to supply and borrow with competitive APY.
            Track everything in your{' '}
            <Link to="/portfolio">cross-chain portfolio</Link>.
          </p>
          <h2>Risk Disclaimer</h2>
          <p>
            DeFi protocols involve smart-contract risk, bridge risk, and potential impermanent loss.
            Always do your own research (DYOR) before interacting with any protocol. Past performance
            does not guarantee future results.
          </p>
        </SeoContentBlock>

        <SwapCard />

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto"
        >
          <article className="glass rounded-xl p-6 text-center hover:scale-105 transition-transform">
            <div className="text-4xl mb-4" aria-hidden="true">⚡</div>
            <h2 className="font-semibold mb-2 text-lg">Swap Tokens Across Chains</h2>
            <p className="text-sm text-muted-foreground">Get quotes in seconds from multiple DEXs and bridges for the best cross-chain routes.</p>
          </article>
          
          <article className="glass rounded-xl p-6 text-center hover:scale-105 transition-transform">
            <div className="text-4xl mb-4" aria-hidden="true">🔒</div>
            <h2 className="font-semibold mb-2 text-lg">Non-Custodial DeFi Swaps</h2>
            <p className="text-sm text-muted-foreground">You control your funds. We never hold your tokens. True decentralized finance.</p>
          </article>
          
          <article className="glass rounded-xl p-6 text-center hover:scale-105 transition-transform">
            <div className="text-4xl mb-4" aria-hidden="true">💎</div>
            <h2 className="font-semibold mb-2 text-lg">Best Cross-Chain Routes</h2>
            <p className="text-sm text-muted-foreground">Aggregated routes ensure you always get optimal pricing across all supported chains.</p>
          </article>
        </motion.div>

        {/* Heading + description moved below feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-16 mb-8 max-w-3xl mx-auto"
        >
          <p className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-gradient">Crypto DeFi Bridge</span>
            <br />
            <span className="text-foreground text-xl md:text-2xl">Cross-Chain Swap, Borrow &amp; Earn</span>
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A <strong className="text-foreground/90">DEX aggregator</strong> and <strong className="text-foreground/90">crypto bridge</strong> for DeFi swapping across 15+ blockchains.
            Swap ETH, stablecoins, wrapped BTC, and hundreds more — always non-custodial with best-price routing.
          </p>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Index;
