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
            <span className="text-gradient">Swap & Bridge</span>
            <br />
            <span className="text-foreground">Across Any Chain</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Find the best rates across DEXs and bridges. Powered by LI.FI.
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
          {[
            {
              icon: '⚡',
              title: 'Lightning Fast',
              description: 'Get quotes in seconds from multiple DEXs and bridges',
            },
            {
              icon: '🔒',
              title: 'Non-Custodial',
              description: 'You control your funds. We never hold your tokens',
            },
            {
              icon: '💎',
              title: 'Best Rates',
              description: 'Aggregated routes ensure you always get optimal pricing',
            },
          ].map((feature, idx) => (
            <div
              key={feature.title}
              className="glass rounded-xl p-6 text-center hover:scale-105 transition-transform"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </Layout>
  );
};

export default Index;
