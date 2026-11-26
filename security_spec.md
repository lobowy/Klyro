# Klyro Firestore Security Specification

## 1. Data Invariants
1. Every private PII record (`/users/{uid}/private/account`), linked wallet (`/users/{uid}/wallets/{walletId}`), token holding (`/users/{uid}/holdings/{coinId}`), and bookmark (`/users/{uid}/bookmarks/{projectId}`) is strictly owned by `request.auth.uid == uid`.
2. The singleton `/meta/siteConfig` document can only be created once (by the first verified user to sign up) with `founderUid == request.auth.uid`; it is immutable and cannot be updated or deleted thereafter.
3. Role badges (`Owner`, `Founder`, `Moderator`, `Developer`) in `/users/{uid}` cannot be self-assigned by subsequent users; they can only be claimed atomically alongside `/meta/siteConfig` creation or managed by the verified Founder.
4. A project (`/projects/{projectId}`) can only be created by a verified signed-in user with `ownerUid == request.auth.uid`, and only the owner (or verified Founder for moderation) can edit or delete it.
5. A project file (`/projects/{projectId}/files/{fileId}`) cannot exist without an existing parent project owned by `request.auth.uid`.
6. A project comment (`/projects/{projectId}/comments/{commentId}`) cannot exist without an existing parent project, and `authorUid` must match `request.auth.uid`.
7. A coin (`/coins/{coinId}`) can only be created by the verified owner of the referenced parent project (`/projects/{projectId}`).
8. A coin trade (`/coins/{coinId}/trades/{tradeId}`) requires an existing parent coin and `traderUid == request.auth.uid`.
9. All strings, arrays, and IDs are strictly size-bounded and regex-guarded; unexpected shadow fields are rejected via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.

## 2. Adversarial Payloads Tested ("Dirty Dozen")
1. **Unverified User Project Create**: `email_verified: false` creating `/projects/p1` -> `PERMISSION_DENIED`.
2. **Owner Spoofing on Project Create**: Authenticated user setting `ownerUid: "other-uid"` -> `PERMISSION_DENIED`.
3. **Self-Assigned Founder Badge**: Second user creating `/users/userB` with `badges: ['Owner', 'Founder']` -> `PERMISSION_DENIED`.
4. **SiteConfig Hijack / Overwrite**: Second user updating or overwriting `/meta/siteConfig` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection**: Creating `/projects/p2` with extra key `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Oversized ID Poisoning**: Creating `/projects/<200-char-id>` -> `PERMISSION_DENIED`.
7. **Non-Owner Project File Attachment**: User B attaching file to User A's project -> `PERMISSION_DENIED`.
8. **Orphan File Write**: Attaching file to non-existent `/projects/missing/files/f1` -> `PERMISSION_DENIED`.
9. **PII Read Leak**: User B reading `/users/userA/private/account` -> `PERMISSION_DENIED`.
10. **Wallet Hijack**: User B writing `/users/userA/wallets/w1` -> `PERMISSION_DENIED`.
11. **Immutable Field Tampering**: Updating `/projects/p1` to change `ownerUid` or `createdAt` -> `PERMISSION_DENIED`.
12. **Blanket User List Scraping**: Listing `/users/{uid}/private` or `/users/{uid}/wallets` as non-owner -> `PERMISSION_DENIED`.
