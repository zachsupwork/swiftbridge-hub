import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Clock } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { AaveSupplyCard } from '@/components/earn/AaveSupplyCard';

export default function Earn() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="text-gradient">Earn</span>
            </h1>
            <p className="text-muted-foreground">
              Supply assets and earn yield via DeFi protocols
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="lending" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="lending" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Lending (Aave)
              </TabsTrigger>
              <TabsTrigger value="morpho" disabled className="gap-2 opacity-50">
                <Clock className="w-4 h-4" />
                Morpho (Coming Soon)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lending" className="mt-0">
              <AaveSupplyCard />
            </TabsContent>

            <TabsContent value="morpho">
              <div className="glass rounded-2xl p-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-xl font-semibold mb-2">Morpho Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Morpho integration is under development. Stay tuned!
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </Layout>
  );
}
