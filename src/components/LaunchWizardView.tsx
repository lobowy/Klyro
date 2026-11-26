import React, {useEffect, useRef, useState} from 'react';
import {User} from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  FileText,
  ImagePlus,
  Paperclip,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  ArtworkVariant,
  CATEGORIES,
  CoinAssetClass,
  LinkedWallet,
  ProjectCategory,
  ProjectFileRecord,
  STOCK_PRESETS,
  StudioTemplate,
  formatFileSize,
  formatUsd,
} from '../data/projects';
import {uploadProjectFile} from '../lib/files';
import {bundleProjectHtml} from '../lib/projectRunner';
import {CHAIN_META, SUPPORTED_CHAINS, WalletChain, shortenAddress} from '../lib/wallets';
import {AiProjectBuilder} from './AiProjectBuilder';
import {KlyroMiniMark} from './KlyroMark';
import {ProjectArtwork} from './ProjectArtwork';

export interface CoinLaunchConfig {
  enabled: boolean;
  name: string;
  ticker: string;
  network: WalletChain;
  totalSupply: number;
  targetCapUsd: number;
  creatorFeePct: number;
  creatorWallet: string;
  assetClass?: CoinAssetClass;
  stockSymbol?: string;
  stockCompany?: string;
  stockExchange?: string;
  refPriceUsd?: number;
}

export interface CreateProjectPayload {
  name: string;
  tagline: string;
  description: string;
  category: Exclude<ProjectCategory, 'All'>;
  artwork: ArtworkVariant;
  customCoverUrl?: string;
  creatorHandle: string;
  creatorName: string;
  ownerUid?: string;
  files: ProjectFileRecord[];
  officialPublished?: boolean;
  coin?: CoinLaunchConfig;
}

interface LaunchWizardViewProps {
  initialTemplate?: StudioTemplate | null;
  user: User | null;
  wallets: LinkedWallet[];
  defaultCreatorName: string;
  defaultCreatorHandle: string;
  onGoogleSignIn: () => Promise<void>;
  onOpenAccountModal: () => void;
  onPublish: (payload: CreateProjectPayload) => Promise<void>;
}

const ARTWORK_OPTIONS: {id: ArtworkVariant; label: string}[] = [
  {id: 'klyro', label: 'Obsidian Wave'},
  {id: 'nova', label: 'Silver Star'},
  {id: 'zenith', label: 'Studio Ribbon'},
  {id: 'orbit', label: 'Monolith Prism'},
  {id: 'stackforge', label: 'Stacked Planes'},
];

const SUPPLY_OPTIONS = [
  {label: '1,000,000,000 (1B)', value: 1_000_000_000},
  {label: '100,000,000 (100M)', value: 100_000_000},
  {label: '10,000,000 (10M)', value: 10_000_000},
];

const TARGET_CAP_OPTIONS = [
  {label: '$25,000', value: 25000},
  {label: '$69,000 (Standard)', value: 69000},
  {label: '$120,000', value: 120000},
];

export const LaunchWizardView: React.FC<LaunchWizardViewProps> = ({
  initialTemplate,
  user,
  wallets,
  defaultCreatorName,
  defaultCreatorHandle,
  onGoogleSignIn,
  onOpenAccountModal,
  onPublish,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('Create. Innovate. Share.');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Exclude<ProjectCategory, 'All'>>('Design');
  const [artwork, setArtwork] = useState<ArtworkVariant>('klyro');
  const [customCoverUrl, setCustomCoverUrl] = useState<string | undefined>(undefined);
  const [creatorHandle, setCreatorHandle] = useState(defaultCreatorHandle || '@klyro_builder');

  // Attached project files & AI build gate
  const [buildMode, setBuildMode] = useState<'ai' | 'upload'>('ai');
  const [attachedFiles, setAttachedFiles] = useState<ProjectFileRecord[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewMode, setPreviewMode] = useState<'card' | 'live'>('card');

  // Coin launch configuration
  const [launchCoinEnabled, setLaunchCoinEnabled] = useState(true);
  const [coinTicker, setCoinTicker] = useState('');
  const [coinNetwork, setCoinNetwork] = useState<WalletChain>('Solana');
  const [coinSupply, setCoinSupply] = useState<number>(1_000_000_000);
  const [coinTargetCap, setCoinTargetCap] = useState<number>(69000);
  const [creatorFeePct, setCreatorFeePct] = useState<number>(0.5);
  const [selectedWalletAddr, setSelectedWalletAddr] = useState<string>('');
  const [officialPublished, setOfficialPublished] = useState(true);
  const [attachStock, setAttachStock] = useState(false);
  const [stockSymbol, setStockSymbol] = useState('NVDA');
  const [stockCompany, setStockCompany] = useState('NVIDIA Corp.');
  const [stockExchange, setStockExchange] = useState('NASDAQ');
  const [stockRefPriceUsd, setStockRefPriceUsd] = useState(142.8);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const projectFilesInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.name);
      setTagline(initialTemplate.tagline);
      setDescription(initialTemplate.description);
      setCategory(initialTemplate.category);
      setArtwork(initialTemplate.artwork);
      setCustomCoverUrl(undefined);
      setStep(1);
      setError(null);
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (defaultCreatorHandle) {
      setCreatorHandle(defaultCreatorHandle);
    }
  }, [defaultCreatorHandle]);

  useEffect(() => {
    const primary = wallets.find((w) => w.isPrimary) || wallets[0];
    if (primary && !selectedWalletAddr) {
      setSelectedWalletAddr(primary.address);
      setCoinNetwork(primary.chain);
    }
  }, [wallets, selectedWalletAddr]);

  const displayTitle = name.trim() || 'Klyro Studio';
  const displayTagline = tagline.trim() || 'Create. Innovate. Share.';
  const displayDesc =
    description.trim() ||
    'A modern platform to design, build, and showcase your next creation with clarity.';
  const suggestedTicker = (name.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'KLYRO').slice(
    0,
    5
  );
  const effectiveTicker = (coinTicker.trim() || suggestedTicker)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 1_500_000) {
      setError('Cover image must be under 1.5MB.');
      return;
    }

    setUploadingCover(true);
    try {
      const uploaded = await uploadProjectFile(file, 'draft', user?.uid || 'local-creator');
      setCustomCoverUrl(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleProjectFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const remainingSlots = Math.max(0, 12 - attachedFiles.length);
    const selected = Array.from(fileList).slice(0, remainingSlots);
    if (selected.length === 0) {
      setError('You can attach up to 12 files per project.');
      return;
    }

    setUploadingFiles(true);
    try {
      const uploadedRecords: ProjectFileRecord[] = [];
      for (const file of selected) {
        const record = await uploadProjectFile(file, 'draft', user?.uid || 'local-creator');
        uploadedRecords.push(record);
      }
      setAttachedFiles((prev) => [...prev, ...uploadedRecords]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload project files.');
    } finally {
      setUploadingFiles(false);
      if (projectFilesInputRef.current) projectFilesInputRef.current.value = '';
    }
  };

  const validateStep = (targetStep: number): boolean => {
    if (targetStep >= 2 && name.trim().length < 2) {
      setError('Please enter a project name (at least 2 characters) to continue.');
      return false;
    }
    if (targetStep >= 3 && attachedFiles.length === 0) {
      setError('Upload at least one project file or build your project with Klyro AI to continue.');
      return false;
    }
    if (targetStep >= 4) {
      if (creatorHandle.trim().length < 2) {
        setError('Please provide a valid creator handle.');
        return false;
      }
      if (launchCoinEnabled && effectiveTicker.length < 2) {
        setError('Coin ticker must be 2–10 uppercase alphanumeric characters.');
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (isSubmitting || uploadingCover || uploadingFiles) return;
    setError(null);

    if (step === 1 && !validateStep(2)) return;
    if (step === 2 && !validateStep(3)) return;
    if (step === 3 && !validateStep(4)) return;

    if (step < 4) {
      setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
      return;
    }

    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      const normalizedHandle = creatorHandle.trim().startsWith('@')
        ? creatorHandle.trim()
        : `@${creatorHandle.trim()}`;
      await onPublish({
        name: displayTitle,
        tagline: displayTagline,
        description: displayDesc,
        category,
        artwork,
        customCoverUrl,
        creatorHandle: normalizedHandle,
        creatorName: defaultCreatorName || displayTitle,
        ownerUid: user?.uid || 'local-creator',
        files: attachedFiles,
        officialPublished,
        coin: launchCoinEnabled
          ? {
              enabled: true,
              name: displayTitle.slice(0, 50),
              ticker: effectiveTicker,
              network: coinNetwork,
              totalSupply: coinSupply,
              targetCapUsd: coinTargetCap,
              creatorFeePct,
              creatorWallet: selectedWalletAddr,
              assetClass: attachStock
                ? 'stock'
                : coinNetwork === 'Hyperliquid'
                ? 'perp'
                : 'coin',
              ...(attachStock
                ? {
                    stockSymbol,
                    stockCompany,
                    stockExchange,
                    refPriceUsd: stockRefPriceUsd,
                  }
                : {}),
            }
          : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const runnableDoc = bundleProjectHtml(attachedFiles, displayTitle);

  return (
    <section className="max-w-[1160px] mx-auto px-6 py-12">
      <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-8 md:p-10 shadow-[0_14px_45px_-22px_rgba(0,0,0,0.08)]">
        {/* 4-Step Progress Bar */}
        <div className="flex items-center justify-between max-w-2xl mx-auto mb-10">
          {[
            {num: 1, label: 'Details'},
            {num: 2, label: 'Build & Files'},
            {num: 3, label: 'Coin & Wallet'},
            {num: 4, label: 'Publish'},
          ].map((s, idx) => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <React.Fragment key={s.num}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.num <= step || validateStep(s.num)) {
                      setError(null);
                      setStep(s.num as 1 | 2 | 3 | 4);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-full text-[13px] font-semibold flex items-center justify-center transition-colors ${
                      active || done
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 group-hover:border-zinc-400'
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-[12px] font-medium whitespace-nowrap ${
                      active || done ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-[1px] mx-3 -mt-5 ${
                      done ? 'bg-zinc-900 dark:bg-zinc-200' : 'bg-zinc-200 dark:bg-zinc-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Form Pane */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Launch Your Project
              </h1>
              <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mt-1">
                {step === 1 && 'Tell us about your project to get started.'}
                {step === 2 &&
                  'Build your live app with Klyro AI or upload real project files (required before publishing).'}
                {step === 3 &&
                  'Configure your project coin launch (including Hyperliquid or tokenized stocks), payout wallet, and handle.'}
                {step === 4 &&
                  'Everything is ready. Publish your working project, files, and token to Klyro Discover.'}
              </p>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="proj-name" className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Project Name
                  </label>
                  <input
                    id="proj-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Klyro Studio"
                    className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="proj-tagline" className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Tagline
                  </label>
                  <input
                    id="proj-tagline"
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Create. Innovate. Share."
                    className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="proj-desc" className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="proj-desc"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your project..."
                    className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-2">Category</div>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat as Exclude<ProjectCategory, 'All'>)}
                        className={`px-3.5 py-2 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
                          category === cat
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
                      Cover Artwork
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => void handleImageUpload(e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingCover}
                        onClick={() => coverInputRef.current?.click()}
                        className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>
                          {uploadingCover
                            ? 'Uploading...'
                            : customCoverUrl
                              ? 'Replace Image'
                              : 'Upload Image'}
                        </span>
                      </button>
                      {customCoverUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomCoverUrl(undefined);
                            if (coverInputRef.current) coverInputRef.current.value = '';
                          }}
                          aria-label="Remove uploaded image"
                          className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ARTWORK_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setArtwork(opt.id);
                          setCustomCoverUrl(undefined);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          !customCoverUrl && artwork === opt.id
                            ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-900/15 dark:ring-white/15 bg-zinc-50 dark:bg-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className="h-16 rounded-lg overflow-hidden mb-1.5">
                          <ProjectArtwork variant={opt.id} />
                        </div>
                        <div className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                          {opt.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mandatory Build Gate: Talk to Klyro AI OR Upload Real Project Files */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                        Project Files Required (AI Build or Upload)
                      </div>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                        Every launched project must run. Chat with Klyro AI to generate code or upload your own files.
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        attachedFiles.length > 0
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {attachedFiles.length > 0
                        ? `${attachedFiles.length} file${attachedFiles.length === 1 ? '' : 's'} ready`
                        : '0 files · Required'}
                    </span>
                  </div>

                  {/* Mode Switcher */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1">
                    <button
                      type="button"
                      onClick={() => setBuildMode('ai')}
                      className={`py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        buildMode === 'ai'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Build with Klyro AI
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuildMode('upload')}
                      className={`py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        buildMode === 'upload'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Upload Project Files
                    </button>
                  </div>

                  {buildMode === 'ai' ? (
                    <AiProjectBuilder
                      projectName={displayTitle}
                      category={category}
                      ownerUid={user?.uid || 'local-creator'}
                      currentFiles={attachedFiles}
                      mode="create"
                      onApplyGenerated={({
                        files: genFiles,
                        suggestedName,
                        suggestedTagline,
                        suggestedDescription,
                      }) => {
                        setAttachedFiles(genFiles);
                        if (!name.trim() && suggestedName) setName(suggestedName);
                        if (tagline === 'Create. Innovate. Share.' && suggestedTagline) {
                          setTagline(suggestedTagline);
                        }
                        if (!description.trim() && suggestedDescription) {
                          setDescription(suggestedDescription);
                        }
                        setPreviewMode('live');
                        setError(null);
                      }}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/50 p-5 text-center space-y-3">
                      <input
                        ref={projectFilesInputRef}
                        type="file"
                        multiple
                        accept=".md,.txt,.json,.ts,.tsx,.js,.jsx,.css,.html,.svg,.png,.jpg,.jpeg,.webp,.pdf,.zip"
                        onChange={(e) => {
                          void handleProjectFilesSelect(e);
                          setError(null);
                        }}
                        className="hidden"
                      />
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        Upload HTML/CSS/JS bundles, React/TS code, SVG graphics, JSON specs, or docs (max 5MB each).
                      </div>
                      <button
                        type="button"
                        disabled={uploadingFiles || attachedFiles.length >= 12}
                        onClick={() => projectFilesInputRef.current?.click()}
                        className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>{uploadingFiles ? 'Uploading...' : 'Select Files to Upload'}</span>
                      </button>
                    </div>
                  )}

                  {attachedFiles.length > 0 && (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-900">
                      {attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {file.name}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-500">
                                {formatFileSize(file.sizeBytes)} · {file.mimeType}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))
                            }
                            aria-label={`Remove ${file.name}`}
                            className="h-7 w-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="proj-handle"
                    className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-200 mb-1.5"
                  >
                    Creator Handle
                  </label>
                  <input
                    id="proj-handle"
                    type="text"
                    value={creatorHandle}
                    onChange={(e) => {
                      setCreatorHandle(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-[14px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-500"
                  />
                </div>

                {/* Launch Coin with Project Toggle */}
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-100">
                          Launch Coin with Project
                        </div>
                        <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                          Deploy a fair-curve project token alongside your showcase.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={launchCoinEnabled}
                      onClick={() => setLaunchCoinEnabled((v) => !v)}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                        launchCoinEnabled
                          ? 'bg-zinc-950 dark:bg-white'
                          : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white dark:bg-zinc-950 transition-transform ${
                          launchCoinEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {launchCoinEnabled && (
                    <div className="space-y-4 pt-3 border-t border-zinc-200/80 dark:border-zinc-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label
                            htmlFor="coin-ticker"
                            className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                          >
                            Ticker Symbol
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-mono text-zinc-400">
                              $
                            </span>
                            <input
                              id="coin-ticker"
                              type="text"
                              maxLength={10}
                              value={coinTicker}
                              onChange={(e) => {
                                setCoinTicker(
                                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                                );
                                if (error) setError(null);
                              }}
                              placeholder={suggestedTicker}
                              className="w-full h-10 pl-7 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] font-mono uppercase text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="coin-network"
                            className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                          >
                            Network
                          </label>
                          <select
                            id="coin-network"
                            value={coinNetwork}
                            onChange={(e) => setCoinNetwork(e.target.value as WalletChain)}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 cursor-pointer"
                          >
                            {SUPPORTED_CHAINS.map((chain) => (
                              <option key={chain} value={chain}>
                                {chain} ({CHAIN_META[chain].symbol})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['Solana', 'Hyperliquid', 'Base', 'Ethereum', 'BNB Chain', 'Arbitrum', 'Sui'] as WalletChain[]).map(
                          (quickChain) => (
                            <button
                              key={quickChain}
                              type="button"
                              onClick={() => setCoinNetwork(quickChain)}
                              className={`h-7 px-2.5 rounded-full text-[11px] font-mono border transition-colors cursor-pointer ${
                                coinNetwork === quickChain
                                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                                  : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                              }`}
                            >
                              {quickChain}
                            </button>
                          )
                        )}
                        <span className="text-[11px] font-mono text-zinc-400 ml-auto">
                          13 chains · {CHAIN_META[coinNetwork].symbol}
                        </span>
                      </div>

                      {/* Optional: Add Stock Backing to Project Token */}
                      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-3">
                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                          <div>
                            <div className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                              Add Stock Backing to Token (Optional)
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Attach an equity reference (e.g. NVDA, TSLA, AAPL) to turn this into a tokenized stock.
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={attachStock}
                            onChange={(e) => setAttachStock(e.target.checked)}
                            className="w-4 h-4 accent-zinc-950 dark:accent-white"
                          />
                        </label>
                        {attachStock && (
                          <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex flex-wrap gap-1.5">
                              {STOCK_PRESETS.map((sp) => (
                                <button
                                  key={sp.symbol}
                                  type="button"
                                  onClick={() => {
                                    setStockSymbol(sp.symbol);
                                    setStockCompany(sp.company);
                                    setStockExchange(sp.exchange);
                                    setStockRefPriceUsd(sp.refPriceUsd);
                                    if (!coinTicker) setCoinTicker(`${sp.symbol}X`);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                                    stockSymbol === sp.symbol
                                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                                  }`}
                                >
                                  {sp.symbol} · ${sp.refPriceUsd}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <input
                                type="text"
                                value={stockSymbol}
                                onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                                placeholder="Symbol"
                                className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-semibold text-zinc-900 dark:text-zinc-100"
                              />
                              <input
                                type="text"
                                value={stockExchange}
                                onChange={(e) => setStockExchange(e.target.value.toUpperCase())}
                                placeholder="Exchange"
                                className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                              />
                              <input
                                type="text"
                                value={stockCompany}
                                onChange={(e) => setStockCompany(e.target.value)}
                                placeholder="Company"
                                className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label
                            htmlFor="coin-supply"
                            className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                          >
                            Total Supply
                          </label>
                          <select
                            id="coin-supply"
                            value={coinSupply}
                            onChange={(e) => setCoinSupply(Number(e.target.value))}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 cursor-pointer"
                          >
                            {SUPPLY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="coin-target"
                            className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                          >
                            Migration Cap
                          </label>
                          <select
                            id="coin-target"
                            value={coinTargetCap}
                            onChange={(e) => setCoinTargetCap(Number(e.target.value))}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 cursor-pointer"
                          >
                            {TARGET_CAP_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="coin-fee"
                            className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                          >
                            Creator Fee
                          </label>
                          <select
                            id="coin-fee"
                            value={creatorFeePct}
                            onChange={(e) => setCreatorFeePct(Number(e.target.value))}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 cursor-pointer"
                          >
                            <option value={0}>0%</option>
                            <option value={0.5}>0.5%</option>
                            <option value={1}>1.0%</option>
                          </select>
                        </div>
                      </div>

                      {/* Linked Payout Wallet */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="coin-wallet"
                            className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            Creator Payout Wallet
                          </label>
                          <button
                            type="button"
                            onClick={onOpenAccountModal}
                            className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Wallet className="w-3 h-3" />
                            <span>{wallets.length > 0 ? 'Manage Wallets' : 'Link Wallet'}</span>
                          </button>
                        </div>

                        {wallets.length > 0 ? (
                          <select
                            id="coin-wallet"
                            value={selectedWalletAddr}
                            onChange={(e) => setSelectedWalletAddr(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 cursor-pointer"
                          >
                            {wallets.map((w) => (
                              <option key={w.id} value={w.address}>
                                {w.label} ({w.chain} · {shortenAddress(w.address)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="h-10 px-3.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-between text-[12px] text-zinc-500 dark:text-zinc-400">
                            <span>No wallet linked yet (sandbox deployment active)</span>
                            <button
                              type="button"
                              onClick={onOpenAccountModal}
                              className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                            >
                              Connect
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 space-y-3">
                  <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Ready to Launch
                  </div>
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Publishing makes{' '}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {displayTitle}
                    </span>{' '}
                    immediately discoverable on Klyro with{' '}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {attachedFiles.length} attached file{attachedFiles.length === 1 ? '' : 's'}
                    </span>
                    {launchCoinEnabled
                      ? ` and launches $${effectiveTicker} on ${coinNetwork}.`
                      : '.'}
                  </p>

                  <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400">Category</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400">Creator</span>
                      <span className="font-mono text-zinc-900 dark:text-zinc-100">
                        {creatorHandle}
                      </span>
                    </div>
                    {launchCoinEnabled && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400">Paired Coin</span>
                          <span className="font-mono font-semibold text-zinc-950 dark:text-zinc-100">
                            ${effectiveTicker} · {coinNetwork}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400">Migration Cap</span>
                          <span className="font-mono text-zinc-900 dark:text-zinc-100">
                            {formatUsd(coinTargetCap)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <label className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                      Publish as Official Release on Discover
                    </span>
                    <input
                      type="checkbox"
                      checked={officialPublished}
                      onChange={(e) => setOfficialPublished(e.target.checked)}
                      className="w-4 h-4 accent-zinc-950 dark:accent-white"
                    />
                  </label>
                </div>

                {!user && (
                  <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-zinc-950 dark:text-zinc-100">
                        Sign in with Google to save to your account
                      </div>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                        Sync projects, files, wallets, and launched coins across devices, or publish
                        in local sandbox mode below.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        setAuthBusy(true);
                        void onGoogleSignIn()
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : 'Sign-in cancelled.')
                          )
                          .finally(() => setAuthBusy(false));
                      }}
                      className="h-9 px-4 rounded-full border border-zinc-900 dark:border-zinc-300 text-[12px] font-semibold text-zinc-950 dark:text-zinc-100 hover:bg-zinc-950 hover:text-white dark:hover:bg-white dark:hover:text-zinc-950 transition-colors shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      {authBusy ? 'Signing in...' : 'Sign in with Google'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              {step > 1 && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setError(null);
                    setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
                  }}
                  className="h-11 px-5 rounded-full border border-zinc-200 dark:border-zinc-700 text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                disabled={isSubmitting || uploadingCover || uploadingFiles}
                onClick={() => void handleNext()}
                className="flex-1 h-11 px-6 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {isSubmitting
                    ? 'Publishing...'
                    : step === 4
                      ? launchCoinEnabled
                        ? `Publish Project & $${effectiveTicker}`
                        : 'Publish Project'
                      : 'Continue'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Live Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 p-5 space-y-4">
              <div className="flex items-center justify-between text-[12px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>Live Preview</span>
                {runnableDoc ? (
                  <div className="inline-flex rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('card')}
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        previewMode === 'card'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'text-zinc-500'
                      }`}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('live')}
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        previewMode === 'live'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'text-zinc-500'
                      }`}
                    >
                      Live App
                    </button>
                  </div>
                ) : (
                  <span>{category}</span>
                )}
              </div>

              <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 shadow-sm">
                <div className="aspect-[16/10] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
                  {previewMode === 'live' && runnableDoc ? (
                    <iframe
                      title={`${displayTitle} Live Preview`}
                      sandbox="allow-scripts"
                      srcDoc={runnableDoc}
                      className="w-full h-full bg-zinc-950"
                    />
                  ) : (
                    <ProjectArtwork
                      variant={artwork}
                      customCoverUrl={customCoverUrl}
                      alt={displayTitle}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-zinc-950 flex items-center justify-center shrink-0">
                      <KlyroMiniMark className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                          {displayTitle}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                      </div>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">{displayTagline}</p>
                    </div>
                  </div>

                  {launchCoinEnabled && effectiveTicker && (
                    <span className="text-[12px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
                      ${effectiveTicker}
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {displayDesc}
                </p>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>
                    {attachedFiles.length} file{attachedFiles.length === 1 ? '' : 's'}
                  </span>
                  <span>
                    {launchCoinEnabled
                      ? attachStock
                        ? `${stockExchange}:${stockSymbol} · ${coinNetwork}`
                        : `${coinNetwork} · ${formatUsd(coinTargetCap)} cap`
                      : 'Showcase only'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
