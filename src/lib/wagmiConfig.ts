import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
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
    [mainnet.id]: http(MAINNET_RPC),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [base.id]: http('https://mainnet.base.org'),
    [avalanche.id]: http('https://api.avax.network/ext/bc/C/rpc'),
    [bsc.id]: http('https://bsc-dataseed1.binance.org'),
    [fantom.id]: http('https://rpc.ftm.tools'),
    [gnosis.id]: http('https://rpc.gnosischain.com'),
    [celo.id]: http('https://forno.celo.org'),
    [moonbeam.id]: http('https://rpc.api.moonbeam.network'),
    [zksync.id]: http('https://mainnet.era.zksync.io'),
    [linea.id]: http('https://rpc.linea.build'),
    [scroll.id]: http('https://rpc.scroll.io'),
    [mantle.id]: http('https://rpc.mantle.xyz'),
    [sepolia.id]: http(SEPOLIA_RPC),
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

// Block explorer URLs for each chain
export const CHAIN_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  10: 'https://optimistic.etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  42161: 'https://arbiscan.io/tx/',
  8453: 'https://basescan.org/tx/',
  43114: 'https://snowtrace.io/tx/',
  56: 'https://bscscan.com/tx/',
  250: 'https://ftmscan.com/tx/',
  100: 'https://gnosisscan.io/tx/',
  42220: 'https://celoscan.io/tx/',
  1284: 'https://moonscan.io/tx/',
  324: 'https://era.zksync.network/tx/',
  59144: 'https://lineascan.build/tx/',
  534352: 'https://scrollscan.com/tx/',
  5000: 'https://explorer.mantle.xyz/tx/',
  11155111: 'https://sepolia.etherscan.io/tx/',
};

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const baseUrl = CHAIN_EXPLORERS[chainId] || 'https://etherscan.io/tx/';
  return `${baseUrl}${txHash}`;
}
