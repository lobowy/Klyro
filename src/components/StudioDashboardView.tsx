import React, {useEffect, useMemo, useState} from 'react';
import {User} from 'firebase/auth';
import {
  ArrowRight,
  BarChart3,
  Check,
  Diamond,
  Eye,
  Folder,
  Heart,
  LayoutGrid,
  Layers,
  Pencil,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  ANALYTICS_SERIES,
  CoinTrade,
  KlyroProject,
  LinkedWallet,
  ProjectCoin,
  ProjectFileRecord,
  STUDIO_TEMPLATES,
  StudioSettings,
  StudioTemplate,
  UserHolding,
  formatCompactCount,
} from '../data/projects';
import {shortenAddress} from '../lib/wallets';
import {AvatarWithRim} from './AvatarWithRim';
import {ProjectArtwork} from './ProjectArtwork';
import {RoleBadges} from './RoleBadges';
import {SuiteModulesView} from './SuiteModulesView';
import {AddStockTokenPayload, TradingTerminalView} from './TradingTerminalView';

interface StudioDashboardViewProps {
  projects: KlyroProject[];
  coins: ProjectCoin[];
  tradesMap: Record<string, CoinTrade[]>;
  liveTradesForSelected?: CoinTrade[];
  terminalCoinId?: string | null;
  onSelectTerminalCoinId?: (coinId: string) => void;
  user: User | null;
  wallets: LinkedWallet[];
  holdings: UserHolding[];
  savedCount: number;
  followingCount: number;
  settings: StudioSettings;
  isFounder?: boolean;
  onCreateNew: (template?: StudioTemplate) => void;
  onSelectProject: (project: KlyroProject, initialTab?: 'overview' | 'files' | 'coin') => void;
  onAddFile: (projectId: string, file: ProjectFileRecord) => Promise<void>;
  onUpdateProject: (id: string, updates: {name: string; tagline: string}) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onUpdateSettings: (partial: Partial<StudioSettings>) => Promise<void>;
  onTradeCoin: (
    coinId: string,
    side: 'buy' | 'sell',
    amountUsd: number,
    leverage?: number
  ) => Promise<void>;
  onAddStockToken?: (payload: AddStockTokenPayload) => Promise<ProjectCoin | null | void>;
  onTopUpCash: (amountUsd: number) => Promise<void>;
  onOpenAccountModal: () => void;
  onOpenProfile: () => void;
}

type StudioSection =
  | 'dashboard'
  | 'projects'
  | 'terminal'
  | 'suite'
  | 'templates'
  | 'analytics'
  | 'settings';

export const StudioDashboardView: React.FC<StudioDashboardViewProps> = ({
  projects,
  coins,
  tradesMap,
  liveTradesForSelected = [],
  terminalCoinId,
  onSelectTerminalCoinId,
  user,
  wallets,
  holdings,
  savedCount,
  followingCount,
  settings,
  isFounder = false,
  onCreateNew,
  onSelectProject,
  onAddFile,
  onUpdateProject,
  onDeleteProject,
  onUpdateSettings,
  onTradeCoin,
  onAddStockToken,
  onTopUpCash,
  onOpenAccountModal,
  onOpenProfile,
}) => {
  const [section, setSection] = useState<StudioSection>('dashboard');
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // My Projects management state
  const [projectSearch, setProjectSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Settings form state
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [creatorHandle, setCreatorHandle] = useState(settings.creatorHandle);
  const [savedNotice, setSavedNotice] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setDisplayName(settings.displayName);
    setCreatorHandle(settings.creatorHandle);
  }, [settings.displayName, settings.creatorHandle]);

  const series = ANALYTICS_SERIES[range];
  const pts = series.points;
  const maxVal = Math.max(...pts.map((p) => p.value)) * 1.12;

  const W = 760;
  const H = 200;
  const padX = 24;
  const padY = 20;
  const coords = pts.map((pt, i) => {
    const x = padX + (i / Math.max(1, pts.length - 1)) * (W - padX * 2);
    const y = H - padY - (pt.value / maxVal) * (H - padY * 2);
    return {x, y, ...pt};
  });

  let pathD = '';
  coords.forEach((c, i) => {
    if (i === 0) {
      pathD = `M ${c.x} ${c.y}`;
    } else {
      const prev = coords[i - 1];
      const cx1 = prev.x + (c.x - prev.x) * 0.45;
      const cx2 = c.x - (c.x - prev.x) * 0.45;
      pathD += ` C ${cx1} ${prev.y}, ${cx2} ${c.y}, ${c.x} ${c.y}`;
    }
  });
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${H - padY} L ${coords[0].x} ${H - padY} Z`;

  const activePointIdx = hoveredIdx !== null ? hoveredIdx : series.peakIndex;
  const activePoint = coords[activePointIdx] || coords[series.peakIndex];
  const activeBadgeText =
    hoveredIdx !== null ? `${formatCompactCount(activePoint.value)} views` : series.peakLabel;

  const totalViews = useMemo(
    () => projects.reduce((acc, p) => acc + p.views, 0),
    [projects]
  );
  const totalLikes = useMemo(
    () => projects.reduce((acc, p) => acc + p.likes, 0),
    [projects]
  );

  const filteredManagedProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [projects, projectSearch]);

  const handleSaveEdit = async (id: string) => {
    if (editName.trim().length < 2) {
      setActionError('Project name must be at least 2 characters.');
      return;
    }
    setActionError(null);
    try {
      await onUpdateProject(id, {
        name: editName.trim(),
        tagline: editTagline.trim() || 'Create. Innovate. Share.',
      });
      setEditingId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update project.');
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setActionError(null);
    try {
      await onDeleteProject(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove project.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSettings) return;
    if (displayName.trim().length < 2) {
      setSettingsError('Display name must be at least 2 characters.');
      return;
    }
    setSettingsError(null);
    setSavingSettings(true);
    try {
      await onUpdateSettings({
        displayName: displayName.trim(),
        creatorHandle: creatorHandle.trim() || '@klyro_builder',
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <section className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_14px_45px_-22px_rgba(0,0,0,0.08)] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
        {/* Left Studio Sidebar */}
        <aside className="md:col-span-3 border-b md:border-b-0 md:border-r border-zinc-200/80 dark:border-zinc-800 p-5 flex flex-col justify-between bg-zinc-50/40 dark:bg-zinc-900/40">
          <div className="space-y-1">
            {[
              {id: 'dashboard' as const, label: 'Dashboard', icon: LayoutGrid},
              {id: 'projects' as const, label: 'My Projects', icon: Folder},
              {id: 'terminal' as const, label: 'Trading Terminal', icon: TrendingUp},
              {id: 'suite' as const, label: 'Klyro Suite (11)', icon: Layers},
              {id: 'templates' as const, label: 'Templates', icon: LayoutGrid},
              {id: 'analytics' as const, label: 'Analytics', icon: BarChart3},
              {id: 'settings' as const, label: 'Settings', icon: Settings},
            ].map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-[13px] font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Diamond className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                {settings.proEnabled ? 'Klyro Pro Active' : 'Upgrade to Pro'}
              </div>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {settings.proEnabled
                  ? 'Custom domains and extended analytics are enabled.'
                  : 'Unlock custom domains and advanced team analytics.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onUpdateSettings({proEnabled: !settings.proEnabled})}
              className="w-full h-9 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>{settings.proEnabled ? 'Pro Enabled' : 'Upgrade'}</span>
              {settings.proEnabled ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </aside>

        {/* Main Studio Viewport */}
        <div className="md:col-span-9 p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <AvatarWithRim
                src={settings.photoURL || user?.photoURL || undefined}
                name={settings.displayName}
                rim={settings.profileRim}
                size="md"
                isFounder={isFounder || Boolean(settings.badges?.includes('Founder'))}
                showFounderBadge
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[26px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {section === 'dashboard' && `Welcome back, ${settings.displayName}!`}
                    {section === 'projects' && 'My Projects'}
                    {section === 'terminal' && 'Trading Terminal'}
                    {section === 'suite' && 'Klyro Ecosystem Suite'}
                    {section === 'templates' && 'Starter Templates'}
                    {section === 'analytics' && 'Project Analytics'}
                    {section === 'settings' && 'Studio Settings'}
                  </h1>
                  {(isFounder || (settings.badges && settings.badges.length > 0)) && (
                    <RoleBadges
                      badges={
                        settings.badges && settings.badges.length > 0
                          ? settings.badges
                          : ['Founder']
                      }
                      compact
                    />
                  )}
                </div>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {section === 'dashboard' && "Here's what's happening across your active showcase."}
                  {section === 'projects' && 'Manage, rename, preview, or remove published projects.'}
                  {section === 'terminal' &&
                    'Axiom-grade market orderbook, Hyperliquid perps, tokenized stocks, and bonding curves.'}
                  {section === 'suite' &&
                    'All 11 integrated tools: LAUNCHLY, BUILDR, DECK, SPOTLIGHT, PORTAL, MAKERSPACE, PULSEBOARD, SHOWCASE, STACKSPACE, QUEST & SANDBOX.'}
                  {section === 'templates' && 'Start from curated monochrome architectures.'}
                  {section === 'analytics' && 'Detailed view velocity and audience reach.'}
                  {section === 'settings' && 'Manage your creator profile, theme, and simulated demo session.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCreateNew()}
              className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Create New</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(section === 'dashboard' || section === 'analytics') && (
            <>
              {/* 4 Consistent KPI Cards derived from centralized project data */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {label: 'Projects', value: String(projects.length), icon: Folder},
                  {label: 'Total Views', value: formatCompactCount(totalViews), icon: Eye},
                  {label: 'Total Likes', value: formatCompactCount(totalLikes), icon: Heart},
                  {
                    label: 'Saved & Followed',
                    value: `${savedCount + followingCount}`,
                    icon: Users,
                  },
                ].map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={kpi.label}
                      className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2"
                    >
                      <Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      <div className="text-[24px] font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                        {kpi.value}
                      </div>
                      <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{kpi.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Project Analytics Spline Chart */}
              <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                    Project Analytics
                  </h2>
                  <select
                    aria-label="Analytics date range"
                    value={range}
                    onChange={(e) => {
                      setRange(e.target.value as '7d' | '30d' | '90d');
                      setHoveredIdx(null);
                    }}
                    className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-[12px] font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400 cursor-pointer"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>

                <div className="relative pt-6 text-zinc-900 dark:text-zinc-100">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[210px] overflow-visible">
                    <defs>
                      <linearGradient id="studio-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {[0.25, 0.55, 0.9].map((ratio, idx) => (
                      <line
                        key={idx}
                        x1={padX}
                        y1={H * ratio}
                        x2={W - padX}
                        y2={H * ratio}
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeDasharray="3 4"
                      />
                    ))}

                    <path d={areaD} fill="url(#studio-area)" />
                    <path
                      d={pathD}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />

                    {coords.map((pt, idx) => (
                      <g key={pt.label}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={idx === activePointIdx ? 5.5 : 3.5}
                          fill={idx === activePointIdx ? 'currentColor' : 'var(--bg-dot, #9ca3af)'}
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={18}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                      </g>
                    ))}
                  </svg>

                  {/* X-axis labels */}
                  <div className="flex items-center justify-between px-4 pt-2 text-[11px] font-mono text-zinc-400">
                    {coords.map((pt) => (
                      <span key={pt.label}>{pt.label}</span>
                    ))}
                  </div>

                  {/* Peak / Hover Callout Badge */}
                  <div
                    className="absolute pointer-events-none -translate-x-1/2 px-3 py-1 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold tabular-nums shadow-md"
                    style={{
                      left: `${(activePoint.x / W) * 100}%`,
                      top: `${Math.max(0, (activePoint.y / H) * 86 - 6)}%`,
                    }}
                  >
                    {activeBadgeText}
                  </div>
                </div>
              </div>
            </>
          )}

          {section === 'projects' && (
            <div className="space-y-4">
              <div className="relative max-w-xs">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Filter your projects..."
                  className="w-full h-9 pl-9 pr-4 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                />
              </div>

              {actionError && <p className="text-[12px] text-red-500">{actionError}</p>}

              {filteredManagedProjects.length === 0 ? (
                <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                  No projects match your filter.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  {filteredManagedProjects.map((p) => {
                    const isEditing = editingId === p.id;
                    const isDeleting = confirmDeleteId === p.id;
                    return (
                      <div
                        key={p.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/60 transition-colors"
                      >
                        {isEditing ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              aria-label="Edit project name"
                              className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900"
                            />
                            <input
                              type="text"
                              value={editTagline}
                              onChange={(e) => setEditTagline(e.target.value)}
                              aria-label="Edit project tagline"
                              className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-14 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0">
                              <ProjectArtwork
                                variant={p.artwork}
                                customCoverUrl={p.customCoverUrl}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {p.name}
                              </div>
                              <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
                                {p.category}
                                {p.coinTicker ? ` · $${p.coinTicker}` : ''}
                                {p.files && p.files.length > 0 ? ` · ${p.files.length} files` : ''} ·{' '}
                                {formatCompactCount(p.views)} views ·{' '}
                                {formatCompactCount(p.likes)} likes
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSaveEdit(p.id)}
                                className="h-8 px-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : isDeleting ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDelete(p.id)}
                                className="h-8 px-3 rounded-full bg-red-600 text-white text-[12px] font-semibold cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-[12px] text-zinc-600 dark:text-zinc-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(p.id);
                                  setEditName(p.name);
                                  setEditTagline(p.tagline);
                                  setConfirmDeleteId(null);
                                }}
                                aria-label={`Edit ${p.name}`}
                                className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(p.id);
                                  setEditingId(null);
                                }}
                                aria-label={`Delete ${p.name}`}
                                className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectProject(p)}
                                className="h-8 px-3.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-[12px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-900 dark:hover:border-zinc-400 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Open
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'terminal' && (
            <TradingTerminalView
              coins={coins}
              projects={projects}
              tradesMap={tradesMap}
              liveTradesForSelected={liveTradesForSelected}
              selectedCoinId={terminalCoinId}
              onSelectCoinId={onSelectTerminalCoinId}
              wallets={wallets}
              holdings={holdings}
              settings={settings}
              onTradeCoin={onTradeCoin}
              onAddStockToken={onAddStockToken}
              onTopUpCash={onTopUpCash}
              onOpenProject={onSelectProject}
              onOpenWallets={onOpenAccountModal}
            />
          )}

          {section === 'suite' && (
            <SuiteModulesView
              projects={projects}
              coins={coins}
              tradesMap={tradesMap}
              wallets={wallets}
              settings={settings}
              userUid={user?.uid}
              onSelectProject={onSelectProject}
              onAddFile={onAddFile}
              onLaunchWizard={(tpl) => onCreateNew(tpl)}
              onUpdateSettings={onUpdateSettings}
              onOpenProfile={onOpenProfile}
            />
          )}

          {section === 'templates' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STUDIO_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  <div className="aspect-[16/9] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <ProjectArtwork variant={tpl.artwork} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {tpl.name}
                      </div>
                      <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                        {tpl.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCreateNew(tpl)}
                      className="h-8 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-medium hover:opacity-90 cursor-pointer"
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'settings' && (
            <div className="space-y-8 max-w-lg">
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label
                    htmlFor="studio-display"
                    className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                  >
                    Creator Display Name
                  </label>
                  <input
                    id="studio-display"
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (settingsError) setSettingsError(null);
                    }}
                    className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="studio-handle"
                    className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                  >
                    Default Handle
                  </label>
                  <input
                    id="studio-handle"
                    type="text"
                    value={creatorHandle}
                    onChange={(e) => setCreatorHandle(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                  />
                </div>

                {settingsError && <p className="text-[12px] text-red-500">{settingsError}</p>}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-60"
                >
                  {savingSettings
                    ? 'Saving...'
                    : savedNotice
                      ? 'Preferences Saved'
                      : 'Save Changes'}
                </button>
              </form>

              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Appearance Theme
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Switch between Pearl-Silver Light and Obsidian Dark mode.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void onUpdateSettings({
                      theme: settings.theme === 'dark' ? 'light' : 'dark',
                    })
                  }
                  className="h-9 px-4 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 cursor-pointer"
                >
                  {settings.theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </button>
              </div>

              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Account &amp; Linked Wallets
                  </div>
                  <div className="text-[12px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {user
                      ? `Signed in (${settings.creatorHandle}) · ${wallets.length} wallet${wallets.length === 1 ? '' : 's'} · ${holdings.length} holding${holdings.length === 1 ? '' : 's'}`
                      : settings.demoWalletConnected
                        ? `Sandbox · ${shortenAddress(settings.demoWalletAddress)}`
                        : 'Signed out (Sandbox mode)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenAccountModal}
                  className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{user ? 'Manage Wallets' : 'Sign in & Link'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
