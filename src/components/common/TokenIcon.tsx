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
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg', // USDC.e Arbitrum
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg', // USDT Ethereum
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg', // USDT Arbitrum
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg', // DAI Ethereum
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg', // DAI Arbitrum
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg', // DAI Base
  
  // ETH variants
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Ethereum
  '0x4200000000000000000000000000000000000006': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Base/OP
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Arbitrum
  
  // BTC variants
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // WBTC Ethereum
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // cbBTC Base
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // WBTC Arbitrum
  
  // LSTs
  '0xae78736cd615f374d3085123a210448e74fc6393': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg', // rETH Ethereum
  '0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg', // rETH Arbitrum
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg', // cbETH Ethereum
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg', // cbETH Base
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH Ethereum
  '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH Base
  '0x5979d7b546e38e414f7e9822514be443a4800529': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH Arbitrum
  
  // Other popular tokens
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/mkr.svg', // MKR
  '0x514910771af9ca656af840dff83e8264ecf986cc3': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg', // LINK Ethereum
  '0xf97f4df75117a78c1a5a0dbb814af92458539fb4': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg', // LINK Arbitrum
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/uni.svg', // UNI
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/aave.svg', // AAVE
  '0x912ce59144191c1204e64559fe8253a0e49e6548': 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg', // ARB
  
  // Morpho governance
  '0x58d97b57bb95320f9a05dc918aef65434969c2b2': 'https://avatars.githubusercontent.com/u/131854917', // MORPHO
};

// Symbol-based fallback logos
const TOKEN_LOGOS_BY_SYMBOL: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDCE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
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
  ARB: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg',
  MORPHO: 'https://avatars.githubusercontent.com/u/131854917',
  GMORPHO: 'https://avatars.githubusercontent.com/u/131854917',
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
