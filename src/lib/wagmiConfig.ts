import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, optimism, polygon, arbitrum, base, sepolia } from 'wagmi/chains';
import { http } from 'wagmi';

const MAINNET_RPC = import.meta.env.VITE_RPC_URL_MAINNET || 'https://eth.llamarpc.com';
const SEPOLIA_RPC = import.meta.env.VITE_RPC_URL_SEPOLIA || 'https://rpc.sepolia.org';

export const config = getDefaultConfig({
  appName: 'SwiftSwap Aggregator',
  projectId: 'swiftswap-demo', // For demo purposes
  chains: [mainnet, optimism, polygon, arbitrum, base, sepolia],
  transports: {
    [mainnet.id]: http(MAINNET_RPC),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [base.id]: http('https://mainnet.base.org'),
    [sepolia.id]: http(SEPOLIA_RPC),
  },
  ssr: false,
});

export const supportedChains = [
  { id: 1, name: 'Ethereum', icon: '⟠' },
  { id: 10, name: 'Optimism', icon: '🔴' },
  { id: 137, name: 'Polygon', icon: '🟣' },
  { id: 42161, name: 'Arbitrum', icon: '🔵' },
  { id: 8453, name: 'Base', icon: '🔷' },
  { id: 11155111, name: 'Sepolia', icon: '🧪' },
];
