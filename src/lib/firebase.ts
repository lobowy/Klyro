import {initializeApp} from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {ProfileRimId, VALID_PROFILE_RIM_IDS, createSandboxWalletAddress} from './wallets';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firestoreDatabaseId explicitly per provisioning config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({prompt: 'select_account'});

export type RoleBadge = 'Owner' | 'Founder' | 'Moderator' | 'Developer' | 'Verified';

export const FOUNDER_BADGES: RoleBadge[] = ['Founder', 'Owner', 'Moderator', 'Developer'];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

void testConnection();

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export interface EnsuredAccountProfile {
  uid: string;
  displayName: string;
  handle: string;
  photoURL: string;
  profileRim: ProfileRimId;
  theme?: 'light' | 'dark';
  bio: string;
  badges: RoleBadge[];
  isFounder: boolean;
  email: string;
  proEnabled: boolean;
  sandboxBalanceUsd: number;
  createdAt: string;
}

export async function ensureUserHasStarterWallets(user: User): Promise<boolean> {
  try {
    const walletsCol = collection(db, 'users', user.uid, 'wallets');
    const existingSnap = await getDocs(walletsCol);
    if (!existingSnap.empty) return false;

    const nowIso = new Date().toISOString();
    const solId = 'wal-solana-primary';
    const baseId = 'wal-base-primary';

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', user.uid, 'wallets', solId), {
      id: solId,
      uid: user.uid,
      chain: 'Solana',
      provider: 'Sandbox',
      address: createSandboxWalletAddress('Solana'),
      label: 'Primary Solana Wallet',
      isPrimary: true,
      verified: true,
      linkedAt: nowIso,
    });
    batch.set(doc(db, 'users', user.uid, 'wallets', baseId), {
      id: baseId,
      uid: user.uid,
      chain: 'Base',
      provider: 'Sandbox',
      address: createSandboxWalletAddress('Base'),
      label: 'Primary Base EVM Wallet',
      isPrimary: false,
      verified: true,
      linkedAt: nowIso,
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/wallets`);
  }
}

export async function ensureUserAccountDocs(user: User): Promise<EnsuredAccountProfile> {
  const nowIso = new Date().toISOString();
  const bootRef = doc(db, 'meta', 'siteConfig');
  const profileRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'account');

  const rawHandleBase = (user.email?.split('@')[0] || user.displayName || 'creator')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 24);
  const defaultHandle = `@${rawHandleBase || 'klyro_user'}`;
  const defaultName = (user.displayName || 'Klyro Creator').slice(0, 60);
  const email = (user.email || 'user@klyro.app').slice(0, 160);

  let founderUid: string | null = null;
  let claimedJustNow = false;

  try {
    const bootSnap = await getDoc(bootRef);
    if (bootSnap.exists()) {
      founderUid = String(bootSnap.data().founderUid || '');
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'meta/siteConfig');
  }

  let profileSnap;
  try {
    profileSnap = await getDoc(profileRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
  }

  let profileData = {
    uid: user.uid,
    displayName: defaultName,
    handle: defaultHandle,
    photoURL: (user.photoURL || '').slice(0, 500),
    profileRim: 'silver' as ProfileRimId,
    theme: 'light' as 'light' | 'dark',
    bio: 'Building and launching on Klyro.',
    badges: [] as RoleBadge[],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (!founderUid && !profileSnap.exists()) {
    // Atomic first-signup claim: create /meta/siteConfig and /users/{uid} with Founder/Owner/Moderator/Developer badges
    try {
      const batch = writeBatch(db);
      batch.set(bootRef, {
        founderUid: user.uid,
        founderHandle: defaultHandle,
        claimedAt: nowIso,
      });
      profileData = {
        ...profileData,
        profileRim: 'founder-crown',
        badges: [...FOUNDER_BADGES],
      };
      batch.set(profileRef, profileData);
      await batch.commit();
      founderUid = user.uid;
      claimedJustNow = true;
    } catch {
      const recheck = await getDoc(bootRef);
      founderUid = recheck.exists() ? String(recheck.data().founderUid || '') : null;
    }
  } else if (!founderUid && profileSnap.exists()) {
    try {
      await setDoc(bootRef, {
        founderUid: user.uid,
        founderHandle: String(profileSnap.data().handle || defaultHandle),
        claimedAt: nowIso,
      });
      founderUid = user.uid;
      claimedJustNow = true;
    } catch {
      const recheck = await getDoc(bootRef);
      founderUid = recheck.exists() ? String(recheck.data().founderUid || '') : null;
    }
  }

  const isFounderUser = founderUid === user.uid;

  if (!claimedJustNow) {
    try {
      if (!profileSnap.exists()) {
        const nextRim: ProfileRimId = isFounderUser ? 'founder-crown' : 'silver';
        profileData = {
          ...profileData,
          profileRim: nextRim,
          badges: isFounderUser ? [...FOUNDER_BADGES] : [],
        };
        await setDoc(profileRef, profileData);
      } else {
        const existing = profileSnap.data();
        const existingBadges = Array.isArray(existing.badges)
          ? (existing.badges as RoleBadge[])
          : [];
        const finalBadges: RoleBadge[] = isFounderUser
          ? Array.from(new Set([...FOUNDER_BADGES, ...existingBadges]))
          : existingBadges;
        const storedRim = existing.profileRim as ProfileRimId | undefined;
        const validRim: ProfileRimId =
          storedRim && VALID_PROFILE_RIM_IDS.includes(storedRim)
            ? storedRim
            : isFounderUser
              ? 'founder-crown'
              : 'silver';

        profileData = {
          uid: user.uid,
          displayName: String(existing.displayName || defaultName),
          handle: String(existing.handle || defaultHandle),
          photoURL: String(existing.photoURL || user.photoURL || ''),
          profileRim: validRim,
          theme: existing.theme === 'dark' ? 'dark' : 'light',
          bio: String(existing.bio || ''),
          badges: finalBadges,
          createdAt: String(existing.createdAt || nowIso),
          updatedAt: String(existing.updatedAt || nowIso),
        };

        if (isFounderUser && FOUNDER_BADGES.some((b) => !existingBadges.includes(b))) {
          await updateDoc(profileRef, {
            badges: finalBadges,
            updatedAt: nowIso,
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  }

  let proEnabled = isFounderUser;
  let sandboxBalanceUsd = 5000;
  try {
    const privSnap = await getDoc(privateRef);
    if (!privSnap.exists()) {
      await setDoc(privateRef, {
        uid: user.uid,
        email,
        proEnabled: isFounderUser,
        sandboxBalanceUsd: 5000,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } else {
      proEnabled = Boolean(privSnap.data().proEnabled);
      if (typeof privSnap.data().sandboxBalanceUsd === 'number') {
        sandboxBalanceUsd = privSnap.data().sandboxBalanceUsd;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/private/account`);
  }

  return {
    uid: user.uid,
    displayName: profileData.displayName,
    handle: profileData.handle,
    photoURL: profileData.photoURL,
    profileRim: profileData.profileRim,
    theme: profileData.theme,
    bio: profileData.bio,
    badges: profileData.badges,
    isFounder: isFounderUser,
    email,
    proEnabled,
    sandboxBalanceUsd,
    createdAt: profileData.createdAt,
  };
}
