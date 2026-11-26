export type WalletChain =
  | 'Solana'
  | 'Hyperliquid'
  | 'Base'
  | 'Ethereum'
  | 'BNB Chain'
  | 'Arbitrum'
  | 'Optimism'
  | 'Polygon'
  | 'Avalanche'
  | 'Sui'
  | 'TON'
  | 'Tron'
  | 'Bitcoin';

export type WalletProviderName =
  | 'Phantom'
  | 'MetaMask'
  | 'Solflare'
  | 'Coinbase'
  | 'Browser'
  | 'Manual'
  | 'Imported'
  | 'Sandbox';

export type ProfileRimId =
  | 'none'
  | 'silver'
  | 'obsidian'
  | 'platinum'
  | 'mercury'
  | 'founder-crown';

export interface ProfileRimMeta {
  id: ProfileRimId;
  name: string;
  desc: string;
  founderOnly?: boolean;
}

export const PROFILE_RIMS: ProfileRimMeta[] = [
  {id: 'none', name: 'Minimal', desc: 'Clean hairline frame'},
  {id: 'silver', name: 'Chrome Silver', desc: 'Brushed metallic bevel'},
  {id: 'obsidian', name: 'Obsidian Matte', desc: 'Double-ring dark glass'},
  {id: 'platinum', name: 'Platinum Halo', desc: 'Pearl orbital highlight'},
  {id: 'mercury', name: 'Liquid Mercury', desc: 'Sweeping metallic sheen'},
  {
    id: 'founder-crown',
    name: 'Founder Crest',
    desc: 'Exclusive diamond-cut founder rim',
    founderOnly: true,
  },
];

export const VALID_PROFILE_RIM_IDS: ProfileRimId[] = PROFILE_RIMS.map((r) => r.id);

export const SUPPORTED_CHAINS: WalletChain[] = [
  'Solana',
  'Hyperliquid',
  'Base',
  'Ethereum',
  'BNB Chain',
  'Arbitrum',
  'Optimism',
  'Polygon',
  'Avalanche',
  'Sui',
  'TON',
  'Tron',
  'Bitcoin',
];

export const CHAIN_META: Record<
  WalletChain,
  {symbol: string; family: 'Solana' | 'Hyperliquid' | 'EVM' | 'Move' | 'TON' | 'Tron' | 'UTXO'; label: string}
> = {
  Solana: {symbol: 'SOL', family: 'Solana', label: 'Solana Mainnet'},
  Hyperliquid: {symbol: 'USDC', family: 'Hyperliquid', label: 'Hyperliquid L1'},
  Base: {symbol: 'ETH', family: 'EVM', label: 'Base L2'},
  Ethereum: {symbol: 'ETH', family: 'EVM', label: 'Ethereum Mainnet'},
  'BNB Chain': {symbol: 'BNB', family: 'EVM', label: 'BNB Smart Chain'},
  Arbitrum: {symbol: 'ETH', family: 'EVM', label: 'Arbitrum One'},
  Optimism: {symbol: 'ETH', family: 'EVM', label: 'OP Mainnet'},
  Polygon: {symbol: 'POL', family: 'EVM', label: 'Polygon PoS'},
  Avalanche: {symbol: 'AVAX', family: 'EVM', label: 'Avalanche C-Chain'},
  Sui: {symbol: 'SUI', family: 'Move', label: 'Sui Network'},
  TON: {symbol: 'TON', family: 'TON', label: 'The Open Network'},
  Tron: {symbol: 'TRX', family: 'Tron', label: 'TRON Mainnet'},
  Bitcoin: {symbol: 'BTC', family: 'UTXO', label: 'Bitcoin'},
};

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  connect: () => Promise<{publicKey: {toString: () => string}}>;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  request: (args: {method: string; params?: unknown[]}) => Promise<unknown>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: {solana?: SolanaProvider};
    solflare?: SolanaProvider;
    ethereum?: EthereumProvider;
  }
}

export function detectBrowserWallets(): {
  hasSolana: boolean;
  solanaName: WalletProviderName;
  hasEthereum: boolean;
  ethereumName: WalletProviderName;
} {
  if (typeof window === 'undefined') {
    return {
      hasSolana: false,
      solanaName: 'Browser',
      hasEthereum: false,
      ethereumName: 'Browser',
    };
  }
  const sol = window.phantom?.solana || window.solflare || window.solana;
  const eth = window.ethereum;
  return {
    hasSolana: Boolean(sol && typeof sol.connect === 'function'),
    solanaName: sol?.isPhantom ? 'Phantom' : sol?.isSolflare ? 'Solflare' : 'Browser',
    hasEthereum: Boolean(eth && typeof eth.request === 'function'),
    ethereumName: eth?.isMetaMask
      ? 'MetaMask'
      : eth?.isCoinbaseWallet
        ? 'Coinbase'
        : 'Browser',
  };
}

export async function connectBrowserSolanaWallet(): Promise<{
  chain: WalletChain;
  provider: WalletProviderName;
  address: string;
}> {
  const sol = window.phantom?.solana || window.solflare || window.solana;
  if (!sol || typeof sol.connect !== 'function') {
    throw new Error('No Solana browser wallet extension detected (Phantom / Solflare).');
  }
  const res = await sol.connect();
  const address = res?.publicKey?.toString?.();
  if (!address) {
    throw new Error('Wallet connection was cancelled or returned no address.');
  }
  return {
    chain: 'Solana',
    provider: sol.isPhantom ? 'Phantom' : sol.isSolflare ? 'Solflare' : 'Browser',
    address,
  };
}

export async function connectBrowserEvmWallet(): Promise<{
  chain: WalletChain;
  provider: WalletProviderName;
  address: string;
}> {
  const eth = window.ethereum;
  if (!eth || typeof eth.request !== 'function') {
    throw new Error('No EVM browser wallet extension detected (MetaMask / Coinbase).');
  }
  const accounts = (await eth.request({method: 'eth_requestAccounts'})) as string[];
  const address = accounts?.[0];
  if (!address) {
    throw new Error('Wallet connection was cancelled or returned no address.');
  }
  let chain: WalletChain = 'Ethereum';
  try {
    const chainId = ((await eth.request({method: 'eth_chainId'})) as string)?.toLowerCase();
    if (chainId === '0x2105') chain = 'Base';
    else if (chainId === '0x38') chain = 'BNB Chain';
    else if (chainId === '0xa4b1') chain = 'Arbitrum';
    else if (chainId === '0xa') chain = 'Optimism';
    else if (chainId === '0x89') chain = 'Polygon';
    else if (chainId === '0xa86a') chain = 'Avalanche';
  } catch {
    // default to Ethereum
  }
  return {
    chain,
    provider: eth.isMetaMask ? 'MetaMask' : eth.isCoinbaseWallet ? 'Coinbase' : 'Browser',
    address,
  };
}

export function looksLikeSecretMaterial(input: string): boolean {
  const trimmed = input.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 12) return true;
  if (/^(0x)?[a-fA-F0-9]{64}$/.test(trimmed)) return true;
  return false;
}

export function validateWalletAddress(chain: WalletChain, address: string): boolean {
  const trimmed = address.trim();
  if (looksLikeSecretMaterial(trimmed)) return false;
  if (trimmed.startsWith('klyro1') && /^[a-z0-9]{18,48}$/.test(trimmed)) {
    return true;
  }
  if (chain === 'Solana') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  }
  if (chain === 'Sui') {
    return /^0x[a-fA-F0-9]{60,66}$/.test(trimmed);
  }
  if (chain === 'TON') {
    return /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{44,48}$/.test(trimmed) || /^0:[a-fA-F0-9]{64}$/.test(trimmed);
  }
  if (chain === 'Tron') {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed);
  }
  if (chain === 'Bitcoin') {
    return /^(bc1[a-z0-9]{25,60}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(trimmed);
  }
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

export function createSandboxWalletAddress(chain: WalletChain): string {
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const hex = '0123456789abcdef';
  const b64url = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

  if (chain === 'Solana') {
    let out = 'KLyR';
    for (let i = 0; i < 40; i++) {
      out += b58[Math.floor(Math.random() * b58.length)];
    }
    return out;
  }
  if (chain === 'Sui') {
    let out = '0x';
    for (let i = 0; i < 64; i++) {
      out += hex[Math.floor(Math.random() * hex.length)];
    }
    return out;
  }
  if (chain === 'TON') {
    let out = 'UQ';
    for (let i = 0; i < 46; i++) {
      out += b64url[Math.floor(Math.random() * b64url.length)];
    }
    return out;
  }
  if (chain === 'Tron') {
    let out = 'T';
    for (let i = 0; i < 33; i++) {
      out += b58[Math.floor(Math.random() * b58.length)];
    }
    return out;
  }
  if (chain === 'Bitcoin') {
    const bech32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    let out = 'bc1q';
    for (let i = 0; i < 38; i++) {
      out += bech32[Math.floor(Math.random() * bech32.length)];
    }
    return out;
  }

  let out = '0x';
  for (let i = 0; i < 40; i++) {
    out += hex[Math.floor(Math.random() * hex.length)];
  }
  return out;
}

export function generateContractAddress(network: WalletChain): string {
  return createSandboxWalletAddress(network);
}

export function shortenAddress(address: string): string {
  if (!address || address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
