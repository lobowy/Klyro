import React, {useEffect, useRef, useState} from 'react';
import {User} from 'firebase/auth';
import {
  Check,
  Copy,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import {
  LinkedWallet,
  ProjectCoin,
  StudioSettings,
  UserHolding,
  formatCompactCount,
  formatUsd,
} from '../data/projects';
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
import {RoleBadges} from './RoleBadges';

interface AccountWalletModalProps {
  open: boolean;
  user: User | null;
  userEmail: string | null;
  settings: StudioSettings;
  wallets: LinkedWallet[];
  holdings: UserHolding[];
  coins: ProjectCoin[];
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenTerminal?: (coinId?: string) => void;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateProfile: (updates: Partial<StudioSettings>) => Promise<void>;
  onLinkWallet: (wallet: {
    chain: WalletChain;
    provider: WalletProviderName;
    address: string;
    label: string;
    verified: boolean;
  }) => Promise<void>;
  onSetPrimaryWallet: (walletId: string) => Promise<void>;
  onUnlinkWallet: (walletId: string) => Promise<void>;
}

export const AccountWalletModal: React.FC<AccountWalletModalProps> = ({
  open,
  user,
  userEmail,
  settings,
  wallets,
  holdings,
  coins,
  onClose,
  onOpenProfile,
  onOpenTerminal,
  onGoogleSignIn,
  onSignOut,
  onUpdateProfile,
  onLinkWallet,
  onSetPrimaryWallet,
  onUnlinkWallet,
}) => {
  const [tab, setTab] = useState<'account' | 'wallets' | 'holdings'>('account');
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [handle, setHandle] = useState(settings.creatorHandle);
  const [bio, setBio] = useState(settings.bio);
  const [profileRim, setProfileRim] = useState<ProfileRimId>(settings.profileRim || 'silver');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);

  const [manualChain, setManualChain] = useState<WalletChain>('Solana');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const walletJsonRef = useRef<HTMLInputElement | null>(null);

  const browserWallets = detectBrowserWallets();

  useEffect(() => {
    setDisplayName(settings.displayName);
    setHandle(settings.creatorHandle);
    setBio(settings.bio);
    setProfileRim(settings.profileRim || 'silver');
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogleClick = async () => {
    if (authBusy) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      await onGoogleSignIn();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    if (displayName.trim().length < 2) {
      setProfileStatus('Display name must be at least 2 characters.');
      return;
    }
    const cleanHandle = handle.trim().startsWith('@')
      ? handle.trim()
      : `@${handle.trim()}`;
    if (!/^@[a-zA-Z0-9_.-]{1,39}$/.test(cleanHandle)) {
      setProfileStatus('Handle may contain letters, numbers, underscores, dots, and hyphens.');
      return;
    }
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      await onUpdateProfile({
        displayName: displayName.trim(),
        creatorHandle: cleanHandle,
        bio: bio.trim(),
      });
      setProfileStatus('Account profile saved.');
      setTimeout(() => setProfileStatus(null), 2500);
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConnectSolana = async () => {
    if (walletBusy) return;
    setWalletError(null);
    setWalletBusy(true);
    try {
      const res = await connectBrowserSolanaWallet();
      await onLinkWallet({
        ...res,
        label: `${res.provider} Wallet`,
        verified: true,
      });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Could not connect Solana wallet.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleConnectEvm = async () => {
    if (walletBusy) return;
    setWalletError(null);
    setWalletBusy(true);
    try {
      const res = await connectBrowserEvmWallet();
      await onLinkWallet({
        ...res,
        label: `${res.provider} (${res.chain})`,
        verified: true,
      });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Could not connect EVM wallet.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleCreateSandboxWallet = async (chain: WalletChain) => {
    if (walletBusy) return;
    setWalletError(null);
    setWalletBusy(true);
    try {
      await onLinkWallet({
        chain,
        provider: 'Sandbox',
        address: createSandboxWalletAddress(chain),
        label: `${chain} Sandbox`,
        verified: true,
      });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Could not create sandbox wallet.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleLinkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (walletBusy) return;
    setWalletError(null);
    const trimmed = manualAddress.trim();
    if (looksLikeSecretMaterial(trimmed)) {
      setWalletError(
        'Never enter a seed phrase or private key. Paste only a public wallet address.'
      );
      return;
    }
    if (!validateWalletAddress(manualChain, trimmed)) {
      setWalletError(
        manualChain === 'Solana'
          ? 'Enter a valid Solana base58 address (32–44 characters).'
          : manualChain === 'Sui'
            ? 'Enter a valid Sui 0x address (62–68 characters).'
            : 'Enter a valid 0x EVM address (42 characters).'
      );
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
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Could not link address.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleImportWalletJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWalletError(null);
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
        throw new Error('No valid public wallet addresses found in JSON file.');
      }
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Invalid wallet JSON file.');
    } finally {
      setWalletBusy(false);
      if (walletJsonRef.current) walletJsonRef.current.value = '';
    }
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

  const avatarSrc = settings.photoURL || user?.photoURL || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Klyro Account and Wallets"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">Account &amp; Wallets</h2>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              {user
                ? `Signed in as ${userEmail || settings.creatorHandle}`
                : 'Sign in with Google or load a public wallet in Sandbox mode.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-900 dark:hover:border-zinc-400 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Full Profile</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-6 text-[13px] font-medium">
          {[
            {id: 'account' as const, label: 'Account'},
            {id: 'wallets' as const, label: `Wallets (${wallets.length})`},
            {id: 'holdings' as const, label: `Holdings (${holdings.length})`},
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white font-semibold'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[72vh] overflow-y-auto space-y-5">
          {!user && tab === 'account' ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 p-6 text-center space-y-4">
              <div className="space-y-1">
                <h3 className="text-[16px] font-semibold text-zinc-950 dark:text-zinc-50">
                  Sign in with Google
                </h3>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Create your Klyro account in one click to claim verified creator identity, load
                  wallets across Solana, Hyperliquid &amp; EVM, upload files, and publish live coins.
                </p>
              </div>

              {authError && <p className="text-[12px] text-red-500">{authError}</p>}

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleGoogleClick()}
                  className="h-11 px-6 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold inline-flex items-center justify-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  <span>{authBusy ? 'Connecting...' : 'Continue with Google'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('wallets')}
                  className="h-11 px-5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-900 dark:hover:border-zinc-400 cursor-pointer"
                >
                  Load Wallet Only
                </button>
              </div>
            </div>
          ) : tab === 'account' && user ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarWithRim
                    src={avatarSrc}
                    name={settings.displayName}
                    rim={profileRim}
                    size="md"
                    isFounder={settings.badges.includes('Founder')}
                    showFounderBadge
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                      {settings.displayName}
                    </div>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                      {userEmail}
                    </div>
                    <RoleBadges badges={settings.badges} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="h-9 px-3.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[12px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="acc-name"
                      className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                    >
                      Display Name
                    </label>
                    <input
                      id="acc-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="acc-handle"
                      className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                    >
                      Username (@handle)
                    </label>
                    <input
                      id="acc-handle"
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="acc-bio"
                    className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Bio
                  </label>
                  <textarea
                    id="acc-bio"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] text-zinc-950 dark:text-zinc-100 resize-none focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
                    Profile Rim
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PROFILE_RIMS.map((rim) => {
                      const locked = rim.founderOnly && !settings.badges.includes('Founder');
                      const active = profileRim === rim.id;
                      return (
                        <button
                          key={rim.id}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            setProfileRim(rim.id);
                            void onUpdateProfile({profileRim: rim.id});
                          }}
                          className={`h-7 px-3 rounded-full text-[11px] font-medium border cursor-pointer disabled:opacity-45 ${
                            active
                              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                              : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-400'
                          }`}
                        >
                          {rim.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {profileStatus && (
                  <p className="text-[12px] text-zinc-700 dark:text-zinc-300">{profileStatus}</p>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-60"
                >
                  {savingProfile ? 'Saving...' : 'Save Account Profile'}
                </button>
              </form>
            </div>
          ) : tab === 'wallets' ? (
            <div className="space-y-5">
              {/* Sandbox Cash Faucet */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Sandbox Trading Cash
                  </div>
                  <div className="text-[17px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                    {formatUsd(settings.sandboxBalanceUsd)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void onUpdateProfile({
                      sandboxBalanceUsd: settings.sandboxBalanceUsd + 1000,
                    })
                  }
                  className="h-8 px-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                >
                  + Load $1,000
                </button>
              </div>

              {/* Live Browser Wallet Connectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={walletBusy}
                  onClick={() =>
                    browserWallets.hasSolana
                      ? void handleConnectSolana()
                      : void handleCreateSandboxWallet('Solana')
                  }
                  className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-900 dark:hover:border-zinc-500 text-left transition-colors cursor-pointer disabled:opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-zinc-950 dark:text-zinc-50">
                      {browserWallets.hasSolana
                        ? `Load ${browserWallets.solanaName}`
                        : 'Load Solana Sandbox'}
                    </span>
                    <Wallet className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    {browserWallets.hasSolana
                      ? 'Detected browser Solana wallet'
                      : 'No extension found — instant demo address'}
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
                  className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-900 dark:hover:border-zinc-500 text-left transition-colors cursor-pointer disabled:opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-zinc-950 dark:text-zinc-50">
                      {browserWallets.hasEthereum
                        ? `Load ${browserWallets.ethereumName}`
                        : 'Load Base / EVM Sandbox'}
                    </span>
                    <Wallet className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    {browserWallets.hasEthereum
                      ? 'Detected browser EVM wallet'
                      : 'No extension found — instant 0x sandbox'}
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_CHAINS.map((chain) => (
                  <button
                    key={chain}
                    type="button"
                    disabled={walletBusy}
                    onClick={() => void handleCreateSandboxWallet(chain)}
                    className="h-7 px-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-950 dark:hover:border-white hover:bg-zinc-950 dark:hover:bg-white hover:text-white dark:hover:text-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    + {chain} ({CHAIN_META[chain].symbol})
                  </button>
                ))}
              </div>

              {/* Manual Address Link + JSON Wallet Import */}
              <form
                onSubmit={handleLinkManual}
                className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">
                    Load Public Address (Read-Only · Never enter private keys)
                  </span>
                  <div>
                    <input
                      ref={walletJsonRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => void handleImportWalletJson(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => walletJsonRef.current?.click()}
                      className="h-7 px-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Import JSON</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    aria-label="Wallet network"
                    value={manualChain}
                    onChange={(e) => setManualChain(e.target.value as WalletChain)}
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-medium text-zinc-950 dark:text-zinc-100"
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
                    placeholder="Label (e.g. Treasury)"
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] text-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    disabled={walletBusy}
                    className="h-9 px-3 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[12px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
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
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-mono text-zinc-950 dark:text-zinc-100"
                />
              </form>

              {walletError && <p className="text-[12px] text-red-500">{walletError}</p>}

              {/* Linked Wallets List */}
              {wallets.length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 text-center py-4">
                  No wallets loaded yet. Connect a browser wallet or load a public address above.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      className="p-3.5 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-950 dark:text-zinc-50">
                          <span className="truncate">{w.label}</span>
                          {w.verified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                          )}
                          {w.isPrimary && (
                            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                              · Primary
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {w.chain} · {w.provider} · {shortenAddress(w.address)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!w.isPrimary && (
                          <button
                            type="button"
                            onClick={() => void onSetPrimaryWallet(w.id)}
                            className="h-8 px-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-400 cursor-pointer"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void copyAddress(w.address)}
                          aria-label="Copy wallet address"
                          className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
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
                          className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {holdings.length === 0 ? (
                <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                  No token holdings yet. Open any project with a launched coin to trade in the
                  live sandbox.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  {holdings.map((h) => {
                    const coin = coins.find((c) => c.id === h.coinId);
                    const valueUsd = h.balance * (coin?.priceUsd ?? h.avgBuyPriceUsd);
                    return (
                      <div key={h.coinId} className="p-4 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900">
                        <div>
                          <div className="text-[14px] font-semibold text-zinc-950 dark:text-zinc-50">
                            ${h.ticker}
                          </div>
                          <div className="text-[12px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                            {formatCompactCount(h.balance)} tokens
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[14px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                              {formatUsd(valueUsd)}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Sandbox Value
                            </div>
                          </div>
                          {onOpenTerminal && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenTerminal(h.coinId);
                              }}
                              className="h-8 px-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                            >
                              Trade
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {onOpenTerminal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTerminal();
                  }}
                  className="w-full h-9 rounded-full border border-zinc-200 dark:border-zinc-800 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-950 dark:hover:border-zinc-400 cursor-pointer"
                >
                  Open Full Trading Terminal →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
