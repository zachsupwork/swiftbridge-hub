/**
 * Deterministic Logo Resolver
 * 
 * Single source of truth for ALL token and chain logos across the dApp.
 * URLs are computed deterministically from chainId + address — no runtime fetching.
 * 
 * Priority:
 *  1. Curated address map (instant, most common tokens)
 *  2. TrustWallet GitHub raw URL (deterministic by chainId + address)
 *  3. Curated symbol map (fallback for unknown addresses)
 *  4. Generic SVG placeholder (inline data URI, zero network)
 */

// ============================================
// GENERIC PLACEHOLDERS (inline SVG — instant)
// ============================================

export const GENERIC_TOKEN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23374151'/%3E%3Ccircle cx='20' cy='20' r='16' fill='%234B5563'/%3E%3Ctext x='20' y='25' text-anchor='middle' font-size='14' font-family='system-ui' fill='%239CA3AF'%3E%24%3C/text%3E%3C/svg%3E";

export const GENERIC_CHAIN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23374151'/%3E%3Ccircle cx='20' cy='20' r='14' stroke='%236B7280' stroke-width='2' fill='none'/%3E%3C/svg%3E";

// ============================================
// TRUSTWALLET CHAIN FOLDER NAMES
// ============================================

const TRUSTWALLET_CHAIN_MAP: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  56: 'smartchain',
  100: 'xdai',
  137: 'polygon',
  250: 'fantom',
  324: 'zksync',
  8453: 'base',
  42161: 'arbitrum',
  43114: 'avalanchec',
  59144: 'linea',
  534352: 'scroll',
  5000: 'mantle',
  42220: 'celo',
  1088: 'metis',
  1101: 'polygonzkevm',
};

// ============================================
// CURATED TOKEN LOGOS BY ADDRESS (lowercase)
// Most common DeFi tokens — resolves instantly
// ============================================

const TOKEN_BY_ADDRESS: Record<string, string> = {
  // --- Stablecoins ---
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', // USDC ETH
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png', // USDC Base
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xaf88d065e77c8cC2239327C5EDb3A432268e5831/logo.png', // USDC Arb
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/assets/0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85/logo.png', // USDC OP
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359/logo.png', // USDC Polygon
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png', // USDC Avax
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8/logo.png', // USDC.e Arb
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png', // USDT ETH
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png', // USDT Arb
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/assets/0x94b008aA00579c1307B0EF2c499aD98a8ce58e58/logo.png', // USDT OP
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png', // DAI ETH
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg', // DAI multi
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA/logo.png', // USDbC Base

  // --- ETH Variants ---
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png', // WETH ETH
  '0x4200000000000000000000000000000000000006': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Base/OP
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x82aF49447D8a07e3bd95BD0d56f35241523fBab1/logo.png', // WETH Arb
  '0x49d5c2bdffac6ce2bfdb6fd9b3a5e2b5073e7c0b': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH.e Avax

  // --- BTC Variants ---
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png', // WBTC ETH
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f/logo.png', // WBTC Arb
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // cbBTC

  // --- LSTs ---
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0/logo.png', // wstETH ETH
  '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH Base
  '0x5979d7b546e38e414f7e9822514be443a4800529': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH Arb
  '0x1f32b1c2345538c0c6f582fcb022739c4a194ebb': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg', // wstETH OP
  '0xae78736cd615f374d3085123a210448e74fc6393': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xae78736Cd615f374D3085123A210448E74Fc6393/logo.png', // rETH ETH
  '0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg', // rETH Arb
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xBe9895146f7AF43049ca1c1AE358B0541Ea49704/logo.png', // cbETH ETH
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg', // cbETH Base
  '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg', // weETH ETH
  '0x35751007a407ca6feffe80b3cb397736d2cf4dbe': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg', // weETH Arb

  // --- DeFi Tokens ---
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png', // AAVE
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png', // LINK ETH
  '0xf97f4df75117a78c1a5a0dbb814af92458539fb4': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg', // LINK Arb
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png', // UNI
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2/logo.png', // MKR
  '0xd533a949740bb3306d119cc777fa900ba034cd52': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png', // CRV
  '0xc00e94cb662c3520282e6f5717214004a7f26888': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xc00e94Cb662C3520282E6f5717214004A7f26888/logo.png', // COMP
  '0xba100000625a3754423978a60c9317c58a424e3d': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xba100000625a3754423978a60c9317c58a424e3D/logo.png', // BAL
  '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B3595068778DD592e39A122f4f5a5cF09C90fE2/logo.png', // SUSHI
  '0x912ce59144191c1204e64559fe8253a0e49e6548': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png', // ARB
  '0x4e15361fd6b4bb609fa63c81a2be19d873717870': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x4E15361FD6b4BB609Fa63C81A2be19d873717870/logo.png', // FTM
  '0xc944e90c64b2c07662a292be6244bdf05cda44a7': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xc944E90C64B2c07662A292be6244BDf05Cda44a7/logo.png', // GRT
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F/logo.png', // SNX

  // --- Polygon tokens ---
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png', // WMATIC
  '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/link.svg', // LINK Polygon
  '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6/logo.png', // WBTC Polygon
  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg', // WETH Polygon

  // --- Avalanche ---
  '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png', // WAVAX
  '0x152b9d0fdc40c096de345d4be12b83c1b0560b39': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // BTC.b Avax
  '0x50b7545627a5162f82a992c33b87adc75187b218': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg', // WBTC.e Avax

  // --- Morpho ---
  '0x58d97b57bb95320f9a05dc918aef65434969c2b2': 'https://cdn.morpho.org/assets/logos/morpho.svg', // MORPHO

  // --- Ethena ---
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg', // USDe
  '0x9d39a5de30e57443bff2a8307a4256c8797a3497': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg', // sUSDe

  // --- GHO ---
  '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f': 'https://app.aave.com/icons/tokens/gho.svg', // GHO
};

// ============================================
// CURATED TOKEN LOGOS BY SYMBOL (fallback)
// ============================================

const TOKEN_BY_SYMBOL: Record<string, string> = {
  ETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  WETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/weth.svg',
  USDC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  'USDC.E': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDCE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  USDT: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdt.svg',
  DAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  SDAI: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/dai.svg',
  WBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  'BTC.B': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  BTCB: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  CBBTC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbtc.svg',
  CBETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/cbeth.svg',
  WSTETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wsteth.svg',
  STETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/steth.svg',
  RETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
  WEETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  EZETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
  OSETH: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/eth.svg',
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
  ARB: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png',
  OP: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg',
  MATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
  WMATIC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
  POL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
  AVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg',
  WAVAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg',
  GHO: 'https://app.aave.com/icons/tokens/gho.svg',
  MORPHO: 'https://cdn.morpho.org/assets/logos/morpho.svg',
  GMORPHO: 'https://cdn.morpho.org/assets/logos/morpho.svg',
  USDE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  SUSDE: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  PYUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  LUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  FRAX: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  BUSD: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  EURS: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  AGEUR: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/usdc.svg',
  RPL: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/reth.svg',
  ENS: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72/logo.png',
  LDO: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32/logo.png',
  '1INCH': 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/1inch.svg',
  KNC: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/knc.svg',
};

// ============================================
// CHAIN LOGOS
// ============================================

const CHAIN_LOGOS: Record<number, string> = {
  1: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/ethereum.svg',
  10: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/optimism.svg',
  56: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/bsc.svg',
  100: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/gnosis.svg',
  130: 'https://raw.githubusercontent.com/uniswap/assets/master/blockchains/unichain/info/logo.png',
  137: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg',
  250: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/fantom.svg',
  324: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/zksync.svg',
  1088: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/metis.svg',
  5000: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/mantle.svg',
  8453: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/base.svg',
  42161: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/arbitrum.svg',
  42220: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/celo.svg',
  43114: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/avalanche.svg',
  59144: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/linea.svg',
  534352: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/scroll.svg',
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  100: 'Gnosis',
  130: 'Unichain',
  137: 'Polygon',
  250: 'Fantom',
  324: 'zkSync Era',
  1088: 'Metis',
  5000: 'Mantle',
  8453: 'Base',
  42161: 'Arbitrum',
  42220: 'Celo',
  43114: 'Avalanche',
  59144: 'Linea',
  534352: 'Scroll',
};

// ============================================
// RESOLVER FUNCTIONS
// ============================================

/**
 * Deterministically resolve a token logo URL.
 * Priority: curated address → TrustWallet by address → curated symbol → generic placeholder.
 * 
 * If a logoURI is provided (e.g. from an API), it is used as the highest priority.
 */
export function resolveTokenLogo(
  opts: {
    address?: string;
    symbol?: string;
    chainId?: number;
    logoURI?: string;
  }
): string {
  const { address, symbol, chainId, logoURI } = opts;

  // 1. Provided logoURI (from API like Morpho GraphQL)
  if (logoURI && logoURI.length > 10 && !logoURI.includes('generic')) {
    return logoURI;
  }

  // 2. Curated address lookup
  if (address) {
    const normalized = address.toLowerCase();
    const curated = TOKEN_BY_ADDRESS[normalized];
    if (curated) return curated;
  }

  // 3. TrustWallet deterministic URL by chainId + address
  if (address && chainId) {
    const twChain = TRUSTWALLET_CHAIN_MAP[chainId];
    if (twChain) {
      // TrustWallet uses checksummed addresses in folder names,
      // but raw.githubusercontent serves case-insensitively for most chains
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${address}/logo.png`;
    }
  }

  // 4. Symbol fallback
  if (symbol) {
    const norm = symbol.toUpperCase().replace(/[.\-\s]/g, '');
    // Strip aToken / debt token prefix for underlying resolution
    const stripped = norm.replace(/^(A|VARIABLE_DEBT_|STABLE_DEBT_|VARIABLEDEBT|STABLEDEBT)/, '');
    const found = TOKEN_BY_SYMBOL[stripped] || TOKEN_BY_SYMBOL[norm];
    if (found) return found;
  }

  return GENERIC_TOKEN_ICON;
}

/**
 * Deterministically resolve a chain logo URL.
 */
export function resolveChainLogo(chainId: number): string {
  return CHAIN_LOGOS[chainId] || GENERIC_CHAIN_ICON;
}

/**
 * Get chain name by ID.
 */
export function resolveChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

/**
 * Build an array of fallback URLs for a token, used by image components
 * that want multi-step fallback via onError.
 */
export function buildTokenLogoFallbacks(opts: {
  address?: string;
  symbol?: string;
  chainId?: number;
  logoURI?: string;
}): string[] {
  const urls: string[] = [];
  const { address, symbol, chainId, logoURI } = opts;

  if (logoURI && logoURI.length > 10 && !logoURI.includes('generic')) {
    urls.push(logoURI);
  }

  if (address) {
    const normalized = address.toLowerCase();
    const curated = TOKEN_BY_ADDRESS[normalized];
    if (curated) urls.push(curated);

    if (chainId) {
      const twChain = TRUSTWALLET_CHAIN_MAP[chainId];
      if (twChain) {
        urls.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${address}/logo.png`);
      }
    }
  }

  if (symbol) {
    const norm = symbol.toUpperCase().replace(/[.\-\s]/g, '');
    const stripped = norm.replace(/^(A|VARIABLE_DEBT_|STABLE_DEBT_|VARIABLEDEBT|STABLEDEBT)/, '');
    const found = TOKEN_BY_SYMBOL[stripped] || TOKEN_BY_SYMBOL[norm];
    if (found) urls.push(found);
  }

  urls.push(GENERIC_TOKEN_ICON);

  // Dedupe preserving order
  return [...new Set(urls)];
}
