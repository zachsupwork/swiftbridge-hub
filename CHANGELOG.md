# Changelog

## [1.1.0] - 2026-01-26

### Branding Updates
- **Site title** updated to "Crypto DeFi Bridge — Cross-Chain Swap + Earn (Supply & Borrow)"
- All instances of "SwiftSwap" replaced with "Crypto DeFi Bridge"
- Consistent branding across header, footer, security banner, and fee breakdowns
- Updated LI.FI integrator ID from "swiftswap" to "cryptodefibridge"
- Updated storage key from "swiftswap_history" to "cryptodefibridge_history"
- CSV export now named "crypto-defi-bridge-history-{date}.csv"

### Mobile Wallet Modal Fixes
- Modal now centered with fixed positioning and proper z-index
- Added max-height of 85vh with internal ScrollArea to prevent cut-off
- Added Framer Motion spring animations for smooth open/close
- Added safe-area padding for iOS/Android
- Modal uses backdrop blur and proper border styling

### Swap Flow Improvements
- Helper text states: "Connect wallet to get a quote" → "Click Get Quote..." → "Review quote, then click Swap"
- Button labels: Connect Wallet → Get Quote → Swap
- Chain selector only shows LI.FI-supported chains
- Clear error messages for unsupported chains/tokens

### Fee Display
- Fee breakdown shows "Crypto DeFi Bridge Fee (0.10%)" instead of "SwiftSwap Fee"
- Tooltip explains fee is applied on LI.FI routes
- Security banner updated to reference "Crypto DeFi Bridge"

### Earn (Morpho) Features
- Supply APY and Borrow APR displayed separately
- APY normalization: values ≤1.5 treated as decimal (×100)
- Default sorting: Supply APY ascending (lowest first)
- Toggle sort options: Highest APY, Lowest APY, Most Liquidity, Lowest Borrow APR
- Token logos use robust fallback hierarchy (address → CDN → symbol → generic)
- Clear explanation that supply goes to ONE market (not spread across all)
- Borrow requires collateral; shows max borrow, LTV/LLTV, health factor

### Configuration Locations
- **Fee percentage**: `VITE_LIFI_FEE` env var (default: 0.001 = 0.10%)
- **Integrator ID**: `VITE_LIFI_INTEGRATOR` env var (default: "cryptodefibridge")
- **Slippage default**: `src/components/swap/SwapCard.tsx` line 40 (default: 0.5%)
- **Supported chains**: `src/lib/wagmiConfig.ts` SUPPORTED_CHAINS array

### Files Modified
- `index.html` - Site title and meta tags
- `src/lib/wagmiConfig.ts` - App name
- `src/lib/lifiClient.ts` - Integrator ID
- `src/lib/swapStorage.ts` - Storage key
- `src/pages/Index.tsx` - Homepage branding
- `src/pages/Analytics.tsx` - Export filename
- `src/components/swap/FeeBreakdown.tsx` - Fee label
- `src/components/swap/IntegratorDebug.tsx` - Integrator reference
- `src/components/layout/SecurityBanner.tsx` - Security text
- `src/components/wallets/MultiWalletButton.tsx` - Modal styling and animations
