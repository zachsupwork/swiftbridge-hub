/**
 * TokenIcon Component
 * 
 * Displays token logos with multi-level fallback:
 * 1. Address-based lookup per chain
 * 2. CDN by address
 * 3. Symbol-based fallback
 * 4. Generic token icon
 */

import { memo, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Known token addresses to logos (chain-agnostic common addresses)
const TOKEN_LOGOS_BY_ADDRESS: Record<string, string> = {
  // Stablecoins
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg', // USDC Ethereum
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg', // USDC Base
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg', // USDC Arbitrum
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg', // USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg', // DAI
  
  // ETH variants
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Ethereum
  '0x4200000000000000000000000000000000000006': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Base/OP
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Arbitrum
  
  // BTC variants
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // WBTC
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // cbBTC Base
  
  // LSTs
  '0xae78736cd615f374d3085123a210448e74fc6393': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg', // rETH
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg', // cbETH Ethereum
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg', // cbETH Base
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH
  '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH Base
  
  // Other
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/mkr.svg', // MKR
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg', // LINK
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/uni.svg', // UNI
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg', // AAVE
};

// Symbol-based fallback logos
const TOKEN_LOGOS_BY_SYMBOL: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  CBBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  STETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/steth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
  LINK: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg',
  UNI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/uni.svg',
  AAVE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg',
  MKR: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/mkr.svg',
  CRV: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/crv.svg',
  COMP: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/comp.svg',
  SNX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/snx.svg',
  SUSHI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/sushi.svg',
  GRT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/grt.svg',
  BAL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/bal.svg',
};

const GENERIC_TOKEN_LOGO = 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/generic.svg';

interface TokenIconProps {
  address?: string;
  symbol?: string;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const TokenIcon = memo(function TokenIcon({ 
  address, 
  symbol, 
  logoUrl,
  size = 'md',
  className,
}: TokenIconProps) {
  const [hasError, setHasError] = useState(false);
  const [currentFallback, setCurrentFallback] = useState(0);
  
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  // Build fallback chain
  const fallbackChain = useMemo(() => {
    const chain: string[] = [];
    
    // 1. Provided logoUrl
    if (logoUrl && logoUrl !== GENERIC_TOKEN_LOGO) {
      chain.push(logoUrl);
    }
    
    // 2. Address-based lookup
    if (address) {
      const normalizedAddress = address.toLowerCase();
      if (TOKEN_LOGOS_BY_ADDRESS[normalizedAddress]) {
        chain.push(TOKEN_LOGOS_BY_ADDRESS[normalizedAddress]);
      }
      
      // 3. CDN by address (multiple sources)
      chain.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`);
    }
    
    // 4. Symbol-based fallback
    if (symbol) {
      const normalizedSymbol = symbol.toUpperCase().replace(/[.\-]/g, '');
      if (TOKEN_LOGOS_BY_SYMBOL[normalizedSymbol]) {
        chain.push(TOKEN_LOGOS_BY_SYMBOL[normalizedSymbol]);
      }
    }
    
    // 5. Generic fallback
    chain.push(GENERIC_TOKEN_LOGO);
    
    // Remove duplicates while preserving order
    return [...new Set(chain)];
  }, [address, symbol, logoUrl]);

  const handleError = () => {
    if (currentFallback < fallbackChain.length - 1) {
      setCurrentFallback(prev => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const currentSrc = hasError ? GENERIC_TOKEN_LOGO : fallbackChain[currentFallback];

  return (
    <img
      src={currentSrc}
      alt={symbol || 'Token'}
      className={cn(sizeClasses[size], 'rounded-full bg-muted object-cover', className)}
      onError={handleError}
      loading="lazy"
    />
  );
});

export default TokenIcon;
