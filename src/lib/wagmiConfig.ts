import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http, fallback } from 'wagmi';
import { 
  mainnet, 
  optimism, 
  polygon, 
  arbitrum, 
  base, 
  avalanche, 
  bsc, 
  sepolia,
  fantom,
  gnosis,
  celo,
  moonbeam,
  zksync,
  linea,
  scroll,
  mantle,
} from 'wagmi/chains';

const MAINNET_RPC = import.meta.env.VITE_RPC_URL_MAINNET || 'https://eth.llamarpc.com';
const SEPOLIA_RPC = import.meta.env.VITE_RPC_URL_SEPOLIA || 'https://rpc.sepolia.org';

// All chains supported by the app - must match what LI.FI may return
export const SUPPORTED_CHAINS = [
  mainnet,
  optimism, 
  polygon,
  arbitrum,
  base,
  avalanche,
  bsc,
  fantom,
  gnosis,
  celo,
  moonbeam,
  zksync,
  linea,
  scroll,
  mantle,
  sepolia, // testnet
] as const;

// Extract chain ID type from supported chains
type SupportedChainId = typeof SUPPORTED_CHAINS[number]['id'];

// Set of supported chain IDs for quick lookup
export const SUPPORTED_CHAIN_IDS = new Set<number>(SUPPORTED_CHAINS.map(c => c.id as number));

// Check if a chain ID is supported
export function isChainSupported(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.has(chainId);
}

// Get chain name by ID
export function getChainName(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find(c => (c.id as number) === chainId);
  return chain?.name || `Chain ${chainId}`;
}

// Get all supported chain IDs as array (for logging)
export function getSupportedChainIds(): number[] {
  return Array.from(SUPPORTED_CHAIN_IDS);
}

// WalletConnect requires a real projectId from https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'cef337411d95995b3eefb18c6780234a';

if (import.meta.env.DEV && !import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) {
  console.warn('[WagmiConfig] VITE_WALLETCONNECT_PROJECT_ID not set — WalletConnect may not work. Get one at https://cloud.walletconnect.com');
}

// Explicit connectors: injected FIRST so MetaMask in-app browser uses
// the native window.ethereum provider instead of MetaMask SDK connector.
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        injectedWallet,
        walletConnectWallet,
        coinbaseWallet,
        rainbowWallet,
      ],
    },
  ],
  {
    appName: 'Crypto DeFi Bridge',
    projectId: WALLETCONNECT_PROJECT_ID,
  }
);

export const config = createConfig({
  connectors,
  chains: SUPPORTED_CHAINS,
  transports: {
    [mainnet.id]: fallback([
      http(MAINNET_RPC),
      http('https://ethereum-rpc.publicnode.com'),
      http('https://eth.drpc.org'),
      http('https://rpc.ankr.com/eth'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [optimism.id]: fallback([
      http('https://mainnet.optimism.io'),
      http('https://optimism-rpc.publicnode.com'),
      http('https://optimism.drpc.org'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [polygon.id]: fallback([
      http('https://polygon-bor-rpc.publicnode.com'),
      http('https://polygon.drpc.org'),
      http('https://rpc.ankr.com/polygon'),
      http('https://polygon-rpc.com'), // deprioritized — frequent rate limits
    ], { retryCount: 3, retryDelay: 2000 }),
    [arbitrum.id]: fallback([
      http('https://arb1.arbitrum.io/rpc'),
      http('https://arbitrum-one-rpc.publicnode.com'),
      http('https://arbitrum.drpc.org'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [base.id]: fallback([
      http('https://mainnet.base.org'),
      http('https://base-rpc.publicnode.com'),
      http('https://base.drpc.org'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [avalanche.id]: fallback([
      http('https://api.avax.network/ext/bc/C/rpc'),
      http('https://avalanche-c-chain-rpc.publicnode.com'),
      http('https://avax.meowrpc.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [bsc.id]: fallback([
      http('https://bsc-dataseed1.binance.org'),
      http('https://bsc-rpc.publicnode.com'),
      http('https://bsc.drpc.org'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [fantom.id]: fallback([
      http('https://rpc.ftm.tools'),
      http('https://fantom-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [gnosis.id]: fallback([
      http('https://rpc.gnosischain.com'),
      http('https://gnosis-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [celo.id]: fallback([
      http('https://forno.celo.org'),
      http('https://celo-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [moonbeam.id]: fallback([
      http('https://rpc.api.moonbeam.network'),
      http('https://moonbeam-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [zksync.id]: fallback([
      http('https://mainnet.era.zksync.io'),
      http('https://zksync-era-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [linea.id]: fallback([
      http('https://rpc.linea.build'),
      http('https://linea-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [scroll.id]: fallback([
      http('https://rpc.scroll.io'),
      http('https://scroll-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [mantle.id]: fallback([
      http('https://rpc.mantle.xyz'),
      http('https://mantle-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
    [sepolia.id]: fallback([
      http(SEPOLIA_RPC),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
    ], { retryCount: 2, retryDelay: 1500 }),
  },
  ssr: false,
});

// Chain metadata for UI display
export const supportedChains = [
  { id: 1, name: 'Ethereum', icon: '⟠' },
  { id: 10, name: 'Optimism', icon: '🔴' },
  { id: 137, name: 'Polygon', icon: '🟣' },
  { id: 42161, name: 'Arbitrum', icon: '🔵' },
  { id: 8453, name: 'Base', icon: '🔷' },
  { id: 43114, name: 'Avalanche', icon: '🔺' },
  { id: 56, name: 'BNB Chain', icon: '🟡' },
  { id: 250, name: 'Fantom', icon: '👻' },
  { id: 100, name: 'Gnosis', icon: '🦉' },
  { id: 42220, name: 'Celo', icon: '🌿' },
  { id: 1284, name: 'Moonbeam', icon: '🌙' },
  { id: 324, name: 'zkSync Era', icon: '⚡' },
  { id: 59144, name: 'Linea', icon: '📐' },
  { id: 534352, name: 'Scroll', icon: '📜' },
  { id: 5000, name: 'Mantle', icon: '🧥' },
  { id: 11155111, name: 'Sepolia', icon: '🧪' },
];

// Block explorer base URLs for each chain
export const CHAIN_EXPLORER_BASES: Record<number, string> = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  137: 'https://polygonscan.com',
  42161: 'https://arbiscan.io',
  8453: 'https://basescan.org',
  43114: 'https://snowtrace.io',
  56: 'https://bscscan.com',
  250: 'https://ftmscan.com',
  100: 'https://gnosisscan.io',
  42220: 'https://celoscan.io',
  1284: 'https://moonscan.io',
  324: 'https://era.zksync.network',
  59144: 'https://lineascan.build',
  534352: 'https://scrollscan.com',
  5000: 'https://explorer.mantle.xyz',
  11155111: 'https://sepolia.etherscan.io',
};

// Legacy compat — kept for existing consumers
export const CHAIN_EXPLORERS: Record<number, string> = Object.fromEntries(
  Object.entries(CHAIN_EXPLORER_BASES).map(([k, v]) => [k, `${v}/tx/`])
);

export function getExplorerBaseUrl(chainId: number): string {
  return CHAIN_EXPLORER_BASES[chainId] || 'https://etherscan.io';
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  return `${getExplorerBaseUrl(chainId)}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  return `${getExplorerBaseUrl(chainId)}/address/${address}`;
}
