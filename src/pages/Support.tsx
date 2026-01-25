/**
 * Support Page
 * 
 * Contact information, FAQ, and support form
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  MessageCircle, 
  Copy, 
  Check, 
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  Wallet,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SUPPORT_EMAIL = 'support@cryptodefibridge.com';

const FAQ_ITEMS = [
  {
    question: "Why did my transaction fail?",
    answer: "Transactions can fail due to insufficient gas, slippage tolerance being too low, or network congestion. Check that you have enough native tokens (ETH, MATIC, etc.) for gas fees and try increasing your slippage tolerance in the settings.",
    icon: AlertTriangle,
  },
  {
    question: "My approval is stuck. What should I do?",
    answer: "If an approval transaction is stuck, you can try to speed it up or cancel it in your wallet. Alternatively, wait for the network to process it - this can sometimes take several minutes during high congestion.",
    icon: RefreshCw,
  },
  {
    question: "I'm on the wrong network. How do I switch?",
    answer: "Click the chain selector in the app or the network button in your wallet. Make sure you have the destination chain added to your wallet. The app will prompt you to switch when needed.",
    icon: Wallet,
  },
  {
    question: "Why is my slippage too high?",
    answer: "High slippage occurs when there's low liquidity or high volatility. Try trading smaller amounts, using different token pairs, or waiting for better market conditions. You can also increase your slippage tolerance, but be aware this may result in less favorable rates.",
    icon: Zap,
  },
  {
    question: "What is health factor in Earn?",
    answer: "Health factor measures how close your borrowed position is to liquidation. Above 1.5 is safe (green), 1.0-1.5 is moderate risk (yellow), and below 1.0 means your position can be liquidated. Add more collateral or repay debt to improve your health factor.",
    icon: Shield,
  },
  {
    question: "How are fees calculated?",
    answer: "For swaps/bridges, fees are included in the quoted price and include network gas, protocol fees, and our service fee. For Earn, a small platform fee applies to supply and borrow actions. All fees are shown transparently before you confirm any transaction.",
    icon: HelpCircle,
  },
];

export default function Support() {
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    txHash: '',
    chain: '',
    wallet: '',
    message: '',
  });

  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    toast({ title: 'Email copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent('Support Request - Crypto DeFi Bridge');
    const body = encodeURIComponent(
      `Email: ${formData.email}\n` +
      `Transaction Hash: ${formData.txHash || 'N/A'}\n` +
      `Chain: ${formData.chain || 'N/A'}\n` +
      `Wallet Address: ${formData.wallet || 'N/A'}\n\n` +
      `Message:\n${formData.message}`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              <span className="text-gradient">Support</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Need help with Crypto DeFi Bridge? Check our FAQ or contact our support team.
            </p>
          </div>

          {/* Quick Contact */}
          <div className="glass rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Email Support</h3>
                  <p className="text-sm text-muted-foreground">We typically respond within 24 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-3 py-2 bg-muted rounded-lg text-sm font-mono">
                  {SUPPORT_EMAIL}
                </code>
                <Button variant="outline" size="icon" onClick={copyEmail}>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Important Info */}
          <div className="glass rounded-xl p-4 border-warning/30 bg-warning/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning mb-1">When contacting support, please include:</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Your transaction hash (tx hash)</li>
                  <li>The chain/network you were using</li>
                  <li>Your wallet address</li>
                  <li>A description of what happened</li>
                </ul>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Frequently Asked Questions
            </h2>
            
            <Accordion type="single" collapsible className="space-y-2">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="glass rounded-lg px-4 border-0"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <item.icon className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-medium">{item.question}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 pl-7">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Contact Form */}
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Contact Us
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Email *</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Transaction Hash</label>
                  <Input
                    type="text"
                    placeholder="0x..."
                    value={formData.txHash}
                    onChange={(e) => setFormData({ ...formData, txHash: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chain/Network</label>
                  <Input
                    type="text"
                    placeholder="e.g., Ethereum, Base, Arbitrum"
                    value={formData.chain}
                    onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Wallet Address</label>
                  <Input
                    type="text"
                    placeholder="0x..."
                    value={formData.wallet}
                    onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Message *</label>
                <Textarea
                  placeholder="Describe your issue in detail..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={5}
                />
              </div>
              
              <Button type="submit" className="w-full sm:w-auto">
                <Mail className="w-4 h-4 mr-2" />
                Send Support Request
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
