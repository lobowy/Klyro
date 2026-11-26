import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {User, onAuthStateChanged} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Coins,
  Eye,
  Globe,
  Heart,
  LayoutGrid,
  List,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  CATEGORIES,
  CoinTrade,
  DEFAULT_SETTINGS,
  INITIAL_COINS,
  INITIAL_PROJECTS,
  INITIAL_TRADES,
  KlyroNotification,
  KlyroProject,
  LinkedWallet,
  ProjectCategory,
  ProjectCoin,
  ProjectFileRecord,
  StudioSettings,
  StudioTemplate,
  UserHolding,
  formatCompactCount,
  formatPriceUsd,
  formatUsd,
} from './data/projects';
import {
  OperationType,
  auth,
  db,
  ensureUserAccountDocs,
  ensureUserHasStarterWallets,
  handleFirestoreError,
  signInWithGoogle,
  signOutAccount,
} from './lib/firebase';
import {SUPPORTED_CHAINS, WalletChain, WalletProviderName, shortenAddress} from './lib/wallets';
import {AccountWalletModal} from './components/AccountWalletModal';
import {AvatarWithRim} from './components/AvatarWithRim';
import {CommunityView, LearnView} from './components/CommunityLearnViews';
import {KlyroHeroSculpture, KlyroMiniMark} from './components/KlyroMark';
import {CreateProjectPayload, LaunchWizardView} from './components/LaunchWizardView';
import {ProfileView} from './components/ProfileView';
import {ProjectArtwork} from './components/ProjectArtwork';
import {ProjectDetailView} from './components/ProjectDetailView';
import {RoleBadges} from './components/RoleBadges';
import {StudioDashboardView} from './components/StudioDashboardView';
import {TradingTerminalView} from './components/TradingTerminalView';

type ActiveRoute = 'discover' | 'launch' | 'studio' | 'community' | 'learn' | 'profile' | 'terminal';

interface AppStateSnapshot {
  projects: KlyroProject[];
  coins: ProjectCoin[];
  trades: Record<string, CoinTrade[]>;
  wallets?: LinkedWallet[];
  holdings?: UserHolding[];
  savedIds: Record<string, boolean>;
  likedIds: Record<string, boolean>;
  followingHandles: Record<string, boolean>;
  joinedCommunities: Record<string, boolean>;
  completedGuides: Record<string, boolean>;
  settings: StudioSettings;
}

const STORAGE_KEY = 'klyro_app_state_v2';

function parseLocation(): {route: ActiveRoute; projectId: string | null} {
  if (typeof window === 'undefined') return {route: 'discover', projectId: null};
  const path = window.location.pathname;
  if (path.startsWith('/project/')) {
    const id = decodeURIComponent(path.slice('/project/'.length));
    return {route: 'discover', projectId: id || null};
  }
  if (path === '/launch') return {route: 'launch', projectId: null};
  if (path === '/studio') return {route: 'studio', projectId: null};
  if (path === '/community') return {route: 'community', projectId: null};
  if (path === '/learn') return {route: 'learn', projectId: null};
  if (path === '/profile') return {route: 'profile', projectId: null};
  if (path === '/terminal') return {route: 'terminal', projectId: null};
  return {route: 'discover', projectId: null};
}

function readCachedState(): Partial<AppStateSnapshot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppStateSnapshot>) : {};
  } catch {
    return {};
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || `id-${Date.now()}`;
}

export default function App() {
  const initialLoc = parseLocation();
  const cached = useMemo(() => readCachedState(), []);

  const [route, setRoute] = useState<ActiveRoute>(initialLoc.route);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialLoc.projectId);
  const [projectInitialTab, setProjectInitialTab] = useState<
    'overview' | 'files' | 'coin' | undefined
  >(undefined);

  // Firebase Auth & Account state
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [founderUid, setFounderUid] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Base server / local state
  const [projects, setProjects] = useState<KlyroProject[]>(
    Array.isArray(cached.projects) && cached.projects.length > 0
      ? cached.projects
      : INITIAL_PROJECTS
  );
  const [coins, setCoins] = useState<ProjectCoin[]>(
    Array.isArray(cached.coins) && cached.coins.length > 0 ? cached.coins : INITIAL_COINS
  );
  const [tradesMap, setTradesMap] = useState<Record<string, CoinTrade[]>>(
    cached.trades || INITIAL_TRADES
  );

  // Firestore real-time overlay state
  const [fsProjects, setFsProjects] = useState<KlyroProject[]>([]);
  const [fsCoins, setFsCoins] = useState<ProjectCoin[]>([]);
  const [fsProjectFiles, setFsProjectFiles] = useState<Record<string, ProjectFileRecord[]>>({});
  const [fsProjectComments, setFsProjectComments] = useState<Record<string, KlyroProject['comments']>>({});
  const [fsCoinTrades, setFsCoinTrades] = useState<Record<string, CoinTrade[]>>({});

  // User wallets, holdings & engagement state
  const [wallets, setWallets] = useState<LinkedWallet[]>(cached.wallets || []);
  const [holdings, setHoldings] = useState<UserHolding[]>(cached.holdings || []);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>(cached.savedIds || {});
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>(cached.likedIds || {});
  const [followingHandles, setFollowingHandles] = useState<Record<string, boolean>>(
    cached.followingHandles || {}
  );
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>(
    cached.joinedCommunities || {}
  );
  const [completedGuides, setCompletedGuides] = useState<Record<string, boolean>>(
    cached.completedGuides || {}
  );
  const [settings, setSettings] = useState<StudioSettings>({
    ...DEFAULT_SETTINGS,
    ...(cached.settings || {}),
  });
  const [notifications, setNotifications] = useState<KlyroNotification[]>([
    {
      id: 'notif-welcome',
      title: 'Klyro Ecosystem Live',
      detail: 'Load wallets, attach project files, and launch multi-chain coins.',
      timeAgo: 'Just now',
      read: false,
      projectId: 'klyro-studio',
      createdAt: new Date().toISOString(),
    },
  ]);

  const [pendingTemplate, setPendingTemplate] = useState<StudioTemplate | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Discover filters & tabs
  const [discoverTab, setDiscoverTab] = useState<'projects' | 'tokens' | 'terminal' | 'leaderboards'>('projects');
  const [terminalCoinId, setTerminalCoinId] = useState<string | null>(null);
  const [tokenChainFilter, setTokenChainFilter] = useState<'All' | WalletChain>('All');
  const [tokenSort, setTokenSort] = useState<'mc' | 'volume' | 'bonding' | 'price'>('mc');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'views' | 'likes'>('trending');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const discoverSectionRef = useRef<HTMLDivElement | null>(null);

  const pushNotification = useCallback((title: string, detail: string, projectId?: string) => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        detail,
        timeAgo: 'Just now',
        read: false,
        projectId,
        createdAt: new Date().toISOString(),
      },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const applyServerSnapshot = useCallback((snap: Partial<AppStateSnapshot>) => {
    if (Array.isArray(snap.projects) && snap.projects.length > 0) setProjects(snap.projects);
    if (Array.isArray(snap.coins) && snap.coins.length > 0) setCoins(snap.coins);
    if (snap.trades) setTradesMap(snap.trades);
    if (snap.savedIds) setSavedIds((prev) => ({...snap.savedIds, ...prev}));
    if (snap.likedIds) setLikedIds(snap.likedIds);
    if (snap.followingHandles) setFollowingHandles(snap.followingHandles);
    if (snap.joinedCommunities) setJoinedCommunities(snap.joinedCommunities);
    if (snap.completedGuides) setCompletedGuides(snap.completedGuides);
    if (snap.settings) {
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        ...snap.settings,
        // Preserve authenticated user's displayName/handle if signed in
        ...(auth.currentUser
          ? {displayName: prev.displayName, creatorHandle: prev.creatorHandle, bio: prev.bio}
          : {}),
      }));
    }
  }, []);

  // Merge server/local projects with live Firestore projects & subcollections
  const mergedProjects = useMemo(() => {
    const byId = new Map<string, KlyroProject>();
    for (const p of projects) {
      byId.set(p.id, p);
    }
    for (const fp of fsProjects) {
      const existing = byId.get(fp.id);
      byId.set(fp.id, {
        ...existing,
        ...fp,
        files: fsProjectFiles[fp.id] || fp.files || existing?.files || [],
        comments: fsProjectComments[fp.id] || fp.comments || existing?.comments || [],
        updates: existing?.updates || fp.updates || [],
      });
    }
    // Also attach live subcollection files/comments if viewing any project
    return Array.from(byId.values()).map((p) => ({
      ...p,
      files: fsProjectFiles[p.id] && fsProjectFiles[p.id].length > 0 ? fsProjectFiles[p.id] : p.files || [],
      comments:
        fsProjectComments[p.id] && fsProjectComments[p.id].length > 0
          ? fsProjectComments[p.id]
          : p.comments || [],
    }));
  }, [projects, fsProjects, fsProjectFiles, fsProjectComments]);

  const mergedCoins = useMemo(() => {
    const byId = new Map<string, ProjectCoin>();
    for (const c of coins) byId.set(c.id, c);
    for (const fc of fsCoins) byId.set(fc.id, fc);
    return Array.from(byId.values());
  }, [coins, fsCoins]);

  // Cache state locally whenever it changes
  useEffect(() => {
    try {
      const snapshot: AppStateSnapshot = {
        projects,
        coins,
        trades: tradesMap,
        wallets,
        holdings,
        savedIds,
        likedIds,
        followingHandles,
        joinedCommunities,
        completedGuides,
        settings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore storage quota errors
    }
  }, [
    projects,
    coins,
    tradesMap,
    wallets,
    holdings,
    savedIds,
    likedIds,
    followingHandles,
    joinedCommunities,
    completedGuides,
    settings,
  ]);

  // Hydrate authoritative state from Express backend
  useEffect(() => {
    let active = true;
    fetch('/api/state')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load state');
        return res.json() as Promise<AppStateSnapshot>;
      })
      .then((data) => {
        if (active) applyServerSnapshot(data);
      })
      .catch(() => {
        // Keep local cache silently if backend is unreachable
      });
    return () => {
      active = false;
    };
  }, [applyServerSnapshot]);

  // Public Firestore listeners for projects & coins
  useEffect(() => {
    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snap) => {
        const list: KlyroProject[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            ownerUid: String(data.ownerUid || ''),
            name: String(data.name || ''),
            tagline: String(data.tagline || ''),
            description: String(data.description || ''),
            category: (data.category || 'Design') as Exclude<ProjectCategory, 'All'>,
            artwork: (data.artwork || 'klyro') as KlyroProject['artwork'],
            customCoverUrl: data.customCoverUrl ? String(data.customCoverUrl) : undefined,
            creatorName: String(data.creatorName || ''),
            creatorHandle: String(data.creatorHandle || '@klyro'),
            tags: Array.isArray(data.tags) ? data.tags.map(String) : ['Creative'],
            views: Number(data.views || 0),
            likes: Number(data.likes || 0),
            coinId: data.coinId ? String(data.coinId) : undefined,
            coinTicker: data.coinTicker ? String(data.coinTicker) : undefined,
            contractAddress: data.contractAddress ? String(data.contractAddress) : undefined,
            verified: Boolean(data.verified),
            officialPublished: Boolean(data.officialPublished),
            hasCinemaDemo: Boolean(data.hasCinemaDemo),
            trendingRank: 1,
            isUserCreated: true,
            createdAt: String(data.createdAt || ''),
            updatedAt: String(data.updatedAt || ''),
            updates: [
              {
                version: 'Launch v1.0',
                date: 'Live',
                note: data.coinTicker
                  ? `Published on Klyro with paired token $${data.coinTicker}.`
                  : 'Published on Klyro.',
              },
            ],
            comments: [],
            files: [],
          };
        });
        setFsProjects(list);
      },
      (err) => {
        console.warn('Projects snapshot notice:', err.message);
      }
    );

    const unsubCoins = onSnapshot(
      collection(db, 'coins'),
      (snap) => {
        const list: ProjectCoin[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            projectId: String(data.projectId || ''),
            ownerUid: String(data.ownerUid || ''),
            name: String(data.name || ''),
            ticker: String(data.ticker || ''),
            network: (data.network || 'Solana') as WalletChain,
            contractAddress: String(data.contractAddress || ''),
            creatorWallet: data.creatorWallet ? String(data.creatorWallet) : undefined,
            totalSupply: Number(data.totalSupply || 1_000_000_000),
            creatorFeePct: Number(data.creatorFeePct || 0),
            targetCapUsd: Number(data.targetCapUsd || 69000),
            priceUsd: Number(data.priceUsd || 0.000005),
            marketCapUsd: Number(data.marketCapUsd || 5000),
            volume24hUsd: Number(data.volume24hUsd || 0),
            bondingProgress: Number(data.bondingProgress || 1),
            holdersCount: Number(data.holdersCount || 1),
            createdAt: String(data.createdAt || ''),
            updatedAt: String(data.updatedAt || ''),
          };
        });
        setFsCoins(list);
      },
      (err) => {
        console.warn('Coins snapshot notice:', err.message);
      }
    );

    return () => {
      unsubProjects();
      unsubCoins();
    };
  }, []);

  // Load siteConfig so founderUid is known globally for Founder/Owner/Moderator/Developer badges
  useEffect(() => {
    void getDoc(doc(db, 'meta', 'siteConfig'))
      .then((snap) => {
        if (snap.exists()) {
          setFounderUid(String(snap.data().founderUid || ''));
        }
      })
      .catch(() => {});
  }, []);

  // Selected project subcollections (files + comments)
  useEffect(() => {
    if (!selectedProjectId) return;
    const unsubFiles = onSnapshot(
      collection(db, 'projects', selectedProjectId, 'files'),
      (snap) => {
        const files: ProjectFileRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            projectId: String(data.projectId || selectedProjectId),
            ownerUid: String(data.ownerUid || ''),
            name: String(data.name || 'file'),
            mimeType: String(data.mimeType || 'application/octet-stream'),
            sizeBytes: Number(data.sizeBytes || 0),
            url: String(data.url || ''),
            previewText: data.previewText ? String(data.previewText) : undefined,
            createdAt: String(data.createdAt || ''),
          };
        });
        setFsProjectFiles((prev) => ({...prev, [selectedProjectId]: files}));
      },
      () => {}
    );

    const unsubComments = onSnapshot(
      collection(db, 'projects', selectedProjectId, 'comments'),
      (snap) => {
        const comments = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              projectId: String(data.projectId || selectedProjectId),
              authorUid: String(data.authorUid || ''),
              author: String(data.authorName || 'Klyro Member'),
              handle: String(data.authorHandle || '@klyro'),
              timeAgo: 'Live',
              body: String(data.body || ''),
              createdAt: String(data.createdAt || ''),
            };
          })
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setFsProjectComments((prev) => ({...prev, [selectedProjectId]: comments}));
      },
      () => {}
    );

    return () => {
      unsubFiles();
      unsubComments();
    };
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => mergedProjects.find((p) => p.id === selectedProjectId) || null,
    [mergedProjects, selectedProjectId]
  );

  const selectedCoin = useMemo(
    () =>
      selectedProject?.coinId
        ? mergedCoins.find((c) => c.id === selectedProject.coinId) || null
        : mergedCoins.find((c) => c.projectId === selectedProject?.id) || null,
    [mergedCoins, selectedProject]
  );

  const activeTerminalCoinId = terminalCoinId || mergedCoins[0]?.id || null;

  // Selected coin & active trading terminal coin trades real-time listener
  useEffect(() => {
    const ids = Array.from(
      new Set([selectedCoin?.id, activeTerminalCoinId].filter((v): v is string => Boolean(v)))
    );
    if (ids.length === 0) return;

    const unsubs = ids.map((coinId) =>
      onSnapshot(
        collection(db, 'coins', coinId, 'trades'),
        (snap) => {
          const list: CoinTrade[] = snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id: String(data.id || d.id),
                coinId: String(data.coinId || coinId),
                traderUid: String(data.traderUid || ''),
                traderHandle: String(data.traderHandle || '@trader'),
                side: (data.side === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
                amountUsd: Number(data.amountUsd || 0),
                tokenAmount: Number(data.tokenAmount || 0),
                priceUsd: Number(data.priceUsd || 0),
                createdAt: String(data.createdAt || ''),
              };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setFsCoinTrades((prev) => ({...prev, [coinId]: list}));
        },
        () => {}
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [selectedCoin?.id, activeTerminalCoinId]);

  // Firebase Auth listener + private subcollections (wallets, holdings, bookmarks)
  useEffect(() => {
    let unsubWallets: (() => void) | null = null;
    let unsubHoldings: (() => void) | null = null;
    let unsubBookmarks: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsubWallets) unsubWallets();
      if (unsubHoldings) unsubHoldings();
      if (unsubBookmarks) unsubBookmarks();
      unsubWallets = null;
      unsubHoldings = null;
      unsubBookmarks = null;

      setUser(nextUser);
      if (!nextUser) {
        setUserEmail(null);
        setSettings((prev) => ({...prev, badges: []}));
        return;
      }

      setUserEmail(nextUser.email || null);
      void ensureUserAccountDocs(nextUser)
        .then(async (profile) => {
          if (profile.isFounder) {
            setFounderUid(nextUser.uid);
          }
          setSettings((prev) => ({
            ...prev,
            displayName: profile.displayName,
            creatorHandle: profile.handle,
            bio: profile.bio,
            photoURL: profile.photoURL || prev.photoURL,
            profileRim: profile.profileRim || prev.profileRim || (profile.isFounder ? 'founder-crown' : 'silver'),
            badges: profile.badges,
            proEnabled: profile.proEnabled,
            sandboxBalanceUsd: profile.sandboxBalanceUsd,
          }));

          const provisioned = await ensureUserHasStarterWallets(nextUser);
          if (provisioned) {
            pushNotification(
              'Personal Wallets Ready',
              'Solana and Base starter wallets were created for your account.'
            );
          }
        })
        .catch((err) => {
          console.error('Account sync error:', err);
        });

      unsubWallets = onSnapshot(
        collection(db, 'users', nextUser.uid, 'wallets'),
        (snap) => {
          const list: LinkedWallet[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              uid: String(data.uid || nextUser.uid),
              chain: (data.chain || 'Solana') as WalletChain,
              provider: (data.provider || 'Manual') as WalletProviderName,
              address: String(data.address || ''),
              label: String(data.label || 'Wallet'),
              isPrimary: Boolean(data.isPrimary),
              verified: Boolean(data.verified),
              linkedAt: String(data.linkedAt || ''),
            };
          });
          setWallets(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${nextUser.uid}/wallets`);
        }
      );

      unsubHoldings = onSnapshot(
        collection(db, 'users', nextUser.uid, 'holdings'),
        (snap) => {
          const list: UserHolding[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid || nextUser.uid),
              coinId: String(data.coinId || d.id),
              ticker: String(data.ticker || ''),
              balance: Number(data.balance || 0),
              avgBuyPriceUsd: Number(data.avgBuyPriceUsd || 0),
              updatedAt: String(data.updatedAt || ''),
            };
          });
          setHoldings(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${nextUser.uid}/holdings`);
        }
      );

      unsubBookmarks = onSnapshot(
        collection(db, 'users', nextUser.uid, 'bookmarks'),
        (snap) => {
          const nextSaved: Record<string, boolean> = {};
          snap.docs.forEach((d) => {
            nextSaved[d.id] = true;
          });
          setSavedIds((prev) => ({...prev, ...nextSaved}));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${nextUser.uid}/bookmarks`);
        }
      );
    });

    return () => {
      if (unsubWallets) unsubWallets();
      if (unsubHoldings) unsubHoldings();
      if (unsubBookmarks) unsubBookmarks();
      unsubAuth();
    };
  }, []);

  // Browser Back / Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const next = parseLocation();
      setRoute(next.route);
      setSelectedProjectId(next.projectId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const pushUrl = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  const savedCount = useMemo(
    () => Object.values(savedIds).filter(Boolean).length,
    [savedIds]
  );

  const followingCount = useMemo(
    () => Object.values(followingHandles).filter(Boolean).length,
    [followingHandles]
  );

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedProjects
      .filter((p) => {
        const catMatch =
          activeCategory === 'All' ||
          p.category === activeCategory ||
          p.tags.includes(activeCategory);
        const savedMatch = !savedOnly || Boolean(savedIds[p.id]);
        const queryMatch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.creatorHandle.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.coinTicker && p.coinTicker.toLowerCase().includes(q)) ||
          (p.contractAddress && p.contractAddress.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q));
        return catMatch && savedMatch && queryMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'views') return b.views - a.views;
        if (sortBy === 'likes') return b.likes - a.likes;
        return a.trendingRank - b.trendingRank;
      });
  }, [mergedProjects, activeCategory, savedOnly, savedIds, searchQuery, sortBy]);

  const navigateTo = (next: ActiveRoute, template?: StudioTemplate) => {
    setSyncError(null);
    setNotifOpen(false);
    setPendingTemplate(template || null);
    setSelectedProjectId(null);
    setProjectInitialTab(undefined);
    setRoute(next);
    pushUrl(next === 'discover' ? '/' : `/${next}`);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const openProject = (
    project: KlyroProject,
    initialTab?: 'overview' | 'files' | 'coin'
  ) => {
    setSyncError(null);
    setNotifOpen(false);
    setProjectInitialTab(initialTab);
    setSelectedProjectId(project.id);
    setRoute('discover');
    pushUrl(`/project/${encodeURIComponent(project.id)}`);
    window.scrollTo({top: 0, behavior: 'smooth'});

    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? {...p, views: p.views + 1} : p))
    );
    void fetch(`/api/projects/${encodeURIComponent(project.id)}/view`, {
      method: 'POST',
    }).catch(() => {});
  };

  const openTerminal = (coinId?: string) => {
    setSyncError(null);
    setNotifOpen(false);
    setSelectedProjectId(null);
    setProjectInitialTab(undefined);
    if (coinId) setTerminalCoinId(coinId);
    setRoute('terminal');
    pushUrl('/terminal');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleExploreProjects = () => {
    setSelectedProjectId(null);
    setRoute('discover');
    pushUrl('/');
    setTimeout(() => {
      discoverSectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
    }, 40);
  };

  const handleGoogleSignInAction = async () => {
    await signInWithGoogle();
  };

  const handleSignOutAction = async () => {
    await signOutAccount();
    setWallets([]);
    setHoldings([]);
  };

  const handleLinkWallet = async (walletInput: {
    chain: WalletChain;
    provider: WalletProviderName;
    address: string;
    label: string;
    verified: boolean;
  }) => {
    const walletId = sanitizeId(`wal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    const newWallet: LinkedWallet = {
      id: walletId,
      uid: user?.uid || 'local-creator',
      chain: walletInput.chain,
      provider: walletInput.provider,
      address: walletInput.address.trim(),
      label: walletInput.label.trim().slice(0, 40) || `${walletInput.chain} Wallet`,
      isPrimary: wallets.length === 0,
      verified: walletInput.verified,
      linkedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'wallets', walletId), newWallet);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/wallets/${walletId}`);
      }
    } else {
      setWallets((prev) => [newWallet, ...prev]);
    }
  };

  const handleSetPrimaryWallet = async (walletId: string) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        for (const w of wallets) {
          batch.update(doc(db, 'users', user.uid, 'wallets', w.id), {
            isPrimary: w.id === walletId,
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/wallets/${walletId}`);
      }
    } else {
      setWallets((prev) => prev.map((w) => ({...w, isPrimary: w.id === walletId})));
    }
  };

  const handleUnlinkWallet = async (walletId: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'wallets', walletId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/wallets/${walletId}`);
      }
    } else {
      setWallets((prev) => prev.filter((w) => w.id !== walletId));
    }
  };

  const handlePublishProject = async (payload: CreateProjectPayload) => {
    setSyncError(null);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ...payload,
        ownerUid: user?.uid || 'local-creator',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Could not publish project.');
    }

    const createdProject = data.project as KlyroProject;
    const createdCoin = data.coin as ProjectCoin | undefined;

    if (data.state) {
      applyServerSnapshot(data.state);
    }

    // Persist to Firestore when signed in with Google
    if (user) {
      const projDoc: Record<string, unknown> = {
        id: createdProject.id,
        ownerUid: user.uid,
        name: createdProject.name.slice(0, 60),
        tagline: createdProject.tagline.slice(0, 120),
        description: createdProject.description.slice(0, 800),
        category: createdProject.category,
        artwork: createdProject.artwork,
        creatorName: createdProject.creatorName.slice(0, 60),
        creatorHandle: createdProject.creatorHandle.slice(0, 40),
        tags: createdProject.tags.slice(0, 6),
        views: 1,
        likes: 1,
        verified: true,
        officialPublished: Boolean(createdProject.officialPublished),
        hasCinemaDemo: false,
        createdAt: createdProject.createdAt || new Date().toISOString(),
        updatedAt: createdProject.updatedAt || new Date().toISOString(),
      };
      if (createdProject.customCoverUrl && createdProject.customCoverUrl.length <= 500) {
        projDoc.customCoverUrl = createdProject.customCoverUrl;
      }
      if (createdCoin) {
        projDoc.coinId = createdCoin.id;
        projDoc.coinTicker = createdCoin.ticker;
        projDoc.contractAddress = createdCoin.contractAddress;
      }

      try {
        // Must create project first because subcollections & coins rules validate owner via get(/projects/projectId)
        await setDoc(doc(db, 'projects', createdProject.id), projDoc);

        for (const f of createdProject.files || []) {
          const fileId = sanitizeId(f.id);
          const fileDoc: Record<string, unknown> = {
            id: fileId,
            projectId: createdProject.id,
            ownerUid: user.uid,
            name: f.name.slice(0, 140),
            mimeType: f.mimeType.slice(0, 100),
            sizeBytes: Math.min(5_242_880, Math.max(0, f.sizeBytes)),
            url: (f.url || `/api/files/${fileId}`).slice(0, 500),
            createdAt: f.createdAt || new Date().toISOString(),
          };
          if (f.previewText) {
            fileDoc.previewText = f.previewText.slice(0, 20000);
          }
          await setDoc(doc(db, 'projects', createdProject.id, 'files', fileId), fileDoc);
        }

        if (createdCoin) {
          const coinDoc: Record<string, unknown> = {
            id: createdCoin.id,
            projectId: createdProject.id,
            ownerUid: user.uid,
            name: createdCoin.name.slice(0, 50),
            ticker: createdCoin.ticker,
            network: createdCoin.network,
            contractAddress: createdCoin.contractAddress,
            totalSupply: createdCoin.totalSupply,
            creatorFeePct: createdCoin.creatorFeePct,
            targetCapUsd: createdCoin.targetCapUsd,
            priceUsd: createdCoin.priceUsd,
            marketCapUsd: createdCoin.marketCapUsd,
            volume24hUsd: createdCoin.volume24hUsd,
            bondingProgress: createdCoin.bondingProgress,
            holdersCount: createdCoin.holdersCount,
            createdAt: createdCoin.createdAt,
            updatedAt: createdCoin.updatedAt,
          };
          if (createdCoin.creatorWallet) {
            coinDoc.creatorWallet = createdCoin.creatorWallet.slice(0, 80);
          }
          await setDoc(doc(db, 'coins', createdCoin.id), coinDoc);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${createdProject.id}`);
      }
    }

    pushNotification(
      `Published ${createdProject.name}`,
      createdCoin
        ? `Live with $${createdCoin.ticker} on ${createdCoin.network}`
        : `${createdProject.files?.length || 0} files attached`,
      createdProject.id
    );

    setPendingTemplate(null);
    setProjectInitialTab(undefined);
    setSelectedProjectId(createdProject.id);
    setRoute('discover');
    pushUrl(`/project/${encodeURIComponent(createdProject.id)}`);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleAddFile = async (projectId: string, file: ProjectFileRecord) => {
    const fileId = sanitizeId(file.id);
    const cleanFile: ProjectFileRecord = {
      ...file,
      id: fileId,
      projectId,
      ownerUid: user?.uid || 'local-creator',
    };

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({file: cleanFile}),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        applyServerSnapshot(data.state);
      } else if (res.status !== 404) {
        throw new Error(data.error || 'Could not attach file.');
      }
    } catch {
      // Fall back to local + Firestore update for projects loaded solely from Firestore
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              files: [cleanFile, ...(p.files || []).filter((f) => f.id !== cleanFile.id)],
            }
          : p
      )
    );

    if (user) {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (projSnap.exists() && projSnap.data().ownerUid === user.uid) {
        const fileDoc: Record<string, unknown> = {
          id: cleanFile.id,
          projectId,
          ownerUid: user.uid,
          name: cleanFile.name.slice(0, 140),
          mimeType: cleanFile.mimeType.slice(0, 100),
          sizeBytes: Math.min(5_242_880, Math.max(0, cleanFile.sizeBytes)),
          url: (cleanFile.url || `/api/files/${cleanFile.id}`).slice(0, 500),
          createdAt: cleanFile.createdAt,
        };
        if (cleanFile.previewText) fileDoc.previewText = cleanFile.previewText.slice(0, 20000);
        try {
          await setDoc(doc(db, 'projects', projectId, 'files', cleanFile.id), fileDoc);
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `projects/${projectId}/files/${cleanFile.id}`
          );
        }
      }
    }
  };

  const handleDeleteFile = async (projectId: string, fileId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
        {method: 'DELETE'}
      );
      const data = await res.json();
      if (res.ok && data.state) {
        applyServerSnapshot(data.state);
      } else if (res.status !== 404) {
        throw new Error(data.error || 'Could not remove file.');
      }
    } catch {
      // Allow Firestore-synced deletion fallback
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? {...p, files: (p.files || []).filter((f) => f.id !== fileId)} : p
      )
    );

    if (user) {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (projSnap.exists() && projSnap.data().ownerUid === user.uid) {
        try {
          await deleteDoc(doc(db, 'projects', projectId, 'files', fileId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/files/${fileId}`);
        }
      }
    }
  };

  const handleLaunchCoin = async (
    projectId: string,
    config: {
      ticker: string;
      network: WalletChain;
      totalSupply: number;
      targetCapUsd: number;
      creatorFeePct: number;
      creatorWallet: string;
    }
  ) => {
    const targetProj = mergedProjects.find((p) => p.id === projectId);
    const res = await fetch('/api/coins', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        projectId,
        ownerUid: user?.uid || 'local-creator',
        name: targetProj?.name || 'Klyro Token',
        ...config,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not launch coin.');
    if (data.state) applyServerSnapshot(data.state);

    const coin = data.coin as ProjectCoin;
    if (user && coin) {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (projSnap.exists() && projSnap.data().ownerUid === user.uid) {
        const coinDoc: Record<string, unknown> = {
          id: coin.id,
          projectId,
          ownerUid: user.uid,
          name: coin.name.slice(0, 50),
          ticker: coin.ticker,
          network: coin.network,
          contractAddress: coin.contractAddress,
          totalSupply: coin.totalSupply,
          creatorFeePct: coin.creatorFeePct,
          targetCapUsd: coin.targetCapUsd,
          priceUsd: coin.priceUsd,
          marketCapUsd: coin.marketCapUsd,
          volume24hUsd: coin.volume24hUsd,
          bondingProgress: coin.bondingProgress,
          holdersCount: coin.holdersCount,
          createdAt: coin.createdAt,
          updatedAt: coin.updatedAt,
        };
        if (coin.creatorWallet) coinDoc.creatorWallet = coin.creatorWallet.slice(0, 80);

        try {
          await setDoc(doc(db, 'coins', coin.id), coinDoc);
          await updateDoc(doc(db, 'projects', projectId), {
            coinId: coin.id,
            coinTicker: coin.ticker,
            contractAddress: coin.contractAddress,
            updatedAt: coin.updatedAt,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `coins/${coin.id}`);
        }
      }
    }
    if (coin) {
      pushNotification(
        `Launched $${coin.ticker}`,
        `Live bonding curve on ${coin.network}`,
        projectId
      );
    }
  };

  const handleTradeCoin = async (coinId: string, side: 'buy' | 'sell', amountUsd: number) => {
    if (side === 'buy' && amountUsd > settings.sandboxBalanceUsd) {
      throw new Error('Insufficient Sandbox cash balance. Load funds in your Profile or Wallet.');
    }

    let updatedCoin: ProjectCoin | null = null;
    let trade: CoinTrade | null = null;

    const res = await fetch(`/api/coins/${encodeURIComponent(coinId)}/trade`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        side,
        amountUsd,
        traderUid: user?.uid || 'sandbox-trader',
        traderHandle: settings.creatorHandle,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.state) applyServerSnapshot(data.state);
      updatedCoin = data.coin as ProjectCoin;
      trade = data.trade as CoinTrade;
    } else if (res.status === 404) {
      const targetCoin = mergedCoins.find((c) => c.id === coinId);
      if (!targetCoin) throw new Error('Coin not found.');
      const nowIso = new Date().toISOString();
      const deltaMc = side === 'buy' ? amountUsd * 1.15 : -amountUsd * 0.9;
      const nextMc = Math.max(2500, Number((targetCoin.marketCapUsd + deltaMc).toFixed(2)));
      const nextPrice = Math.max(
        0.000001,
        Number((nextMc / Math.max(1, targetCoin.totalSupply)).toFixed(8))
      );
      const tokenAmount = Number(
        (amountUsd / Math.max(0.000001, targetCoin.priceUsd)).toFixed(2)
      );
      updatedCoin = {
        ...targetCoin,
        marketCapUsd: nextMc,
        priceUsd: nextPrice,
        volume24hUsd: Number((targetCoin.volume24hUsd + amountUsd).toFixed(2)),
        bondingProgress: Math.min(
          100,
          Number(((nextMc / Math.max(1000, targetCoin.targetCapUsd)) * 100).toFixed(2))
        ),
        holdersCount:
          side === 'buy' ? targetCoin.holdersCount + 1 : targetCoin.holdersCount,
        updatedAt: nowIso,
      };
      trade = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        coinId,
        traderUid: user?.uid || 'sandbox-trader',
        traderHandle: settings.creatorHandle,
        side,
        amountUsd,
        tokenAmount,
        priceUsd: nextPrice,
        createdAt: nowIso,
      };
      setCoins((prev) => {
        const exists = prev.some((c) => c.id === coinId);
        return exists
          ? prev.map((c) => (c.id === coinId ? updatedCoin! : c))
          : [updatedCoin!, ...prev];
      });
      setTradesMap((prev) => ({
        ...prev,
        [coinId]: [trade!, ...(prev[coinId] || [])].slice(0, 60),
      }));
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Trade failed.');
    }

    if (!updatedCoin || !trade) return;

    const nextCash =
      side === 'buy'
        ? Math.max(0, Number((settings.sandboxBalanceUsd - amountUsd).toFixed(2)))
        : Number((settings.sandboxBalanceUsd + amountUsd).toFixed(2));
    setSettings((prev) => ({...prev, sandboxBalanceUsd: nextCash}));
    void fetch('/api/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sandboxBalanceUsd: nextCash}),
    }).catch(() => {});

    // Update user's holding locally & in Firestore
    const existingHolding = holdings.find((h) => h.coinId === coinId);
    const currentBal = existingHolding?.balance || 0;
    const nextBalance =
      side === 'buy'
        ? currentBal + trade.tokenAmount
        : Math.max(0, currentBal - trade.tokenAmount);

    const nextHolding: UserHolding = {
      uid: user?.uid || 'sandbox-trader',
      coinId,
      ticker: updatedCoin.ticker,
      balance: Number(nextBalance.toFixed(4)),
      avgBuyPriceUsd: updatedCoin.priceUsd,
      updatedAt: trade.createdAt,
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'holdings', coinId), nextHolding);
        await updateDoc(doc(db, 'users', user.uid, 'private', 'account'), {
          email: (user.email || 'user@klyro.app').slice(0, 160),
          proEnabled: Boolean(settings.proEnabled),
          sandboxBalanceUsd: nextCash,
          updatedAt: new Date().toISOString(),
        });
        const coinSnap = await getDoc(doc(db, 'coins', coinId));
        if (coinSnap.exists()) {
          await updateDoc(doc(db, 'coins', coinId), {
            priceUsd: updatedCoin.priceUsd,
            marketCapUsd: updatedCoin.marketCapUsd,
            volume24hUsd: updatedCoin.volume24hUsd,
            bondingProgress: updatedCoin.bondingProgress,
            holdersCount: updatedCoin.holdersCount,
            updatedAt: updatedCoin.updatedAt,
          });
          const tradeId = sanitizeId(trade.id);
          await setDoc(doc(db, 'coins', coinId, 'trades', tradeId), {
            ...trade,
            id: tradeId,
            traderUid: user.uid,
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `coins/${coinId}/trades`);
      }
    } else {
      setHoldings((prev) => {
        const filtered = prev.filter((h) => h.coinId !== coinId);
        return nextBalance > 0 ? [nextHolding, ...filtered] : filtered;
      });
    }

    pushNotification(
      `${side === 'buy' ? 'Bought' : 'Sold'} $${updatedCoin.ticker}`,
      `${formatUsd(amountUsd)} @ ${formatPriceUsd(updatedCoin.priceUsd)}`,
      updatedCoin.projectId
    );
  };

  const handleUpdateProject = async (
    id: string,
    updates: {name: string; tagline: string}
  ) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok && data.state) applyServerSnapshot(data.state);
      else if (res.status !== 404) throw new Error(data.error || 'Update failed.');
    } catch (err) {
      if (err instanceof Error && err.message !== 'Update failed.') {
        // fallback for Firestore-only project
      }
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? {...p, ...updates} : p))
    );

    if (user) {
      const projSnap = await getDoc(doc(db, 'projects', id));
      if (projSnap.exists() && projSnap.data().ownerUid === user.uid) {
        try {
          await updateDoc(doc(db, 'projects', id), {
            name: updates.name.slice(0, 60),
            tagline: updates.tagline.slice(0, 120),
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `projects/${id}`);
        }
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    const target = mergedProjects.find((p) => p.id === id);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.state) applyServerSnapshot(data.state);
    } catch {
      // fallback
    }

    setProjects((prev) => prev.filter((p) => p.id !== id));
    setFsProjects((prev) => prev.filter((p) => p.id !== id));

    if (user) {
      const projSnap = await getDoc(doc(db, 'projects', id));
      if (
        projSnap.exists() &&
        (projSnap.data().ownerUid === user.uid || user.uid === founderUid)
      ) {
        try {
          await deleteDoc(doc(db, 'projects', id));
          if (target?.coinId) {
            const coinSnap = await getDoc(doc(db, 'coins', target.coinId));
            if (
              coinSnap.exists() &&
              (coinSnap.data().ownerUid === user.uid || user.uid === founderUid)
            ) {
              await deleteDoc(doc(db, 'coins', target.coinId));
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
        }
      }
    }
  };

  const handlePublishRelease = async (
    projectId: string,
    version: string,
    note: string,
    officialPublished: boolean
  ) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/release`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({version, note, officialPublished}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyServerSnapshot(data.state);
      }
    } catch {
      // local + Firestore fallback
    }

    const updateEntry = {
      version: version.slice(0, 32),
      date: 'Live',
      note: note.slice(0, 240),
    };
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {...p, officialPublished, updates: [updateEntry, ...(p.updates || [])]}
          : p
      )
    );

    if (user) {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (
        projSnap.exists() &&
        (projSnap.data().ownerUid === user.uid || user.uid === founderUid)
      ) {
        try {
          await updateDoc(doc(db, 'projects', projectId), {
            officialPublished,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
        }
      }
    }

    pushNotification(
      `Release ${version} Published`,
      note,
      projectId
    );
  };

  const handleModerateProject = async (
    projectId: string,
    action: 'verify' | 'publish' | 'delete'
  ) => {
    if (action === 'delete') {
      await handleDeleteProject(projectId);
      return;
    }
    const target = mergedProjects.find((p) => p.id === projectId);
    if (!target) return;
    const nextVerified = action === 'verify' ? !target.verified : target.verified;
    const nextOfficial =
      action === 'publish' ? !Boolean(target.officialPublished) : Boolean(target.officialPublished);

    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? {...p, verified: nextVerified, officialPublished: nextOfficial} : p
      )
    );
    void fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({officialPublished: nextOfficial}),
    }).catch(() => {});

    if (user && user.uid === founderUid) {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (projSnap.exists()) {
        try {
          await updateDoc(doc(db, 'projects', projectId), {
            verified: nextVerified,
            officialPublished: nextOfficial,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
        }
      }
    }
  };

  const handleToggleEngage = async (id: string, action: 'save' | 'like') => {
    if (action === 'save') {
      const nextSaved = !savedIds[id];
      setSavedIds((prev) => ({...prev, [id]: nextSaved}));
      if (user) {
        try {
          if (nextSaved) {
            await setDoc(doc(db, 'users', user.uid, 'bookmarks', sanitizeId(id)), {
              uid: user.uid,
              projectId: sanitizeId(id),
              createdAt: new Date().toISOString(),
            });
          } else {
            await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', sanitizeId(id)));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/bookmarks/${id}`);
        }
      }
    } else {
      const nextLiked = !likedIds[id];
      setLikedIds((prev) => ({...prev, [id]: nextLiked}));
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? {...p, likes: Math.max(0, p.likes + (nextLiked ? 1 : -1))} : p
        )
      );
    }

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/engage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyServerSnapshot(data.state);
      }
    } catch {
      setSyncError('Saved locally. Sync will resume when server connection is available.');
    }
  };

  const handleToggleFollow = async (handle: string) => {
    setFollowingHandles((prev) => ({...prev, [handle]: !prev[handle]}));
    try {
      const res = await fetch('/api/creators/follow', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({handle}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyServerSnapshot(data.state);
      }
    } catch {
      // optimistic local persistence remains
    }
  };

  const handleAddComment = async (projectId: string, body: string) => {
    let commentId = sanitizeId(`c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    let createdAt = new Date().toISOString();

    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/comments`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        body,
        authorUid: user?.uid || 'guest',
        author: settings.displayName,
        handle: settings.creatorHandle,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.state) applyServerSnapshot(data.state);
      if (data.comment?.id) commentId = sanitizeId(data.comment.id);
      if (data.comment?.createdAt) createdAt = String(data.comment.createdAt);
    } else if (res.status === 404) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                comments: [
                  {
                    id: commentId,
                    projectId,
                    authorUid: user?.uid || 'guest',
                    author: settings.displayName,
                    handle: settings.creatorHandle,
                    timeAgo: 'Just now',
                    body,
                    createdAt,
                  },
                  ...p.comments,
                ],
              }
            : p
        )
      );
    } else {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to post comment.');
    }

    if (user) {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (projSnap.exists()) {
        try {
          await setDoc(doc(db, 'projects', projectId, 'comments', commentId), {
            id: commentId,
            projectId,
            authorUid: user.uid,
            authorName: settings.displayName.slice(0, 60),
            authorHandle: settings.creatorHandle.slice(0, 40),
            body: body.slice(0, 500),
            createdAt,
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `projects/${projectId}/comments/${commentId}`
          );
        }
      }
    }
  };

  const handleToggleCommunity = async (name: string) => {
    setJoinedCommunities((prev) => ({...prev, [name]: !prev[name]}));
    try {
      const res = await fetch('/api/communities/join', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyServerSnapshot(data.state);
      }
    } catch {
      // optimistic local persistence remains
    }
  };

  const handleToggleGuide = async (number: string) => {
    setCompletedGuides((prev) => ({...prev, [number]: !prev[number]}));
    try {
      const res = await fetch('/api/learn/toggle', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({number}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) applyServerSnapshot(data.state);
      }
    } catch {
      // optimistic local persistence remains
    }
  };

  const handleUpdateSettings = async (
    partial: Partial<StudioSettings>,
    propagateToProjects = false
  ) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(partial),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save settings.');
    if (data.state) applyServerSnapshot(data.state);

    setSettings((prev) => ({...prev, ...partial}));

    const nextDisplayName = (partial.displayName ?? settings.displayName).slice(0, 60);
    const rawHandle = partial.creatorHandle ?? settings.creatorHandle;
    const cleanHandle = (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`).slice(0, 40);

    if (propagateToProjects) {
      setProjects((prev) =>
        prev.map((p) =>
          (user && p.ownerUid === user.uid) || p.ownerUid === 'local-creator'
            ? {...p, creatorName: nextDisplayName, creatorHandle: cleanHandle}
            : p
        )
      );
      for (const p of mergedProjects) {
        if ((user && p.ownerUid === user.uid) || p.ownerUid === 'local-creator') {
          void fetch(`/api/projects/${encodeURIComponent(p.id)}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({creatorName: nextDisplayName, creatorHandle: cleanHandle}),
          }).catch(() => {});
        }
      }
    }

    if (user) {
      const nowIso = new Date().toISOString();
      try {
        if (
          partial.displayName !== undefined ||
          partial.creatorHandle !== undefined ||
          partial.bio !== undefined ||
          partial.photoURL !== undefined ||
          partial.profileRim !== undefined
        ) {
          await updateDoc(doc(db, 'users', user.uid), {
            displayName: nextDisplayName,
            handle: cleanHandle,
            bio: (partial.bio ?? settings.bio).slice(0, 240),
            photoURL: (partial.photoURL ?? settings.photoURL ?? user.photoURL ?? '').slice(0, 500),
            profileRim: partial.profileRim ?? settings.profileRim ?? 'silver',
            updatedAt: nowIso,
          });
          if (propagateToProjects) {
            for (const p of fsProjects) {
              if (p.ownerUid === user.uid) {
                await updateDoc(doc(db, 'projects', p.id), {
                  creatorName: nextDisplayName,
                  creatorHandle: cleanHandle,
                  updatedAt: nowIso,
                });
              }
            }
          }
        }
        if (partial.proEnabled !== undefined || partial.sandboxBalanceUsd !== undefined) {
          await updateDoc(doc(db, 'users', user.uid, 'private', 'account'), {
            email: (user.email || 'user@klyro.app').slice(0, 160),
            proEnabled: Boolean(partial.proEnabled ?? settings.proEnabled),
            sandboxBalanceUsd: Number(partial.sandboxBalanceUsd ?? settings.sandboxBalanceUsd),
            updatedAt: nowIso,
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  const selectedTrades = useMemo(() => {
    if (!selectedCoin) return [];
    const live = fsCoinTrades[selectedCoin.id] || [];
    const cachedTrades = tradesMap[selectedCoin.id] || [];
    const seen = new Set<string>();
    const combined: CoinTrade[] = [];
    for (const t of [...live, ...cachedTrades]) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        combined.push(t);
      }
    }
    return combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [selectedCoin, fsCoinTrades, tradesMap]);

  const terminalLiveTrades = useMemo(() => {
    if (!activeTerminalCoinId) return [];
    const live = fsCoinTrades[activeTerminalCoinId] || [];
    const cachedTrades = tradesMap[activeTerminalCoinId] || [];
    const seen = new Set<string>();
    const combined: CoinTrade[] = [];
    for (const t of [...live, ...cachedTrades]) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        combined.push(t);
      }
    }
    return combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activeTerminalCoinId, fsCoinTrades, tradesMap]);

  const handleTopUpCash = async (amountUsd: number) => {
    const nextCash = Number(((settings.sandboxBalanceUsd || 0) + amountUsd).toFixed(2));
    await handleUpdateSettings({sandboxBalanceUsd: nextCash});
  };

  const selectedHolding = useMemo(
    () => (selectedCoin ? holdings.find((h) => h.coinId === selectedCoin.id) || null : null),
    [selectedCoin, holdings]
  );

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const filteredCoins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedCoins
      .filter((c) => {
        const chainOk = tokenChainFilter === 'All' || c.network === tokenChainFilter;
        const queryOk =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          c.contractAddress.toLowerCase().includes(q);
        return chainOk && queryOk;
      })
      .sort((a, b) => {
        if (tokenSort === 'volume') return b.volume24hUsd - a.volume24hUsd;
        if (tokenSort === 'bonding') return b.bondingProgress - a.bondingProgress;
        if (tokenSort === 'price') return b.priceUsd - a.priceUsd;
        return b.marketCapUsd - a.marketCapUsd;
      });
  }, [mergedCoins, tokenChainFilter, searchQuery, tokenSort]);

  const periodFactor =
    leaderboardPeriod === 'Daily' ? 1 : leaderboardPeriod === 'Weekly' ? 3.4 : 11.2;

  const creatorLeaderboard = useMemo(() => {
    const byHandle = new Map<
      string,
      {name: string; handle: string; views: number; likes: number; projects: number}
    >();
    for (const p of mergedProjects) {
      const existing = byHandle.get(p.creatorHandle) || {
        name: p.creatorName,
        handle: p.creatorHandle,
        views: 0,
        likes: 0,
        projects: 0,
      };
      existing.views += p.views;
      existing.likes += p.likes;
      existing.projects += 1;
      byHandle.set(p.creatorHandle, existing);
    }
    return Array.from(byHandle.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);
  }, [mergedProjects]);

  const avatarSrc = settings.photoURL || user?.photoURL || '';
  const isCurrentUserFounder = Boolean(
    (user && founderUid && user.uid === founderUid) || settings.badges?.includes('Founder')
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9FB] text-[#09090B]">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('discover');
            }}
            className="flex items-center gap-2.5 text-[18px] font-semibold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-sm"
          >
            <KlyroMiniMark className="w-6 h-6" />
            <span>Klyro</span>
          </a>

          {/* Zone 2: 5 Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-[14px] font-medium"
          >
            {(
              [
                {id: 'discover', label: 'Discover'},
                {id: 'launch', label: 'Launch'},
                {id: 'studio', label: 'Studio'},
                {id: 'community', label: 'Community'},
                {id: 'learn', label: 'Learn'},
              ] as const
            ).map((item) => {
              const active = route === item.id && !selectedProject;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 border-b-[1.5px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-sm ${
                    active
                      ? 'text-zinc-950 border-zinc-950 font-semibold'
                      : 'text-zinc-500 border-transparent hover:text-zinc-950'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Notifications, Profile / Wallet & Primary CTA */}
          <div className="shrink-0 flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              aria-label="Notifications"
              className="relative h-9 w-9 rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-950 text-white text-[9px] font-mono font-semibold flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 rounded-2xl bg-white border border-zinc-200 shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-zinc-950">Notifications</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifications((prev) => prev.map((n) => ({...n, read: true})))
                    }
                    className="text-[11px] font-medium text-zinc-500 hover:text-zinc-950 cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? {...x, read: true} : x))
                        );
                        setNotifOpen(false);
                        if (n.projectId) {
                          const target = mergedProjects.find((p) => p.id === n.projectId);
                          if (target) openProject(target);
                        }
                      }}
                      className={`w-full p-3.5 text-left hover:bg-zinc-50 transition-colors cursor-pointer ${
                        n.read ? 'opacity-70' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-zinc-950">{n.title}</span>
                        <span className="text-[10px] text-zinc-400">{n.timeAgo}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigateTo('profile')}
              className="h-9 pl-1.5 pr-3 rounded-full border border-zinc-200 bg-white text-zinc-900 text-[12px] font-medium hover:border-zinc-400 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AvatarWithRim
                src={avatarSrc}
                name={settings.displayName}
                rim={settings.profileRim}
                size="xs"
                isFounder={isCurrentUserFounder}
                showFounderBadge
              />
              <span className="hidden sm:inline max-w-[100px] truncate font-mono">
                {user ? settings.creatorHandle : 'Profile'}
              </span>
              {isCurrentUserFounder && (
                <span className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded-full bg-zinc-950 text-white text-[9px] font-mono font-semibold uppercase tracking-wide">
                  Founder
                </span>
              )}
              {wallets.length > 0 && (
                <span className="text-[11px] font-mono text-zinc-500">· {wallets.length}W</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              aria-label="Account and Wallets"
              className="h-9 px-3 rounded-full border border-zinc-200 bg-white text-zinc-800 text-[12px] font-medium hover:border-zinc-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 text-zinc-700" />
              <span className="hidden lg:inline">{user ? 'Wallets' : 'Sign in'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('launch')}
              className="h-9 px-4 rounded-full bg-zinc-950 text-white text-[13px] font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Compact Nav Row */}
        <div className="md:hidden border-t border-zinc-100 px-4 py-2 flex items-center gap-5 overflow-x-auto text-[13px] font-medium">
          {(
            [
              {id: 'discover', label: 'Discover'},
              {id: 'launch', label: 'Launch'},
              {id: 'studio', label: 'Studio'},
              {id: 'community', label: 'Community'},
              {id: 'learn', label: 'Learn'},
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                route === item.id && !selectedProject
                  ? 'text-zinc-950 font-semibold'
                  : 'text-zinc-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {syncError && (
        <div className="bg-zinc-900 text-white text-[12px] text-center py-2 px-4">
          {syncError}
        </div>
      )}

      {/* Main Content Router */}
      <main className="flex-1">
        {selectedProjectId && !selectedProject ? (
          <section className="max-w-[680px] mx-auto px-6 py-20 text-center space-y-4">
            <h1 className="text-[24px] font-semibold text-zinc-950">Project not found</h1>
            <p className="text-[14px] text-zinc-500">
              This project may have been removed or the link is no longer active.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('discover')}
              className="h-10 px-5 rounded-full bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
            >
              Return to Discover
            </button>
          </section>
        ) : selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            coin={selectedCoin}
            trades={selectedTrades}
            holding={selectedHolding}
            user={user}
            wallets={wallets}
            founderUid={founderUid}
            currentUserBadges={settings.badges}
            sandboxBalanceUsd={settings.sandboxBalanceUsd}
            initialTab={projectInitialTab}
            isSaved={Boolean(savedIds[selectedProject.id])}
            isFollowing={Boolean(followingHandles[selectedProject.creatorHandle])}
            isLiked={Boolean(likedIds[selectedProject.id])}
            onToggleSave={(id) => void handleToggleEngage(id, 'save')}
            onToggleFollow={(handle) => void handleToggleFollow(handle)}
            onToggleLike={(id) => void handleToggleEngage(id, 'like')}
            onAddComment={handleAddComment}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onLaunchCoin={handleLaunchCoin}
            onTradeCoin={handleTradeCoin}
            onPublishRelease={handlePublishRelease}
            onOpenAccountModal={() => setAccountModalOpen(true)}
            onOpenProfile={() => navigateTo('profile')}
            onOpenTerminal={openTerminal}
            creatorRim={
              selectedProject.ownerUid === user?.uid
                ? settings.profileRim
                : selectedProject.ownerUid && founderUid && selectedProject.ownerUid === founderUid
                  ? 'founder-crown'
                  : 'silver'
            }
            onBack={() => navigateTo('discover')}
          />
        ) : route === 'launch' ? (
          <LaunchWizardView
            initialTemplate={pendingTemplate}
            user={user}
            wallets={wallets}
            defaultCreatorName={settings.displayName}
            defaultCreatorHandle={settings.creatorHandle}
            onGoogleSignIn={handleGoogleSignInAction}
            onOpenAccountModal={() => setAccountModalOpen(true)}
            onPublish={handlePublishProject}
          />
        ) : route === 'studio' ? (
          <StudioDashboardView
            projects={mergedProjects}
            coins={mergedCoins}
            tradesMap={tradesMap}
            liveTradesForSelected={terminalLiveTrades}
            terminalCoinId={activeTerminalCoinId}
            onSelectTerminalCoinId={setTerminalCoinId}
            user={user}
            wallets={wallets}
            holdings={holdings}
            savedCount={savedCount}
            followingCount={followingCount}
            settings={settings}
            isFounder={isCurrentUserFounder}
            onCreateNew={(tpl) => navigateTo('launch', tpl)}
            onSelectProject={openProject}
            onAddFile={handleAddFile}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onUpdateSettings={handleUpdateSettings}
            onTradeCoin={handleTradeCoin}
            onTopUpCash={handleTopUpCash}
            onOpenAccountModal={() => setAccountModalOpen(true)}
            onOpenProfile={() => navigateTo('profile')}
          />
        ) : route === 'terminal' ? (
          <section className="max-w-[1240px] mx-auto px-6 py-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight text-zinc-950 flex items-center gap-2.5">
                  <TrendingUp className="w-6 h-6" />
                  <span>Klyro Trading Terminal</span>
                </h1>
                <p className="text-[13px] text-zinc-500 mt-0.5">
                  Live multi-chain orderbook, bonding curves, limit orders, and sandbox execution across 12 networks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('discover')}
                  className="h-9 px-4 rounded-full border border-zinc-200 bg-white text-[12px] font-medium text-zinc-700 hover:border-zinc-900 cursor-pointer"
                >
                  Back to Discover
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('launch')}
                  className="h-9 px-4 rounded-full bg-zinc-950 text-white text-[12px] font-semibold hover:bg-zinc-800 cursor-pointer"
                >
                  Launch Coin
                </button>
              </div>
            </div>

            <TradingTerminalView
              coins={mergedCoins}
              projects={mergedProjects}
              tradesMap={tradesMap}
              liveTradesForSelected={terminalLiveTrades}
              selectedCoinId={activeTerminalCoinId}
              onSelectCoinId={setTerminalCoinId}
              wallets={wallets}
              holdings={holdings}
              settings={settings}
              onTradeCoin={handleTradeCoin}
              onTopUpCash={handleTopUpCash}
              onOpenProject={openProject}
              onOpenWallets={() => setAccountModalOpen(true)}
            />
          </section>
        ) : route === 'profile' ? (
          <ProfileView
            user={user}
            userEmail={userEmail}
            isFounder={isCurrentUserFounder}
            settings={settings}
            projects={mergedProjects}
            coins={mergedCoins}
            wallets={wallets}
            holdings={holdings}
            savedIds={savedIds}
            followingHandles={followingHandles}
            onGoogleSignIn={handleGoogleSignInAction}
            onSignOut={handleSignOutAction}
            onUpdateProfile={handleUpdateSettings}
            onLinkWallet={handleLinkWallet}
            onSetPrimaryWallet={handleSetPrimaryWallet}
            onUnlinkWallet={handleUnlinkWallet}
            onSelectProject={openProject}
            onToggleSave={(id) => void handleToggleEngage(id, 'save')}
            onToggleFollow={(handle) => void handleToggleFollow(handle)}
            onModerateProject={handleModerateProject}
            onOpenTerminal={openTerminal}
            onCreateNew={() => navigateTo('launch')}
          />
        ) : route === 'community' ? (
          <CommunityView
            joinedCommunities={joinedCommunities}
            onToggleJoin={(name) => void handleToggleCommunity(name)}
            onExploreProjects={handleExploreProjects}
          />
        ) : route === 'learn' ? (
          <LearnView
            completedGuides={completedGuides}
            onToggleComplete={(num) => void handleToggleGuide(num)}
            onStartLaunch={() => navigateTo('launch')}
          />
        ) : (
          /* HOMEPAGE: Pearl-Silver Hero + 4-Column Stat Strip + Discover Showcase */
          <>
            {/* Signature Hero Section */}
            <section className="pearl-hero-bg border-b border-zinc-200/80">
              <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-10 md:pt-16 md:pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  {/* Left Typographic Proposition */}
                  <div className="lg:col-span-6 space-y-6">
                    <h1
                      className="text-[44px] sm:text-[56px] lg:text-[64px] font-semibold tracking-[-0.035em] leading-[1.03] text-zinc-950"
                      style={{textWrap: 'balance'}}
                    >
                      Everything starts with an{' '}
                      <span className="silver-headline-accent">idea.</span>
                    </h1>

                    <p className="text-[17px] leading-[1.55] text-zinc-600 max-w-[440px]">
                      Discover projects. Build your presence. Launch your next creation.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleExploreProjects}
                        className="h-11 px-6 rounded-full bg-zinc-950 text-white text-[14px] font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        <span>Explore Projects</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateTo('launch')}
                        className="h-11 px-6 rounded-full bg-white text-zinc-900 border border-zinc-200 text-[14px] font-medium hover:border-zinc-400 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Create a Project
                      </button>
                    </div>
                  </div>

                  {/* Right Sculptural Glossy Silver Orbital K */}
                  <div className="lg:col-span-6 flex items-center justify-center">
                    <KlyroHeroSculpture className="w-full max-w-[500px] h-[300px] sm:h-[360px]" />
                  </div>
                </div>

                {/* 4-Column Proof Strip */}
                <div className="mt-12 pt-8 border-t border-zinc-200/90 grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="flex items-center gap-3.5">
                    <Sparkles className="w-5 h-5 text-zinc-700 stroke-[1.6] shrink-0" />
                    <div>
                      <div className="text-[20px] font-semibold tracking-tight tabular-nums text-zinc-950">
                        1M+
                      </div>
                      <div className="text-[13px] text-zinc-500">Projects</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 lg:border-l lg:border-zinc-200 lg:pl-6">
                    <Users className="w-5 h-5 text-zinc-700 stroke-[1.6] shrink-0" />
                    <div>
                      <div className="text-[20px] font-semibold tracking-tight tabular-nums text-zinc-950">
                        500K+
                      </div>
                      <div className="text-[13px] text-zinc-500">Creators</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 lg:border-l lg:border-zinc-200 lg:pl-6">
                    <Globe className="w-5 h-5 text-zinc-700 stroke-[1.6] shrink-0" />
                    <div>
                      <div className="text-[20px] font-semibold tracking-tight tabular-nums text-zinc-950">
                        100+
                      </div>
                      <div className="text-[13px] text-zinc-500">Communities</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 lg:border-l lg:border-zinc-200 lg:pl-6">
                    <Zap className="w-5 h-5 text-zinc-700 stroke-[1.6] shrink-0" />
                    <div>
                      <div className="text-[16px] font-semibold tracking-tight text-zinc-950">
                        Fast &amp; Secure
                      </div>
                      <div className="text-[13px] text-zinc-500">Built for scale</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Discover Section */}
            <section
              ref={discoverSectionRef}
              className="max-w-[1200px] mx-auto px-6 py-14 space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-[34px] font-semibold tracking-tight text-zinc-950">
                      Discover
                    </h2>
                    <p className="text-[15px] text-zinc-500 mt-1">
                      Explore trending projects, launched tokens, and creator leaderboards.
                    </p>
                  </div>

                  <div className="inline-flex items-center p-1 rounded-full border border-zinc-200 bg-white overflow-x-auto max-w-full">
                    {(
                      [
                        {id: 'projects', label: 'Projects'},
                        {id: 'tokens', label: `Token Explorer (${mergedCoins.length})`},
                        {id: 'terminal', label: 'Trading Terminal'},
                        {id: 'leaderboards', label: 'Leaderboards'},
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDiscoverTab(t.id)}
                        className={`h-8 px-3.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          discoverTab === t.id
                            ? 'bg-zinc-950 text-white font-semibold'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search, Sort & View Mode Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, $ticker, CA..."
                      aria-label="Search projects"
                      className="h-10 pl-9 pr-4 w-56 rounded-full border border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                    />
                  </div>

                  {discoverTab === 'projects' && (
                    <>
                      <select
                        aria-label="Sort projects"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'trending' | 'views' | 'likes')}
                        className="h-10 px-4 rounded-full border border-zinc-200 bg-white text-[13px] font-medium text-zinc-800 focus:outline-none focus:border-zinc-900 cursor-pointer"
                      >
                        <option value="trending">Trending</option>
                        <option value="views">Most Viewed</option>
                        <option value="likes">Most Liked</option>
                      </select>

                      <div className="flex items-center p-1 rounded-full border border-zinc-200 bg-white">
                        <button
                          type="button"
                          onClick={() => setViewMode('grid')}
                          aria-label="Grid view"
                          className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            viewMode === 'grid'
                              ? 'bg-zinc-950 text-white'
                              : 'text-zinc-500 hover:text-zinc-950'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          aria-label="Table view"
                          className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            viewMode === 'table'
                              ? 'bg-zinc-950 text-white'
                              : 'text-zinc-500 hover:text-zinc-950'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {discoverTab === 'tokens' ? (
                /* Token Explorer Table */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {(['All', ...SUPPORTED_CHAINS] as const).map((chain) => (
                        <button
                          key={chain}
                          type="button"
                          onClick={() => setTokenChainFilter(chain)}
                          className={`h-8 px-3.5 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                            tokenChainFilter === chain
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                          }`}
                        >
                          {chain}
                        </button>
                      ))}
                    </div>

                    <select
                      aria-label="Sort tokens"
                      value={tokenSort}
                      onChange={(e) =>
                        setTokenSort(e.target.value as 'mc' | 'volume' | 'bonding' | 'price')
                      }
                      className="h-9 px-3.5 rounded-full border border-zinc-200 bg-white text-[12px] font-medium text-zinc-800 cursor-pointer"
                    >
                      <option value="mc">Market Cap</option>
                      <option value="volume">24h Volume</option>
                      <option value="bonding">Bonding Progress</option>
                      <option value="price">Price</option>
                    </select>
                  </div>

                  {filteredCoins.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center space-y-2">
                      <Coins className="w-6 h-6 text-zinc-400 mx-auto" />
                      <div className="text-[15px] font-semibold text-zinc-900">
                        No matching tokens
                      </div>
                      <p className="text-[13px] text-zinc-500">
                        Try switching chains or clearing your search query.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white border border-zinc-200/90 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 text-[12px] font-medium text-zinc-500">
                            <th className="py-3.5 px-5">Token</th>
                            <th className="py-3.5 px-4">Network</th>
                            <th className="py-3.5 px-4 text-right">Price</th>
                            <th className="py-3.5 px-4 text-right">Market Cap</th>
                            <th className="py-3.5 px-4 text-right">24h Volume</th>
                            <th className="py-3.5 px-4 text-right">Curve</th>
                            <th className="py-3.5 px-5 text-right">Trade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-[13px]">
                          {filteredCoins.map((c) => {
                            const proj = mergedProjects.find(
                              (p) => p.id === c.projectId || p.coinId === c.id
                            );
                            return (
                              <tr
                                key={c.id}
                                onClick={() => (proj ? openProject(proj, 'coin') : openTerminal(c.id))}
                                className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                              >
                                <td className="py-3.5 px-5">
                                  <div className="font-semibold text-zinc-950">
                                    ${c.ticker}{' '}
                                    <span className="font-normal text-zinc-500">· {c.name}</span>
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-400">
                                    CA: {shortenAddress(c.contractAddress)}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-[12px] text-zinc-700">
                                  {c.network}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-900">
                                  {formatPriceUsd(c.priceUsd)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-900">
                                  {formatUsd(c.marketCapUsd)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-600">
                                  {formatUsd(c.volume24hUsd)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-900">
                                  {c.bondingProgress.toFixed(1)}%
                                </td>
                                <td
                                  className="py-3.5 px-5 text-right"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => openTerminal(c.id)}
                                    className="h-7 px-3 rounded-full bg-zinc-950 text-white text-[11px] font-semibold hover:bg-zinc-800 cursor-pointer"
                                  >
                                    Trade
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : discoverTab === 'terminal' ? (
                <TradingTerminalView
                  coins={mergedCoins}
                  projects={mergedProjects}
                  tradesMap={tradesMap}
                  liveTradesForSelected={terminalLiveTrades}
                  selectedCoinId={activeTerminalCoinId}
                  onSelectCoinId={setTerminalCoinId}
                  wallets={wallets}
                  holdings={holdings}
                  settings={settings}
                  onTradeCoin={handleTradeCoin}
                  onTopUpCash={handleTopUpCash}
                  onOpenProject={openProject}
                  onOpenWallets={() => setAccountModalOpen(true)}
                />
              ) : discoverTab === 'leaderboards' ? (
                /* Leaderboards Section */
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    {(['Daily', 'Weekly', 'Monthly'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setLeaderboardPeriod(period)}
                        className={`h-8 px-4 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
                          leaderboardPeriod === period
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Top Projects */}
                    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-zinc-950 flex items-center gap-2">
                          <Award className="w-4 h-4 text-zinc-700" />
                          Top Projects
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">{leaderboardPeriod}</span>
                      </div>
                      <div className="divide-y divide-zinc-100">
                        {[...mergedProjects]
                          .sort((a, b) => b.views - a.views)
                          .slice(0, 6)
                          .map((p, idx) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => openProject(p)}
                              className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[12px] font-mono text-zinc-400 w-4">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-zinc-950 truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[11px] text-zinc-500">{p.creatorHandle}</div>
                                </div>
                              </div>
                              <span className="text-[12px] font-mono tabular-nums text-zinc-700 shrink-0">
                                {formatCompactCount(Math.round(p.views * periodFactor))} views
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Top Coins */}
                    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-zinc-950 flex items-center gap-2">
                          <Coins className="w-4 h-4 text-zinc-700" />
                          Top Coins
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">{leaderboardPeriod}</span>
                      </div>
                      <div className="divide-y divide-zinc-100">
                        {[...mergedCoins]
                          .sort((a, b) => b.marketCapUsd - a.marketCapUsd)
                          .slice(0, 6)
                          .map((c, idx) => {
                            const proj = mergedProjects.find(
                              (p) => p.id === c.projectId || p.coinId === c.id
                            );
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => proj && openProject(proj, 'coin')}
                                className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-[12px] font-mono text-zinc-400 w-4">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-mono font-semibold text-zinc-950 truncate">
                                      ${c.ticker}
                                    </div>
                                    <div className="text-[11px] text-zinc-500">{c.network}</div>
                                  </div>
                                </div>
                                <span className="text-[12px] font-mono tabular-nums text-zinc-700 shrink-0">
                                  {formatUsd(c.marketCapUsd)}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Top Creators */}
                    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-zinc-950 flex items-center gap-2">
                          <Users className="w-4 h-4 text-zinc-700" />
                          Top Creators
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">{leaderboardPeriod}</span>
                      </div>
                      <div className="divide-y divide-zinc-100">
                        {creatorLeaderboard.map((cr, idx) => (
                          <button
                            key={cr.handle}
                            type="button"
                            onClick={() => {
                              setSearchQuery(cr.handle);
                              setDiscoverTab('projects');
                            }}
                            className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-[12px] font-mono text-zinc-400 w-4">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-zinc-950 truncate">
                                  {cr.name}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500">
                                  {cr.handle}
                                </div>
                              </div>
                            </div>
                            <span className="text-[12px] font-mono tabular-nums text-zinc-700 shrink-0">
                              {formatCompactCount(Math.round(cr.views * periodFactor))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              {/* Category Filter Tabs + Saved Filter */}
              <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
                <div className="flex items-center gap-2">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`h-9 px-4 rounded-full text-[13px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setSavedOnly((v) => !v)}
                  className={`h-9 px-4 rounded-full text-[13px] font-medium border transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                    savedOnly
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Saved ({savedCount})</span>
                </button>
              </div>

              {/* Project Showcase Grid or Table */}
              {filteredProjects.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center space-y-3">
                  <div className="text-[16px] font-semibold text-zinc-900">
                    No matching projects
                  </div>
                  <p className="text-[13px] text-zinc-500">
                    {savedOnly
                      ? 'You have not saved any projects matching these filters yet.'
                      : 'Try clearing your search or switching back to all categories.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('All');
                      setSearchQuery('');
                      setSavedOnly(false);
                    }}
                    className="h-9 px-4 rounded-full bg-zinc-950 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map((project) => {
                    const isSaved = Boolean(savedIds[project.id]);
                    const isLiked = Boolean(likedIds[project.id]);
                    return (
                      <article
                        key={project.id}
                        onClick={() => openProject(project)}
                        className="group rounded-2xl bg-white border border-zinc-200/90 p-3.5 hover:border-zinc-400 transition-all cursor-pointer flex flex-col justify-between shadow-[0_6px_24px_-16px_rgba(0,0,0,0.08)]"
                      >
                        <div>
                          <div className="aspect-[16/10] rounded-xl overflow-hidden border border-zinc-200/70">
                            <ProjectArtwork
                              variant={project.artwork}
                              customCoverUrl={project.customCoverUrl}
                              alt={project.name}
                            />
                          </div>

                          <div className="pt-4 px-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h3 className="text-[16px] font-semibold tracking-tight text-zinc-950 truncate">
                                  {project.name}
                                </h3>
                                {project.verified && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                                )}
                                {project.ownerUid && founderUid && project.ownerUid === founderUid && (
                                  <RoleBadges badges={['Founder']} compact />
                                )}
                              </div>
                              {project.coinTicker ? (
                                <span className="text-[11px] font-mono font-semibold text-zinc-600 shrink-0">
                                  ${project.coinTicker}
                                </span>
                              ) : (
                                isSaved && (
                                  <Bookmark className="w-3.5 h-3.5 fill-zinc-900 text-zinc-900 shrink-0" />
                                )
                              )}
                            </div>
                            <p className="text-[13px] text-zinc-500 mt-0.5 truncate">
                              {project.tagline}
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 mt-4 px-1 border-t border-zinc-100 flex items-center justify-between">
                          <div className="flex items-center gap-3.5 text-[12px] font-mono tabular-nums text-zinc-500">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              {formatCompactCount(project.views)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  isLiked ? 'fill-zinc-900 text-zinc-900' : ''
                                }`}
                              />
                              {formatCompactCount(project.likes)}
                            </span>
                          </div>

                          <span className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-950 group-hover:text-white group-hover:border-zinc-950 transition-colors">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* Clean Table View */
                <div className="rounded-2xl bg-white border border-zinc-200/90 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-[12px] font-medium text-zinc-500">
                        <th className="py-3.5 px-5">Project</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Creator</th>
                        <th className="py-3.5 px-4 text-right">Views</th>
                        <th className="py-3.5 px-5 text-right">Likes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-[13px]">
                      {filteredProjects.map((project) => (
                        <tr
                          key={project.id}
                          onClick={() => openProject(project)}
                          className="hover:bg-zinc-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-8 rounded-lg overflow-hidden border border-zinc-200 shrink-0">
                                <ProjectArtwork
                                  variant={project.artwork}
                                  customCoverUrl={project.customCoverUrl}
                                />
                              </div>
                              <div>
                                <div className="font-semibold text-zinc-950 flex items-center gap-1.5">
                                  <span>{project.name}</span>
                                  {project.verified && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-900" />
                                  )}
                                  {project.coinTicker && (
                                    <span className="text-[11px] font-mono text-zinc-500">
                                      ${project.coinTicker}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-zinc-500">{project.tagline}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-600">{project.category}</td>
                          <td className="py-3.5 px-4 text-zinc-500 font-mono text-[12px]">
                            {project.creatorHandle}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-800">
                            {formatCompactCount(project.views)}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono tabular-nums text-zinc-800">
                            {formatCompactCount(project.likes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {/* Account, Google Auth & Linked Wallets Modal */}
      <AccountWalletModal
        open={accountModalOpen}
        user={user}
        userEmail={userEmail}
        settings={settings}
        wallets={wallets}
        holdings={holdings}
        coins={mergedCoins}
        onClose={() => setAccountModalOpen(false)}
        onOpenProfile={() => navigateTo('profile')}
        onOpenTerminal={openTerminal}
        onGoogleSignIn={handleGoogleSignInAction}
        onSignOut={handleSignOutAction}
        onUpdateProfile={handleUpdateSettings}
        onLinkWallet={handleLinkWallet}
        onSetPrimaryWallet={handleSetPrimaryWallet}
        onUnlinkWallet={handleUnlinkWallet}
      />

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-zinc-200/80 mt-8">
        <div className="max-w-[1280px] mx-auto px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[16px] font-semibold text-zinc-950">
              <KlyroMiniMark className="w-5 h-5" />
              <span>Klyro</span>
            </div>
            <span aria-hidden="true" className="h-4 w-[1px] bg-zinc-300" />
            <span className="text-[13px] text-zinc-500">Discover · Build · Share</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[12px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-zinc-600" />
              Fast
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-600" />
              Secure
            </span>
            <button
              type="button"
              onClick={() => navigateTo('community')}
              className="inline-flex items-center gap-1.5 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-zinc-600" />
              Community
            </button>
            <button
              type="button"
              onClick={() => navigateTo('learn')}
              className="inline-flex items-center gap-1.5 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
              Learn
            </button>
            <button
              type="button"
              onClick={() => navigateTo('launch')}
              className="inline-flex items-center gap-1.5 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
              Innovate
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
