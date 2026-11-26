import React, {useEffect, useMemo, useRef, useState} from 'react';
import {User} from 'firebase/auth';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  Eye,
  FileCode2,
  FileText,
  FlaskConical,
  Heart,
  Image as ImageIcon,
  Maximize2,
  Paperclip,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ArtworkVariant,
  CoinTrade,
  KlyroProject,
  LinkedWallet,
  ProjectCoin,
  ProjectFileRecord,
  UserHolding,
  formatCompactCount,
  formatEngagementRate,
  formatFileSize,
  formatPriceUsd,
  formatUsd,
} from '../data/projects';
import {uploadProjectFile} from '../lib/files';
import {RoleBadge} from '../lib/firebase';
import {bundleProjectHtml, getRunnableFile} from '../lib/projectRunner';
import {DEMO_DURATION, clamp, getActiveChapter} from '../lib/timeline';
import {exportDemoVideo} from '../lib/videoExporter';
import {SUPPORTED_CHAINS, ProfileRimId, WalletChain, shortenAddress} from '../lib/wallets';
import {AiProjectBuilder} from './AiProjectBuilder';
import {AvatarWithRim} from './AvatarWithRim';
import {CinemaStage} from './CinemaStage';
import {KlyroMiniMark} from './KlyroMark';
import {ProjectArtwork} from './ProjectArtwork';
import {RoleBadges} from './RoleBadges';

interface ProjectDetailViewProps {
  project: KlyroProject;
  coin?: ProjectCoin | null;
  trades: CoinTrade[];
  holding?: UserHolding | null;
  user: User | null;
  wallets: LinkedWallet[];
  founderUid?: string | null;
  currentUserBadges?: RoleBadge[];
  sandboxBalanceUsd?: number;
  initialTab?: 'overview' | 'files' | 'coin' | 'comments' | 'analytics' | 'updates';
  isSaved: boolean;
  isFollowing: boolean;
  isLiked: boolean;
  onToggleSave: (id: string) => void;
  onToggleFollow: (handle: string) => void;
  onToggleLike: (id: string) => void;
  onAddComment: (projectId: string, body: string) => Promise<void>;
  onAddFile: (projectId: string, file: ProjectFileRecord) => Promise<void>;
  onDeleteFile: (projectId: string, fileId: string) => Promise<void>;
  onLaunchCoin: (
    projectId: string,
    config: {
      ticker: string;
      network: WalletChain;
      totalSupply: number;
      targetCapUsd: number;
      creatorFeePct: number;
      creatorWallet: string;
    }
  ) => Promise<void>;
  onTradeCoin: (
    coinId: string,
    side: 'buy' | 'sell',
    amountUsd: number,
    leverage?: number
  ) => Promise<void>;
  onPublishRelease?: (
    projectId: string,
    version: string,
    note: string,
    officialPublished: boolean
  ) => Promise<void>;
  onOpenAccountModal: () => void;
  onOpenProfile?: () => void;
  onOpenTerminal?: (coinId?: string) => void;
  creatorRim?: ProfileRimId;
  onBack: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  coin,
  trades,
  holding,
  user,
  wallets,
  founderUid,
  currentUserBadges = [],
  sandboxBalanceUsd = 5000,
  initialTab,
  isSaved,
  isFollowing,
  isLiked,
  onToggleSave,
  onToggleFollow,
  onToggleLike,
  onAddComment,
  onAddFile,
  onDeleteFile,
  onLaunchCoin,
  onTradeCoin,
  onPublishRelease,
  onOpenAccountModal,
  onOpenProfile,
  onOpenTerminal,
  creatorRim,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'files' | 'ai' | 'coin' | 'comments' | 'analytics' | 'updates'
  >(initialTab || 'overview');
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [stageMode, setStageMode] = useState<'app' | 'media'>('app');
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [sandboxTab, setSandboxTab] = useState<'preview' | 'ai' | 'tests' | 'publish'>('preview');

  // Automated test suite state
  const [testResults, setTestResults] = useState<
    {name: string; status: 'pass' | 'warn'; detail: string}[]
  >([]);
  const [testRunAt, setTestRunAt] = useState<string | null>(null);

  // Official publish & release note form
  const [relVersion, setRelVersion] = useState('v1.1.0');
  const [relNote, setRelNote] = useState('');
  const [relOfficial, setRelOfficial] = useState(Boolean(project.officialPublished));
  const [relBusy, setRelBusy] = useState(false);
  const [relStatus, setRelStatus] = useState<string | null>(null);

  // Files state
  const [previewFile, setPreviewFile] = useState<ProjectFileRecord | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);

  // Coin trading terminal state
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | 'ALL'>('24H');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [tradeUsd, setTradeUsd] = useState('100');
  const [slippage, setSlippage] = useState<'0.5' | '1' | '3'>('1');
  const [tradingBusy, setTradingBusy] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Inline coin launch for existing project without coin
  const [launchTicker, setLaunchTicker] = useState('');
  const [launchNetwork, setLaunchNetwork] = useState<WalletChain>('Solana');
  const [launchSupply, setLaunchSupply] = useState(1_000_000_000);
  const [launchTarget, setLaunchTarget] = useState(69000);
  const [launchFee, setLaunchFee] = useState(0.5);
  const [launchWallet, setLaunchWallet] = useState('');
  const [launchingCoin, setLaunchingCoin] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Embedded 15s Cinema Demo state
  const [demoTime, setDemoTime] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(true);
  const [exportPct, setExportPct] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastMsRef = useRef<number | null>(null);

  const files = project.files || [];
  const showCinema = Boolean(project.hasCinemaDemo) && selectedSlide === 0;

  const isOwner = Boolean(
    (user && project.ownerUid === user.uid) ||
      (!user && project.ownerUid === 'local-creator') ||
      (project.isUserCreated && (!project.ownerUid || project.ownerUid === 'local-creator'))
  );

  const canOfficialPublish =
    isOwner ||
    Boolean(user && founderUid && user.uid === founderUid) ||
    currentUserBadges.includes('Owner') ||
    currentUserBadges.includes('Founder') ||
    currentUserBadges.includes('Moderator');

  const isCreatorFounder = Boolean(
    (project.ownerUid && founderUid && project.ownerUid === founderUid) ||
      (isOwner && currentUserBadges.includes('Founder'))
  );

  const effectiveCreatorRim: ProfileRimId =
    creatorRim || (isCreatorFounder ? 'founder-crown' : 'silver');

  const creatorBadges: RoleBadge[] = useMemo(() => {
    if (project.ownerUid && founderUid && project.ownerUid === founderUid) {
      return ['Founder', 'Owner', 'Moderator', 'Developer'];
    }
    if (isOwner && currentUserBadges.length > 0) {
      return currentUserBadges;
    }
    if (project.verified) {
      return ['Verified'];
    }
    return [];
  }, [project.ownerUid, project.verified, founderUid, isOwner, currentUserBadges]);

  const runnableHtmlFile = useMemo(() => getRunnableFile(files) || null, [files]);
  const bundledAppHtml = useMemo(
    () => bundleProjectHtml(files, project.name),
    [files, project.name]
  );

  useEffect(() => {
    setSelectedSlide(0);
    setStageMode(project.hasCinemaDemo ? 'media' : bundledAppHtml ? 'app' : 'media');
    setDemoTime(0);
    setDemoPlaying(true);
    setCommentError(null);
    setExportError(null);
    setFileError(null);
    setTradeStatus(null);
    setLaunchError(null);
    setRelOfficial(Boolean(project.officialPublished));
    setRelStatus(null);
    setTestResults([]);
    setTestRunAt(null);
    setPreviewFile(project.files?.[0] || null);
    if (initialTab) setActiveTab(initialTab);
  }, [project.id, initialTab]);

  useEffect(() => {
    if (!previewFile && files.length > 0) {
      setPreviewFile(files[0]);
    }
  }, [files, previewFile]);

  useEffect(() => {
    const primary = wallets.find((w) => w.isPrimary) || wallets[0];
    if (primary && !launchWallet) {
      setLaunchWallet(primary.address);
      setLaunchNetwork(primary.chain);
    }
  }, [wallets, launchWallet]);

  useEffect(() => {
    if (!demoPlaying || !showCinema) {
      lastMsRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastMsRef.current === null) lastMsRef.current = now;
      const dt = (now - lastMsRef.current) / 1000;
      lastMsRef.current = now;
      setDemoTime((prev) => (prev + dt >= DEMO_DURATION ? 0 : prev + dt));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastMsRef.current = null;
    };
  }, [demoPlaying, showCinema]);

  useEffect(() => {
    if (!liveModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLiveModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveModalOpen]);

  // Deterministic chart series anchored to the coin's live price & recent trades
  const chartPoints = useMemo(() => {
    if (!coin) return [];
    const base = coin.priceUsd;
    const count = timeframe === '1H' ? 12 : timeframe === '24H' ? 16 : timeframe === '7D' ? 20 : 24;
    const seed = coin.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const tradePrices = [...trades]
      .slice(0, 6)
      .reverse()
      .map((t) => t.priceUsd);

    const pts: number[] = [];
    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const wave = Math.sin((i + seed) * 0.85) * 0.06 + Math.cos((i + seed) * 0.4) * 0.03;
      const trend = 0.78 + progress * 0.22;
      pts.push(Math.max(0.000001, base * trend * (1 + wave)));
    }
    if (tradePrices.length > 0) {
      for (let i = 0; i < tradePrices.length && i < pts.length; i++) {
        pts[pts.length - tradePrices.length + i] = tradePrices[i];
      }
    }
    pts[pts.length - 1] = base;
    return pts;
  }, [coin, trades, timeframe]);

  const handleExport = async () => {
    if (exportPct !== null) return;
    setExportError(null);
    setExportPct(0);
    try {
      const blob = await exportDemoVideo((p) => setExportPct(p));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.id}-demo-15s.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setExportError('Video export requires MediaRecorder support in your browser.');
    } finally {
      setExportPct(null);
    }
  };

  const handleFullscreenPlayer = async () => {
    const el = playerContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  const handleCopyContract = async () => {
    if (!coin?.contractAddress) return;
    try {
      await navigator.clipboard.writeText(coin.contractAddress);
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    } catch {
      setCopiedContract(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPostingComment) return;
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError('Please write a comment before posting.');
      return;
    }
    setCommentError(null);
    setIsPostingComment(true);
    try {
      await onAddComment(project.id, trimmed);
      setCommentText('');
    } catch {
      setCommentError('Could not save your comment. Please try again.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleUploadNewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setUploadingFile(true);
    try {
      const record = await uploadProjectFile(file, project.id, user?.uid || 'local-creator');
      await onAddFile(project.id, record);
      setPreviewFile(record);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to upload file.');
    } finally {
      setUploadingFile(false);
      if (addFileInputRef.current) addFileInputRef.current.value = '';
    }
  };

  const handleDownloadFile = (file: ProjectFileRecord) => {
    if (file.url) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (file.previewText !== undefined) {
      const blob = new Blob([file.previewText], {type: file.mimeType || 'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
    }
  };

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coin || tradingBusy) return;
    setTradeStatus(null);
    const amount = Number(tradeUsd);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      setTradeStatus({type: 'err', text: 'Enter a valid USD amount between $0.01 and $1,000,000.'});
      return;
    }
    if (tradeSide === 'sell') {
      const holdingUsd = (holding?.balance || 0) * coin.priceUsd;
      if (holdingUsd <= 0 || amount > holdingUsd * 1.02) {
        setTradeStatus({
          type: 'err',
          text: `Insufficient $${coin.ticker} balance. Buy tokens in the sandbox first.`,
        });
        return;
      }
    }

    setTradingBusy(true);
    try {
      await onTradeCoin(coin.id, tradeSide, amount);
      const estTokens = amount / Math.max(0.0000001, coin.priceUsd);
      setTradeStatus({
        type: 'ok',
        text:
          tradeSide === 'buy'
            ? `Bought ~${formatCompactCount(estTokens)} $${coin.ticker} (${formatUsd(amount)}).`
            : `Sold ~${formatCompactCount(estTokens)} $${coin.ticker} for ${formatUsd(amount)}.`,
      });
    } catch (err) {
      setTradeStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Trade execution failed.',
      });
    } finally {
      setTradingBusy(false);
    }
  };

  const handleLaunchProjectCoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (launchingCoin) return;
    setLaunchError(null);
    const cleanTicker = launchTicker
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    if (cleanTicker.length < 2) {
      setLaunchError('Ticker must be 2–10 uppercase alphanumeric characters.');
      return;
    }
    setLaunchingCoin(true);
    try {
      await onLaunchCoin(project.id, {
        ticker: cleanTicker,
        network: launchNetwork,
        totalSupply: launchSupply,
        targetCapUsd: launchTarget,
        creatorFeePct: launchFee,
        creatorWallet: launchWallet,
      });
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Could not launch project coin.');
    } finally {
      setLaunchingCoin(false);
    }
  };

  const handleRunDiagnostics = () => {
    const checks: {name: string; status: 'pass' | 'warn'; detail: string}[] = [
      {
        name: 'Project Metadata & Manifest',
        status: project.name.length >= 2 && project.description.length >= 10 ? 'pass' : 'warn',
        detail: `${project.name} · ${project.category} (${project.creatorHandle})`,
      },
      {
        name: 'Attached Deliverable Files',
        status: files.length > 0 ? 'pass' : 'warn',
        detail:
          files.length > 0
            ? `${files.length} file(s) mounted (${files.map((f) => f.name).slice(0, 3).join(', ')})`
            : 'No project files attached yet — upload files or generate starter HTML.',
      },
      {
        name: 'Executable / Preview Runtime',
        status: runnableHtmlFile || project.hasCinemaDemo ? 'pass' : 'warn',
        detail: runnableHtmlFile
          ? `Sandboxed HTML/SVG runtime ready (${runnableHtmlFile.name})`
          : project.hasCinemaDemo
            ? '15s CinemaStage runtime verified'
            : 'Using visual sandbox fallback (add an HTML/SVG file for live app execution)',
      },
      {
        name: 'Token Bonding Curve & Contract',
        status: coin ? 'pass' : 'warn',
        detail: coin
          ? `$${coin.ticker} live on ${coin.network} · CA ${shortenAddress(coin.contractAddress)} · ${coin.bondingProgress.toFixed(1)}%`
          : 'No paired token launched yet',
      },
      {
        name: 'Creator Payout Wallet',
        status: coin?.creatorWallet || wallets.length > 0 ? 'pass' : 'warn',
        detail: coin?.creatorWallet
          ? `Linked payout: ${shortenAddress(coin.creatorWallet)}`
          : wallets[0]
            ? `Account wallet ready: ${shortenAddress(wallets[0].address)}`
            : 'Sandbox payout mode active',
      },
    ];
    setTestResults(checks);
    setTestRunAt(new Date().toLocaleTimeString());
  };

  const handleApplyAiGeneratedFiles = async (generatedFiles: ProjectFileRecord[]) => {
    setFileError(null);
    for (const file of generatedFiles) {
      await onAddFile(project.id, {...file, projectId: project.id});
    }
    if (generatedFiles[0]) {
      setPreviewFile(generatedFiles[0]);
      setStageMode('app');
    }
  };

  const handlePublishOfficialRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPublishRelease || relBusy) return;
    setRelStatus(null);
    setRelBusy(true);
    try {
      await onPublishRelease(
        project.id,
        relVersion.trim() || 'v1.1.0',
        relNote.trim() || `Verified and officially published ${project.name} on Klyro.`,
        relOfficial
      );
      setRelNote('');
      setRelStatus('Release published and synced across Klyro.');
    } catch (err) {
      setRelStatus(err instanceof Error ? err.message : 'Could not publish release.');
    } finally {
      setRelBusy(false);
    }
  };

  const allArtworks: ArtworkVariant[] = [
    project.artwork,
    ...(['zenith', 'stackforge', 'orbit', 'nova', 'klyro'] as ArtworkVariant[]).filter(
      (v) => v !== project.artwork
    ),
  ];
  const slides = allArtworks.slice(0, 5);
  const activeChapter = getActiveChapter(demoTime);

  const parsedTradeUsd = Number(tradeUsd) || 0;
  const estTokens = coin ? parsedTradeUsd / Math.max(0.0000001, coin.priceUsd) : 0;
  const holdingUsdValue = coin ? (holding?.balance || 0) * coin.priceUsd : 0;

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-6 cursor-pointer whitespace-nowrap"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Discover</span>
      </button>

      <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 md:p-8 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Media & Tabs Column */}
          <div className="lg:col-span-7 space-y-4">
            <div
              ref={playerContainerRef}
              className="relative rounded-2xl overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800 aspect-video"
            >
              {bundledAppHtml && (
                <div className="absolute top-3 right-3 z-20 inline-flex rounded-full bg-black/80 backdrop-blur border border-white/15 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setStageMode('app')}
                    className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                      stageMode === 'app' ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    Live App
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageMode('media')}
                    className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                      stageMode === 'media'
                        ? 'bg-white text-black'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    {project.hasCinemaDemo ? '15s Demo' : 'Cover'}
                  </button>
                </div>
              )}

              {stageMode === 'app' && bundledAppHtml ? (
                <iframe
                  title={`${project.name} Live Application`}
                  sandbox="allow-scripts"
                  srcDoc={bundledAppHtml}
                  className="w-full h-full bg-zinc-950"
                />
              ) : showCinema ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={demoPlaying ? 'Pause product demo' : 'Play product demo'}
                  onClick={() => setDemoPlaying((p) => !p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDemoPlaying((p) => !p);
                    }
                  }}
                  className="w-full h-full cursor-pointer"
                >
                  <CinemaStage time={demoTime} />
                </div>
              ) : (
                <ProjectArtwork
                  variant={slides[selectedSlide] || project.artwork}
                  customCoverUrl={selectedSlide === 0 ? project.customCoverUrl : undefined}
                  alt={project.name}
                />
              )}

              {/* Subtle playback controls when viewing the 15s demo */}
              {stageMode === 'media' && showCinema && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-6 pb-3 px-3 space-y-2 pointer-events-none">
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Demo playback timeline"
                    aria-valuemin={0}
                    aria-valuemax={DEMO_DURATION}
                    aria-valuenow={Number(demoTime.toFixed(1))}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
                      setDemoTime(ratio * DEMO_DURATION);
                    }}
                    className="h-2 flex items-center cursor-pointer pointer-events-auto"
                  >
                    <div className="w-full h-[3px] rounded-full bg-white/25 overflow-hidden">
                      <div
                        className="h-full bg-white"
                        style={{width: `${(demoTime / DEMO_DURATION) * 100}%`}}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      <button
                        type="button"
                        onClick={() => setDemoPlaying((p) => !p)}
                        aria-label={demoPlaying ? 'Pause preview' : 'Play preview'}
                        className="h-8 px-3 rounded-full bg-black/80 backdrop-blur border border-white/15 text-white text-[11px] font-medium flex items-center gap-1.5 hover:bg-black transition-colors cursor-pointer"
                      >
                        {demoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{demoPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDemoTime(0);
                          setDemoPlaying(true);
                        }}
                        aria-label="Restart preview"
                        className="h-8 w-8 rounded-full bg-black/80 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span className="hidden sm:inline text-[11px] font-mono text-zinc-300 pl-1.5 tabular-nums">
                        {activeChapter.index} {activeChapter.label} · {demoTime.toFixed(1)}s
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={exportPct !== null}
                        className="h-8 px-3 rounded-full bg-white text-black text-[11px] font-semibold flex items-center gap-1.5 hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-75"
                      >
                        <Download className="w-3 h-3" />
                        <span>{exportPct !== null ? `${exportPct}%` : 'Export 1080p'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFullscreenPlayer}
                        aria-label="Fullscreen player"
                        className="h-8 w-8 rounded-full bg-black/80 backdrop-blur border border-white/15 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {exportError && <p className="text-[12px] text-red-600">{exportError}</p>}

            {/* 5 Thumbnail Selector Slots */}
            <div className="grid grid-cols-5 gap-2.5">
              {slides.map((variant, idx) => (
                <button
                  key={`${variant}-${idx}`}
                  type="button"
                  onClick={() => setSelectedSlide(idx)}
                  aria-label={`Preview slide ${idx + 1}`}
                  className={`aspect-video rounded-xl overflow-hidden border transition-all cursor-pointer ${
                    selectedSlide === idx
                      ? 'border-zinc-900 ring-2 ring-zinc-900/15'
                      : 'border-zinc-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <ProjectArtwork
                    variant={variant}
                    customCoverUrl={idx === 0 ? project.customCoverUrl : undefined}
                  />
                </button>
              ))}
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="pt-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-5 text-[13px] font-medium overflow-x-auto">
              {[
                {id: 'overview' as const, label: 'Overview'},
                {id: 'files' as const, label: `Files (${files.length})`},
                ...(isOwner ? [{id: 'ai' as const, label: 'AI Builder'}] : []),
                {
                  id: 'coin' as const,
                  label: coin ? `Coin ($${coin.ticker})` : 'Coin & Trade',
                },
                {id: 'comments' as const, label: `Comments (${project.comments.length})`},
                {id: 'analytics' as const, label: 'Analytics'},
                {id: 'updates' as const, label: 'Updates'},
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="pt-2 min-h-[160px]">
              {activeTab === 'overview' && (
                <div className="space-y-3 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <p>{project.description}</p>
                  <p>
                    Crafted for speed, clarity, and monochrome visual precision. Interact with the
                    live app above, inspect attached files, or trade the paired project token.
                  </p>
                </div>
              )}

              {activeTab === 'ai' && isOwner && (
                <AiProjectBuilder
                  projectName={project.name}
                  category={project.category}
                  ownerUid={user?.uid || project.ownerUid || 'local-creator'}
                  currentFiles={files}
                  mode="iterate"
                  onApplyGenerated={({files: generated}) => {
                    void handleApplyAiGeneratedFiles(generated);
                  }}
                />
              )}

              {activeTab === 'files' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] text-zinc-500 dark:text-zinc-400">
                      {files.length} attached project file{files.length === 1 ? '' : 's'}
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('ai')}
                          className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-medium text-zinc-800 dark:text-zinc-100 hover:border-zinc-900 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Build with AI</span>
                        </button>
                        <input
                          ref={addFileInputRef}
                          type="file"
                          onChange={(e) => void handleUploadNewFile(e)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingFile}
                          onClick={() => addFileInputRef.current?.click()}
                          className="h-8 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer disabled:opacity-60"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{uploadingFile ? 'Uploading...' : 'Add File'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {fileError && <p className="text-[12px] text-red-600">{fileError}</p>}

                  {files.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                      No files attached to this project yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                        {files.map((f) => {
                          const isSelected = previewFile?.id === f.id;
                          const isImg = f.mimeType.startsWith('image/');
                          return (
                            <div
                              key={f.id}
                              onClick={() => setPreviewFile(f)}
                              className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-zinc-50 dark:bg-zinc-900'
                                  : 'bg-white dark:bg-zinc-950 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {isImg ? (
                                  <ImageIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                                ) : f.previewText ? (
                                  <FileCode2 className="w-4 h-4 text-zinc-500 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                    {f.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                    {formatFileSize(f.sizeBytes)} · {f.mimeType}
                                  </div>
                                </div>
                              </div>

                              <div
                                className="flex items-center gap-1.5 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(f)}
                                  aria-label={`Download ${f.name}`}
                                  className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </button>
                                {isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => void onDeleteFile(project.id, f.id)}
                                    aria-label={`Delete ${f.name}`}
                                    className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {previewFile && (
                        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-[12px]">
                            <span className="font-mono text-zinc-200">{previewFile.name}</span>
                            <span className="font-mono text-zinc-400">
                              {formatFileSize(previewFile.sizeBytes)}
                            </span>
                          </div>
                          {previewFile.mimeType.startsWith('image/') && previewFile.url ? (
                            <div className="p-4 flex justify-center bg-black">
                              <img
                                src={previewFile.url}
                                alt={previewFile.name}
                                className="max-h-72 rounded-lg object-contain"
                              />
                            </div>
                          ) : previewFile.previewText ? (
                            <pre className="p-4 text-[12px] font-mono text-zinc-200 overflow-x-auto max-h-64 leading-relaxed">
                              {previewFile.previewText}
                            </pre>
                          ) : (
                            <div className="p-5 text-[12px] text-zinc-400">
                              Binary archive ({previewFile.mimeType}). Use Download above to save a
                              local copy.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'coin' && (
                <div className="space-y-5">
                  {coin ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-mono font-semibold text-zinc-950 dark:text-zinc-50">
                            ${coin.ticker}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                            {coin.network}
                          </span>
                        </div>
                        {onOpenTerminal && (
                          <button
                            type="button"
                            onClick={() => onOpenTerminal(coin.id)}
                            className="h-8 px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Open Trading Terminal</span>
                          </button>
                        )}
                      </div>

                      {/* Coin Overview Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Price</div>
                          <div className="text-[16px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-0.5">
                            {formatPriceUsd(coin.priceUsd)}
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Market Cap</div>
                          <div className="text-[16px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-0.5">
                            {formatUsd(coin.marketCapUsd)}
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">24h Volume</div>
                          <div className="text-[16px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-0.5">
                            {formatUsd(coin.volume24hUsd)}
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Holders</div>
                          <div className="text-[16px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-0.5">
                            {formatCompactCount(coin.holdersCount)}
                          </div>
                        </div>
                      </div>

                      {/* Bonding Curve Progress */}
                      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Bonding Curve Progress ({coin.network})</span>
                          </span>
                          <span className="font-mono font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                            {coin.bondingProgress.toFixed(1)}% · Target {formatUsd(coin.targetCapUsd)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-zinc-950 dark:bg-white rounded-full transition-all"
                            style={{width: `${Math.min(100, Math.max(2, coin.bondingProgress))}%`}}
                          />
                        </div>
                      </div>

                      {/* Interactive SVG Price Chart */}
                      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[13px] font-semibold text-zinc-950 dark:text-zinc-50">
                            ${coin.ticker} Curve History
                          </div>
                          <div className="flex items-center gap-1">
                            {(['1H', '24H', '7D', 'ALL'] as const).map((tf) => (
                              <button
                                key={tf}
                                type="button"
                                onClick={() => setTimeframe(tf)}
                                className={`h-7 px-2.5 rounded-full text-[11px] font-mono font-medium cursor-pointer transition-colors ${
                                  timeframe === tf
                                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                                }`}
                              >
                                {tf}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(() => {
                          const W = 540;
                          const H = 130;
                          const minP = Math.min(...chartPoints);
                          const maxP = Math.max(...chartPoints);
                          const span = Math.max(0.0000001, maxP - minP);
                          const coords = chartPoints.map((val, idx) => {
                            const x = 10 + (idx / Math.max(1, chartPoints.length - 1)) * (W - 20);
                            const y = H - 14 - ((val - minP) / span) * (H - 28);
                            return {x, y};
                          });
                          const lineD = coords
                            .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
                            .join(' ');
                          const areaD = `${lineD} L ${coords[coords.length - 1].x} ${H - 10} L ${coords[0].x} ${H - 10} Z`;
                          return (
                            <div className="text-zinc-950 dark:text-zinc-100">
                              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
                                <defs>
                                  <linearGradient id="coin-area" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                                  </linearGradient>
                                </defs>
                                <path d={areaD} fill="url(#coin-area)" />
                                <path
                                  d={lineD}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle
                                  cx={coords[coords.length - 1].x}
                                  cy={coords[coords.length - 1].y}
                                  r="4"
                                  fill="currentColor"
                                />
                              </svg>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Simulated Live Trading Terminal */}
                      <form
                        onSubmit={handleExecuteTrade}
                        className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center p-1 rounded-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                            {(['buy', 'sell'] as const).map((side) => (
                              <button
                                key={side}
                                type="button"
                                onClick={() => {
                                  setTradeSide(side);
                                  setTradeStatus(null);
                                }}
                                className={`h-8 px-4 rounded-full text-[12px] font-semibold capitalize cursor-pointer transition-colors ${
                                  tradeSide === side
                                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                                }`}
                              >
                                {side}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span>Slippage:</span>
                            {(['0.5', '1', '3'] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSlippage(s)}
                                className={`px-2 py-0.5 rounded-full font-mono cursor-pointer ${
                                  slippage === s
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                                    : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {s}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[12px]">
                            <label htmlFor="trade-amount" className="font-medium text-zinc-700 dark:text-zinc-300">
                              Amount (USD · Cash {formatUsd(sandboxBalanceUsd)})
                            </label>
                            <span className="font-mono text-zinc-500 dark:text-zinc-400">
                              {formatCompactCount(holding?.balance || 0)} ${coin.ticker} (
                              {formatUsd(holdingUsdValue)})
                            </span>
                          </div>
                          <input
                            id="trade-amount"
                            type="number"
                            min="0.01"
                            step="any"
                            value={tradeUsd}
                            onChange={(e) => setTradeUsd(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[14px] font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {tradeSide === 'buy'
                              ? [25, 100, 250, 500].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setTradeUsd(String(preset))}
                                    className="h-7 px-3 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-500 cursor-pointer"
                                  >
                                    ${preset}
                                  </button>
                                ))
                              : [0.25, 0.5, 1].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() =>
                                      setTradeUsd(
                                        Math.max(1, Number((holdingUsdValue * pct).toFixed(2))).toString()
                                      )
                                    }
                                    className="h-7 px-3 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-500 cursor-pointer"
                                  >
                                    {Math.round(pct * 100)}%
                                  </button>
                                ))}
                            <span className="ml-auto text-[12px] font-mono text-zinc-500 dark:text-zinc-400">
                              ≈ {formatCompactCount(estTokens)} ${coin.ticker}
                            </span>
                          </div>
                        </div>

                        {tradeStatus && (
                          <p
                            className={`text-[12px] ${
                              tradeStatus.type === 'ok'
                                ? 'text-zinc-800 dark:text-zinc-200 font-medium'
                                : 'text-red-500'
                            }`}
                          >
                            {tradeStatus.text}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={tradingBusy}
                          className="w-full h-11 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
                        >
                          {tradingBusy
                            ? 'Executing Trade...'
                            : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} $${coin.ticker} (${slippage}% max slippage)`}
                        </button>
                      </form>

                      {/* Recent Trades */}
                      <div className="space-y-2">
                        <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                          Recent Trades
                        </div>
                        {trades.length === 0 ? (
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                            No trades recorded yet. Place the first sandbox order above.
                          </p>
                        ) : (
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                            {trades.slice(0, 8).map((t) => (
                              <div
                                key={t.id}
                                className="px-4 py-2.5 flex items-center justify-between text-[12px] bg-white dark:bg-zinc-950"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`font-mono font-semibold uppercase ${
                                      t.side === 'buy'
                                        ? 'text-zinc-950 dark:text-white'
                                        : 'text-zinc-500 dark:text-zinc-400'
                                    }`}
                                  >
                                    {t.side}
                                  </span>
                                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                                    {t.traderHandle}
                                  </span>
                                </div>
                                <div className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                                  {formatUsd(t.amountUsd)} · {formatCompactCount(t.tokenAmount)} $
                                  {coin.ticker}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
                          <Coins className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold text-zinc-950 dark:text-zinc-50">
                            No Coin Launched Yet
                          </div>
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                            {isOwner
                              ? 'Launch a paired coin for this project right now.'
                              : 'This showcase has not launched a paired token yet.'}
                          </p>
                        </div>
                      </div>

                      {isOwner && (
                        <form
                          onSubmit={handleLaunchProjectCoin}
                          className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor="inline-ticker"
                                className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                              >
                                Ticker
                              </label>
                              <input
                                id="inline-ticker"
                                type="text"
                                maxLength={10}
                                value={launchTicker}
                                onChange={(e) =>
                                  setLaunchTicker(
                                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                                  )
                                }
                                placeholder="e.g. KLYR"
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] text-zinc-950 dark:text-zinc-100 font-mono uppercase"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="inline-network"
                                className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                              >
                                Network
                              </label>
                              <select
                                id="inline-network"
                                value={launchNetwork}
                                onChange={(e) => setLaunchNetwork(e.target.value as WalletChain)}
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] text-zinc-950 dark:text-zinc-100"
                              >
                                {SUPPORTED_CHAINS.map((chain) => (
                                  <option key={chain} value={chain}>
                                    {chain}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <select
                              aria-label="Supply"
                              value={launchSupply}
                              onChange={(e) => setLaunchSupply(Number(e.target.value))}
                              className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] text-zinc-950 dark:text-zinc-100"
                            >
                              <option value={1_000_000_000}>1B Supply</option>
                              <option value={100_000_000}>100M Supply</option>
                              <option value={10_000_000}>10M Supply</option>
                            </select>
                            <select
                              aria-label="Migration cap"
                              value={launchTarget}
                              onChange={(e) => setLaunchTarget(Number(e.target.value))}
                              className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] text-zinc-950 dark:text-zinc-100"
                            >
                              <option value={25000}>$25K Target Cap</option>
                              <option value={69000}>$69K Target Cap</option>
                              <option value={120000}>$120K Target Cap</option>
                            </select>
                            <select
                              aria-label="Creator fee"
                              value={launchFee}
                              onChange={(e) => setLaunchFee(Number(e.target.value))}
                              className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] text-zinc-950 dark:text-zinc-100"
                            >
                              <option value={0}>0% Fee</option>
                              <option value={0.5}>0.5% Fee</option>
                              <option value={1}>1% Fee</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              Payout:{' '}
                              {launchWallet
                                ? shortenAddress(launchWallet)
                                : 'No linked wallet (sandbox)'}
                            </span>
                            <button
                              type="button"
                              onClick={onOpenAccountModal}
                              className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                            >
                              Link Wallet
                            </button>
                          </div>

                          {launchError && <p className="text-[12px] text-red-500">{launchError}</p>}

                          <button
                            type="submit"
                            disabled={launchingCoin}
                            className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-60"
                          >
                            {launchingCoin ? 'Launching Coin...' : 'Launch Coin for Project'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  <form onSubmit={handleSubmitComment} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          if (commentError) setCommentError(null);
                        }}
                        placeholder="Share feedback with the creator..."
                        className="flex-1 h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                      />
                      <button
                        type="submit"
                        disabled={isPostingComment}
                        className="px-4 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap disabled:opacity-60"
                      >
                        {isPostingComment ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                    {commentError && <p className="text-[12px] text-red-500">{commentError}</p>}
                  </form>

                  {project.comments.length === 0 ? (
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                      No comments yet. Start the conversation above.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {project.comments.map((c) => (
                        <div key={c.id} className="py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-none">
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{c.author}</span>
                            <span className="text-zinc-400">{c.handle}</span>
                            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                              ·
                            </span>
                            <span className="text-zinc-400">{c.timeAgo}</span>
                          </div>
                          <p className="text-[13px] text-zinc-600 dark:text-zinc-400 mt-1">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="grid grid-cols-3 gap-4 pt-1">
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400">Total Reach</div>
                    <div className="text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
                      {formatCompactCount(project.views)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400">Like Ratio</div>
                    <div className="text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
                      {formatEngagementRate(project.likes, project.views)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400">Trending Rank</div>
                    <div className="text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
                      #{project.trendingRank}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'updates' && (
                <div className="space-y-3">
                  {project.updates.length === 0 ? (
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No release notes published yet.</p>
                  ) : (
                    project.updates.map((u) => (
                      <div key={u.version} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{u.version}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{u.date}</span>
                        </div>
                        <p className="text-[13px] text-zinc-600 dark:text-zinc-400 mt-1">{u.note}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Info & Action Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                {project.artwork === 'klyro' && !project.customCoverUrl ? (
                  <KlyroMiniMark className="w-6 h-6" />
                ) : (
                  <ProjectArtwork
                    variant={project.artwork}
                    customCoverUrl={project.customCoverUrl}
                  />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {project.name}
                  </h1>
                  {project.verified && <CheckCircle2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
                  {project.officialPublished && (
                    <span className="px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-[10px] font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                      Official
                    </span>
                  )}
                </div>
                <p className="text-[14px] text-zinc-500 dark:text-zinc-400">{project.tagline}</p>
              </div>
            </div>

            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">{project.description}</p>

            {/* Paired Coin Quick Strip */}
            {coin && (
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-mono font-semibold text-zinc-950 dark:text-zinc-50">
                      ${coin.ticker}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      {coin.network}
                      {coin.stockSymbol ? ` · ${coin.stockSymbol}` : ''}
                    </span>
                  </div>
                  <div className="text-[13px] font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                    {formatPriceUsd(coin.priceUsd)} · MC {formatUsd(coin.marketCapUsd)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-200/70 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => void handleCopyContract()}
                    className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>CA: {shortenAddress(coin.contractAddress)}</span>
                    {copiedContract ? (
                      <Check className="w-3 h-3 text-zinc-900 dark:text-zinc-100" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  <div className="flex items-center gap-3">
                    {onOpenTerminal && (
                      <button
                        type="button"
                        onClick={() => onOpenTerminal(coin.id)}
                        className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                      >
                        Terminal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('coin')}
                      className="text-[12px] font-semibold text-zinc-950 dark:text-white hover:underline cursor-pointer"
                    >
                      Trade ${coin.ticker} →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSandboxTab('preview');
                  setLiveModalOpen(true);
                }}
                className="flex-1 h-11 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
              >
                <span>{runnableHtmlFile ? 'Launch Live App' : 'Tools & Sandbox'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  handleRunDiagnostics();
                  setSandboxTab('tests');
                  setLiveModalOpen(true);
                }}
                aria-label="Test project"
                className="h-11 px-3.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-900 dark:hover:border-zinc-500 text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleSave(project.id)}
                className={`h-11 px-3.5 rounded-full border text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isSaved
                    ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy project link"
                className="h-11 px-3 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Clean Unboxed Metadata */}
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400 flex items-center flex-wrap gap-2 py-2 border-y border-zinc-100 dark:border-zinc-800">
              {project.tags.map((tag, idx) => (
                <React.Fragment key={tag}>
                  <span>{tag}</span>
                  {idx < project.tags.length - 1 && (
                    <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                      ·
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Creator Attribution */}
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => onOpenProfile && onOpenProfile()}
                className="flex items-center gap-3 text-left group cursor-pointer"
              >
                <AvatarWithRim
                  src={isOwner ? user?.photoURL || undefined : undefined}
                  name={project.creatorName}
                  rim={effectiveCreatorRim}
                  size="md"
                  isFounder={isCreatorFounder}
                  showFounderBadge
                />
                <div className="space-y-1">
                  <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 group-hover:underline">
                    By {project.creatorName}
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{project.creatorHandle}</div>
                  {creatorBadges.length > 0 && <RoleBadges badges={creatorBadges} compact />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onToggleFollow(project.creatorHandle)}
                className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isFollowing
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-zinc-900 dark:border-white'
                    : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                }`}
              >
                {isFollowing && <Check className="w-3.5 h-3.5" />}
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            </div>

            {/* Tabular Stats */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-zinc-400" />
                  <div>
                    <div className="text-[16px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatCompactCount(project.views)}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Views</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleLike(project.id)}
                  className="flex items-center gap-2 text-left group cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      isLiked
                        ? 'fill-zinc-900 dark:fill-white text-zinc-900 dark:text-white'
                        : 'text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white'
                    }`}
                  />
                  <div>
                    <div className="text-[16px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatCompactCount(project.likes)}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Likes</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Live Sandbox, Test Runner & Official Publish Suite */}
      {liveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${project.name} live sandbox and tools`}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLiveModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl bg-zinc-950 text-white border border-white/15 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/15 shrink-0">
                  <ProjectArtwork
                    variant={project.artwork}
                    customCoverUrl={project.customCoverUrl}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate">
                    {project.name} — Live Tools &amp; Sandbox
                  </div>
                  <div className="text-[12px] text-zinc-400 truncate">{project.tagline}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLiveModalOpen(false)}
                aria-label="Close live sandbox"
                className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white hover:border-white/40 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tool Tabs */}
            <div className="px-6 pt-3 border-b border-white/10 flex items-center gap-5 text-[12px] font-medium">
              {[
                {id: 'preview' as const, label: 'Live Runtime'},
                ...(isOwner ? [{id: 'ai' as const, label: 'AI Builder'}] : []),
                {id: 'tests' as const, label: 'Diagnostics & Tests'},
                ...(canOfficialPublish
                  ? [{id: 'publish' as const, label: 'Official Publish'}]
                  : []),
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSandboxTab(t.id);
                    if (t.id === 'tests' && testResults.length === 0) {
                      handleRunDiagnostics();
                    }
                  }}
                  className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    sandboxTab === t.id
                      ? 'border-white text-white font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 max-h-[72vh] overflow-y-auto space-y-5">
              {sandboxTab === 'preview' && (
                <>
                  {bundledAppHtml ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span>
                          Running bundled deliverable: {runnableHtmlFile?.name || 'index.html'}
                        </span>
                        <span>sandbox=&quot;allow-scripts&quot;</span>
                      </div>
                      <iframe
                        title={`${project.name} interactive sandbox`}
                        sandbox="allow-scripts"
                        srcDoc={bundledAppHtml}
                        className="w-full aspect-video rounded-2xl border border-white/15 bg-black"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 relative">
                      <ProjectArtwork
                        variant={project.artwork}
                        customCoverUrl={project.customCoverUrl}
                      />
                      {isOwner && (
                        <div className="absolute bottom-3 right-3">
                          <button
                            type="button"
                            onClick={() => setSandboxTab('ai')}
                            className="h-8 px-3.5 rounded-full bg-white text-zinc-950 text-[11px] font-semibold hover:bg-zinc-200 cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Build Live App with AI</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <div className="text-[11px] text-zinc-400">Files</div>
                      <div className="text-[14px] font-semibold mt-1">{files.length} attached</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <div className="text-[11px] text-zinc-400">Release Status</div>
                      <div className="text-[14px] font-semibold mt-1">
                        {project.officialPublished ? 'Official Live' : 'Published'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                      <div className="text-[11px] text-zinc-400">
                        {coin ? `$${coin.ticker} (${coin.network})` : 'Views'}
                      </div>
                      <div className="text-[14px] font-semibold tabular-nums mt-1">
                        {coin ? formatPriceUsd(coin.priceUsd) : formatCompactCount(project.views)}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {sandboxTab === 'ai' && isOwner && (
                <AiProjectBuilder
                  projectName={project.name}
                  category={project.category}
                  ownerUid={user?.uid || project.ownerUid || 'local-creator'}
                  currentFiles={files}
                  mode="iterate"
                  onApplyGenerated={({files: generated}) => {
                    void handleApplyAiGeneratedFiles(generated).then(() =>
                      setSandboxTab('preview')
                    );
                  }}
                />
              )}

              {sandboxTab === 'tests' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-semibold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-zinc-300" />
                        <span>Automated Project Verification Suite</span>
                      </div>
                      <p className="text-[12px] text-zinc-400 mt-0.5">
                        {testRunAt
                          ? `Last verified at ${testRunAt}`
                          : 'Inspect deliverables, runtime, coin bonding curve, and wallet routing.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunDiagnostics}
                      className="h-9 px-4 rounded-full bg-white text-zinc-950 text-[12px] font-semibold hover:bg-zinc-200 cursor-pointer shrink-0"
                    >
                      Run All Tests
                    </button>
                  </div>

                  <div className="divide-y divide-white/10 border border-white/15 rounded-2xl overflow-hidden">
                    {testResults.map((check) => (
                      <div
                        key={check.name}
                        className="p-3.5 flex items-center justify-between gap-4 bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-white">{check.name}</div>
                          <div className="text-[12px] text-zinc-400 mt-0.5">{check.detail}</div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold shrink-0 ${
                            check.status === 'pass'
                              ? 'bg-white text-zinc-950'
                              : 'border border-white/25 text-zinc-300'
                          }`}
                        >
                          {check.status === 'pass' ? 'PASS' : 'CHECK'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sandboxTab === 'publish' && canOfficialPublish && (
                <form onSubmit={handlePublishOfficialRelease} className="space-y-4">
                  <div className="p-4 rounded-2xl border border-white/15 bg-white/[0.03] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Rocket className="w-5 h-5 text-white shrink-0" />
                      <div>
                        <div className="text-[14px] font-semibold">Official Publish Status</div>
                        <p className="text-[12px] text-zinc-400">
                          Mark this project and its files as an officially verified live release.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      aria-label="Official release status"
                      checked={relOfficial}
                      onChange={(e) => setRelOfficial(e.target.checked)}
                      className="w-4 h-4 accent-white cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="rel-ver" className="block text-[11px] text-zinc-400 mb-1">
                        Version Tag
                      </label>
                      <input
                        id="rel-ver"
                        type="text"
                        value={relVersion}
                        onChange={(e) => setRelVersion(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-white/15 bg-black text-[13px] font-mono text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="rel-note" className="block text-[11px] text-zinc-400 mb-1">
                        Release Changelog Note
                      </label>
                      <input
                        id="rel-note"
                        type="text"
                        value={relNote}
                        onChange={(e) => setRelNote(e.target.value)}
                        placeholder="e.g. Attached live runtime, verified coin liquidity."
                        className="w-full h-10 px-3 rounded-xl border border-white/15 bg-black text-[13px] text-white"
                      />
                    </div>
                  </div>

                  {relStatus && <p className="text-[12px] text-zinc-200">{relStatus}</p>}

                  <button
                    type="submit"
                    disabled={relBusy}
                    className="h-10 px-5 rounded-full bg-white text-zinc-950 text-[13px] font-semibold hover:bg-zinc-200 cursor-pointer disabled:opacity-60"
                  >
                    {relBusy ? 'Publishing...' : 'Publish Official Release'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
