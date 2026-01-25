/**
 * Footer Component
 * 
 * Site navigation, contact info, and legal links
 */

import { Link } from 'react-router-dom';
import { ArrowLeftRight, TrendingUp, Wallet, BarChart3, HelpCircle, BookOpen, Mail } from 'lucide-react';
import logoImage from '@/assets/cdb-logo.png';

const NAVIGATION = [
  { label: 'Swap', path: '/swap', icon: ArrowLeftRight },
  { label: 'Earn', path: '/earn', icon: TrendingUp },
  { label: 'Portfolio', path: '/portfolio', icon: Wallet },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
];

const RESOURCES = [
  { label: 'Documentation', path: '/docs', icon: BookOpen },
  { label: 'Support', path: '/support', icon: HelpCircle },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={logoImage} 
                alt="Crypto DeFi Bridge Logo" 
                className="w-8 h-8 rounded-lg"
              />
              <span className="font-bold text-lg text-gradient">CRYPTO DEFI BRIDGE</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Non-custodial cross-chain DeFi platform for swaps, bridges, and lending.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              {NAVIGATION.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              {RESOURCES.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <a
              href="mailto:support@cryptodefibridge.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              support@cryptodefibridge.com
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/50 mt-8 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {currentYear} Crypto DeFi Bridge. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/docs" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/docs" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <span className="text-muted-foreground/50">Non-custodial • DYOR</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
