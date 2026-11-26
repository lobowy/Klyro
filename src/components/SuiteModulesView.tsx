import React, {useMemo, useState} from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  Check,
  Code2,
  Compass,
  Download,
  FileCode2,
  FlaskConical,
  Globe,
  Layers,
  Palette,
  Presentation,
  Rocket,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  CoinTrade,
  KlyroProject,
  LinkedWallet,
  ProjectCoin,
  ProjectFileRecord,
  STUDIO_TEMPLATES,
  StudioSettings,
  StudioTemplate,
  formatCompactCount,
  formatFileSize,
  formatPriceUsd,
  formatUsd,
} from '../data/projects';
import {uploadProjectFile} from '../lib/files';
import {SUPPORTED_CHAINS, WalletChain, shortenAddress} from '../lib/wallets';
import {ProjectArtwork} from './ProjectArtwork';

export type SuiteModuleId =
  | 'SHOWCASE'
  | 'LAUNCHLY'
  | 'BUILDR'
  | 'DECK'
  | 'SPOTLIGHT'
  | 'PORTAL'
  | 'MAKERSPACE'
  | 'PULSEBOARD'
  | 'STACKSPACE'
  | 'QUEST'
  | 'SANDBOX';

interface SuiteModulesViewProps {
  projects: KlyroProject[];
  coins: ProjectCoin[];
  tradesMap: Record<string, CoinTrade[]>;
  wallets: LinkedWallet[];
  settings: StudioSettings;
  userUid?: string;
  onSelectProject: (project: KlyroProject, initialTab?: 'overview' | 'files' | 'coin') => void;
  onAddFile: (projectId: string, file: ProjectFileRecord) => Promise<void>;
  onLaunchWizard: (template?: StudioTemplate) => void;
  onUpdateSettings: (partial: Partial<StudioSettings>) => Promise<void>;
  onOpenProfile: () => void;
}

const SUITE_MODULES: {
  id: SuiteModuleId;
  label: string;
  desc: string;
  icon: React.FC<{className?: string}>;
}[] = [
  {id: 'LAUNCHLY', label: 'LAUNCHLY', desc: 'Multi-chain token & project launcher', icon: Rocket},
  {id: 'BUILDR', label: 'BUILDR', desc: 'Code editor & live project file composer', icon: Code2},
  {id: 'DECK', label: 'DECK', desc: 'Pitch & release slide presenter', icon: Presentation},
  {id: 'SPOTLIGHT', label: 'SPOTLIGHT', desc: 'Official & featured releases', icon: Sparkles},
  {id: 'PORTAL', label: 'PORTAL', desc: '13-chain network & wallet router', icon: Globe},
  {id: 'MAKERSPACE', label: 'MAKERSPACE', desc: 'Monochrome SVG & asset studio', icon: Palette},
  {id: 'PULSEBOARD', label: 'PULSEBOARD', desc: 'Live market & trade pulse feed', icon: Activity},
  {id: 'SHOWCASE', label: 'SHOWCASE', desc: 'Interactive portfolio gallery', icon: Compass},
  {id: 'STACKSPACE', label: 'STACKSPACE', desc: 'Cross-project file & stack tree', icon: Layers},
  {id: 'QUEST', label: 'QUEST', desc: 'Creator milestones & sandbox rewards', icon: Award},
  {id: 'SANDBOX', label: 'SANDBOX', desc: 'App runtime & curve simulator', icon: FlaskConical},
];

export const SuiteModulesView: React.FC<SuiteModulesViewProps> = ({
  projects,
  coins,
  tradesMap,
  wallets,
  settings,
  userUid,
  onSelectProject,
  onAddFile,
  onLaunchWizard,
  onUpdateSettings,
  onOpenProfile,
}) => {
  const [activeModule, setActiveModule] = useState<SuiteModuleId>('LAUNCHLY');

  // LAUNCHLY simulator state
  const [simChain, setSimChain] = useState<WalletChain>('Solana');
  const [simCap, setSimCap] = useState(69000);
  const [simBuyUsd, setSimBuyUsd] = useState(250);

  // BUILDR editor state
  const [targetProjectId, setTargetProjectId] = useState<string>(projects[0]?.id || '');
  const [fileName, setFileName] = useState('app.html');
  const [fileCode, setFileCode] = useState(
    '<!doctype html><html><body style="margin:0;background:#09090b;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh"><div style="text-align:center"><h2>Klyro BUILDR Output</h2><p style="color:#a1a1aa">Edit HTML on the left and attach directly to your project.</p></div></body></html>'
  );
  const [buildrBusy, setBuildrBusy] = useState(false);
  const [buildrStatus, setBuildrStatus] = useState<string | null>(null);

  // DECK state
  const [deckProjectId, setDeckProjectId] = useState<string>(projects[0]?.id || '');
  const [slideIdx, setSlideIdx] = useState(0);

  // MAKERSPACE state
  const [makerTitle, setMakerTitle] = useState(settings.displayName || 'KLYRO');
  const [makerRing, setMakerRing] = useState(true);
  const [makerBusy, setMakerBusy] = useState(false);
  const [makerStatus, setMakerStatus] = useState<string | null>(null);

  // PULSEBOARD filter
  const [pulseChain, setPulseChain] = useState<'ALL' | WalletChain>('ALL');

  // QUEST claimed state (local session tracking + sandbox credit)
  const [claimedQuests, setClaimedQuests] = useState<Record<string, boolean>>({});

  // SANDBOX curve simulator
  const [sandboxCoinId, setSandboxCoinId] = useState<string>(coins[0]?.id || '');
  const [sandboxOrderUsd, setSandboxOrderUsd] = useState(500);

  const effectiveTargetId = projects.some((p) => p.id === targetProjectId)
    ? targetProjectId
    : projects[0]?.id || '';
  const deckProject =
    projects.find((p) => p.id === deckProjectId) || projects[0] || null;
  const deckCoin = deckProject
    ? coins.find((c) => c.id === deckProject.coinId || c.projectId === deckProject.id) || null
    : null;

  const allTrades = useMemo(() => {
    const list: {trade: CoinTrade; coin?: ProjectCoin; project?: KlyroProject}[] = [];
    for (const coin of coins) {
      const trades = tradesMap[coin.id] || [];
      const proj = projects.find((p) => p.id === coin.projectId || p.coinId === coin.id);
      for (const trade of trades) {
        list.push({trade, coin, project: proj});
      }
    }
    return list
      .filter((item) => pulseChain === 'ALL' || item.coin?.network === pulseChain)
      .sort((a, b) => b.trade.createdAt.localeCompare(a.trade.createdAt));
  }, [coins, tradesMap, projects, pulseChain]);

  const allFiles = useMemo(() => {
    const out: {file: ProjectFileRecord; project: KlyroProject}[] = [];
    for (const p of projects) {
      for (const f of p.files || []) {
        out.push({file: f, project: p});
      }
    }
    return out;
  }, [projects]);

  const userProjects = projects.filter(
    (p) => p.isUserCreated || (userUid && p.ownerUid === userUid)
  );
  const hasProjectWithFiles = userProjects.some((p) => (p.files?.length || 0) > 0);
  const hasLaunchedCoin = userProjects.some((p) => Boolean(p.coinTicker));
  const hasAnyTrade = allTrades.some(
    (t) =>
      t.trade.traderHandle.toLowerCase() === settings.creatorHandle.toLowerCase() ||
      (userUid && t.trade.traderUid === userUid)
  );

  const quests = [
    {
      id: 'q-identity',
      title: 'Set Creator Username',
      desc: 'Customize your display name & @handle on your Profile.',
      done: settings.creatorHandle !== '@klyro_builder' || Boolean(userUid),
      rewardUsd: 500,
    },
    {
      id: 'q-wallet',
      title: 'Load a Multi-Chain Wallet',
      desc: 'Connect Phantom, MetaMask, or load a public/sandbox wallet.',
      done: wallets.length > 0,
      rewardUsd: 750,
    },
    {
      id: 'q-files',
      title: 'Publish a Project with Files',
      desc: 'Launch a working project built with Klyro AI or uploaded files.',
      done: hasProjectWithFiles,
      rewardUsd: 1000,
    },
    {
      id: 'q-coin',
      title: 'Launch a Multi-Chain Coin',
      desc: 'Deploy a paired bonding-curve token or perp on Solana, Hyperliquid, Base, or Sui.',
      done: hasLaunchedCoin,
      rewardUsd: 1250,
    },
    {
      id: 'q-trade',
      title: 'Execute a Sandbox Trade',
      desc: 'Buy or sell any project coin in the Trading Terminal.',
      done: hasAnyTrade,
      rewardUsd: 500,
    },
  ];

  const handleAttachBuildrFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTargetId || buildrBusy) return;
    setBuildrStatus(null);
    setBuildrBusy(true);
    try {
      const cleanName = fileName.trim() || 'index.html';
      const mime = cleanName.endsWith('.json')
        ? 'application/json'
        : cleanName.endsWith('.md')
          ? 'text/markdown'
          : cleanName.endsWith('.svg')
            ? 'image/svg+xml'
            : 'text/html';
      const file = new File([fileCode], cleanName, {type: mime});
      const record = await uploadProjectFile(file, effectiveTargetId, userUid || 'local-creator');
      await onAddFile(effectiveTargetId, record);
      setBuildrStatus(`Attached ${cleanName} to project.`);
    } catch (err) {
      setBuildrStatus(err instanceof Error ? err.message : 'Failed to attach file.');
    } finally {
      setBuildrBusy(false);
    }
  };

  const buildMakerSvg = () => {
    const label = makerTitle.replace(/[<>&]/g, '').slice(0, 18) || 'KLYRO';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#18181b"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#a1a1aa"/>
      <stop offset="100%" stop-color="#e4e4e7"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  ${makerRing ? '<ellipse cx="320" cy="180" rx="220" ry="74" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" transform="rotate(-12 320 180)"/>' : ''}
  <text x="320" y="192" text-anchor="middle" font-family="system-ui,sans-serif" font-size="42" font-weight="700" letter-spacing="6" fill="url(#silver)">${label}</text>
</svg>`;
  };

  const handleAttachMakerSvg = async () => {
    if (!effectiveTargetId || makerBusy) return;
    setMakerBusy(true);
    setMakerStatus(null);
    try {
      const svgText = buildMakerSvg();
      const file = new File([svgText], 'klyro-emblem.svg', {type: 'image/svg+xml'});
      const record = await uploadProjectFile(file, effectiveTargetId, userUid || 'local-creator');
      await onAddFile(effectiveTargetId, record);
      setMakerStatus('Saved klyro-emblem.svg to selected project.');
    } catch (err) {
      setMakerStatus(err instanceof Error ? err.message : 'Could not attach artwork.');
    } finally {
      setMakerBusy(false);
    }
  };

  const deckSlides = deckProject
    ? [
        {
          eyebrow: `01 / OVERVIEW · ${deckProject.category.toUpperCase()}`,
          title: deckProject.name,
          body: deckProject.tagline,
          footer: `By ${deckProject.creatorName} (${deckProject.creatorHandle})`,
        },
        {
          eyebrow: '02 / ARCHITECTURE',
          title: 'Product Thesis & Files',
          body: deckProject.description,
          footer: `${deckProject.files?.length || 0} attached deliverables · ${deckProject.tags.join(' · ')}`,
        },
        {
          eyebrow: '03 / TOKEN & LIQUIDITY',
          title: deckCoin ? `$${deckCoin.ticker} on ${deckCoin.network}` : 'Showcase Readiness',
          body: deckCoin
            ? `Price ${formatPriceUsd(deckCoin.priceUsd)} · Market Cap ${formatUsd(deckCoin.marketCapUsd)} · Bonding Progress ${deckCoin.bondingProgress.toFixed(1)}% toward ${formatUsd(deckCoin.targetCapUsd)}.`
            : 'Ready to deploy a fair-curve token or perp across Solana, Hyperliquid, Base, Ethereum, Arbitrum, or Sui.',
          footer: deckCoin ? `Contract: ${shortenAddress(deckCoin.contractAddress)}` : 'No paired coin yet',
        },
        {
          eyebrow: '04 / TRACTION',
          title: `${formatCompactCount(deckProject.views)} Views · ${formatCompactCount(deckProject.likes)} Likes`,
          body: deckProject.officialPublished
            ? 'Marked as an Official Live Release on Klyro Discover.'
            : 'Active community showcase with live comments and analytics.',
          footer: `Trending Rank #${deckProject.trendingRank}`,
        },
      ]
    : [];

  const sandboxCoin = coins.find((c) => c.id === sandboxCoinId) || coins[0] || null;
  const simImpactPct = sandboxCoin
    ? Math.min(45, (sandboxOrderUsd / Math.max(2500, sandboxCoin.marketCapUsd)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Module Switcher Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {SUITE_MODULES.map((m) => {
          const Icon = m.icon;
          const active = activeModule === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveModule(m.id)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                active
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-mono font-semibold tracking-tight">
                  {m.label}
                </span>
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white dark:text-zinc-950' : 'text-zinc-500 dark:text-zinc-400'}`} />
              </div>
              <div
                className={`text-[11px] mt-1 truncate ${
                  active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {m.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Module Workspace */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-5 md:p-6">
        {activeModule === 'LAUNCHLY' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50">
                  LAUNCHLY — Multi-Chain Launchpad Planner
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Configure chain economics and jump straight into the 4-step publisher.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLaunchWizard()}
                className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Launchpad</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2">
                <label className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400 block">Target Network</label>
                <select
                  value={simChain}
                  onChange={(e) => setSimChain(e.target.value as WalletChain)}
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] font-medium text-zinc-900 dark:text-zinc-100"
                >
                  {SUPPORTED_CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2">
                <label className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400 block">
                  Migration Cap
                </label>
                <select
                  value={simCap}
                  onChange={(e) => setSimCap(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] font-medium text-zinc-900 dark:text-zinc-100"
                >
                  <option value={25000}>$25,000</option>
                  <option value={69000}>$69,000 (Standard)</option>
                  <option value={120000}>$120,000</option>
                </select>
              </div>
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                <div className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
                  Initial Liquidity Projection
                </div>
                <div className="text-[20px] font-semibold font-mono text-zinc-950 dark:text-zinc-50">
                  {((simBuyUsd / simCap) * 100).toFixed(2)}% curve fill
                </div>
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={simBuyUsd}
                  onChange={(e) => setSimBuyUsd(Number(e.target.value))}
                  className="w-full accent-zinc-950 dark:accent-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STUDIO_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-50">{tpl.name}</div>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{tpl.tagline}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLaunchWizard(tpl)}
                    className="h-8 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold cursor-pointer shrink-0"
                  >
                    Launch
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeModule === 'BUILDR' && (
          <form onSubmit={handleAttachBuildrFile} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50">
                  BUILDR — Live File &amp; App Composer
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Author runnable HTML, JSON, or Markdown files and attach them directly to any
                  project.
                </p>
              </div>
              <button
                type="submit"
                disabled={buildrBusy || !effectiveTargetId}
                className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{buildrBusy ? 'Attaching...' : 'Attach File to Project'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                aria-label="Target project"
                value={effectiveTargetId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] text-zinc-900 dark:text-zinc-100"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.creatorHandle})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Filename (e.g. app.html, spec.json)"
                className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] font-mono text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <textarea
                rows={9}
                value={fileCode}
                onChange={(e) => setFileCode(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 text-[12px] font-mono resize-none focus:outline-none"
              />
              <iframe
                title="BUILDR sandbox preview"
                sandbox="allow-scripts"
                srcDoc={fileCode}
                className="w-full h-[220px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-black"
              />
            </div>
            {buildrStatus && <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">{buildrStatus}</p>}
          </form>
        )}

        {activeModule === 'DECK' && deckProject && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50">
                  DECK — Project Pitch Presenter
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Auto-generated monochrome slide deck synced with live project &amp; coin metrics.
                </p>
              </div>
              <select
                aria-label="Select deck project"
                value={deckProject.id}
                onChange={(e) => {
                  setDeckProjectId(e.target.value);
                  setSlideIdx(0);
                }}
                className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-medium text-zinc-900 dark:text-zinc-100"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl bg-zinc-950 text-white p-8 min-h-[230px] flex flex-col justify-between border border-zinc-800">
              <div className="text-[11px] font-mono text-zinc-400">
                {deckSlides[slideIdx]?.eyebrow}
              </div>
              <div className="space-y-2 py-4">
                <h3 className="text-[24px] font-semibold tracking-tight">
                  {deckSlides[slideIdx]?.title}
                </h3>
                <p className="text-[14px] text-zinc-300 max-w-2xl leading-relaxed">
                  {deckSlides[slideIdx]?.body}
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[12px] font-mono text-zinc-400">
                <span>{deckSlides[slideIdx]?.footer}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSlideIdx((i) => (i - 1 + deckSlides.length) % deckSlides.length)
                    }
                    className="h-8 px-3 rounded-full border border-white/20 text-white hover:bg-white/10 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideIdx((i) => (i + 1) % deckSlides.length)}
                    className="h-8 px-3 rounded-full bg-white text-zinc-950 font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeModule === 'SPOTLIGHT' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50">
                SPOTLIGHT — Official &amp; Verified Releases
              </h2>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Curated spotlight across verified creators and officially published builds.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects
                .filter((p) => p.verified || p.officialPublished)
                .slice(0, 6)
                .map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-11 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0">
                        <ProjectArtwork variant={p.artwork} customCoverUrl={p.customCoverUrl} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                          {p.name}
                        </div>
                        <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                          {p.creatorHandle} · {p.officialPublished ? 'Official Release' : 'Verified'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectProject(p, 'overview')}
                      className="h-8 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold cursor-pointer shrink-0"
                    >
                      Open
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeModule === 'PORTAL' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-50">
                  PORTAL — Multi-Chain Wallet &amp; Network Hub
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  All {SUPPORTED_CHAINS.length} launch networks (including Solana &amp; Hyperliquid) wired to your loaded wallets and contracts.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenProfile}
                className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold cursor-pointer"
              >
                Load / Manage Wallets
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUPPORTED_CHAINS.map((chain) => {
                const chainWallets = wallets.filter((w) => w.chain === chain);
                const chainCoins = coins.filter((c) => c.network === chain);
                return (
                  <div
                    key={chain}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1.5"
                  >
                    <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-50">{chain}</div>
                    <div className="text-[12px] font-mono text-zinc-500 dark:text-zinc-400">
                      {chainWallets.length} wallet(s) · {chainCoins.length} coin(s)
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                      {chainWallets[0]
                        ? shortenAddress(chainWallets[0].address)
                        : 'Ready for sandbox or address load'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeModule === 'MAKERSPACE' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-100">
                  MAKERSPACE — Monochrome Emblem &amp; SVG Studio
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Design vector cover assets and save them directly to your project files.
                </p>
              </div>
              <button
                type="button"
                disabled={makerBusy || !effectiveTargetId}
                onClick={() => void handleAttachMakerSvg()}
                className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold cursor-pointer disabled:opacity-60"
              >
                {makerBusy ? 'Saving...' : 'Attach SVG to Project'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="space-y-3">
                <input
                  type="text"
                  value={makerTitle}
                  onChange={(e) => setMakerTitle(e.target.value)}
                  placeholder="Wordmark text..."
                  className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 text-[13px] font-mono"
                />
                <select
                  aria-label="Destination project"
                  value={effectiveTargetId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 text-[13px]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      Attach to: {p.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makerRing}
                    onChange={(e) => setMakerRing(e.target.checked)}
                    className="w-4 h-4 accent-zinc-950 dark:accent-white"
                  />
                  <span>Include orbital metallic ring</span>
                </label>
                {makerStatus && (
                  <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                    {makerStatus}
                  </p>
                )}
              </div>
              <div
                className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[16/9]"
                dangerouslySetInnerHTML={{__html: buildMakerSvg()}}
              />
            </div>
          </div>
        )}

        {activeModule === 'PULSEBOARD' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-100">
                  PULSEBOARD — Live Market &amp; Trade Stream
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Real-time swaps across every launched project token.
                </p>
              </div>
              <select
                aria-label="Filter pulse chain"
                value={pulseChain}
                onChange={(e) => setPulseChain(e.target.value as 'ALL' | WalletChain)}
                className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 text-[12px] font-medium"
              >
                <option value="ALL">All Chains</option>
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {allTrades.length === 0 ? (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 py-6 text-center">
                No trades recorded for this filter yet.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
                {allTrades.slice(0, 12).map(({trade, coin, project}) => (
                  <div
                    key={trade.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-[12px]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-semibold uppercase text-zinc-950 dark:text-zinc-100">
                        {trade.side}
                      </span>
                      <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                        ${coin?.ticker || 'TOKEN'} ({coin?.network || 'Solana'})
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 truncate">
                        by {trade.traderHandle}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatUsd(trade.amountUsd)}
                      </span>
                      {project && (
                        <button
                          type="button"
                          onClick={() => onSelectProject(project, 'coin')}
                          className="h-7 px-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium hover:border-zinc-900 dark:hover:border-zinc-400 cursor-pointer"
                        >
                          Trade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeModule === 'SHOWCASE' && (
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-100">
              SHOWCASE — All Live Projects ({projects.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProject(p, 'overview')}
                  className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-900 dark:hover:border-zinc-500 text-left transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="aspect-[16/10] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <ProjectArtwork variant={p.artwork} customCoverUrl={p.customCoverUrl} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                      {p.name}
                    </span>
                    {p.coinTicker && (
                      <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        ${p.coinTicker}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                    {p.tagline}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeModule === 'STACKSPACE' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-100">
                STACKSPACE — Project Files &amp; Deliverables ({allFiles.length})
              </h2>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Unified repository of files uploaded or generated across all Klyro projects.
              </p>
            </div>
            {allFiles.length === 0 ? (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 py-6 text-center">
                No files attached yet. Use Klyro AI Builder, File Upload, or BUILDR to create files.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
                {allFiles.map(({file, project}) => (
                  <div
                    key={`${project.id}-${file.id}`}
                    className="p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileCode2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                          {file.name}{' '}
                          <span className="font-normal text-zinc-500 dark:text-zinc-400">
                            · {project.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {formatFileSize(file.sizeBytes)} · {file.mimeType}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {file.previewText !== undefined && (
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([file.previewText || ''], {
                              type: file.mimeType || 'text/plain',
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = file.name;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            setTimeout(() => URL.revokeObjectURL(url), 2000);
                          }}
                          className="h-8 px-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectProject(project, 'files')}
                        className="h-8 px-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeModule === 'QUEST' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-100">
                  QUEST — Creator Milestones
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Live progress tracked automatically from your actions. Claim Sandbox USD rewards.
                </p>
              </div>
              <div className="text-[13px] font-mono font-semibold text-zinc-950 dark:text-zinc-100">
                Cash: {formatUsd(settings.sandboxBalanceUsd)}
              </div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
              {quests.map((q) => {
                const claimed = Boolean(claimedQuests[q.id]);
                return (
                  <div
                    key={q.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
                        <span>{q.title}</span>
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          +{formatUsd(q.rewardUsd)}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">{q.desc}</p>
                    </div>
                    {claimed ? (
                      <span className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" />
                        Claimed
                      </span>
                    ) : q.done ? (
                      <button
                        type="button"
                        onClick={() => {
                          setClaimedQuests((prev) => ({...prev, [q.id]: true}));
                          void onUpdateSettings({
                            sandboxBalanceUsd: settings.sandboxBalanceUsd + q.rewardUsd,
                          });
                        }}
                        className="h-8 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        Claim {formatUsd(q.rewardUsd)}
                      </button>
                    ) : (
                      <span className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-400 inline-flex items-center shrink-0">
                        In Progress
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeModule === 'SANDBOX' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-950 dark:text-zinc-100">
                  SANDBOX — Bonding Curve &amp; Price Impact Lab
                </h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Simulate order impact before executing trades in any project&apos;s Terminal.
                </p>
              </div>
              {sandboxCoin && (
                <button
                  type="button"
                  onClick={() => {
                    const proj = projects.find(
                      (p) => p.id === sandboxCoin.projectId || p.coinId === sandboxCoin.id
                    );
                    if (proj) onSelectProject(proj, 'coin');
                  }}
                  className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold cursor-pointer"
                >
                  Open ${sandboxCoin.ticker} Terminal
                </button>
              )}
            </div>

            {sandboxCoin && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2">
                  <label className="text-[12px] text-zinc-500 dark:text-zinc-400 block">
                    Select Token
                  </label>
                  <select
                    value={sandboxCoin.id}
                    onChange={(e) => setSandboxCoinId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 text-[13px] font-mono"
                  >
                    {coins.map((c) => (
                      <option key={c.id} value={c.id}>
                        ${c.ticker} ({c.network})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2">
                  <label className="text-[12px] text-zinc-500 dark:text-zinc-400 block">
                    Simulated Buy: {formatUsd(sandboxOrderUsd)}
                  </label>
                  <input
                    type="range"
                    min={25}
                    max={5000}
                    step={25}
                    value={sandboxOrderUsd}
                    onChange={(e) => setSandboxOrderUsd(Number(e.target.value))}
                    className="w-full accent-zinc-950 dark:accent-white"
                  />
                </div>
                <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-1">
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                    Projected Impact &amp; Output
                  </div>
                  <div className="text-[16px] font-semibold font-mono text-zinc-950 dark:text-zinc-100">
                    +{simImpactPct.toFixed(2)}% price
                  </div>
                  <div className="text-[12px] font-mono text-zinc-600 dark:text-zinc-400">
                    ≈ {formatCompactCount(sandboxOrderUsd / Math.max(0.0000001, sandboxCoin.priceUsd))}{' '}
                    ${sandboxCoin.ticker}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
