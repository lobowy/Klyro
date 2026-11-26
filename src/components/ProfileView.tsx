import React, {useEffect, useRef, useState} from 'react';
import {User} from 'firebase/auth';
import {
  ArrowRight,
  Bookmark,
  Check,
  Coins,
  Copy,
  Download,
  ExternalLink,
  Folder,
  ImagePlus,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Wallet,
} from 'lucide-react';
import {
  KlyroProject,
  LinkedWallet,
  ProjectCoin,
  StudioSettings,
  UserHolding,
  formatCompactCount,
  formatPriceUsd,
  formatUsd,
} from '../data/projects';
import {uploadProjectFile} from '../lib/files';
import {
  CHAIN_META,
  PROFILE_RIMS,
  ProfileRimId,
  SUPPORTED_CHAINS,
  WalletChain,
  WalletProviderName,
  connectBrowserEvmWallet,
  connectBrowserSolanaWallet,
  createSandboxWalletAddress,
  detectBrowserWallets,
  looksLikeSecretMaterial,
  shortenAddress,
  validateWalletAddress,
} from '../lib/wallets';
import {AvatarWithRim} from './AvatarWithRim';
import {ProjectArtwork} from './ProjectArtwork';
import {RoleBadges} from './RoleBadges';

interface ProfileViewProps {
  user: User | null;
  userEmail: string | null;
  isFounder: boolean;
  settings: StudioSettings;
  projects: KlyroProject[];
  coins: ProjectCoin[];
  wallets: LinkedWallet[];
  holdings: UserHolding[];
  savedIds: Record<string, boolean>;
  followingHandles: Record<string, boolean>;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateProfile: (updates: Partial<StudioSettings>, propagateToProjects?: boolean) => Promise<void>;
  onLinkWallet: (wallet: {
    chain: WalletChain;
    provider: WalletProviderName;
    address: string;
    label: string;
    verified: boolean;
  }) => Promise<void>;
  onSetPrimaryWallet: (walletId: string) => Promise<void>;
  onUnlinkWallet: (walletId: string) => Promise<void>;
  onSelectProject: (project: KlyroProject, initialTab?: 'overview' | 'coin') => void;
  onToggleSave: (projectId: string) => void;
  onToggleFollow: (handle: string) => void;
  onModerateProject?: (projectId: string, action: 'verify' | 'publish' | 'delete') => Promise<void>;
  onOpenTerminal?: (coinId?: string) => void;
  onCreateNew: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  userEmail,
  isFounder,
  settings,
  projects,
  coins,
  wallets,
  holdings,
  savedIds,
  followingHandles,
  onGoogleSignIn,
  onSignOut,
  onUpdateProfile,
  onLinkWallet,
  onSetPrimaryWallet,
  onUnlinkWallet,
  onSelectProject,
  onToggleSave,
  onToggleFollow,
  onModerateProject,
  onOpenTerminal,
  onCreateNew,
}) => {
  const [tab, setTab] = useState<'overview' | 'wallet' | 'saved' | 'moderator'>('overview');
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [handle, setHandle] = useState(settings.creatorHandle);
  const [bio, setBio] = useState(settings.bio);
  const [photoURL, setPhotoURL] = useState(settings.photoURL || '');
  const [profileRim, setProfileRim] = useState<ProfileRimId>(settings.profileRim || 'silver');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{type: 'ok' | 'err'; text: string} | null>(
    null
  );

  // Wallet Loader state
  const [manualChain, setManualChain] = useState<WalletChain>('Solana');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletNotice, setWalletNotice] = useState<{type: 'ok' | 'err'; text: string} | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [holdingFilter, setHoldingFilter] = useState<'all' | 'value'>('all');
  const [authBusy, setAuthBusy] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const walletJsonInputRef = useRef<HTMLInputElement | null>(null);
  const browserWallets = detectBrowserWallets();

  useEffect(() => {
    setDisplayName(settings.displayName);
    setHandle(settings.creatorHandle);
    setBio(settings.bio);
    setPhotoURL(settings.photoURL || '');
    setProfileRim(settings.profileRim || 'silver');
  }, [settings]);

  const myProjects = projects.filter(
    (p) =>
      (user && p.ownerUid === user.uid) ||
      p.creatorHandle.toLowerCase() === settings.creatorHandle.toLowerCase() ||
      p.isUserCreated
  );
  const savedProjects = projects.filter((p) => savedIds[p.id]);
  const followedList = Object.entries(followingHandles)
    .filter(([, active]) => active)
    .map(([h]) => h);

  const totalPortfolioUsd = holdings.reduce((sum, h) => {
    const coin = coins.find((c) => c.id === h.coinId);
    return sum + h.balance * (coin?.priceUsd ?? h.avgBuyPriceUsd);
  }, 0);

  const canModerate =
    isFounder ||
    settings.badges.includes('Owner') ||
    settings.badges.includes('Founder') ||
    settings.badges.includes('Moderator');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    setProfileNotice(null);

    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      setProfileNotice({type: 'err', text: 'Display name must be between 2 and 60 characters.'});
      return;
    }

    const rawH = handle.trim().replace(/^@+/, '');
    const cleanHandle = `@${rawH.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
    if (cleanHandle.length < 2 || cleanHandle.length > 40) {
      setProfileNotice({
        type: 'err',
        text: 'Username handle must be 2–40 characters (letters, numbers, _, ., -).',
      });
      return;
    }

    setSavingProfile(true);
    try {
      await onUpdateProfile(
        {
          displayName: cleanName,
          creatorHandle: cleanHandle,
          bio: bio.trim().slice(0, 240),
          photoURL: photoURL.trim().slice(0, 500),
          profileRim,
        },
        true
      );
      setHandle(cleanHandle);
      setProfileNotice({type: 'ok', text: 'Profile and username updated across Klyro.'});
    } catch (err) {
      setProfileNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not update profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setProfileNotice({type: 'err', text: 'Avatar must be PNG, JPEG, or WebP.'});
      return;
    }
    setUploadingAvatar(true);
    setProfileNotice(null);
    try {
      const uploaded = await uploadProjectFile(file, 'profile-avatar', user?.uid || 'local-creator');
      setPhotoURL(uploaded.url);
      await onUpdateProfile({photoURL: uploaded.url});
      setProfileNotice({type: 'ok', text: 'Avatar updated.'});
    } catch (err) {
      setProfileNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to upload avatar.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConnectSolana = async () => {
    if (walletBusy) return;
    setWalletNotice(null);
    setWalletBusy(true);
    try {
      const res = await connectBrowserSolanaWallet();
      await onLinkWallet({
        ...res,
        label: `${res.provider} Wallet`,
        verified: true,
      });
      setWalletNotice({type: 'ok', text: `Loaded ${res.provider} (${shortenAddress(res.address)}).`});
    } catch (err) {
      setWalletNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not connect Solana wallet.',
      });
    } finally {
      setWalletBusy(false);
    }
  };

  const handleConnectEvm = async () => {
    if (walletBusy) return;
    setWalletNotice(null);
    setWalletBusy(true);
    try {
      const res = await connectBrowserEvmWallet();
      await onLinkWallet({
        ...res,
        label: `${res.provider} (${res.chain})`,
        verified: true,
      });
      setWalletNotice({type: 'ok', text: `Loaded ${res.provider} (${shortenAddress(res.address)}).`});
    } catch (err) {
      setWalletNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not connect EVM wallet.',
      });
    } finally {
      setWalletBusy(false);
    }
  };

  const handleCreateSandboxWallet = async (chain: WalletChain) => {
    if (walletBusy) return;
    setWalletNotice(null);
    setWalletBusy(true);
    try {
      const addr = createSandboxWalletAddress(chain);
      await onLinkWallet({
        chain,
        provider: 'Sandbox',
        address: addr,
        label: `${chain} Sandbox`,
        verified: true,
      });
      setWalletNotice({type: 'ok', text: `Created & loaded ${chain} Sandbox wallet.`});
    } catch (err) {
      setWalletNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not create sandbox wallet.',
      });
    } finally {
      setWalletBusy(false);
    }
  };

  const handleLinkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (walletBusy) return;
    setWalletNotice(null);
    const trimmed = manualAddress.trim();
    if (looksLikeSecretMaterial(trimmed)) {
      setWalletNotice({
        type: 'err',
        text: 'Never enter a seed phrase or private key. Paste only a public wallet address.',
      });
      return;
    }
    if (!validateWalletAddress(manualChain, trimmed)) {
      setWalletNotice({
        type: 'err',
        text: `Invalid ${manualChain} public address format.`,
      });
      return;
    }
    setWalletBusy(true);
    try {
      await onLinkWallet({
        chain: manualChain,
        provider: 'Manual',
        address: trimmed,
        label: manualLabel.trim() || `${manualChain} Wallet`,
        verified: false,
      });
      setManualAddress('');
      setManualLabel('');
      setWalletNotice({type: 'ok', text: `Loaded ${manualChain} public wallet.`});
    } catch (err) {
      setWalletNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not load wallet.',
      });
    } finally {
      setWalletBusy(false);
    }
  };

  const handleImportWalletJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWalletNotice(null);
    setWalletBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        wallets?: {chain?: WalletChain; address?: string; label?: string}[];
        address?: string;
        chain?: WalletChain;
        label?: string;
      };
      const items = Array.isArray(parsed.wallets)
        ? parsed.wallets
        : parsed.address
          ? [{chain: parsed.chain || 'Solana', address: parsed.address, label: parsed.label}]
          : [];
      if (items.length === 0) {
        throw new Error('No valid public wallet addresses found in JSON file.');
      }
      let loaded = 0;
      for (const item of items.slice(0, 6)) {
        const chain = SUPPORTED_CHAINS.includes(item.chain as WalletChain)
          ? (item.chain as WalletChain)
          : 'Solana';
        const addr = String(item.address || '').trim();
        if (addr && validateWalletAddress(chain, addr)) {
          await onLinkWallet({
            chain,
            provider: 'Imported',
            address: addr,
            label: String(item.label || `${chain} Imported`).slice(0, 40),
            verified: false,
          });
          loaded += 1;
        }
      }
      if (loaded === 0) {
        throw new Error('Could not validate any public addresses inside the imported file.');
      }
      setWalletNotice({type: 'ok', text: `Loaded ${loaded} wallet${loaded === 1 ? '' : 's'} from file.`});
    } catch (err) {
      setWalletNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Invalid wallet JSON file.',
      });
    } finally {
      setWalletBusy(false);
      if (walletJsonInputRef.current) walletJsonInputRef.current.value = '';
    }
  };

  const handleExportWallets = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      handle: settings.creatorHandle,
      wallets: wallets.map((w) => ({
        chain: w.chain,
        provider: w.provider,
        label: w.label,
        address: w.address,
        isPrimary: w.isPrimary,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klyro-wallets-${settings.creatorHandle.replace('@', '')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const visibleHoldings =
    holdingFilter === 'value'
      ? [...holdings].sort((a, b) => {
          const ca = coins.find((c) => c.id === a.coinId)?.priceUsd ?? a.avgBuyPriceUsd;
          const cb = coins.find((c) => c.id === b.coinId)?.priceUsd ?? b.avgBuyPriceUsd;
          return b.balance * cb - a.balance * ca;
        })
      : holdings;

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
      {/* Top Profile Identity Card */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 md:p-8 shadow-[0_14px_45px_-22px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <AvatarWithRim
                src={photoURL || user?.photoURL || ''}
                name={settings.displayName}
                rim={profileRim}
                size="lg"
                shape="rounded"
                isFounder={isFounder || settings.badges.includes('Founder')}
                showFounderBadge
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void handleAvatarUpload(e)}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Upload profile photo"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-700 hover:text-zinc-950 cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[24px] font-semibold tracking-tight text-zinc-950">
                  {settings.displayName}
                </h1>
                <span className="text-[13px] font-mono text-zinc-500">
                  {settings.creatorHandle}
                </span>
              </div>

              <RoleBadges
                badges={
                  isFounder && !settings.badges.includes('Founder')
                    ? ['Founder', ...settings.badges]
                    : settings.badges
                }
              />

              <p className="text-[13px] text-zinc-600 max-w-xl">{settings.bio}</p>
              {userEmail && (
                <div className="text-[11px] font-mono text-zinc-400">
                  Account: {userEmail} · Private
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {user ? (
              <>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => {
                    setAuthBusy(true);
                    void onGoogleSignIn().finally(() => setAuthBusy(false));
                  }}
                  className="h-9 px-4 rounded-full border border-zinc-200 bg-white text-[12px] font-medium text-zinc-800 hover:border-zinc-400 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Switch User</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="h-9 px-4 rounded-full border border-zinc-200 bg-white text-[12px] font-medium text-zinc-700 hover:text-zinc-950 hover:border-zinc-400 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => {
                  setAuthBusy(true);
                  void onGoogleSignIn().finally(() => setAuthBusy(false));
                }}
                className="h-10 px-5 rounded-full bg-zinc-950 text-white text-[13px] font-semibold hover:bg-zinc-800 inline-flex items-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCreateNew}
              className="h-9 px-4 rounded-full bg-zinc-950 text-white text-[12px] font-semibold hover:bg-zinc-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Launch Project</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="mt-6 pt-6 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] text-zinc-500">My Projects</div>
            <div className="text-[20px] font-semibold tabular-nums text-zinc-950">
              {myProjects.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Loaded Wallets</div>
            <div className="text-[20px] font-semibold tabular-nums text-zinc-950">
              {wallets.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Sandbox Cash</div>
            <div className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950">
              {formatUsd(settings.sandboxBalanceUsd)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500">Token Portfolio</div>
            <div className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950">
              {formatUsd(totalPortfolioUsd)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 pt-2 border-b border-zinc-200 flex items-center gap-6 text-[13px] font-medium overflow-x-auto">
          {[
            {id: 'overview' as const, label: 'Edit User & Projects'},
            {id: 'wallet' as const, label: `Load Wallet & Portfolio (${wallets.length})`},
            {id: 'saved' as const, label: `Saved & Following (${savedProjects.length})`},
            ...(canModerate
              ? [{id: 'moderator' as const, label: 'Founder & Moderator Tools'}]
              : []),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`pb-3 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === item.id
                  ? 'border-zinc-950 text-zinc-950 font-semibold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-950'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Change User / Edit Profile Form */}
              <form
                onSubmit={handleSaveProfile}
                className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 space-y-4"
              >
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-950">
                    Customize User &amp; Handle
                  </h2>
                  <p className="text-[12px] text-zinc-500 mt-0.5">
                    Update your display name, public @username, and creator bio.
                  </p>
                </div>

                <div>
                  <label htmlFor="prof-name" className="block text-[12px] font-medium text-zinc-700 mb-1">
                    Display Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-[13px] focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label htmlFor="prof-handle" className="block text-[12px] font-medium text-zinc-700 mb-1">
                    Username (@handle)
                  </label>
                  <input
                    id="prof-handle"
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-[13px] font-mono focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label htmlFor="prof-bio" className="block text-[12px] font-medium text-zinc-700 mb-1">
                    Bio
                  </label>
                  <textarea
                    id="prof-bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 bg-white text-[13px] resize-none focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-zinc-700">Profile Rim</span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {PROFILE_RIMS.find((r) => r.id === profileRim)?.name || 'Silver'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PROFILE_RIMS.map((rim) => {
                      const active = profileRim === rim.id;
                      const locked =
                        rim.founderOnly && !isFounder && !settings.badges.includes('Founder');
                      return (
                        <button
                          key={rim.id}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            setProfileRim(rim.id);
                            void onUpdateProfile({profileRim: rim.id});
                          }}
                          className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            active
                              ? 'border-zinc-950 bg-white shadow-sm'
                              : 'border-zinc-200 bg-white/70 hover:border-zinc-400'
                          }`}
                        >
                          <AvatarWithRim
                            src={photoURL || user?.photoURL || ''}
                            name={displayName || settings.displayName}
                            rim={rim.id}
                            size="xs"
                            isFounder={rim.id === 'founder-crown'}
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-zinc-900 truncate">
                              {rim.name}
                            </div>
                            <div className="text-[9px] text-zinc-400 truncate">
                              {locked ? 'Founder only' : rim.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {profileNotice && (
                  <p
                    className={`text-[12px] ${
                      profileNotice.type === 'ok' ? 'text-zinc-800 font-medium' : 'text-red-600'
                    }`}
                  >
                    {profileNotice.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full h-10 rounded-full bg-zinc-950 text-white text-[13px] font-semibold hover:bg-zinc-800 cursor-pointer disabled:opacity-60"
                >
                  {savingProfile ? 'Saving...' : 'Save Username & Profile'}
                </button>
              </form>

              {/* Published Projects & Launched Coins */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-zinc-950">
                    Your Projects &amp; Launched Coins ({myProjects.length})
                  </h2>
                </div>

                {myProjects.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-zinc-200 bg-zinc-50/50 text-center space-y-3">
                    <Folder className="w-6 h-6 text-zinc-400 mx-auto" />
                    <div className="text-[14px] font-semibold text-zinc-900">
                      No published projects yet
                    </div>
                    <p className="text-[12px] text-zinc-500">
                      Launch your first project with files and a multi-chain coin.
                    </p>
                    <button
                      type="button"
                      onClick={onCreateNew}
                      className="h-9 px-4 rounded-full bg-zinc-950 text-white text-[12px] font-semibold cursor-pointer"
                    >
                      Launch Now
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                    {myProjects.map((p) => {
                      const coin = coins.find((c) => c.id === p.coinId || c.projectId === p.id);
                      return (
                        <div
                          key={p.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-zinc-50/70 transition-colors"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-14 h-10 rounded-lg overflow-hidden border border-zinc-200 shrink-0">
                              <ProjectArtwork
                                variant={p.artwork}
                                customCoverUrl={p.customCoverUrl}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-semibold text-zinc-950 truncate">
                                  {p.name}
                                </span>
                                {coin && (
                                  <span className="text-[11px] font-mono font-semibold text-zinc-600">
                                    ${coin.ticker} · {coin.network}
                                  </span>
                                )}
                              </div>
                              <div className="text-[12px] text-zinc-500 truncate">
                                {p.files?.length || 0} files · {formatCompactCount(p.views)} views ·{' '}
                                {p.officialPublished ? 'Official Release' : 'Published'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {coin && (
                              <button
                                type="button"
                                onClick={() => onSelectProject(p, 'coin')}
                                className="h-8 px-3 rounded-full border border-zinc-200 text-[12px] font-mono font-medium text-zinc-800 hover:border-zinc-900 cursor-pointer"
                              >
                                Trade ${coin.ticker}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectProject(p, 'overview')}
                              className="h-8 px-3.5 rounded-full bg-zinc-950 text-white text-[12px] font-medium hover:bg-zinc-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'wallet' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Load Wallet & Faucet */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-medium text-zinc-500">
                      Sandbox Trading Cash Balance
                    </div>
                    <div className="text-[22px] font-semibold font-mono tabular-nums text-zinc-950">
                      {formatUsd(settings.sandboxBalanceUsd)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateProfile({
                          sandboxBalanceUsd: settings.sandboxBalanceUsd + 1000,
                        })
                      }
                      className="h-8 px-3 rounded-full bg-zinc-950 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      + Load $1,000
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateProfile({
                          sandboxBalanceUsd: settings.sandboxBalanceUsd + 5000,
                        })
                      }
                      className="h-8 px-3 rounded-full border border-zinc-300 bg-white text-zinc-900 text-[11px] font-semibold cursor-pointer"
                    >
                      + Load $5,000
                    </button>
                  </div>
                </div>

                {/* Connect Browser Extensions / Instant Sandbox */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={walletBusy}
                    onClick={() =>
                      browserWallets.hasSolana
                        ? void handleConnectSolana()
                        : void handleCreateSandboxWallet('Solana')
                    }
                    className="p-4 rounded-2xl border border-zinc-200 hover:border-zinc-900 text-left transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-zinc-950">
                        {browserWallets.hasSolana
                          ? `Load ${browserWallets.solanaName}`
                          : 'Load Solana Sandbox'}
                      </span>
                      <Wallet className="w-4 h-4 text-zinc-700" />
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      {browserWallets.hasSolana
                        ? 'Detected browser Solana wallet extension'
                        : 'Instant Solana sandbox wallet'}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={walletBusy}
                    onClick={() =>
                      browserWallets.hasEthereum
                        ? void handleConnectEvm()
                        : void handleCreateSandboxWallet('Base')
                    }
                    className="p-4 rounded-2xl border border-zinc-200 hover:border-zinc-900 text-left transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-zinc-950">
                        {browserWallets.hasEthereum
                          ? `Load ${browserWallets.ethereumName}`
                          : 'Load Base / EVM Sandbox'}
                      </span>
                      <Wallet className="w-4 h-4 text-zinc-700" />
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      {browserWallets.hasEthereum
                        ? 'Detected browser EVM wallet extension'
                        : 'Instant 0x Base/ETH sandbox wallet'}
                    </div>
                  </button>
                </div>

                {/* Quick Multi-Chain Sandbox Wallet Strip */}
                <div className="p-3.5 rounded-2xl border border-zinc-200 bg-white space-y-2">
                  <div className="text-[11px] font-semibold text-zinc-700">
                    Instant Multi-Chain Wallet Generator (12 Networks)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUPPORTED_CHAINS.map((chain) => (
                      <button
                        key={chain}
                        type="button"
                        disabled={walletBusy}
                        onClick={() => void handleCreateSandboxWallet(chain)}
                        className="h-7 px-2.5 rounded-full border border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-800 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        + {chain} ({CHAIN_META[chain].symbol})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Load Any Public Address or JSON Wallet File */}
                <form
                  onSubmit={handleLinkManual}
                  className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-zinc-900">
                      Load Public Wallet Address (Read-Only · Never enter private keys)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        ref={walletJsonInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => void handleImportWalletJson(e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => walletJsonInputRef.current?.click()}
                        className="h-7 px-2.5 rounded-full border border-zinc-300 bg-white text-[11px] font-medium text-zinc-700 hover:border-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Import JSON</span>
                      </button>
                      {wallets.length > 0 && (
                        <button
                          type="button"
                          onClick={handleExportWallets}
                          className="h-7 px-2.5 rounded-full border border-zinc-300 bg-white text-[11px] font-medium text-zinc-700 hover:border-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      aria-label="Chain"
                      value={manualChain}
                      onChange={(e) => setManualChain(e.target.value as WalletChain)}
                      className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-[12px] font-medium"
                    >
                      {SUPPORTED_CHAINS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={manualLabel}
                      onChange={(e) => setManualLabel(e.target.value)}
                      placeholder="Label (e.g. Main Treasury)"
                      className="h-9 px-3 rounded-xl border border-zinc-200 bg-white text-[12px]"
                    />
                    <button
                      type="submit"
                      disabled={walletBusy}
                      className="h-9 px-3 rounded-xl bg-zinc-950 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Load Wallet</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder={`Paste ${manualChain} public address...`}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-white text-[12px] font-mono"
                  />
                </form>

                {walletNotice && (
                  <p
                    className={`text-[12px] ${
                      walletNotice.type === 'ok' ? 'text-zinc-800 font-medium' : 'text-red-600'
                    }`}
                  >
                    {walletNotice.text}
                  </p>
                )}

                {/* Linked Wallets List */}
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                  {wallets.length === 0 ? (
                    <div className="p-6 text-center text-[13px] text-zinc-500">
                      No wallets loaded yet. Connect an extension, load a public address, or create
                      a sandbox wallet above.
                    </div>
                  ) : (
                    wallets.map((w) => (
                      <div
                        key={w.id}
                        className="p-3.5 flex items-center justify-between gap-3 bg-white"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-950">
                            <span className="truncate">{w.label}</span>
                            {w.verified && <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />}
                            {w.isPrimary && (
                              <span className="text-[11px] font-mono text-zinc-500">· Primary</span>
                            )}
                          </div>
                          <div className="text-[12px] font-mono text-zinc-500">
                            {w.chain} · {w.provider} · {shortenAddress(w.address)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!w.isPrimary && (
                            <button
                              type="button"
                              onClick={() => void onSetPrimaryWallet(w.id)}
                              className="h-8 px-2.5 rounded-full border border-zinc-200 text-[11px] font-medium text-zinc-700 hover:border-zinc-900 cursor-pointer"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void copyAddress(w.address)}
                            aria-label="Copy wallet address"
                            className="h-8 w-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-950 cursor-pointer"
                          >
                            {copiedAddr === w.address ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onUnlinkWallet(w.id)}
                            aria-label="Unlink wallet"
                            className="h-8 w-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right: Portfolio Holdings */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-zinc-950">
                    Token Portfolio ({holdings.length})
                  </h2>
                  <div className="flex items-center gap-1">
                    {(['all', 'value'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setHoldingFilter(f)}
                        className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer ${
                          holdingFilter === f
                            ? 'bg-zinc-950 text-white'
                            : 'border border-zinc-200 text-zinc-600'
                        }`}
                      >
                        {f === 'all' ? 'Recent' : 'Top Value'}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleHoldings.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-zinc-200 bg-zinc-50/50 text-center space-y-2">
                    <Coins className="w-6 h-6 text-zinc-400 mx-auto" />
                    <div className="text-[13px] font-semibold text-zinc-900">No token holdings</div>
                    <p className="text-[12px] text-zinc-500">
                      Open any project with a coin and buy tokens using your Sandbox cash.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                    {visibleHoldings.map((h) => {
                      const coin = coins.find((c) => c.id === h.coinId);
                      const proj = projects.find(
                        (p) => p.coinId === h.coinId || p.id === coin?.projectId
                      );
                      const price = coin?.priceUsd ?? h.avgBuyPriceUsd;
                      const valueUsd = h.balance * price;
                      return (
                        <button
                          key={h.coinId}
                          type="button"
                          onClick={() =>
                            onOpenTerminal ? onOpenTerminal(h.coinId) : proj && onSelectProject(proj, 'coin')
                          }
                          className="w-full p-4 flex items-center justify-between bg-white hover:bg-zinc-50 text-left transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="text-[14px] font-semibold font-mono text-zinc-950">
                              ${h.ticker}
                              {coin ? ` · ${coin.network}` : ''}
                            </div>
                            <div className="text-[12px] font-mono tabular-nums text-zinc-500">
                              {formatCompactCount(h.balance)} @ {formatPriceUsd(price)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[14px] font-semibold font-mono tabular-nums text-zinc-950">
                              {formatUsd(valueUsd)}
                            </div>
                            <div className="text-[11px] text-zinc-500">Open Terminal →</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {onOpenTerminal && (
                  <button
                    type="button"
                    onClick={() => onOpenTerminal()}
                    className="w-full h-10 rounded-full border border-zinc-200 bg-white text-[12px] font-semibold text-zinc-900 hover:border-zinc-950 cursor-pointer"
                  >
                    Open Full Trading Terminal →
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'saved' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-[15px] font-semibold text-zinc-950">
                  Saved Projects ({savedProjects.length})
                </h2>
                {savedProjects.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">No saved projects yet.</p>
                ) : (
                  <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                    {savedProjects.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 flex items-center justify-between gap-3 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectProject(p, 'overview')}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-[13px] font-semibold text-zinc-950 truncate">
                            {p.name}
                          </div>
                          <div className="text-[12px] text-zinc-500 truncate">{p.tagline}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleSave(p.id)}
                          className="h-8 px-3 rounded-full border border-zinc-200 text-[11px] font-medium text-zinc-700 hover:border-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Bookmark className="w-3 h-3 fill-zinc-900" />
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-[15px] font-semibold text-zinc-950">
                  Followed Creators ({followedList.length})
                </h2>
                {followedList.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">Not following any creators yet.</p>
                ) : (
                  <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                    {followedList.map((h) => (
                      <div key={h} className="p-3.5 flex items-center justify-between bg-white">
                        <span className="text-[13px] font-mono text-zinc-900">{h}</span>
                        <button
                          type="button"
                          onClick={() => onToggleFollow(h)}
                          className="h-8 px-3 rounded-full border border-zinc-200 text-[11px] font-medium text-zinc-700 hover:border-zinc-900 cursor-pointer"
                        >
                          Unfollow
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'moderator' && canModerate && onModerateProject && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 flex items-center gap-3">
                <Shield className="w-5 h-5 text-zinc-950 shrink-0" />
                <div>
                  <div className="text-[14px] font-semibold text-zinc-950">
                    Founder &amp; Moderator Controls
                  </div>
                  <p className="text-[12px] text-zinc-500">
                    Manage official verification, official release status, and moderation across
                    all live Klyro projects.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-zinc-950 truncate">
                        {p.name}{' '}
                        <span className="text-[12px] font-mono font-normal text-zinc-500">
                          by {p.creatorHandle}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        {p.verified ? 'Verified' : 'Unverified'} ·{' '}
                        {p.officialPublished ? 'Official Release' : 'Standard'}
                        {p.coinTicker ? ` · $${p.coinTicker}` : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onModerateProject(p.id, 'verify')}
                        className="h-8 px-3 rounded-full border border-zinc-200 text-[11px] font-medium text-zinc-800 hover:border-zinc-900 cursor-pointer"
                      >
                        {p.verified ? 'Unverify' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onModerateProject(p.id, 'publish')}
                        className="h-8 px-3 rounded-full border border-zinc-200 text-[11px] font-medium text-zinc-800 hover:border-zinc-900 cursor-pointer"
                      >
                        {p.officialPublished ? 'Standardize' : 'Mark Official'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onModerateProject(p.id, 'delete')}
                        className="h-8 px-3 rounded-full border border-red-200 text-[11px] font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
