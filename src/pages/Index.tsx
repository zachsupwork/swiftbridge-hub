import { Layout } from '@/components/layout/Layout';
import { SwapCard } from '@/components/swap/SwapCard';
import { motion } from 'framer-motion';

const Index = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">CryptoDeFiBridge</span>
            <br />
            <span className="text-foreground text-2xl md:text-3xl">Cross-Chain DeFi Bridge & Swap Aggregator</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Swap tokens across multiple blockchains using the best liquidity routes.
            <br className="hidden sm:block" />
            <span className="text-foreground/80">Non-custodial. Transparent fees. Secure by design.</span>
          </p>
        </motion.div>

        <SwapCard />

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto"
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
      </div>
    </Layout>
  );
};

export default Index;
