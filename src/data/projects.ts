import {RoleBadge} from '../lib/firebase';
import {ProfileRimId, WalletChain, WalletProviderName} from '../lib/wallets';

export type ProjectCategory =
  | 'All'
  | 'AI'
  | 'Developer Tools'
  | 'Games'
  | 'Design'
  | 'Open Source'
  | 'Education';

export type ArtworkVariant =
  | 'klyro'
  | 'nova'
  | 'zenith'
  | 'orbit'
  | 'pixelcraft'
  | 'stackforge'
  | 'edusphere';

export interface ProjectComment {
  id: string;
  projectId?: string;
  authorUid?: string;
  author: string;
  handle: string;
  timeAgo: string;
  body: string;
  createdAt?: string;
}

export interface ProjectFileRecord {
  id: string;
  projectId: string;
  ownerUid: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  previewText?: string;
  createdAt: string;
}

export type CoinAssetClass = 'coin' | 'perp' | 'stock';

export interface ProjectCoin {
  id: string;
  projectId: string;
  ownerUid: string;
  name: string;
  ticker: string;
  network: WalletChain;
  contractAddress: string;
  creatorWallet?: string;
  assetClass?: CoinAssetClass;
  stockSymbol?: string;
  stockCompany?: string;
  stockExchange?: string;
  fundingRatePct?: number;
  openInterestUsd?: number;
  maxLeverage?: number;
  totalSupply: number;
  creatorFeePct: number;
  targetCapUsd: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  bondingProgress: number;
  holdersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoinTrade {
  id: string;
  coinId: string;
  traderUid: string;
  traderHandle: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  tokenAmount: number;
  priceUsd: number;
  leverage?: number;
  createdAt: string;
}

export interface LinkedWallet {
  id: string;
  uid: string;
  chain: WalletChain;
  provider: WalletProviderName;
  address: string;
  label: string;
  isPrimary: boolean;
  verified: boolean;
  linkedAt: string;
}

export interface UserHolding {
  uid: string;
  coinId: string;
  ticker: string;
  balance: number;
  avgBuyPriceUsd: number;
  updatedAt: string;
}

export interface KlyroNotification {
  id: string;
  title: string;
  detail: string;
  timeAgo: string;
  read: boolean;
  projectId?: string;
  createdAt: string;
}

export interface KlyroProject {
  id: string;
  ownerUid?: string;
  name: string;
  tagline: string;
  description: string;
  category: Exclude<ProjectCategory, 'All'>;
  tags: string[];
  creatorName: string;
  creatorHandle: string;
  views: number;
  likes: number;
  artwork: ArtworkVariant;
  customCoverUrl?: string;
  coinId?: string;
  coinTicker?: string;
  contractAddress?: string;
  verified: boolean;
  officialPublished?: boolean;
  trendingRank: number;
  hasCinemaDemo?: boolean;
  isUserCreated?: boolean;
  createdAt?: string;
  updatedAt?: string;
  updates: {version: string; date: string; note: string}[];
  comments: ProjectComment[];
  files?: ProjectFileRecord[];
}

export interface StudioTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: Exclude<ProjectCategory, 'All'>;
  artwork: ArtworkVariant;
}

export interface StudioSettings {
  displayName: string;
  creatorHandle: string;
  bio: string;
  photoURL?: string;
  profileRim?: ProfileRimId;
  theme?: 'light' | 'dark';
  badges: RoleBadge[];
  proEnabled: boolean;
  sandboxBalanceUsd: number;
  demoWalletConnected: boolean;
  demoWalletAddress: string;
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(Math.round(value));
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatPriceUsd(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatEngagementRate(likes: number, views: number): string {
  if (views <= 0) return '0.0%';
  return `${((likes / views) * 100).toFixed(1)}%`;
}

export const CATEGORIES: ProjectCategory[] = [
  'All',
  'AI',
  'Developer Tools',
  'Games',
  'Design',
  'Open Source',
  'Education',
];

export interface StockPreset {
  symbol: string;
  company: string;
  exchange: string;
  refPriceUsd: number;
}

export const STOCK_PRESETS: StockPreset[] = [
  {symbol: 'NVDA', company: 'NVIDIA Corp.', exchange: 'NASDAQ', refPriceUsd: 142.85},
  {symbol: 'TSLA', company: 'Tesla Inc.', exchange: 'NASDAQ', refPriceUsd: 338.6},
  {symbol: 'AAPL', company: 'Apple Inc.', exchange: 'NASDAQ', refPriceUsd: 229.45},
  {symbol: 'MSFT', company: 'Microsoft Corp.', exchange: 'NASDAQ', refPriceUsd: 421.1},
  {symbol: 'COIN', company: 'Coinbase Global', exchange: 'NASDAQ', refPriceUsd: 294.3},
  {symbol: 'SPY', company: 'SPDR S&P 500 ETF', exchange: 'NYSE', refPriceUsd: 598.2},
  {symbol: 'AMZN', company: 'Amazon.com Inc.', exchange: 'NASDAQ', refPriceUsd: 208.4},
  {symbol: 'META', company: 'Meta Platforms', exchange: 'NASDAQ', refPriceUsd: 576.15},
  {symbol: 'GOOGL', company: 'Alphabet Inc.', exchange: 'NASDAQ', refPriceUsd: 179.8},
];

export const DEFAULT_SETTINGS: StudioSettings = {
  displayName: 'Klyro Creator',
  creatorHandle: '@klyro_builder',
  bio: 'Building and launching on Klyro.',
  photoURL: '',
  profileRim: 'silver',
  theme: 'light',
  badges: [],
  proEnabled: false,
  sandboxBalanceUsd: 5000,
  demoWalletConnected: true,
  demoWalletAddress: 'KLyR9x4M7vQwP2nZ8tB3kL5sD6fG1hJ2mN4pQ8rS7tU9',
};

export const INITIAL_COINS: ProjectCoin[] = [
  {
    id: 'coin-klyro-studio',
    projectId: 'klyro-studio',
    ownerUid: 'klyro-official',
    name: 'Klyro Studio',
    ticker: 'KLYR',
    network: 'Solana',
    contractAddress: 'KLyR8mP4xQ9vN2wL7zR5tB3cV6nM1kJ4hG8fD2sA9pE3w',
    creatorWallet: 'KLyR8mP4xQ9vN2wL7zR5tB3cV6nM1kJ4hG8fD2sA9pE3w',
    assetClass: 'coin',
    totalSupply: 1_000_000_000,
    creatorFeePct: 0.5,
    targetCapUsd: 69000,
    priceUsd: 0.000542,
    marketCapUsd: 54200,
    volume24hUsd: 178400,
    bondingProgress: 78.5,
    holdersCount: 1842,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-hl-hype',
    projectId: 'klyro-studio',
    ownerUid: 'hyperliquid-official',
    name: 'Hyperliquid',
    ticker: 'HYPE',
    network: 'Hyperliquid',
    contractAddress: '0x0d01dc56dcaaca66ad901c959b4011ec1d68f10a',
    assetClass: 'perp',
    fundingRatePct: 0.0124,
    openInterestUsd: 184200000,
    maxLeverage: 20,
    totalSupply: 1_000_000_000,
    creatorFeePct: 0.02,
    targetCapUsd: 500000000,
    priceUsd: 26.84,
    marketCapUsd: 268400000,
    volume24hUsd: 94150000,
    bondingProgress: 100,
    holdersCount: 94210,
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-hl-purr',
    projectId: 'zenith',
    ownerUid: 'hyperliquid-official',
    name: 'Purr Hyperliquid',
    ticker: 'PURR',
    network: 'Hyperliquid',
    contractAddress: '0xc1fb593aeffbeb02f85e0308e9956a90a237e95d',
    assetClass: 'coin',
    fundingRatePct: 0.0085,
    openInterestUsd: 14200000,
    maxLeverage: 5,
    totalSupply: 600_000_000,
    creatorFeePct: 0.05,
    targetCapUsd: 200000000,
    priceUsd: 0.284,
    marketCapUsd: 170400000,
    volume24hUsd: 19240000,
    bondingProgress: 85.2,
    holdersCount: 38420,
    createdAt: '2026-11-03T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-hl-solp',
    projectId: 'orbit-ai',
    ownerUid: 'hyperliquid-official',
    name: 'Solana Perp',
    ticker: 'SOLP',
    network: 'Hyperliquid',
    contractAddress: '0x4a2f81b3d0279e4a1f62e78b2b10c9c01d39a401',
    assetClass: 'perp',
    fundingRatePct: 0.0156,
    openInterestUsd: 412500000,
    maxLeverage: 40,
    totalSupply: 500_000_000,
    creatorFeePct: 0.02,
    targetCapUsd: 1000000000,
    priceUsd: 214.6,
    marketCapUsd: 892000000,
    volume24hUsd: 620400000,
    bondingProgress: 100,
    holdersCount: 121400,
    createdAt: '2026-11-03T11:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-hl-btcp',
    projectId: 'stackforge',
    ownerUid: 'hyperliquid-official',
    name: 'Bitcoin Perp',
    ticker: 'BTCP',
    network: 'Hyperliquid',
    contractAddress: '0x8b11e4a92c03198d4b2f09a1e3c780b4f21c8912',
    assetClass: 'perp',
    fundingRatePct: 0.0102,
    openInterestUsd: 1240000000,
    maxLeverage: 40,
    totalSupply: 21_000_000,
    creatorFeePct: 0.02,
    targetCapUsd: 2000000000,
    priceUsd: 96420.0,
    marketCapUsd: 1910000000,
    volume24hUsd: 1480000000,
    bondingProgress: 100,
    holdersCount: 192300,
    createdAt: '2026-11-03T12:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-stk-nvdax',
    projectId: 'orbit-ai',
    ownerUid: 'klyro-stocks',
    name: 'NVIDIA Tokenized Stock',
    ticker: 'NVDAX',
    network: 'Hyperliquid',
    contractAddress: '0x5d902a1f4b8c3219e8f1a774b0d92c43a81f0011',
    assetClass: 'stock',
    stockSymbol: 'NVDA',
    stockCompany: 'NVIDIA Corp.',
    stockExchange: 'NASDAQ',
    fundingRatePct: 0.0045,
    openInterestUsd: 64200000,
    maxLeverage: 10,
    totalSupply: 10_000_000,
    creatorFeePct: 0.1,
    targetCapUsd: 100000000,
    priceUsd: 142.85,
    marketCapUsd: 68400000,
    volume24hUsd: 24900000,
    bondingProgress: 100,
    holdersCount: 14820,
    createdAt: '2026-11-04T09:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-stk-tslax',
    projectId: 'pixelcraft',
    ownerUid: 'klyro-stocks',
    name: 'Tesla Tokenized Stock',
    ticker: 'TSLAX',
    network: 'Solana',
    contractAddress: 'TSLa7xQ9vN2wL7zR5tB3cV6nM1kJ4hG8fD2sA9pE3w91',
    assetClass: 'stock',
    stockSymbol: 'TSLA',
    stockCompany: 'Tesla Inc.',
    stockExchange: 'NASDAQ',
    maxLeverage: 10,
    totalSupply: 5_000_000,
    creatorFeePct: 0.1,
    targetCapUsd: 80000000,
    priceUsd: 338.6,
    marketCapUsd: 49200000,
    volume24hUsd: 18400000,
    bondingProgress: 100,
    holdersCount: 11240,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-stk-aaplx',
    projectId: 'nova-studio',
    ownerUid: 'klyro-stocks',
    name: 'Apple Tokenized Stock',
    ticker: 'AAPLX',
    network: 'Base',
    contractAddress: '0x3a91c08d5b724f0192b8c73e12d44a90b77c2201',
    assetClass: 'stock',
    stockSymbol: 'AAPL',
    stockCompany: 'Apple Inc.',
    stockExchange: 'NASDAQ',
    maxLeverage: 10,
    totalSupply: 5_000_000,
    creatorFeePct: 0.1,
    targetCapUsd: 60000000,
    priceUsd: 229.45,
    marketCapUsd: 38100000,
    volume24hUsd: 11200000,
    bondingProgress: 100,
    holdersCount: 8940,
    createdAt: '2026-11-04T11:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-stk-coinx',
    projectId: 'stackforge',
    ownerUid: 'klyro-stocks',
    name: 'Coinbase Tokenized Stock',
    ticker: 'COINX',
    network: 'Hyperliquid',
    contractAddress: '0x7c82b19a6e430d192f8a331c55e21d87f90b4402',
    assetClass: 'stock',
    stockSymbol: 'COIN',
    stockCompany: 'Coinbase Global',
    stockExchange: 'NASDAQ',
    fundingRatePct: 0.0052,
    openInterestUsd: 21500000,
    maxLeverage: 10,
    totalSupply: 4_000_000,
    creatorFeePct: 0.1,
    targetCapUsd: 40000000,
    priceUsd: 294.3,
    marketCapUsd: 27400000,
    volume24hUsd: 9840000,
    bondingProgress: 100,
    holdersCount: 6150,
    createdAt: '2026-11-04T11:30:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-nova-studio',
    projectId: 'nova-studio',
    ownerUid: 'nova-official',
    name: 'Nova Studio',
    ticker: 'NOVA',
    network: 'Base',
    contractAddress: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788',
    creatorWallet: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788',
    assetClass: 'coin',
    totalSupply: 1_000_000_000,
    creatorFeePct: 0.5,
    targetCapUsd: 69000,
    priceUsd: 0.000418,
    marketCapUsd: 41800,
    volume24hUsd: 94200,
    bondingProgress: 60.6,
    holdersCount: 912,
    createdAt: '2026-11-04T12:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-zenith',
    projectId: 'zenith',
    ownerUid: 'zenith-official',
    name: 'Zenith',
    ticker: 'ZNTH',
    network: 'Solana',
    contractAddress: 'ZNth4pK9wR2mX6vL8qJ3nB5cT7yF1dS9hA2gE4uW6rM8p',
    creatorWallet: 'ZNth4pK9wR2mX6vL8qJ3nB5cT7yF1dS9hA2gE4uW6rM8p',
    assetClass: 'coin',
    totalSupply: 1_000_000_000,
    creatorFeePct: 0.5,
    targetCapUsd: 69000,
    priceUsd: 0.000295,
    marketCapUsd: 29500,
    volume24hUsd: 61500,
    bondingProgress: 42.8,
    holdersCount: 640,
    createdAt: '2026-11-06T14:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'coin-orbit-ai',
    projectId: 'orbit-ai',
    ownerUid: 'orbit-official',
    name: 'Orbit AI',
    ticker: 'ORBT',
    network: 'Base',
    contractAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    creatorWallet: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    assetClass: 'coin',
    totalSupply: 1_000_000_000,
    creatorFeePct: 1.0,
    targetCapUsd: 69000,
    priceUsd: 0.000234,
    marketCapUsd: 23400,
    volume24hUsd: 48900,
    bondingProgress: 33.9,
    holdersCount: 518,
    createdAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
  },
];

export const INITIAL_TRADES: Record<string, CoinTrade[]> = {
  'coin-klyro-studio': [
    {
      id: 'tr-1',
      coinId: 'coin-klyro-studio',
      traderUid: 'seed-1',
      traderHandle: '@elenavance',
      side: 'buy',
      amountUsd: 420,
      tokenAmount: 774907,
      priceUsd: 0.000542,
      createdAt: '2026-11-25T09:42:00.000Z',
    },
    {
      id: 'tr-2',
      coinId: 'coin-klyro-studio',
      traderUid: 'seed-2',
      traderHandle: '@mchen_dev',
      side: 'buy',
      amountUsd: 185,
      tokenAmount: 346479,
      priceUsd: 0.000534,
      createdAt: '2026-11-25T09:18:00.000Z',
    },
    {
      id: 'tr-3',
      coinId: 'coin-klyro-studio',
      traderUid: 'seed-3',
      traderHandle: '@sorat',
      side: 'sell',
      amountUsd: 95,
      tokenAmount: 179924,
      priceUsd: 0.000528,
      createdAt: '2026-11-25T08:55:00.000Z',
    },
  ],
  'coin-hl-hype': [
    {
      id: 'tr-hl-1',
      coinId: 'coin-hl-hype',
      traderUid: 'seed-hl-1',
      traderHandle: '@hl_whale',
      side: 'buy',
      amountUsd: 2450,
      tokenAmount: 91.28,
      priceUsd: 26.84,
      leverage: 10,
      createdAt: '2026-11-25T09:50:00.000Z',
    },
  ],
  'coin-stk-nvdax': [
    {
      id: 'tr-stk-1',
      coinId: 'coin-stk-nvdax',
      traderUid: 'seed-stk-1',
      traderHandle: '@quant_desk',
      side: 'buy',
      amountUsd: 1428.5,
      tokenAmount: 10,
      priceUsd: 142.85,
      leverage: 5,
      createdAt: '2026-11-25T09:47:00.000Z',
    },
  ],
};

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: 'tpl-product-drop',
    name: 'Minimal Product Drop',
    tagline: 'Clean. Focused. Ready.',
    description: 'High-contrast monochrome showcase built for design tools and product launches.',
    category: 'Design',
    artwork: 'klyro',
  },
  {
    id: 'tpl-ai-agent',
    name: 'AI Agent Showcase',
    tagline: 'Structured intelligence.',
    description: 'Present autonomous workflows, prompt architectures, and live evaluation traces.',
    category: 'AI',
    artwork: 'orbit',
  },
  {
    id: 'tpl-dev-cli',
    name: 'Developer CLI Docs',
    tagline: 'Zero-config tooling.',
    description: 'Showcase open-source packages, command ergonomics, and reproducible benchmarks.',
    category: 'Developer Tools',
    artwork: 'stackforge',
  },
  {
    id: 'tpl-motion-reel',
    name: 'Motion System Reel',
    tagline: 'Precision kinetics.',
    description: 'Interactive motion language kit with timing curves and spatial transitions.',
    category: 'Design',
    artwork: 'zenith',
  },
];

export const INITIAL_PROJECTS: KlyroProject[] = [
  {
    id: 'klyro-studio',
    ownerUid: 'klyro-official',
    name: 'Klyro Studio',
    tagline: 'Create. Innovate. Share.',
    description:
      'A modern platform to design, build, and showcase your ideas with ease. Built for creators, builders, and community launches.',
    category: 'Design',
    tags: ['Design', 'Productivity', 'Creative', 'Web'],
    creatorName: 'Klyro Team',
    creatorHandle: '@klyro',
    views: 248000,
    likes: 12000,
    artwork: 'klyro',
    coinId: 'coin-klyro-studio',
    coinTicker: 'KLYR',
    contractAddress: 'KLyR8mP4xQ9vN2wL7zR5tB3cV6nM1kJ4hG8fD2sA9pE3w',
    verified: true,
    trendingRank: 1,
    hasCinemaDemo: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [
      {
        version: 'Release 2.4',
        date: 'November 2026',
        note: 'Introduced instant 4-step creator launch studio with live preview cards, file attachments, and paired coin launches.',
      },
      {
        version: 'Release 2.1',
        date: 'October 2026',
        note: 'Added high-contrast obsidian media showcase and verified creator handles.',
      },
    ],
    comments: [
      {
        id: 'c1',
        author: 'Elena Vance',
        handle: '@elenavance',
        timeAgo: '2h ago',
        body: 'The monochrome studio layout and live preview flow feel remarkably crisp.',
      },
      {
        id: 'c2',
        author: 'Marcus Chen',
        handle: '@mchen_dev',
        timeAgo: '6h ago',
        body: 'Published our first release and paired token in under four minutes. Zero friction.',
      },
    ],
    files: [
      {
        id: 'file-klyro-app',
        projectId: 'klyro-studio',
        ownerUid: 'klyro-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1890,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #09090b; color: #f4f4f5; padding: 24px; display: grid; gap: 16px; }
  .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 18px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .title { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
  .sub { font-size: 12px; color: #a1a1aa; }
  input[type=range] { width: 100%; accent-color: #ffffff; }
  .preview { border-radius: 14px; padding: 22px; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.12); }
  .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #27272a; color: #e4e4e7; }
  button { background: #ffffff; color: #09090b; border: 0; border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
  <div class="card row">
    <div>
      <div class="title">Klyro Contrast &amp; Surface Calibrator</div>
      <div class="sub">Interactive monochrome elevation &amp; contrast ratio workbench</div>
    </div>
    <span id="ratio" class="pill">Contrast: 19.4 : 1 (AAA)</span>
  </div>
  <div class="card" style="display:grid;gap:14px;">
    <div class="row"><span class="sub">Surface Luminance</span><span id="lumVal" class="sub">9%</span></div>
    <input id="lum" type="range" min="4" max="96" value="9" />
    <div class="row"><span class="sub">Silver Specular Rim</span><span id="rimVal" class="sub">18%</span></div>
    <input id="rim" type="range" min="5" max="60" value="18" />
    <div id="stage" class="preview">
      <div class="row" style="margin-bottom:8px;"><span style="font-weight:700;font-size:18px;">Klyro Obsidian Glass</span><button id="invert">Invert Polarity</button></div>
      <div id="copy" style="font-size:13px;opacity:0.78;">Zero-noise hierarchy calibrated for studio clarity and real-time execution.</div>
    </div>
  </div>
  <script>
    const lum = document.getElementById('lum');
    const rim = document.getElementById('rim');
    const stage = document.getElementById('stage');
    const ratio = document.getElementById('ratio');
    const lumVal = document.getElementById('lumVal');
    const rimVal = document.getElementById('rimVal');
    function update() {
      const l = Number(lum.value);
      const r = Number(rim.value);
      const darkInk = l > 52;
      stage.style.background = 'hsl(240, 6%, ' + l + '%)';
      stage.style.color = darkInk ? '#09090b' : '#fafafa';
      stage.style.borderColor = darkInk ? 'rgba(9,9,11,' + (r/100) + ')' : 'rgba(255,255,255,' + (r/100) + ')';
      lumVal.textContent = l + '%';
      rimVal.textContent = r + '%';
      const cr = Math.max(1.2, Math.abs((darkInk ? 5 : 98) - l) / 4.3).toFixed(1);
      ratio.textContent = 'Contrast: ' + cr + ' : 1 (' + (cr >= 7 ? 'AAA' : cr >= 4.5 ? 'AA' : 'Low') + ')';
    }
    lum.oninput = update;
    rim.oninput = update;
    document.getElementById('invert').onclick = () => { lum.value = Number(lum.value) > 50 ? 9 : 94; update(); };
    update();
  </script>
</body>
</html>`,
        createdAt: '2026-11-01T09:55:00.000Z',
      },
      {
        id: 'file-klyro-readme',
        projectId: 'klyro-studio',
        ownerUid: 'klyro-official',
        name: 'README.md',
        mimeType: 'text/markdown',
        sizeBytes: 428,
        url: '',
        previewText:
          '# Klyro Studio\n\nEverything starts with an idea.\n\n## Architecture\n- Deterministic 60fps 15s product film engine\n- Fair-curve token launch studio\n- Multi-chain wallet linking (Solana, Hyperliquid, Base, Ethereum)\n',
        createdAt: '2026-11-01T10:00:00.000Z',
      },
      {
        id: 'file-klyro-tokenomics',
        projectId: 'klyro-studio',
        ownerUid: 'klyro-official',
        name: 'tokenomics.json',
        mimeType: 'application/json',
        sizeBytes: 246,
        url: '',
        previewText: JSON.stringify(
          {
            ticker: 'KLYR',
            network: 'Solana',
            totalSupply: 1000000000,
            creatorFeePct: 0.5,
            migrationTargetUsd: 69000,
          },
          null,
          2
        ),
        createdAt: '2026-11-01T10:05:00.000Z',
      },
    ],
  },
  {
    id: 'nova-studio',
    ownerUid: 'nova-official',
    name: 'Nova Studio',
    tagline: 'Create. Innovate. Share.',
    description:
      'Minimalist creative workspace for spatial interfaces, interactive prototypes, and team design systems.',
    category: 'Design',
    tags: ['Design', 'Systems', 'Studio'],
    creatorName: 'Nova Collective',
    creatorHandle: '@novastudio',
    views: 128000,
    likes: 4800,
    artwork: 'nova',
    coinId: 'coin-nova-studio',
    coinTicker: 'NOVA',
    contractAddress: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788',
    verified: true,
    trendingRank: 2,
    createdAt: '2026-11-04T12:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [
      {
        version: 'v1.8',
        date: 'November 2026',
        note: 'Added real-time vector snapping and monochrome component tokens.',
      },
    ],
    comments: [
      {
        id: 'c3',
        author: 'Sora Takahashi',
        handle: '@sorat',
        timeAgo: '1d ago',
        body: 'Cleanest prototyping surface we have used this year.',
      },
    ],
    files: [
      {
        id: 'file-nova-app',
        projectId: 'nova-studio',
        ownerUid: 'nova-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1750,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #fafafa; color: #09090b; padding: 22px; display: grid; gap: 14px; }
  .panel { background: #fff; border: 1px solid #e4e4e7; border-radius: 14px; padding: 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .box { background: #09090b; color: #fff; padding: 16px; font-size: 12px; font-weight: 600; transition: all 0.2s; }
  .row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #52525b; }
  input { width: 100%; accent-color: #09090b; }
</style>
</head>
<body>
  <div class="panel">
    <div style="font-weight:700;font-size:15px;">Nova Spatial Token Lab</div>
    <div style="font-size:12px;color:#71717a;margin-top:2px;">Live radius, gap, and elevation generator</div>
  </div>
  <div class="panel" style="display:grid;gap:10px;">
    <div class="row"><span>Corner Radius</span><strong id="rOut">14px</strong></div>
    <input id="rad" type="range" min="0" max="28" value="14" />
    <div class="row"><span>Spatial Gap</span><strong id="gOut">10px</strong></div>
    <input id="gap" type="range" min="4" max="24" value="10" />
    <div id="grid" class="grid">
      <div class="box">Card 01<br><span style="opacity:.6;font-weight:400;">Surface Alpha</span></div>
      <div class="box">Card 02<br><span style="opacity:.6;font-weight:400;">Surface Beta</span></div>
      <div class="box">Card 03<br><span style="opacity:.6;font-weight:400;">Surface Gamma</span></div>
    </div>
  </div>
  <script>
    const rad = document.getElementById('rad');
    const gap = document.getElementById('gap');
    const grid = document.getElementById('grid');
    function sync() {
      document.getElementById('rOut').textContent = rad.value + 'px';
      document.getElementById('gOut').textContent = gap.value + 'px';
      grid.style.gap = gap.value + 'px';
      document.querySelectorAll('.box').forEach(b => b.style.borderRadius = rad.value + 'px');
    }
    rad.oninput = sync;
    gap.oninput = sync;
    sync();
  </script>
</body>
</html>`,
        createdAt: '2026-11-04T11:55:00.000Z',
      },
      {
        id: 'file-nova-tokens',
        projectId: 'nova-studio',
        ownerUid: 'nova-official',
        name: 'design-tokens.json',
        mimeType: 'application/json',
        sizeBytes: 192,
        url: '',
        previewText: '{\n  "surface": "#FFFFFF",\n  "ink": "#09090B",\n  "silver": "#D4D4D8"\n}',
        createdAt: '2026-11-04T12:00:00.000Z',
      },
    ],
  },
  {
    id: 'zenith',
    ownerUid: 'zenith-official',
    name: 'Zenith',
    tagline: 'Next-gen design tools.',
    description:
      'Precision motion curves, parametric typography, and fluid glass shaders for modern web products.',
    category: 'Design',
    tags: ['Motion', 'Design', 'Web'],
    creatorName: 'Zenith Labs',
    creatorHandle: '@zenithlabs',
    views: 98000,
    likes: 3100,
    artwork: 'zenith',
    coinId: 'coin-zenith',
    coinTicker: 'ZNTH',
    contractAddress: 'ZNth4pK9wR2mX6vL8qJ3nB5cT7yF1dS9hA2gE4uW6rM8p',
    verified: true,
    trendingRank: 3,
    createdAt: '2026-11-06T14:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [
      {
        version: 'v3.0',
        date: 'November 2026',
        note: 'Hardware-accelerated bezier curve inspector and 60fps export.',
      },
    ],
    comments: [
      {
        id: 'c4',
        author: 'Devon Mercer',
        handle: '@dmercer',
        timeAgo: '2d ago',
        body: 'Cubic-bezier scrubbing feels effortless even on complex scenes.',
      },
    ],
    files: [
      {
        id: 'file-zenith-app',
        projectId: 'zenith',
        ownerUid: 'zenith-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1840,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #09090b; color: #fafafa; padding: 22px; display: grid; gap: 14px; }
  .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 16px; }
  .track { height: 54px; background: #09090b; border: 1px solid #27272a; border-radius: 999px; position: relative; padding: 6px; overflow: hidden; }
  .puck { width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, #fff, #71717a); position: relative; left: 0; }
  .btns { display: flex; gap: 8px; flex-wrap: wrap; }
  button { background: #27272a; color: #fff; border: 1px solid #3f3f46; border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
  button.active { background: #fff; color: #09090b; border-color: #fff; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <div style="font-weight:700;font-size:15px;">Zenith Cubic-Bezier Inspector</div>
    <div id="curveLabel" style="font-size:12px;color:#a1a1aa;margin-top:4px;font-family:monospace;">cubic-bezier(0.22, 1, 0.36, 1)</div>
  </div>
  <div class="card" style="display:grid;gap:14px;">
    <div class="btns">
      <button class="active" data-c="cubic-bezier(0.22, 1, 0.36, 1)">Apple Expo Out</button>
      <button data-c="cubic-bezier(0.65, 0, 0.35, 1)">Precision Snap</button>
      <button data-c="cubic-bezier(0.34, 1.56, 0.64, 1)">Spring Overshoot</button>
      <button id="fire" style="margin-left:auto;background:#fff;color:#09090b;">Trigger Motion</button>
    </div>
    <div class="track"><div id="puck" class="puck"></div></div>
  </div>
  <script>
    let curve = 'cubic-bezier(0.22, 1, 0.36, 1)';
    let flipped = false;
    const puck = document.getElementById('puck');
    const lbl = document.getElementById('curveLabel');
    document.querySelectorAll('button[data-c]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('button[data-c]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        curve = btn.dataset.c;
        lbl.textContent = curve;
      };
    });
    document.getElementById('fire').onclick = () => {
      flipped = !flipped;
      puck.style.transition = 'transform 750ms ' + curve;
      puck.style.transform = flipped ? 'translateX(calc(100vw - 110px))' : 'translateX(0px)';
    };
  </script>
</body>
</html>`,
        createdAt: '2026-11-06T14:00:00.000Z',
      },
    ],
  },
  {
    id: 'orbit-ai',
    ownerUid: 'orbit-official',
    name: 'Orbit AI',
    tagline: 'AI made simple.',
    description:
      'Composable workflow agents and structured inference pipelines with transparent execution traces.',
    category: 'AI',
    tags: ['AI', 'Automation', 'Agents'],
    creatorName: 'Orbit Systems',
    creatorHandle: '@orbitai',
    views: 72000,
    likes: 2700,
    artwork: 'orbit',
    coinId: 'coin-orbit-ai',
    coinTicker: 'ORBT',
    contractAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    verified: true,
    trendingRank: 4,
    createdAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [
      {
        version: 'v2.2',
        date: 'October 2026',
        note: 'Sub-200ms tool routing and multi-step deterministic verification.',
      },
    ],
    comments: [],
    files: [
      {
        id: 'file-orbit-app',
        projectId: 'orbit-ai',
        ownerUid: 'orbit-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1890,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #09090b; color: #fafafa; padding: 20px; display: grid; gap: 12px; }
  .card { background: #18181b; border: 1px solid #27272a; border-radius: 14px; padding: 14px; }
  .nodes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .node { border: 1px solid #27272a; border-radius: 10px; padding: 10px; background: #09090b; font-size: 12px; }
  .node.done { border-color: #fff; background: #27272a; }
  .log { font-family: monospace; font-size: 11px; color: #d4d4d8; background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 10px; min-height: 76px; }
  button { background: #fff; color: #09090b; border: 0; border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
    <div><div style="font-weight:700;font-size:15px;">Orbit Agent DAG Runner</div><div style="font-size:12px;color:#a1a1aa;">Deterministic multi-step trace inspector</div></div>
    <button id="run">Run Pipeline</button>
  </div>
  <div class="nodes">
    <div class="node" id="n0">1. Parse Intent</div>
    <div class="node" id="n1">2. Route Tools</div>
    <div class="node" id="n2">3. Verify Schema</div>
    <div class="node" id="n3">4. Emit Output</div>
  </div>
  <div id="log" class="log">Ready. Click "Run Pipeline" to execute agent trace...</div>
  <script>
    const steps = ['Parsed prompt constraints (14ms)', 'Routed tool call: price_feed_v2 (42ms)', 'Validated JSON schema contract (8ms)', 'Committed signed trace hash #8f2a (11ms)'];
    document.getElementById('run').onclick = () => {
      const log = document.getElementById('log');
      log.innerHTML = '';
      for (let i = 0; i < 4; i++) document.getElementById('n' + i).classList.remove('done');
      steps.forEach((msg, idx) => {
        setTimeout(() => {
          document.getElementById('n' + idx).classList.add('done');
          log.innerHTML += '<div>[' + (idx+1) + '/4] ' + msg + '</div>';
        }, (idx + 1) * 260);
      });
    };
  </script>
</body>
</html>`,
        createdAt: '2026-11-08T09:00:00.000Z',
      },
    ],
  },
  {
    id: 'pixelcraft',
    ownerUid: 'pixelcraft-official',
    name: 'PixelCraft',
    tagline: 'Build. Play. Create.',
    description:
      'Lightweight browser world-builder and procedural terrain engine for independent game creators.',
    category: 'Games',
    tags: ['Games', 'Terrain', 'WebGL'],
    creatorName: 'PixelCraft Guild',
    creatorHandle: '@pixelcraft',
    views: 64000,
    likes: 1900,
    artwork: 'pixelcraft',
    verified: true,
    trendingRank: 5,
    createdAt: '2026-11-09T11:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [],
    comments: [],
    files: [
      {
        id: 'file-pixelcraft-app',
        projectId: 'pixelcraft',
        ownerUid: 'pixelcraft-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1740,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #09090b; color: #fafafa; padding: 18px; display: grid; gap: 12px; }
  .bar { display: flex; justify-content: space-between; align-items: center; }
  canvas { width: 100%; height: 220px; border-radius: 14px; border: 1px solid #27272a; background: #18181b; display: block; cursor: crosshair; }
  button { background: #fff; color: #09090b; border: 0; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
  <div class="bar">
    <div><strong style="font-size:15px;">PixelCraft Procedural Terrain</strong> <span id="seedLbl" style="font-size:12px;color:#a1a1aa;margin-left:8px;">Seed #402</span></div>
    <button id="regen">New Seed</button>
  </div>
  <canvas id="c" width="640" height="220"></canvas>
  <script>
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    let seed = 402;
    function draw() {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, c.width, c.height);
      for (let layer = 0; layer < 4; layer++) {
        ctx.fillStyle = ['#18181b', '#27272a', '#3f3f46', '#71717a'][layer];
        ctx.beginPath();
        ctx.moveTo(0, c.height);
        for (let x = 0; x <= c.width; x += 12) {
          const y = 75 + layer * 30 + Math.sin(x * 0.015 + seed + layer) * 18 + Math.cos(x * 0.04 - seed) * 10;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(c.width, c.height);
        ctx.closePath();
        ctx.fill();
      }
      document.getElementById('seedLbl').textContent = 'Seed #' + seed;
    }
    document.getElementById('regen').onclick = () => { seed = Math.floor(100 + Math.random() * 900); draw(); };
    c.onclick = () => { seed += 7; draw(); };
    draw();
  </script>
</body>
</html>`,
        createdAt: '2026-11-09T11:00:00.000Z',
      },
    ],
  },
  {
    id: 'stackforge',
    ownerUid: 'stackforge-official',
    name: 'StackForge',
    tagline: 'Developer toolkit.',
    description:
      'Zero-config edge deployments, typed schema migrations, and modular cloud primitives for fast teams.',
    category: 'Developer Tools',
    tags: ['Developer Tools', 'Open Source', 'CLI'],
    creatorName: 'StackForge Core',
    creatorHandle: '@stackforge',
    views: 52000,
    likes: 1500,
    artwork: 'stackforge',
    verified: true,
    trendingRank: 6,
    createdAt: '2026-11-10T15:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [],
    comments: [],
    files: [
      {
        id: 'file-stackforge-app',
        projectId: 'stackforge',
        ownerUid: 'stackforge-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1620,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #09090b; color: #fafafa; padding: 20px; display: grid; gap: 12px; }
  .card { background: #18181b; border: 1px solid #27272a; border-radius: 14px; padding: 14px; display: grid; gap: 10px; }
  .region { display: grid; grid-template-columns: 90px 1fr 56px; align-items: center; gap: 10px; font-size: 12px; }
  .bar-wrap { background: #09090b; height: 8px; border-radius: 999px; overflow: hidden; }
  .bar { height: 100%; background: #fff; border-radius: 999px; transition: width 0.3s ease; }
  button { background: #fff; color: #09090b; border: 0; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div><strong style="font-size:15px;">StackForge Edge Latency Probe</strong></div>
    <button id="ping">Run Edge Probe</button>
  </div>
  <div id="list" class="card"></div>
  <script>
    const regions = [['iad-us', 14], ['sfo-us', 22], ['fra-eu', 38], ['nrt-ap', 54]];
    function render() {
      document.getElementById('list').innerHTML = regions.map(([r, ms]) =>
        '<div class="region"><span style="font-family:monospace;">' + r + '</span><div class="bar-wrap"><div class="bar" style="width:' + Math.min(100, ms * 1.4) + '%"></div></div><span style="text-align:right;font-family:monospace;">' + ms + 'ms</span></div>'
      ).join('');
    }
    document.getElementById('ping').onclick = () => {
      regions.forEach(item => item[1] = Math.floor(8 + Math.random() * 58));
      render();
    };
    render();
  </script>
</body>
</html>`,
        createdAt: '2026-11-10T15:00:00.000Z',
      },
    ],
  },
  {
    id: 'edusphere',
    ownerUid: 'edusphere-official',
    name: 'EduSphere',
    tagline: 'Learn by doing.',
    description:
      'Interactive visual labs and structured technical cohorts built for curious self-directed learners.',
    category: 'Education',
    tags: ['Education', 'Interactive', 'Open Source'],
    creatorName: 'EduSphere Foundation',
    creatorHandle: '@edusphere',
    views: 41000,
    likes: 1200,
    artwork: 'edusphere',
    verified: true,
    trendingRank: 7,
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    updates: [],
    comments: [],
    files: [
      {
        id: 'file-edusphere-app',
        projectId: 'edusphere',
        ownerUid: 'edusphere-official',
        name: 'index.html',
        mimeType: 'text/html',
        sizeBytes: 1710,
        url: '',
        previewText: `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  body { margin: 0; background: #fafafa; color: #09090b; padding: 20px; display: grid; gap: 12px; }
  .bars { height: 180px; background: #fff; border: 1px solid #e4e4e7; border-radius: 14px; padding: 14px; display: flex; align-items: flex-end; gap: 6px; }
  .col { flex: 1; background: #09090b; border-radius: 6px 6px 2px 2px; transition: height 0.2s, background 0.2s; }
  .col.active { background: #71717a; }
  button { background: #09090b; color: #fff; border: 0; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div><strong style="font-size:15px;">EduSphere Visual Sort Lab</strong></div>
    <div style="display:flex;gap:8px;"><button id="shuffle" style="background:#e4e4e7;color:#09090b;">Shuffle</button><button id="step">Bubble Step</button></div>
  </div>
  <div id="bars" class="bars"></div>
  <script>
    let arr = [78, 34, 92, 18, 64, 48, 86, 26, 55, 70];
    let active = -1;
    function render() {
      document.getElementById('bars').innerHTML = arr.map((v, i) => '<div class="col ' + (i === active || i === active+1 ? 'active' : '') + '" style="height:' + v + '%"></div>').join('');
    }
    document.getElementById('shuffle').onclick = () => { arr = arr.map(() => Math.floor(15 + Math.random() * 82)); active = -1; render(); };
    document.getElementById('step').onclick = () => {
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] > arr[i+1]) { [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; active = i; break; }
      }
      render();
    };
    render();
  </script>
</body>
</html>`,
        createdAt: '2026-11-12T10:00:00.000Z',
      },
    ],
  },
];

export const ANALYTICS_SERIES: Record<
  '7d' | '30d' | '90d',
  {
    peakLabel: string;
    peakIndex: number;
    points: {label: string; value: number}[];
  }
> = {
  '7d': {
    peakLabel: '64K views',
    peakIndex: 4,
    points: [
      {label: 'Mon', value: 28000},
      {label: 'Tue', value: 39000},
      {label: 'Wed', value: 34000},
      {label: 'Thu', value: 51000},
      {label: 'Fri', value: 64000},
      {label: 'Sat', value: 57000},
      {label: 'Sun', value: 61000},
    ],
  },
  '30d': {
    peakLabel: '178K views',
    peakIndex: 7,
    points: [
      {label: 'Day 1', value: 22000},
      {label: 'Day 5', value: 48000},
      {label: 'Day 9', value: 62000},
      {label: 'Day 13', value: 55000},
      {label: 'Day 17', value: 98000},
      {label: 'Day 21', value: 91000},
      {label: 'Day 24', value: 142000},
      {label: 'Day 26', value: 178000},
      {label: 'Day 28', value: 138000},
      {label: 'Day 30', value: 149000},
    ],
  },
  '90d': {
    peakLabel: '412K views',
    peakIndex: 6,
    points: [
      {label: 'Wk 1', value: 84000},
      {label: 'Wk 3', value: 132000},
      {label: 'Wk 5', value: 185000},
      {label: 'Wk 7', value: 168000},
      {label: 'Wk 9', value: 274000},
      {label: 'Wk 11', value: 340000},
      {label: 'Wk 12', value: 412000},
      {label: 'Wk 13', value: 389000},
    ],
  },
};

export const COMMUNITIES = [
  {
    name: 'Monochrome Systems',
    members: '18.4K members',
    focus: 'Design Systems · Minimalist UI',
    summary: 'Builders crafting high-contrast typography, spatial interfaces, and restraint-first software.',
  },
  {
    name: 'Creator Launch Guild',
    members: '14.2K members',
    focus: 'Product Launches · Growth',
    summary: 'Weekly launch teardowns, demo storytelling critiques, and founder office hours.',
  },
  {
    name: 'Open Tooling Collective',
    members: '9.8K members',
    focus: 'Developer Tools · Open Source',
    summary: 'Maintainers collaborating on edge runtimes, CLI ergonomics, and local-first workflows.',
  },
  {
    name: 'Applied AI Studio',
    members: '22.1K members',
    focus: 'AI · Structured Workflows',
    summary: 'Engineers sharing deterministic agent patterns, evaluation benchmarks, and model UI kits.',
  },
];

export const LEARN_GUIDES = [
  {
    number: '01',
    title: 'Designing a Clear First Launch',
    readTime: '4 min read',
    category: 'Launch Playbook',
    summary:
      'How to distill a complex technical product into a one-sentence proposition, live interactive preview, and verifiable proof.',
  },
  {
    number: '02',
    title: 'Structuring Creator Tokenomics & Curves',
    readTime: '6 min read',
    category: 'Architecture',
    summary:
      'Transparent supply parameters, fair-launch bonding dynamics, and community ownership models that reward early believers.',
  },
  {
    number: '03',
    title: 'Motion Restraint in Product Demos',
    readTime: '5 min read',
    category: 'Craft & Visuals',
    summary:
      'Using studio lighting, pure contrast, and deliberate pacing to communicate quality without visual noise.',
  },
  {
    number: '04',
    title: 'Reading Retention & View Velocity',
    readTime: '3 min read',
    category: 'Analytics',
    summary:
      'Turning raw impression spikes into durable community followers and recurring project contributors.',
  },
];
