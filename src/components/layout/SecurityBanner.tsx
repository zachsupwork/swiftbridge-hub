import { Shield, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

export function SecurityBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass border-b border-border py-2"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3 h-3 text-success" />
          <span>
            <span className="text-success font-medium">Non-custodial:</span> You sign transactions with your own wallet. SwiftSwap never holds your funds.
          </span>
          <a
            href="https://docs.li.fi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline ml-2"
          >
            Learn more <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
