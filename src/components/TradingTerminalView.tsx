import React, {useMemo, useState} from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  Building2,
  CandlestickChart,
  Check,
  Coins,
  Copy,
  Flame,
  LineChart,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  CoinTrade,
  KlyroProject,
  LinkedWallet,
  ProjectCoin,
  STOCK_PRESETS,
  StudioSettings,
  UserHolding,
  formatCompactCount,
  formatPriceUsd,
  formatUsd,
} from '../data/projects';
import {CHAIN_META, SUPPORTED_CHAINS, WalletChain, shortenAddress} from '../lib/wallets';

export interface AddStockTokenPayload {
  mode: 'create' | 'attach';
  coinId?: string;
  stockSymbol: string;
  stockCompany: string;
  stockExchange: string;
  network: WalletChain;
  ticker?: string;
  refPriceUsd?: number;
  maxLeverage?: number;
}

interface TradingTerminalViewProps {
  coins: ProjectCoin[];
  projects: KlyroProject[];
  tradesMap: Record<string, CoinTrade[]>;
  liveTradesForSelected?: CoinTrade[];
  selectedCoinId?: string | null;
  onSelectCoinId?: (coinId: string) => void;
  wallets: LinkedWallet[];
  holdings: UserHolding[];
  settings: StudioSettings;
  onTradeCoin: (
    coinId: string,
    side: 'buy' | 'sell',
    amountUsd: number,
    leverage?: number
  ) => Promise<void>;
  onTopUpCash: (amountUsd: number) => Promise<void>;
  onOpenProject: (project: KlyroProject, initialTab?: 'overview' | 'files' | 'coin') => void;
  onOpenWallets: () => void;
  onAddStockToken?: (payload: AddStockTokenPayload) => Promise<ProjectCoin | null | void>;
}

interface LimitOrder {
  id: string;
  coinId: string;
  ticker: string;
  side: 'buy' | 'sell';
  limitPriceUsd: number;
  amountUsd: number;
  leverage: number;
  createdAt: string;
}

type ChartTimeframe = '1s' | '1m' | '5m' | '15m' | '1H' | '4H' | '24H';
type MarketTab = 'All' | 'Pulse' | 'Hyperliquid' | 'Stocks' | 'Solana' | 'Base';

interface CandleBar {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const TradingTerminalView: React.FC<TradingTerminalViewProps> = ({
  coins,
  projects,
  tradesMap,
  liveTradesForSelected = [],
  selectedCoinId,
  onSelectCoinId,
  wallets,
  holdings,
  settings,
  onTradeCoin,
  onTopUpCash,
  onOpenProject,
  onOpenWallets,
  onAddStockToken,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [marketTab, setMarketTab] = useState<MarketTab>('All');
  const [chainFilter, setChainFilter] = useState<'All' | WalletChain>('All');
  const [quickBuyPresetUsd, setQuickBuyPresetUsd] = useState<number>(25);

  const [internalCoinId, setInternalCoinId] = useState<string>(coins[0]?.id || '');
  const activeCoinId =
    selectedCoinId && coins.some((c) => c.id === selectedCoinId)
      ? selectedCoinId
      : coins.some((c) => c.id === internalCoinId)
      ? internalCoinId
      : coins[0]?.id || '';

  const activeCoin = useMemo(
    () => coins.find((c) => c.id === activeCoinId) || coins[0] || null,
    [coins, activeCoinId]
  );

  const linkedProject = useMemo(
    () => (activeCoin ? projects.find((p) => p.id === activeCoin.projectId) || null : null),
    [projects, activeCoin]
  );

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [amountUsd, setAmountUsd] = useState('100');
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [leverage, setLeverage] = useState<number>(1);
  const [slippagePct, setSlippagePct] = useState('1.0');
  const [priorityMode, setPriorityMode] = useState<'Standard' | 'Fast' | 'Turbo'>('Fast');
  const [mevShield, setMevShield] = useState(true);
  const [showOrderSettings, setShowOrderSettings] = useState(false);

  const [timeframe, setTimeframe] = useState<ChartTimeframe>('15m');
  const [chartType, setChartType] = useState<'candles' | 'curve'>('candles');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [bottomTab, setBottomTab] = useState<
    'trades' | 'orderbook' | 'positions' | 'orders' | 'specs'
  >('trades');

  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [quickBuyingId, setQuickBuyingId] = useState<string | null>(null);
  const [toppingUp, setToppingUp] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copiedCa, setCopiedCa] = useState(false);

  // Add Stock to Token Modal state
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMode, setStockMode] = useState<'create' | 'attach'>('create');
  const [stockTargetCoinId, setStockTargetCoinId] = useState<string>(coins[0]?.id || '');
  const [stockSymbolInput, setStockSymbolInput] = useState('NVDA');
  const [stockCompanyInput, setStockCompanyInput] = useState('NVIDIA Corp.');
  const [stockExchangeInput, setStockExchangeInput] = useState('NASDAQ');
  const [stockNetwork, setStockNetwork] = useState<WalletChain>('Hyperliquid');
  const [stockTickerInput, setStockTickerInput] = useState('NVDAX');
  const [stockRefPriceInput, setStockRefPriceInput] = useState('142.8');
  const [stockMaxLevInput, setStockMaxLevInput] = useState('20');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockModalError, setStockModalError] = useState<string | null>(null);

  const selectCoin = (coinId: string) => {
    setInternalCoinId(coinId);
    onSelectCoinId?.(coinId);
    setTradeStatus(null);
    setLimitPriceInput('');
    setHoverIdx(null);
    const nextCoin = coins.find((c) => c.id === coinId);
    if (nextCoin && leverage > (nextCoin.maxLeverage || 40)) {
      setLeverage(nextCoin.maxLeverage || 1);
    }
  };

  const filteredCoins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return coins.filter((c) => {
      if (marketTab === 'Hyperliquid' && c.network !== 'Hyperliquid') return false;
      if (marketTab === 'Stocks' && c.assetClass !== 'stock') return false;
      if (marketTab === 'Solana' && c.network !== 'Solana') return false;
      if (marketTab === 'Base' && c.network !== 'Base') return false;
      if (marketTab === 'Pulse' && c.volume24hUsd < 15000 && c.network !== 'Hyperliquid') {
        return false;
      }
      if (chainFilter !== 'All' && c.network !== chainFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.ticker.toLowerCase().includes(q) ||
        (c.stockSymbol || '').toLowerCase().includes(q) ||
        (c.stockCompany || '').toLowerCase().includes(q) ||
        c.contractAddress.toLowerCase().includes(q) ||
        c.network.toLowerCase().includes(q)
      );
    });
  }, [coins, marketTab, chainFilter, searchQuery]);

  const activeTrades = useMemo(() => {
    if (!activeCoin) return [];
    const mapTrades = tradesMap[activeCoin.id] || [];
    const combined = [...liveTradesForSelected, ...mapTrades];
    const seen = new Set<string>();
    return combined.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [activeCoin, tradesMap, liveTradesForSelected]);

  const activeHolding = useMemo(
    () => (activeCoin ? holdings.find((h) => h.coinId === activeCoin.id) || null : null),
    [holdings, activeCoin]
  );

  const primaryWallet = useMemo(
    () =>
      wallets.find((w) => w.chain === activeCoin?.network) ||
      wallets.find((w) => w.isPrimary) ||
      wallets[0] ||
      null,
    [wallets, activeCoin]
  );

  const maxLevForActive = activeCoin?.maxLeverage || (activeCoin?.network === 'Hyperliquid' ? 40 : 10);
  const supportsMargin =
    activeCoin?.network === 'Hyperliquid' ||
    activeCoin?.assetClass === 'perp' ||
    activeCoin?.assetClass === 'stock' ||
    Boolean(activeCoin?.maxLeverage);

  const effectiveLeverage = supportsMargin ? Math.min(maxLevForActive, Math.max(1, leverage)) : 1;

  // Deterministic OHLC candle series anchored around activeCoin price + live trades
  const candleBars: CandleBar[] = useMemo(() => {
    if (!activeCoin) return [];
    const base = activeCoin.priceUsd;
    const count = 28;
    const tfVol: Record<ChartTimeframe, number> = {
      '1s': 0.004,
      '1m': 0.008,
      '5m': 0.015,
      '15m': 0.024,
      '1H': 0.04,
      '4H': 0.065,
      '24H': 0.11,
    };
    const vol = tfVol[timeframe];
    const seedNum = activeCoin.id
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    const bars: CandleBar[] = [];
    let prevClose = base * (1 - vol * 1.4);

    for (let i = 0; i < count; i++) {
      const wave =
        Math.sin((i + seedNum) * 0.68) * vol * 0.85 +
        Math.cos((i * 1.3 + seedNum) * 0.42) * vol * 0.45;
      const drift = (i / (count - 1)) * (base - base * (1 - vol * 1.4));
      const open = i === 0 ? prevClose : bars[i - 1].close;
      const close =
        i === count - 1
          ? base
          : Math.max(0.0000001, base * (1 - vol * 1.4) + drift + base * wave);
      const wickUp = Math.abs(Math.sin(i * 2.1 + seedNum)) * vol * 0.65 * base;
      const wickDown = Math.abs(Math.cos(i * 1.7 + seedNum)) * vol * 0.65 * base;
      const high = Math.max(open, close) + wickUp;
      const low = Math.max(0.0000001, Math.min(open, close) - wickDown);
      const volume = Math.max(
        500,
        (activeCoin.volume24hUsd / count) * (0.5 + Math.abs(Math.sin(i + seedNum)) * 1.4)
      );
      bars.push({
        label:
          i === count - 1
            ? 'Live'
            : timeframe === '24H'
            ? `${i + 1}d`
            : `-${count - 1 - i}`,
        open,
        high,
        low,
        close,
        volume,
      });
      prevClose = close;
    }

    // Apply latest live trade influence on final candle
    if (activeTrades.length > 0) {
      const last = bars[bars.length - 1];
      last.close = activeCoin.priceUsd;
      last.high = Math.max(last.high, last.open, last.close);
      last.low = Math.min(last.low, last.open, last.close);
    }
    return bars;
  }, [activeCoin, activeTrades, timeframe]);

  const inspectedBar =
    hoverIdx !== null && candleBars[hoverIdx]
      ? candleBars[hoverIdx]
      : candleBars[candleBars.length - 1] || null;

  const orderbook = useMemo(() => {
    if (!activeCoin) return {asks: [], bids: []};
    const p = activeCoin.priceUsd;
    const asks = Array.from({length: 6}, (_, idx) => {
      const mult = 1 + (6 - idx) * 0.0035;
      const sizeUsd = Math.round(900 + (6 - idx) * 720 + (idx % 2) * 340);
      return {price: p * mult, sizeUsd, depthPct: 24 + (6 - idx) * 11};
    });
    const bids = Array.from({length: 6}, (_, idx) => {
      const mult = 1 - (idx + 1) * 0.0035;
      const sizeUsd = Math.round(1150 + idx * 680 + (idx % 2) * 290);
      return {price: Math.max(0.0000001, p * mult), sizeUsd, depthPct: 28 + idx * 10};
    });
    return {asks, bids};
  }, [activeCoin]);

  const parsedAmount = Number(amountUsd) || 0;
  const effectiveNotional = parsedAmount * effectiveLeverage;
  const estimatedTokens =
    activeCoin && parsedAmount > 0
      ? effectiveNotional / Math.max(0.0000001, activeCoin.priceUsd)
      : 0;
  const holdingUsdValue =
    activeCoin && activeHolding ? activeHolding.balance * activeCoin.priceUsd : 0;

  const executeOrder = async (
    targetCoinId = activeCoin?.id,
    orderSide = side,
    usd = parsedAmount,
    lev = effectiveLeverage
  ) => {
    const target = coins.find((c) => c.id === targetCoinId);
    if (!target) return;
    setTradeStatus(null);
    if (!Number.isFinite(usd) || usd <= 0) {
      setTradeStatus({type: 'error', message: 'Enter a valid USD amount greater than 0.'});
      return;
    }
    if (orderSide === 'buy' && usd > settings.sandboxBalanceUsd) {
      setTradeStatus({
        type: 'error',
        message: 'Insufficient sandbox USDC balance. Click + Deposit to add funds.',
      });
      return;
    }

    if (orderType === 'limit' && targetCoinId === activeCoin?.id) {
      const targetPrice = Number(limitPriceInput);
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        setTradeStatus({type: 'error', message: 'Enter a valid Limit price in USD.'});
        return;
      }
      const newOrder: LimitOrder = {
        id: `lo-${Date.now()}`,
        coinId: target.id,
        ticker: target.ticker,
        side: orderSide,
        limitPriceUsd: targetPrice,
        amountUsd: usd,
        leverage: lev,
        createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      };
      setLimitOrders((prev) => [newOrder, ...prev]);
      setTradeStatus({
        type: 'success',
        message: `Limit ${orderSide === 'buy' ? 'Long' : 'Short'} order queued for $${target.ticker} at ${formatPriceUsd(targetPrice)} (${lev}x).`,
      });
      return;
    }

    setSubmitting(true);
    try {
      await onTradeCoin(target.id, orderSide, usd, lev);
      setTradeStatus({
        type: 'success',
        message: `${orderSide === 'buy' ? 'Bought / Long' : 'Sold / Short'} ${formatUsd(usd)}${
          lev > 1 ? ` (${lev}x = ${formatUsd(usd * lev)} notional)` : ''
        } on $${target.ticker}.`,
      });
    } catch (err) {
      setTradeStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Trade execution failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickBuy = async (e: React.MouseEvent, coin: ProjectCoin) => {
    e.stopPropagation();
    if (quickBuyPresetUsd > settings.sandboxBalanceUsd) {
      setTradeStatus({
        type: 'error',
        message: 'Insufficient sandbox balance for 1-click Quick Buy.',
      });
      return;
    }
    setQuickBuyingId(coin.id);
    setTradeStatus(null);
    try {
      await onTradeCoin(coin.id, 'buy', quickBuyPresetUsd, 1);
      selectCoin(coin.id);
      setTradeStatus({
        type: 'success',
        message: `⚡ Instant Quick Buy filled: ${formatUsd(quickBuyPresetUsd)} of $${coin.ticker} (${coin.network}).`,
      });
    } catch (err) {
      setTradeStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Quick Buy failed.',
      });
    } finally {
      setQuickBuyingId(null);
    }
  };

  const handleSubmitStockModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddStockToken) return;
    setStockModalError(null);
    const sym = stockSymbolInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!sym) {
      setStockModalError('Enter a stock ticker symbol (e.g. NVDA, AAPL, TSLA).');
      return;
    }
    setStockSaving(true);
    try {
      const created = await onAddStockToken({
        mode: stockMode,
        coinId: stockMode === 'attach' ? stockTargetCoinId : undefined,
        stockSymbol: sym,
        stockCompany: stockCompanyInput.trim() || sym,
        stockExchange: stockExchangeInput.trim() || 'NASDAQ',
        network: stockNetwork,
        ticker: stockTickerInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || `${sym}X`,
        refPriceUsd: Number(stockRefPriceInput) || 100,
        maxLeverage: Math.min(40, Math.max(1, Number(stockMaxLevInput) || 10)),
      });
      if (created && created.id) {
        selectCoin(created.id);
      } else if (stockMode === 'attach' && stockTargetCoinId) {
        selectCoin(stockTargetCoinId);
      }
      setShowStockModal(false);
      setTradeStatus({
        type: 'success',
        message:
          stockMode === 'attach'
            ? `Attached ${stockExchangeInput}:${sym} stock backing to token.`
            : `Deployed tokenized stock ${sym} (${stockTickerInput.toUpperCase()}) on ${stockNetwork}.`,
      });
    } catch (err) {
      setStockModalError(
        err instanceof Error ? err.message : 'Failed to configure stock token.'
      );
    } finally {
      setStockSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Axiom Ticker Tape & Wallet Status Bar */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-zinc-200 dark:border-zinc-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-950 dark:text-zinc-50">
              AXIOM PRO TERMINAL
            </span>
          </div>
          {coins.slice(0, 6).map((c) => {
            const active = activeCoin?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCoin(c.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors tabular-nums ${
                  active
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="font-bold">${c.ticker}</span>
                <span className="opacity-75">{formatPriceUsd(c.priceUsd)}</span>
                {c.network === 'Hyperliquid' && (
                  <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-white/15 dark:bg-black/20">
                    HL
                  </span>
                )}
                {c.assetClass === 'stock' && (
                  <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-white/15 dark:bg-black/20">
                    STK
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onAddStockToken && (
            <button
              type="button"
              onClick={() => {
                setStockModalError(null);
                setStockTargetCoinId(activeCoin?.id || coins[0]?.id || '');
                setShowStockModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              Add Stock to Token
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs tabular-nums">
            <span className="text-zinc-500 dark:text-zinc-400">Cash</span>
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">
              {formatUsd(settings.sandboxBalanceUsd)}
            </span>
            <button
              type="button"
              disabled={toppingUp}
              onClick={async () => {
                setToppingUp(true);
                try {
                  await onTopUpCash(1000);
                } finally {
                  setToppingUp(false);
                }
              }}
              className="px-2 py-0.5 rounded-md bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[10px] font-semibold hover:opacity-90"
            >
              {toppingUp ? '...' : '+$1K'}
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenWallets}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            {primaryWallet
              ? `${primaryWallet.chain} · ${shortenAddress(primaryWallet.address)}`
              : 'Link Wallet'}
          </button>
        </div>
      </div>

      {/* Main 3-Column Axiom Cockpit */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Pulse & Discovery Rail */}
        <aside className="xl:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900 dark:text-zinc-100">
                Pulse / Markets
              </span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-0.5">
              {[25, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setQuickBuyPresetUsd(amt)}
                  title="1-Click Quick Buy amount"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums transition-colors ${
                    quickBuyPresetUsd === amt
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  ⚡${amt}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, HL perp, NVDA, CA..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
            />
          </div>

          {/* Market Category Pills + Chain Selector */}
          <div className="flex flex-wrap gap-1">
            {(['All', 'Pulse', 'Hyperliquid', 'Stocks', 'Solana', 'Base'] as MarketTab[]).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMarketTab(tab)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    marketTab === tab
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          <select
            aria-label="Filter markets by blockchain"
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value as 'All' | WalletChain)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="All">All 13 Chains ({coins.length})</option>
            {SUPPORTED_CHAINS.map((c) => (
              <option key={c} value={c}>
                {c} ({CHAIN_META[c].symbol})
              </option>
            ))}
          </select>

          <div className="space-y-1 max-h-[540px] overflow-y-auto pr-0.5">
            {filteredCoins.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No matching tokens found.
              </div>
            ) : (
              filteredCoins.map((c) => {
                const selected = activeCoin?.id === c.id;
                const isHl = c.network === 'Hyperliquid';
                const isStock = c.assetClass === 'stock';
                return (
                  <div
                    key={c.id}
                    onClick={() => selectCoin(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') selectCoin(c.id);
                    }}
                    className={`w-full text-left rounded-xl p-2.5 border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      selected
                        ? 'border-zinc-950 dark:border-white bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold tracking-tight truncate">
                          ${c.ticker}
                        </span>
                        {isStock ? (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                              selected
                                ? 'bg-white/20 dark:bg-zinc-900 text-white'
                                : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
                            }`}
                          >
                            {c.stockSymbol || 'STOCK'}
                          </span>
                        ) : isHl ? (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                              selected
                                ? 'bg-white/20 dark:bg-zinc-900 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {c.maxLeverage ? `${c.maxLeverage}x HL` : 'HL'}
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              selected
                                ? 'bg-white/15 dark:bg-black/15'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {c.network}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] truncate mt-0.5 tabular-nums ${
                          selected ? 'opacity-75' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {c.stockCompany || c.name} · Vol ${formatCompactCount(c.volume24hUsd)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right tabular-nums">
                        <div className="text-[11px] font-semibold">{formatPriceUsd(c.priceUsd)}</div>
                        <div className={`text-[9px] ${selected ? 'opacity-75' : 'text-zinc-500'}`}>
                          {isHl
                            ? `OI $${formatCompactCount(c.openInterestUsd || c.marketCapUsd)}`
                            : `MC $${formatCompactCount(c.marketCapUsd)}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={quickBuyingId === c.id}
                        onClick={(e) => void handleQuickBuy(e, c)}
                        title={`1-Click Quick Buy $${quickBuyPresetUsd}`}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-0.5 transition-colors ${
                          selected
                            ? 'bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white'
                            : 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:opacity-85'
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {quickBuyingId === c.id ? '...' : `$${quickBuyPresetUsd}`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER COLUMN: Chart + Market Metrics + Live Orderbook/Trades Dock */}
        <section className="xl:col-span-6 space-y-4">
          {!activeCoin ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-sm text-zinc-500">
              No tokens launched yet. Launch a project or click Add Stock to Token.
            </div>
          ) : (
            <>
              {/* Market Header + Candlestick / Curve Chart */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {activeCoin.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-md bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[10px] font-bold">
                        ${activeCoin.ticker}
                      </span>
                      <span className="px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        {activeCoin.network}
                      </span>
                      {activeCoin.assetClass === 'stock' && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {activeCoin.stockExchange || 'NASDAQ'}: {activeCoin.stockSymbol}
                        </span>
                      )}
                      {activeCoin.network === 'Hyperliquid' && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-900 dark:text-zinc-100">
                          PERP · UP TO {activeCoin.maxLeverage || 40}X
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">{shortenAddress(activeCoin.contractAddress)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeCoin.contractAddress).catch(() => {});
                          setCopiedCa(true);
                          setTimeout(() => setCopiedCa(false), 1600);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-[10px] text-zinc-700 dark:text-zinc-300"
                      >
                        {copiedCa ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        {copiedCa ? 'Copied' : 'Copy CA'}
                      </button>
                      {linkedProject && (
                        <button
                          type="button"
                          onClick={() => onOpenProject(linkedProject, 'overview')}
                          className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-semibold hover:underline"
                        >
                          Open Live Project <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chart Type & Timeframe Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => setChartType('candles')}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 ${
                          chartType === 'candles'
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <CandlestickChart className="w-3 h-3" />
                        Candles
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType('curve')}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 ${
                          chartType === 'curve'
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <LineChart className="w-3 h-3" />
                        Curve
                      </button>
                    </div>
                    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
                      {(['1s', '1m', '5m', '15m', '1H', '4H', '24H'] as ChartTimeframe[]).map(
                        (tf) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setTimeframe(tf)}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold ${
                              timeframe === tf
                                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                          >
                            {tf}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Live 4-Metric Axiom Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 px-3 py-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Mark Price</div>
                    <div className="text-sm font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                      {formatPriceUsd(activeCoin.priceUsd)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 px-3 py-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Market Cap</div>
                    <div className="text-sm font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                      {formatUsd(activeCoin.marketCapUsd)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 px-3 py-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {activeCoin.network === 'Hyperliquid' ? 'Open Interest' : '24h Volume'}
                    </div>
                    <div className="text-sm font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                      {formatUsd(
                        activeCoin.network === 'Hyperliquid'
                          ? activeCoin.openInterestUsd || activeCoin.volume24hUsd
                          : activeCoin.volume24hUsd
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 px-3 py-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {activeCoin.network === 'Hyperliquid'
                        ? '1h Funding'
                        : activeCoin.assetClass === 'stock'
                        ? 'Equity Oracle'
                        : 'Bonding Curve'}
                    </div>
                    <div className="text-sm font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                      {activeCoin.network === 'Hyperliquid'
                        ? `+${(activeCoin.fundingRatePct ?? 0.012).toFixed(3)}%`
                        : activeCoin.assetClass === 'stock'
                        ? `${activeCoin.stockExchange || 'NASDAQ'}:${activeCoin.stockSymbol}`
                        : `${activeCoin.bondingProgress.toFixed(1)}%`}
                    </div>
                  </div>
                </div>

                {/* OHLC HUD + Interactive Chart Canvas */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 text-white space-y-2">
                  {inspectedBar && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 tabular-nums">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-zinc-200 font-semibold">
                          ${activeCoin.ticker}/USD · {timeframe}
                        </span>
                        <span>O {formatPriceUsd(inspectedBar.open)}</span>
                        <span>H {formatPriceUsd(inspectedBar.high)}</span>
                        <span>L {formatPriceUsd(inspectedBar.low)}</span>
                        <span className="text-white font-semibold">
                          C {formatPriceUsd(inspectedBar.close)}
                        </span>
                      </div>
                      <span>Vol ${formatCompactCount(inspectedBar.volume)}</span>
                    </div>
                  )}

                  {(() => {
                    const W = 720;
                    const H = 220;
                    const VOL_H = 38;
                    const PAD_T = 10;
                    const CHART_H = H - VOL_H - PAD_T - 8;
                    const highs = candleBars.map((b) => b.high);
                    const lows = candleBars.map((b) => b.low);
                    const maxP = Math.max(...highs, 0.000001);
                    const minP = Math.min(...lows, 0);
                    const range = Math.max(maxP - minP, maxP * 0.02);
                    const maxVol = Math.max(...candleBars.map((b) => b.volume), 1);
                    const stepX = W / Math.max(1, candleBars.length);

                    const yFor = (val: number) =>
                      PAD_T + CHART_H - ((val - minP) / range) * CHART_H;

                    const curvePoints = candleBars
                      .map((b, i) => `${(i + 0.5) * stepX},${yFor(b.close)}`)
                      .join(' ');
                    const areaPoints = `0,${PAD_T + CHART_H} ${curvePoints} ${W},${PAD_T + CHART_H}`;

                    return (
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="w-full h-56 select-none"
                        onMouseLeave={() => setHoverIdx(null)}
                      >
                        <defs>
                          <linearGradient id="axiomArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75].map((pct) => (
                          <line
                            key={pct}
                            x1={0}
                            x2={W}
                            y1={PAD_T + CHART_H * pct}
                            y2={PAD_T + CHART_H * pct}
                            stroke="#27272a"
                            strokeDasharray="3 4"
                            strokeWidth="1"
                          />
                        ))}

                        {chartType === 'curve' ? (
                          <>
                            <polygon points={areaPoints} fill="url(#axiomArea)" />
                            <polyline
                              points={curvePoints}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          </>
                        ) : (
                          candleBars.map((b, idx) => {
                            const cx = (idx + 0.5) * stepX;
                            const isUp = b.close >= b.open;
                            const bodyTop = yFor(Math.max(b.open, b.close));
                            const bodyBot = yFor(Math.min(b.open, b.close));
                            const bodyH = Math.max(2, bodyBot - bodyTop);
                            const barW = Math.max(4, stepX * 0.58);
                            const vH = (b.volume / maxVol) * (VOL_H - 4);
                            return (
                              <g
                                key={idx}
                                onMouseEnter={() => setHoverIdx(idx)}
                                className="cursor-crosshair"
                              >
                                <rect
                                  x={idx * stepX}
                                  y={0}
                                  width={stepX}
                                  height={H}
                                  fill={hoverIdx === idx ? 'rgba(255,255,255,0.04)' : 'transparent'}
                                />
                                <line
                                  x1={cx}
                                  x2={cx}
                                  y1={yFor(b.high)}
                                  y2={yFor(b.low)}
                                  stroke={isUp ? '#fafafa' : '#71717a'}
                                  strokeWidth="1.2"
                                />
                                <rect
                                  x={cx - barW / 2}
                                  y={bodyTop}
                                  width={barW}
                                  height={bodyH}
                                  rx="1"
                                  fill={isUp ? '#fafafa' : '#3f3f46'}
                                  stroke={isUp ? '#fafafa' : '#a1a1aa'}
                                  strokeWidth="0.6"
                                />
                                <rect
                                  x={cx - barW / 2}
                                  y={H - vH}
                                  width={barW}
                                  height={vH}
                                  rx="1"
                                  fill={isUp ? 'rgba(255,255,255,0.35)' : 'rgba(113,113,122,0.35)'}
                                />
                              </g>
                            );
                          })
                        )}
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom Dock: Trades / Orderbook / Positions / Limit Orders / Asset Specs */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                  {(
                    [
                      ['trades', `Live Trades (${activeTrades.length})`],
                      ['orderbook', 'Orderbook Ladder'],
                      ['positions', `Positions (${holdings.length})`],
                      ['orders', `Limit Orders (${limitOrders.length})`],
                      ['specs', 'Asset Specs'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBottomTab(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        bottomTab === id
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {bottomTab === 'trades' && (
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    {activeTrades.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500">
                        No fills recorded yet on ${activeCoin.ticker}. Submit a Market or Quick Buy order to start the tape.
                      </div>
                    ) : (
                      <table className="w-full text-xs tabular-nums">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                            <th className="py-2 text-left">Side</th>
                            <th className="py-2 text-left">Trader</th>
                            <th className="py-2 text-right">Amount</th>
                            <th className="py-2 text-right">Size</th>
                            <th className="py-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                          {activeTrades.map((t) => (
                            <tr key={t.id}>
                              <td className="py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    t.side === 'buy'
                                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                                      : 'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                  }`}
                                >
                                  {t.side === 'buy' ? 'Buy' : 'Sell'}
                                  {t.leverage && t.leverage > 1 ? ` ${t.leverage}x` : ''}
                                </span>
                              </td>
                              <td className="py-2 text-zinc-700 dark:text-zinc-300 font-medium">
                                {t.traderHandle}
                              </td>
                              <td className="py-2 text-right font-semibold text-zinc-950 dark:text-zinc-50">
                                {formatUsd(t.amountUsd)}
                              </td>
                              <td className="py-2 text-right text-zinc-500 dark:text-zinc-400">
                                {formatCompactCount(t.tokenAmount)} {activeCoin.ticker}
                              </td>
                              <td className="py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                                {formatPriceUsd(t.priceUsd)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {bottomTab === 'orderbook' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs tabular-nums">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex justify-between">
                        <span>Bids (Buy Depth)</span>
                        <span>Size</span>
                      </div>
                      <div className="space-y-1">
                        {orderbook.bids.map((row, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setOrderType('limit');
                              setSide('buy');
                              setLimitPriceInput(String(Number(row.price.toFixed(6))));
                            }}
                            className="w-full relative overflow-hidden rounded-lg px-2.5 py-1.5 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-zinc-900/10 dark:bg-white/10 pointer-events-none"
                              style={{width: `${row.depthPct}%`}}
                            />
                            <span className="relative font-mono font-semibold text-zinc-950 dark:text-zinc-50">
                              {formatPriceUsd(row.price)}
                            </span>
                            <span className="relative text-zinc-500 dark:text-zinc-400">
                              {formatUsd(row.sizeUsd)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex justify-between">
                        <span>Asks (Sell Depth)</span>
                        <span>Size</span>
                      </div>
                      <div className="space-y-1">
                        {orderbook.asks.map((row, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setOrderType('limit');
                              setSide('sell');
                              setLimitPriceInput(String(Number(row.price.toFixed(6))));
                            }}
                            className="w-full relative overflow-hidden rounded-lg px-2.5 py-1.5 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <span
                              className="absolute inset-y-0 right-0 bg-zinc-500/15 pointer-events-none"
                              style={{width: `${row.depthPct}%`}}
                            />
                            <span className="relative font-mono font-semibold text-zinc-950 dark:text-zinc-50">
                              {formatPriceUsd(row.price)}
                            </span>
                            <span className="relative text-zinc-500 dark:text-zinc-400">
                              {formatUsd(row.sizeUsd)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {bottomTab === 'positions' && (
                  <div className="space-y-2 text-xs tabular-nums">
                    {holdings.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500">
                        No active holdings yet. Execute a buy order to open a position.
                      </div>
                    ) : (
                      holdings.map((h) => {
                        const c = coins.find((item) => item.id === h.coinId);
                        const markPrice = c?.priceUsd ?? h.avgBuyPriceUsd;
                        const val = h.balance * markPrice;
                        const cost = h.balance * h.avgBuyPriceUsd;
                        const pnl = val - cost;
                        return (
                          <div
                            key={h.coinId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"
                          >
                            <div>
                              <div className="font-bold text-zinc-950 dark:text-zinc-50">
                                ${h.ticker}{' '}
                                <span className="text-[11px] font-normal text-zinc-500">
                                  · {formatCompactCount(h.balance)} units
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                Entry {formatPriceUsd(h.avgBuyPriceUsd)} · Mark{' '}
                                {formatPriceUsd(markPrice)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                                  {formatUsd(val)}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  PnL {pnl >= 0 ? '+' : ''}
                                  {formatUsd(pnl)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void executeOrder(h.coinId, 'sell', Math.max(1, val), 1)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {bottomTab === 'orders' && (
                  <div className="space-y-2 text-xs tabular-nums">
                    {limitOrders.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500">
                        No open limit orders. Switch ticket to Limit or click any Orderbook price level.
                      </div>
                    ) : (
                      limitOrders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"
                        >
                          <div>
                            <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                              {o.side.toUpperCase()} ${o.ticker} · {formatUsd(o.amountUsd)} ({o.leverage}x)
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Target {formatPriceUsd(o.limitPriceUsd)} · Placed {o.createdAt}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await onTradeCoin(o.coinId, o.side, o.amountUsd, o.leverage);
                                setLimitOrders((prev) => prev.filter((item) => item.id !== o.id));
                                setTradeStatus({
                                  type: 'success',
                                  message: `Filled limit order on $${o.ticker}.`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold"
                            >
                              Fill Now
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLimitOrders((prev) => prev.filter((item) => item.id !== o.id))
                              }
                              className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {bottomTab === 'specs' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs tabular-nums">
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div className="text-[10px] text-zinc-500">Total Supply</div>
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50 mt-0.5">
                        {formatCompactCount(activeCoin.totalSupply)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div className="text-[10px] text-zinc-500">Creator Fee</div>
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50 mt-0.5">
                        {activeCoin.creatorFeePct}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div className="text-[10px] text-zinc-500">Holders</div>
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50 mt-0.5">
                        {formatCompactCount(activeCoin.holdersCount)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div className="text-[10px] text-zinc-500">Asset Class</div>
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50 mt-0.5 uppercase">
                        {activeCoin.assetClass || 'coin'}
                      </div>
                    </div>
                    {activeCoin.stockSymbol && (
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 col-span-2">
                        <div className="text-[10px] text-zinc-500">Stock Backing</div>
                        <div className="font-semibold text-zinc-950 dark:text-zinc-50 mt-0.5">
                          {activeCoin.stockExchange || 'NASDAQ'}: {activeCoin.stockSymbol} —{' '}
                          {activeCoin.stockCompany}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* RIGHT COLUMN: Axiom Execution Ticket */}
        <aside className="xl:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-4">
          {!activeCoin ? (
            <div className="text-xs text-zinc-500 py-8 text-center">Select a market to trade.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-950 dark:text-zinc-50">
                  Order Ticket
                </span>
                <button
                  type="button"
                  onClick={() => setShowOrderSettings((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {slippagePct}% · {priorityMode}
                </button>
              </div>

              {showOrderSettings && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 space-y-2.5 text-xs">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Slippage Tolerance
                    </div>
                    <div className="flex gap-1">
                      {['0.5', '1.0', '3.0'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSlippagePct(s)}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-semibold ${
                            slippagePct === s
                              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                              : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Priority Route
                    </div>
                    <div className="flex gap-1">
                      {(['Standard', 'Fast', 'Turbo'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriorityMode(p)}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-semibold ${
                            priorityMode === p
                              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                              : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between pt-1 cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      MEV Shield Protection
                    </span>
                    <input
                      type="checkbox"
                      checked={mevShield}
                      onChange={(e) => setMevShield(e.target.checked)}
                      className="accent-zinc-950 dark:accent-white"
                    />
                  </label>
                </div>
              )}

              {/* Buy / Long vs Sell / Short */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1">
                <button
                  type="button"
                  onClick={() => setSide('buy')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    side === 'buy'
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {supportsMargin ? 'Buy / Long' : 'Buy'}
                </button>
                <button
                  type="button"
                  onClick={() => setSide('sell')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    side === 'sell'
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {supportsMargin ? 'Sell / Short' : 'Sell'}
                </button>
              </div>

              {/* Market / Limit */}
              <div className="flex gap-1.5">
                {(['market', 'limit'] as const).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOrderType(ot)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                      orderType === ot
                        ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-white'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {ot === 'market' ? 'Market Instant' : 'Limit Order'}
                  </button>
                ))}
              </div>

              {orderType === 'limit' && (
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Trigger Price (USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={limitPriceInput}
                    onChange={(e) => setLimitPriceInput(e.target.value)}
                    placeholder={activeCoin.priceUsd.toFixed(4)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-950 dark:text-zinc-50 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                  />
                </div>
              )}

              {/* Leverage Slider for Hyperliquid / Perps / Stocks */}
              {supportsMargin && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">Leverage</span>
                    <span className="font-bold text-zinc-950 dark:text-zinc-50">
                      {effectiveLeverage}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={maxLevForActive}
                    value={effectiveLeverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full accent-zinc-950 dark:accent-white"
                  />
                  <div className="flex gap-1">
                    {[1, 5, 10, 20, maxLevForActive]
                      .filter((v, i, a) => v <= maxLevForActive && a.indexOf(v) === i)
                      .map((presetLev) => (
                        <button
                          key={presetLev}
                          type="button"
                          onClick={() => setLeverage(presetLev)}
                          className={`flex-1 py-1 rounded text-[10px] font-semibold tabular-nums ${
                            effectiveLeverage === presetLev
                              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                              : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {presetLev}x
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Amount Input + Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  <span>Margin / Amount (USD)</span>
                  <span>
                    {side === 'buy'
                      ? `Avail ${formatUsd(settings.sandboxBalanceUsd)}`
                      : `Hold ${formatUsd(holdingUsdValue)}`}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-2.5 text-sm font-bold tabular-nums text-zinc-950 dark:text-zinc-50 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-zinc-400">
                    USDC
                  </span>
                </div>

                {side === 'buy' ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {[25, 100, 250, 1000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmountUsd(String(v))}
                        className="py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 tabular-nums"
                      >
                        ${v >= 1000 ? '1K' : v}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setAmountUsd(
                            String(Math.max(1, Number((holdingUsdValue * pct).toFixed(2))))
                          )
                        }
                        className="py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 tabular-nums"
                      >
                        {pct === 1 ? 'MAX' : `${pct * 100}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary Breakdown */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 space-y-1.5 text-[11px] tabular-nums">
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>Est. Size</span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatCompactCount(estimatedTokens)} {activeCoin.ticker}
                  </span>
                </div>
                {effectiveLeverage > 1 && (
                  <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Effective Notional</span>
                    <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                      {formatUsd(effectiveNotional)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>Route</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {activeCoin.network} · {mevShield ? 'MEV Shield' : 'Direct'}
                  </span>
                </div>
              </div>

              {tradeStatus && (
                <div
                  className={`rounded-xl px-3 py-2 text-xs ${
                    tradeStatus.type === 'success'
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                      : 'border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {tradeStatus.message}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => void executeOrder()}
                className="w-full py-3 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                <Activity className="w-3.5 h-3.5" />
                {submitting
                  ? 'Executing...'
                  : orderType === 'limit'
                  ? `Place Limit ${side === 'buy' ? 'Long' : 'Short'}`
                  : `${side === 'buy' ? 'Buy / Long' : 'Sell / Short'} $${activeCoin.ticker}`}
              </button>
            </>
          )}
        </aside>
      </div>

      {/* Add Stock to Token Modal */}
      {showStockModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowStockModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Equities Bridge
                </div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                  Add Stock to Token
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Attach real-world equity backing to an existing token or deploy a new tokenized stock market.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStockModal(false)}
                className="p-2 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1">
              <button
                type="button"
                onClick={() => setStockMode('create')}
                className={`py-2 rounded-lg text-xs font-semibold ${
                  stockMode === 'create'
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Deploy New Stock Token
              </button>
              <button
                type="button"
                onClick={() => setStockMode('attach')}
                className={`py-2 rounded-lg text-xs font-semibold ${
                  stockMode === 'attach'
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Attach to Existing Token
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Quick Stock Presets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STOCK_PRESETS.map((preset) => (
                  <button
                    key={preset.symbol}
                    type="button"
                    onClick={() => {
                      setStockSymbolInput(preset.symbol);
                      setStockCompanyInput(preset.company);
                      setStockExchangeInput(preset.exchange);
                      setStockTickerInput(`${preset.symbol}X`);
                      setStockRefPriceInput(String(preset.refPriceUsd));
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                      stockSymbolInput === preset.symbol
                        ? 'border-zinc-950 dark:border-white bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {preset.symbol} · ${preset.refPriceUsd}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitStockModal} className="space-y-3 text-xs">
              {stockMode === 'attach' && (
                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    Target Token
                  </label>
                  <select
                    value={stockTargetCoinId}
                    onChange={(e) => setStockTargetCoinId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50"
                  >
                    {coins.map((c) => (
                      <option key={c.id} value={c.id}>
                        ${c.ticker} — {c.name} ({c.network})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    Stock Symbol
                  </label>
                  <input
                    type="text"
                    value={stockSymbolInput}
                    onChange={(e) => setStockSymbolInput(e.target.value.toUpperCase())}
                    placeholder="NVDA"
                    className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-semibold text-zinc-950 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    Exchange
                  </label>
                  <input
                    type="text"
                    value={stockExchangeInput}
                    onChange={(e) => setStockExchangeInput(e.target.value.toUpperCase())}
                    placeholder="NASDAQ"
                    className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    Company
                  </label>
                  <input
                    type="text"
                    value={stockCompanyInput}
                    onChange={(e) => setStockCompanyInput(e.target.value)}
                    placeholder="NVIDIA Corp."
                    className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50"
                  />
                </div>
              </div>

              {stockMode === 'create' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Network
                    </label>
                    <select
                      value={stockNetwork}
                      onChange={(e) => setStockNetwork(e.target.value as WalletChain)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2.5 py-2 text-zinc-950 dark:text-zinc-50"
                    >
                      {SUPPORTED_CHAINS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Token Ticker
                    </label>
                    <input
                      type="text"
                      value={stockTickerInput}
                      onChange={(e) => setStockTickerInput(e.target.value.toUpperCase())}
                      placeholder="NVDAX"
                      className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-semibold text-zinc-950 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Ref Price ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={stockRefPriceInput}
                      onChange={(e) => setStockRefPriceInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Max Lev (x)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={stockMaxLevInput}
                      onChange={(e) => setStockMaxLevInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-zinc-950 dark:text-zinc-50"
                    />
                  </div>
                </div>
              )}

              {stockModalError && (
                <div className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100">
                  {stockModalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockSaving}
                  className="px-5 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {stockSaving
                    ? 'Saving...'
                    : stockMode === 'attach'
                    ? 'Attach Stock Backing'
                    : 'Deploy Stock Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
