# Gifticon PWA Offline App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the gifticon frontend into a fully offline-capable PWA with local-first data layer, mutation queue, and background sync.

**Architecture:** Replace direct API calls with a Repository layer backed by IndexedDB. All writes go to a local mutation queue first, then replay to the server on connectivity. Service Worker managed via vite-plugin-pwa with injectManifest for custom push/sync logic.

**Tech Stack:** React 19, TypeScript, vite-plugin-pwa (injectManifest mode), idb, Workbox

**Spec:** `docs/superpowers/specs/2026-04-03-gifticon-pwa-offline-design.md`

**Working directory:** `gifticon/frontend/`

---

## File Structure

### New Files

```
src/data/db.ts                          # IndexedDB schema & init (idb)
src/data/types.ts                       # Local entity types (LocalGifticon, Mutation, etc.)
src/data/repository/GifticonRepository.ts   # Gifticon CRUD (local-first)
src/data/repository/ImageRepository.ts      # Image blob storage
src/data/repository/SyncRepository.ts       # Mutation queue & sync metadata
src/data/sync/SyncEngine.ts                 # Sync orchestrator (online replay + fetch)
src/data/sync/ConflictResolver.ts           # LWW + append-only conflict policies
src/data/hooks/useGifticons.ts              # Replace MyGifticonsPage API calls
src/data/hooks/useGifticonDetail.ts         # Replace GifticonDetailPage API calls
src/data/hooks/useOfflineStatus.ts          # Online/offline state + pending count
src/data/hooks/useShareGroups.ts            # Replace ShareGroupsPage API calls
src/components/OfflineIndicator.tsx         # Top bar online/offline indicator
src/components/SyncBadge.tsx                # Sync status badge for cards
src/components/OcrConflictModal.tsx         # OCR vs user-input conflict resolution UI
src/sw.ts                                  # Custom SW (replaces public/sw.js)
```

### Modified Files

```
package.json                            # Add idb, vite-plugin-pwa deps
vite.config.ts                          # Add VitePWA plugin config
tsconfig.app.json                       # Add WebWorker lib for SW types
src/types/index.ts                      # Add DRAFT status, local types
src/main.tsx                            # Remove manual SW registration
src/App.tsx                             # Add OfflineIndicator
src/components/GifticonCard.tsx         # Add SyncBadge for draft/pending items
src/pages/MyGifticonsPage.tsx           # Use useGifticons hook
src/pages/GifticonDetailPage.tsx        # Use useGifticonDetail hook
src/pages/RegisterGifticonPage.tsx      # Draft-first registration flow
src/pages/ShareGroupsPage.tsx           # Use useShareGroups hook
src/pages/SettingsPage.tsx              # Add sync status section
```

### Deleted Files

```
public/sw.js                            # Replaced by src/sw.ts
```

---

## Task 1: Install dependencies and configure vite-plugin-pwa

**Files:**
- Modify: `gifticon/frontend/package.json`
- Modify: `gifticon/frontend/vite.config.ts`
- Modify: `gifticon/frontend/tsconfig.app.json`

- [ ] **Step 1: Install idb and vite-plugin-pwa**

```bash
cd gifticon/frontend && npm install idb vite-plugin-pwa
```

- [ ] **Step 2: Update vite.config.ts with VitePWA plugin (injectManifest mode)**

Replace the entire file:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      manifest: {
        name: '기프티콘 관리',
        short_name: '기프티콘',
        description: '기프티콘을 등록하고 관리하세요',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#4A90D9',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8086',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Add WebWorker lib to tsconfig.app.json**

In the `compilerOptions.lib` array, add `"WebWorker"`. If there is no `lib` array, add:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

- [ ] **Step 4: Remove manual SW registration from main.tsx**

Replace `src/main.tsx` with:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

vite-plugin-pwa handles SW registration automatically via `injectRegister: 'auto'`.

- [ ] **Step 5: Remove public/manifest.json (now in vite config)**

```bash
rm gifticon/frontend/public/manifest.json
```

The `<link rel="manifest">` in `index.html` can stay — vite-plugin-pwa will generate the manifest file.

- [ ] **Step 6: Create minimal src/sw.ts placeholder**

Create `src/sw.ts`:

```typescript
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache static assets (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// Push notification handler (migrated from public/sw.js)
self.addEventListener('push', (event) => {
  let data = { title: '기프티콘 알림', body: '새로운 알림이 있습니다.', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
```

- [ ] **Step 7: Verify dev server starts without errors**

```bash
cd gifticon/frontend && npm run dev
```

Expected: Vite starts successfully, no build errors.

- [ ] **Step 8: Delete old public/sw.js**

```bash
rm gifticon/frontend/public/sw.js
```

- [ ] **Step 9: Commit**

```bash
git add gifticon/frontend/package.json gifticon/frontend/package-lock.json \
  gifticon/frontend/vite.config.ts gifticon/frontend/tsconfig.app.json \
  gifticon/frontend/src/main.tsx gifticon/frontend/src/sw.ts
git rm gifticon/frontend/public/sw.js gifticon/frontend/public/manifest.json
git commit -m "feat(gifticon): add vite-plugin-pwa with injectManifest, migrate SW"
```

---

## Task 2: IndexedDB schema and local types

**Files:**
- Create: `gifticon/frontend/src/data/types.ts`
- Create: `gifticon/frontend/src/data/db.ts`
- Modify: `gifticon/frontend/src/types/index.ts`

- [ ] **Step 1: Add DRAFT to GifticonStatus in types/index.ts**

In `src/types/index.ts`, change line 46:

```typescript
export type GifticonStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'SHARED' | 'DRAFT';
```

- [ ] **Step 2: Create src/data/types.ts with local entity types**

```typescript
export type SyncStatus = 'synced' | 'pending' | 'conflict';

export type MutationType =
  | 'CREATE'
  | 'UPDATE_STATUS'
  | 'UPDATE_DETAIL'
  | 'DELETE'
  | 'CREATE_GROUP'
  | 'ADD_MEMBER'
  | 'SHARE_GIFTICON';

export type MutationStatus = 'pending' | 'in_flight' | 'failed';

export interface LocalGifticon {
  id: string;                    // local UUID or `server-${serverId}`
  serverId: number | null;       // null for drafts
  status: string;                // ACTIVE | USED | EXPIRED | SHARED | DRAFT
  expiryDate: string | null;
  brand: string | null;
  productName: string | null;
  barcodeNumber: string | null;
  memo: string | null;
  imageUrl: string | null;       // server URL
  localImageKey: string | null;  // key into images store
  userId: string;
  updatedAt: string;             // ISO timestamp
  syncStatus: SyncStatus;
}

export interface LocalImage {
  key: string;                   // `img-${gifticonId}`
  blob: Blob;
  mimeType: string;
  cachedAt: string;
}

export interface Mutation {
  id: string;
  type: MutationType;
  entityId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
  status: MutationStatus;
}

export interface ViewHistoryEntry {
  id: string;
  gifticonId: string;
  userId: string;
  viewedAt: string;
  synced: boolean;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}

export interface LocalShareGroup {
  id: string;
  serverId: number | null;
  name: string;
  ownerId: string;
  memberCount: number;
  gifticonCount: number;
  createdAt: string;
  syncStatus: SyncStatus;
}
```

- [ ] **Step 3: Create src/data/db.ts with IndexedDB initialization**

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  LocalGifticon,
  LocalImage,
  Mutation,
  ViewHistoryEntry,
  SyncMeta,
  LocalShareGroup,
} from './types';

interface GifticonDB extends DBSchema {
  gifticons: {
    key: string;
    value: LocalGifticon;
    indexes: {
      'by-status': string;
      'by-expiryDate': string;
      'by-userId': string;
      'by-updatedAt': string;
      'by-syncStatus': string;
    };
  };
  images: {
    key: string;
    value: LocalImage;
    indexes: {
      'by-cachedAt': string;
    };
  };
  mutationQueue: {
    key: string;
    value: Mutation;
    indexes: {
      'by-type': string;
      'by-entityId': string;
      'by-timestamp': string;
      'by-status': string;
    };
  };
  viewHistory: {
    key: string;
    value: ViewHistoryEntry;
    indexes: {
      'by-gifticonId': string;
      'by-userId': string;
      'by-viewedAt': string;
      'by-synced': string;
    };
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
  };
  shareGroups: {
    key: string;
    value: LocalShareGroup;
    indexes: {
      'by-ownerId': string;
      'by-syncStatus': string;
    };
  };
}

const DB_NAME = 'gifticon-offline-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GifticonDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<GifticonDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GifticonDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // gifticons
        const gifticonStore = db.createObjectStore('gifticons', { keyPath: 'id' });
        gifticonStore.createIndex('by-status', 'status');
        gifticonStore.createIndex('by-expiryDate', 'expiryDate');
        gifticonStore.createIndex('by-userId', 'userId');
        gifticonStore.createIndex('by-updatedAt', 'updatedAt');
        gifticonStore.createIndex('by-syncStatus', 'syncStatus');

        // images
        const imageStore = db.createObjectStore('images', { keyPath: 'key' });
        imageStore.createIndex('by-cachedAt', 'cachedAt');

        // mutationQueue
        const mutationStore = db.createObjectStore('mutationQueue', { keyPath: 'id' });
        mutationStore.createIndex('by-type', 'type');
        mutationStore.createIndex('by-entityId', 'entityId');
        mutationStore.createIndex('by-timestamp', 'timestamp');
        mutationStore.createIndex('by-status', 'status');

        // viewHistory
        const viewStore = db.createObjectStore('viewHistory', { keyPath: 'id' });
        viewStore.createIndex('by-gifticonId', 'gifticonId');
        viewStore.createIndex('by-userId', 'userId');
        viewStore.createIndex('by-viewedAt', 'viewedAt');
        viewStore.createIndex('by-synced', 'synced');

        // syncMeta
        db.createObjectStore('syncMeta', { keyPath: 'key' });

        // shareGroups
        const groupStore = db.createObjectStore('shareGroups', { keyPath: 'id' });
        groupStore.createIndex('by-ownerId', 'ownerId');
        groupStore.createIndex('by-syncStatus', 'syncStatus');
      },
    });
  }
  return dbPromise;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd gifticon/frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add gifticon/frontend/src/data/ gifticon/frontend/src/types/index.ts
git commit -m "feat(gifticon): add IndexedDB schema and local entity types"
```

---

## Task 3: Repository layer - GifticonRepository and ImageRepository

**Files:**
- Create: `gifticon/frontend/src/data/repository/GifticonRepository.ts`
- Create: `gifticon/frontend/src/data/repository/ImageRepository.ts`
- Create: `gifticon/frontend/src/data/repository/SyncRepository.ts`

- [ ] **Step 1: Create SyncRepository (mutation queue management)**

Create `src/data/repository/SyncRepository.ts`:

```typescript
import { getDB } from '../db';
import type { Mutation, MutationType, MutationStatus, SyncMeta } from '../types';

export async function addMutation(
  type: MutationType,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<Mutation> {
  const db = await getDB();
  const mutation: Mutation = {
    id: crypto.randomUUID(),
    type,
    entityId,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };
  await db.put('mutationQueue', mutation);
  return mutation;
}

export async function getPendingMutations(): Promise<Mutation[]> {
  const db = await getDB();
  return db.getAllFromIndex('mutationQueue', 'by-status', 'pending');
}

export async function updateMutationStatus(
  id: string,
  status: MutationStatus,
): Promise<void> {
  const db = await getDB();
  const mutation = await db.get('mutationQueue', id);
  if (!mutation) return;
  mutation.status = status;
  if (status === 'failed') mutation.retryCount += 1;
  await db.put('mutationQueue', mutation);
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('mutationQueue', id);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('mutationQueue', 'by-status', 'pending');
}

export async function getFailedCount(): Promise<number> {
  const db = await getDB();
  return db.countFromIndex('mutationQueue', 'by-status', 'failed');
}

export async function getSyncMeta(key: string): Promise<unknown | undefined> {
  const db = await getDB();
  const meta = await db.get('syncMeta', key);
  return meta?.value;
}

export async function setSyncMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('syncMeta', { key, value });
}
```

- [ ] **Step 2: Create ImageRepository**

Create `src/data/repository/ImageRepository.ts`:

```typescript
import { getDB } from '../db';
import type { LocalImage } from '../types';

export async function saveImage(
  gifticonId: string,
  blob: Blob,
  mimeType: string,
): Promise<string> {
  const db = await getDB();
  const key = `img-${gifticonId}`;
  const entry: LocalImage = {
    key,
    blob,
    mimeType,
    cachedAt: new Date().toISOString(),
  };
  await db.put('images', entry);
  return key;
}

export async function getImage(key: string): Promise<LocalImage | undefined> {
  const db = await getDB();
  return db.get('images', key);
}

export async function getImageBlobUrl(key: string): Promise<string | null> {
  const image = await getImage(key);
  if (!image) return null;
  return URL.createObjectURL(image.blob);
}

export async function deleteImage(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('images', key);
}

export async function cacheImageFromUrl(
  gifticonId: string,
  url: string,
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return saveImage(gifticonId, blob, blob.type);
  } catch {
    return null; // offline or fetch failed
  }
}
```

- [ ] **Step 3: Create GifticonRepository**

Create `src/data/repository/GifticonRepository.ts`:

```typescript
import { getDB } from '../db';
import type { LocalGifticon } from '../types';
import type { Gifticon, GifticonSummary } from '../../types';
import * as SyncRepo from './SyncRepository';
import * as ImageRepo from './ImageRepository';

// Convert server entity to local entity
function toLocal(g: Gifticon | GifticonSummary, syncStatus: 'synced' = 'synced'): LocalGifticon {
  const serverId = g.id;
  return {
    id: `server-${serverId}`,
    serverId,
    status: g.status,
    expiryDate: g.expiryDate,
    brand: g.brand,
    productName: g.productName,
    barcodeNumber: g.barcodeNumber,
    memo: 'memo' in g ? (g as Gifticon).memo ?? null : null,
    imageUrl: 'imageUrl' in g ? (g as Gifticon).imageUrl : ('thumbnailUrl' in g ? (g as GifticonSummary).thumbnailUrl : null),
    localImageKey: null,
    userId: 'userId' in g ? String((g as Gifticon).userId) : '',
    updatedAt: 'updatedAt' in g ? (g as Gifticon).updatedAt : new Date().toISOString(),
    syncStatus,
  };
}

export async function getAll(userId: string): Promise<LocalGifticon[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('gifticons', 'by-userId', userId);
  // Filter out USED/EXPIRED for smart caching, but keep them if recently changed
  return all.sort((a, b) => {
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });
}

export async function getById(id: string): Promise<LocalGifticon | undefined> {
  const db = await getDB();
  return db.get('gifticons', id);
}

export async function getByServerId(serverId: number): Promise<LocalGifticon | undefined> {
  const db = await getDB();
  const all = await db.getAll('gifticons');
  return all.find((g) => g.serverId === serverId);
}

export async function createDraft(
  userId: string,
  imageBlob: Blob,
  metadata?: { brand?: string; productName?: string; barcodeNumber?: string; expiryDate?: string },
): Promise<LocalGifticon> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const imageKey = await ImageRepo.saveImage(id, imageBlob, imageBlob.type);

  const draft: LocalGifticon = {
    id,
    serverId: null,
    status: 'DRAFT',
    expiryDate: metadata?.expiryDate ?? null,
    brand: metadata?.brand ?? null,
    productName: metadata?.productName ?? null,
    barcodeNumber: metadata?.barcodeNumber ?? null,
    memo: null,
    imageUrl: null,
    localImageKey: imageKey,
    userId,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  await db.put('gifticons', draft);
  await SyncRepo.addMutation('CREATE', id, {
    imageKey,
    ...metadata,
  });

  return draft;
}

export async function updateStatus(
  id: string,
  status: string,
): Promise<void> {
  const db = await getDB();
  const gifticon = await db.get('gifticons', id);
  if (!gifticon) return;

  const timestamp = new Date().toISOString();
  gifticon.status = status;
  gifticon.updatedAt = timestamp;
  gifticon.syncStatus = 'pending';
  await db.put('gifticons', gifticon);

  await SyncRepo.addMutation('UPDATE_STATUS', id, { status, timestamp });
}

export async function updateDetail(
  id: string,
  fields: { brand?: string; productName?: string; barcodeNumber?: string; expiryDate?: string },
): Promise<void> {
  const db = await getDB();
  const gifticon = await db.get('gifticons', id);
  if (!gifticon) return;

  if (fields.brand !== undefined) gifticon.brand = fields.brand;
  if (fields.productName !== undefined) gifticon.productName = fields.productName;
  if (fields.barcodeNumber !== undefined) gifticon.barcodeNumber = fields.barcodeNumber;
  if (fields.expiryDate !== undefined) gifticon.expiryDate = fields.expiryDate;
  gifticon.updatedAt = new Date().toISOString();
  gifticon.syncStatus = 'pending';
  await db.put('gifticons', gifticon);

  await SyncRepo.addMutation('UPDATE_DETAIL', id, fields);
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  const gifticon = await db.get('gifticons', id);
  if (!gifticon) return;

  // If it's a local-only draft, just delete
  if (!gifticon.serverId) {
    await db.delete('gifticons', id);
    if (gifticon.localImageKey) await ImageRepo.deleteImage(gifticon.localImageKey);
    return;
  }

  gifticon.syncStatus = 'pending';
  await db.put('gifticons', gifticon);
  await SyncRepo.addMutation('DELETE', id, { serverId: gifticon.serverId });
}

export async function applyServerState(
  serverGifticons: (Gifticon | GifticonSummary)[],
  userId: string,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('gifticons', 'readwrite');
  const store = tx.objectStore('gifticons');

  for (const sg of serverGifticons) {
    const localId = `server-${sg.id}`;
    const existing = await store.get(localId);

    if (existing && existing.syncStatus === 'pending') {
      // Don't overwrite pending local changes
      continue;
    }

    const local = toLocal(sg);
    local.localImageKey = existing?.localImageKey ?? null;
    await store.put(local);
  }

  await tx.done;

  // Cache images for ACTIVE gifticons
  const active = await db.getAllFromIndex('gifticons', 'by-status', 'ACTIVE');
  for (const g of active) {
    if (g.imageUrl && !g.localImageKey) {
      const key = await ImageRepo.cacheImageFromUrl(g.id, g.imageUrl);
      if (key) {
        g.localImageKey = key;
        await db.put('gifticons', g);
      }
    }
  }
}

// Clean up cached data for USED/EXPIRED gifticons
export async function cleanupCache(): Promise<void> {
  const db = await getDB();
  const used = await db.getAllFromIndex('gifticons', 'by-status', 'USED');
  const expired = await db.getAllFromIndex('gifticons', 'by-status', 'EXPIRED');

  for (const g of [...used, ...expired]) {
    if (g.syncStatus === 'synced' && g.localImageKey) {
      await ImageRepo.deleteImage(g.localImageKey);
      g.localImageKey = null;
      await db.put('gifticons', g);
    }
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd gifticon/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add gifticon/frontend/src/data/repository/
git commit -m "feat(gifticon): add Repository layer (Gifticon, Image, Sync)"
```

---

## Task 4: Sync Engine and Conflict Resolver

**Files:**
- Create: `gifticon/frontend/src/data/sync/ConflictResolver.ts`
- Create: `gifticon/frontend/src/data/sync/SyncEngine.ts`
- Modify: `gifticon/frontend/src/sw.ts`

- [ ] **Step 1: Create ConflictResolver**

Create `src/data/sync/ConflictResolver.ts`:

```typescript
import type { LocalGifticon } from '../types';
import type { Gifticon } from '../../types';

export interface ConflictResult {
  resolved: LocalGifticon;
  needsUserConfirmation: boolean;
  conflictFields?: string[];
}

export function resolveStatusConflict(
  local: LocalGifticon,
  server: Gifticon,
): 'local' | 'server' {
  // LWW based on timestamp - earlier "use" wins for status changes
  const localTime = new Date(local.updatedAt).getTime();
  const serverTime = new Date(server.updatedAt).getTime();
  return localTime <= serverTime ? 'local' : 'server';
}

export function resolveMetadataConflict(
  local: LocalGifticon,
  server: Gifticon,
): ConflictResult {
  const conflictFields: string[] = [];
  const resolved = { ...local };

  // For each metadata field: server wins, notify user
  if (local.brand !== server.brand && local.brand !== null) {
    conflictFields.push('brand');
    resolved.brand = server.brand;
  }
  if (local.productName !== server.productName && local.productName !== null) {
    conflictFields.push('productName');
    resolved.productName = server.productName;
  }

  // Sensitive fields: flag for user confirmation instead of auto-resolving
  const needsUserConfirmation =
    (local.expiryDate !== server.expiryDate && local.expiryDate !== null) ||
    (local.barcodeNumber !== server.barcodeNumber && local.barcodeNumber !== null);

  if (needsUserConfirmation) {
    if (local.expiryDate !== server.expiryDate) conflictFields.push('expiryDate');
    if (local.barcodeNumber !== server.barcodeNumber) conflictFields.push('barcodeNumber');
  }

  return { resolved, needsUserConfirmation, conflictFields };
}
```

- [ ] **Step 2: Create SyncEngine**

Create `src/data/sync/SyncEngine.ts`:

```typescript
import * as GifticonRepo from '../repository/GifticonRepository';
import * as ImageRepo from '../repository/ImageRepository';
import * as SyncRepo from '../repository/SyncRepository';
import { getDB } from '../db';
import type { Mutation } from '../types';
import type { ApiResponse, Gifticon, GifticonPage } from '../../types';
import { apiRequest } from '../../api/client';
import { getUserId } from '../../api/client';
import { resolveStatusConflict } from './ConflictResolver';

const MAX_RETRIES = 3;

type SyncListener = (event: 'start' | 'complete' | 'error', detail?: string) => void;
const listeners: Set<SyncListener> = new Set();

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(event: 'start' | 'complete' | 'error', detail?: string) {
  listeners.forEach((fn) => fn(event, detail));
}

export async function replayQueue(): Promise<void> {
  const pending = await SyncRepo.getPendingMutations();
  if (pending.length === 0) return;

  notify('start');

  for (const mutation of pending) {
    try {
      await SyncRepo.updateMutationStatus(mutation.id, 'in_flight');
      await replayMutation(mutation);
      await SyncRepo.removeMutation(mutation.id);
    } catch (err) {
      const m = await SyncRepo.getPendingMutations();
      const current = m.find((x) => x.id === mutation.id);
      if (current && current.retryCount >= MAX_RETRIES) {
        await SyncRepo.updateMutationStatus(mutation.id, 'failed');
      } else {
        await SyncRepo.updateMutationStatus(mutation.id, 'pending');
      }
    }
  }

  // After replay, fetch latest state from server
  await fetchAndApplyServerState();
  await GifticonRepo.cleanupCache();

  notify('complete');
}

async function replayMutation(mutation: Mutation): Promise<void> {
  const db = await getDB();
  const gifticon = await db.get('gifticons', mutation.entityId);

  switch (mutation.type) {
    case 'CREATE': {
      if (!gifticon) return;
      const imageKey = mutation.payload.imageKey as string;
      const image = await ImageRepo.getImage(imageKey);
      if (!image) return;

      const formData = new FormData();
      formData.append('image', image.blob, 'gifticon.jpg');
      if (gifticon.brand) formData.append('brand', gifticon.brand);
      if (gifticon.productName) formData.append('productName', gifticon.productName);
      if (gifticon.barcodeNumber) formData.append('barcodeNumber', gifticon.barcodeNumber);
      if (gifticon.expiryDate) formData.append('expiryDate', gifticon.expiryDate);

      const res = await apiRequest<Gifticon>('/api/gifticons', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data) {
        // Promote draft to server entity
        await db.delete('gifticons', gifticon.id);
        const promoted = {
          ...gifticon,
          id: `server-${res.data.id}`,
          serverId: res.data.id,
          status: res.data.status,
          brand: res.data.brand || gifticon.brand,
          productName: res.data.productName || gifticon.productName,
          barcodeNumber: res.data.barcodeNumber || gifticon.barcodeNumber,
          expiryDate: res.data.expiryDate || gifticon.expiryDate,
          imageUrl: res.data.imageUrl,
          syncStatus: 'synced' as const,
        };
        await db.put('gifticons', promoted);
        // Update image key reference
        if (gifticon.localImageKey) {
          await ImageRepo.saveImage(promoted.id, image.blob, image.mimeType);
          await ImageRepo.deleteImage(gifticon.localImageKey);
          promoted.localImageKey = `img-${promoted.id}`;
          await db.put('gifticons', promoted);
        }
      }
      break;
    }

    case 'UPDATE_STATUS': {
      if (!gifticon?.serverId) return;
      const res = await apiRequest<Gifticon>(`/api/gifticons/${gifticon.serverId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: mutation.payload.status }),
      });
      if (res.success && res.data) {
        gifticon.syncStatus = 'synced';
        await db.put('gifticons', gifticon);
      } else if (res.error?.code === 'CONFLICT') {
        // LWW resolution
        const serverRes = await apiRequest<Gifticon>(`/api/gifticons/${gifticon.serverId}`);
        if (serverRes.success && serverRes.data) {
          const winner = resolveStatusConflict(gifticon, serverRes.data);
          if (winner === 'server') {
            gifticon.status = serverRes.data.status;
          }
          gifticon.syncStatus = 'synced';
          await db.put('gifticons', gifticon);
        }
      }
      break;
    }

    case 'UPDATE_DETAIL': {
      if (!gifticon?.serverId) return;
      const res = await apiRequest<Gifticon>(`/api/gifticons/${gifticon.serverId}`, {
        method: 'PUT',
        body: JSON.stringify(mutation.payload),
      });
      if (res.success) {
        gifticon.syncStatus = 'synced';
        await db.put('gifticons', gifticon);
      }
      break;
    }

    case 'DELETE': {
      const serverId = mutation.payload.serverId as number;
      const res = await apiRequest<void>(`/api/gifticons/${serverId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        await db.delete('gifticons', mutation.entityId);
        const imageKey = `img-${mutation.entityId}`;
        await ImageRepo.deleteImage(imageKey);
      }
      break;
    }

    case 'CREATE_GROUP': {
      const res = await apiRequest<{ id: number }>('/api/gifticons/share-groups', {
        method: 'POST',
        body: JSON.stringify({ name: mutation.payload.name }),
      });
      if (res.success && res.data) {
        const group = await db.get('shareGroups', mutation.entityId);
        if (group) {
          await db.delete('shareGroups', group.id);
          group.id = `server-${res.data.id}`;
          group.serverId = res.data.id;
          group.syncStatus = 'synced';
          await db.put('shareGroups', group);
        }
      }
      break;
    }

    case 'ADD_MEMBER': {
      const group = await db.get('shareGroups', mutation.entityId);
      if (!group?.serverId) return;
      await apiRequest<void>(`/api/gifticons/share-groups/${group.serverId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: mutation.payload.userId }),
      });
      break;
    }

    case 'SHARE_GIFTICON': {
      const group = await db.get('shareGroups', mutation.entityId);
      const gifticonLocal = mutation.payload.gifticonId
        ? await db.get('gifticons', mutation.payload.gifticonId as string)
        : null;
      if (!group?.serverId || !gifticonLocal?.serverId) return;
      await apiRequest<void>(
        `/api/gifticons/share-groups/${group.serverId}/gifticons/${gifticonLocal.serverId}`,
        { method: 'POST' },
      );
      break;
    }
  }
}

async function fetchAndApplyServerState(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const res = await apiRequest<GifticonPage>('/api/gifticons?page=0&size=1000');
  if (res.success && res.data) {
    await GifticonRepo.applyServerState(res.data.content, userId);
  }

  await SyncRepo.setSyncMeta('lastSyncAt', new Date().toISOString());
}

// Trigger sync registration for Background Sync API
export async function requestSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('mutation-sync');
  } else {
    // iOS fallback - replay directly
    await replayQueue();
  }
}

// Initialize online/offline listeners
export function initSyncListeners(): () => void {
  const handleOnline = () => {
    replayQueue();
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
```

- [ ] **Step 3: Add Background Sync handler to sw.ts**

Append to the end of `src/sw.ts`:

```typescript
// Background Sync handler
self.addEventListener('sync', (event: ExtendableEvent & { tag?: string }) => {
  if (event.tag === 'mutation-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Notify main thread to replay queue
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REPLAY' }));
      }),
    );
  }
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd gifticon/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add gifticon/frontend/src/data/sync/ gifticon/frontend/src/sw.ts
git commit -m "feat(gifticon): add SyncEngine, ConflictResolver, Background Sync"
```

---

## Task 5: React hooks for offline data access

**Files:**
- Create: `gifticon/frontend/src/data/hooks/useOfflineStatus.ts`
- Create: `gifticon/frontend/src/data/hooks/useGifticons.ts`
- Create: `gifticon/frontend/src/data/hooks/useGifticonDetail.ts`
- Create: `gifticon/frontend/src/data/hooks/useShareGroups.ts`

- [ ] **Step 1: Create useOfflineStatus hook**

Create `src/data/hooks/useOfflineStatus.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as SyncRepo from '../repository/SyncRepository';
import { onSyncEvent } from '../sync/SyncEngine';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const refreshCounts = useCallback(async () => {
    setPendingCount(await SyncRepo.getPendingCount());
    setFailedCount(await SyncRepo.getFailedCount());
    const last = await SyncRepo.getSyncMeta('lastSyncAt');
    setLastSyncAt(last as string | null);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onSyncEvent((event) => {
      if (event === 'start') setSyncing(true);
      if (event === 'complete' || event === 'error') {
        setSyncing(false);
        refreshCounts();
      }
    });

    refreshCounts();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [refreshCounts]);

  return { isOnline, pendingCount, failedCount, syncing, lastSyncAt, refreshCounts };
}
```

- [ ] **Step 2: Create useGifticons hook**

Create `src/data/hooks/useGifticons.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { LocalGifticon } from '../types';
import * as GifticonRepo from '../repository/GifticonRepository';
import { replayQueue, onSyncEvent } from '../sync/SyncEngine';
import { getMyGifticons } from '../../api/gifticon';
import { getUserId } from '../../api/client';

export function useGifticons() {
  const [gifticons, setGifticons] = useState<LocalGifticon[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    const local = await GifticonRepo.getAll(userId);
    setGifticons(local);
    setLoading(false);
  }, []);

  const syncFromServer = useCallback(async () => {
    const userId = getUserId();
    if (!userId || !navigator.onLine) return;

    try {
      const res = await getMyGifticons(0, 1000);
      if (res.success && res.data) {
        await GifticonRepo.applyServerState(res.data.content, userId);
        await GifticonRepo.cleanupCache();
        await loadLocal();
      }
    } catch {
      // offline or server error - use local data
    }
  }, [loadLocal]);

  useEffect(() => {
    loadLocal().then(syncFromServer);

    const unsubscribe = onSyncEvent((event) => {
      if (event === 'complete') loadLocal();
    });

    return unsubscribe;
  }, [loadLocal, syncFromServer]);

  return { gifticons, loading, refresh: loadLocal };
}
```

- [ ] **Step 3: Create useGifticonDetail hook**

Create `src/data/hooks/useGifticonDetail.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { LocalGifticon } from '../types';
import * as GifticonRepo from '../repository/GifticonRepository';
import * as ImageRepo from '../repository/ImageRepository';
import { getGifticon } from '../../api/gifticon';
import { onSyncEvent } from '../sync/SyncEngine';

export function useGifticonDetail(idParam: string | undefined) {
  const [gifticon, setGifticon] = useState<LocalGifticon | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!idParam) return;
    setLoading(true);

    // Try local first (could be server-${id} or a draft UUID)
    let local = await GifticonRepo.getByServerId(Number(idParam));
    if (!local) {
      local = await GifticonRepo.getById(idParam) ?? null;
    }

    if (local) {
      setGifticon(local);
      // Load local image
      if (local.localImageKey) {
        const url = await ImageRepo.getImageBlobUrl(local.localImageKey);
        setImageUrl(url);
      } else if (local.imageUrl) {
        setImageUrl(local.imageUrl);
      }
      setLoading(false);
    }

    // If online, also fetch server data to update
    if (navigator.onLine && !isNaN(Number(idParam))) {
      try {
        const res = await getGifticon(Number(idParam));
        if (res.success && res.data) {
          const serverId = res.data.id;
          const localId = `server-${serverId}`;
          const existing = await GifticonRepo.getById(localId);
          if (!existing || existing.syncStatus === 'synced') {
            await GifticonRepo.applyServerState([res.data], String(res.data.userId));
            const updated = await GifticonRepo.getById(localId);
            if (updated) {
              setGifticon(updated);
              if (updated.imageUrl && !updated.localImageKey) {
                setImageUrl(updated.imageUrl);
              }
            }
          }
        }
      } catch {
        // use local data
      }
    }

    setLoading(false);
  }, [idParam]);

  useEffect(() => {
    load();
    const unsubscribe = onSyncEvent((event) => {
      if (event === 'complete') load();
    });
    return unsubscribe;
  }, [load]);

  return { gifticon, imageUrl, loading, reload: load };
}
```

- [ ] **Step 4: Create useShareGroups hook**

Create `src/data/hooks/useShareGroups.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getDB } from '../db';
import type { LocalShareGroup } from '../types';
import * as SyncRepo from '../repository/SyncRepository';
import { getMyGroups } from '../../api/share';
import { getUserId } from '../../api/client';
import { onSyncEvent, requestSync } from '../sync/SyncEngine';

export function useShareGroups() {
  const [groups, setGroups] = useState<LocalShareGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const db = await getDB();
    const userId = getUserId();
    if (!userId) return;
    const all = await db.getAllFromIndex('shareGroups', 'by-ownerId', userId);
    setGroups(all);
    setLoading(false);
  }, []);

  const syncFromServer = useCallback(async () => {
    const userId = getUserId();
    if (!userId || !navigator.onLine) return;

    try {
      const res = await getMyGroups();
      if (res.success && res.data) {
        const db = await getDB();
        for (const sg of res.data) {
          const localId = `server-${sg.id}`;
          const existing = await db.get('shareGroups', localId);
          if (existing && existing.syncStatus === 'pending') continue;

          const local: LocalShareGroup = {
            id: localId,
            serverId: sg.id,
            name: sg.name,
            ownerId: sg.ownerId,
            memberCount: sg.memberCount,
            gifticonCount: sg.gifticonCount,
            createdAt: sg.createdAt,
            syncStatus: 'synced',
          };
          await db.put('shareGroups', local);
        }
        await loadLocal();
      }
    } catch {
      // use local
    }
  }, [loadLocal]);

  useEffect(() => {
    loadLocal().then(syncFromServer);
    const unsubscribe = onSyncEvent((event) => {
      if (event === 'complete') loadLocal();
    });
    return unsubscribe;
  }, [loadLocal, syncFromServer]);

  const createGroup = useCallback(async (name: string) => {
    const db = await getDB();
    const userId = getUserId();
    if (!userId) return;

    const id = crypto.randomUUID();
    const group: LocalShareGroup = {
      id,
      serverId: null,
      name,
      ownerId: userId,
      memberCount: 1,
      gifticonCount: 0,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };
    await db.put('shareGroups', group);
    await SyncRepo.addMutation('CREATE_GROUP', id, { name });
    await loadLocal();
    await requestSync();
  }, [loadLocal]);

  const addMember = useCallback(async (groupId: string, userId: string) => {
    await SyncRepo.addMutation('ADD_MEMBER', groupId, { userId });
    await requestSync();
  }, []);

  return { groups, loading, refresh: loadLocal, createGroup, addMember };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd gifticon/frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add gifticon/frontend/src/data/hooks/
git commit -m "feat(gifticon): add offline-first React hooks"
```

---

## Task 6: UI components - OfflineIndicator, SyncBadge, OcrConflictModal

**Files:**
- Create: `gifticon/frontend/src/components/OfflineIndicator.tsx`
- Create: `gifticon/frontend/src/components/SyncBadge.tsx`
- Create: `gifticon/frontend/src/components/OcrConflictModal.tsx`

- [ ] **Step 1: Create OfflineIndicator**

Create `src/components/OfflineIndicator.tsx`:

```typescript
import { useOfflineStatus } from '../data/hooks/useOfflineStatus';

export default function OfflineIndicator() {
  const { isOnline, syncing, pendingCount } = useOfflineStatus();

  if (isOnline && !syncing && pendingCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '6px 16px',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
        background: !isOnline ? '#ff6b6b' : syncing ? '#ffa726' : '#4A90D9',
        color: '#fff',
      }}
    >
      {!isOnline && '오프라인 모드'}
      {isOnline && syncing && '동기화 중...'}
      {isOnline && !syncing && pendingCount > 0 && `동기화 대기 ${pendingCount}건`}
    </div>
  );
}
```

- [ ] **Step 2: Create SyncBadge**

Create `src/components/SyncBadge.tsx`:

```typescript
import type { SyncStatus } from '../data/types';

interface SyncBadgeProps {
  syncStatus: SyncStatus;
  isDraft: boolean;
}

export default function SyncBadge({ syncStatus, isDraft }: SyncBadgeProps) {
  if (syncStatus === 'synced' && !isDraft) return null;

  const label = isDraft
    ? 'OCR 대기'
    : syncStatus === 'pending'
      ? '동기화 대기'
      : syncStatus === 'conflict'
        ? '충돌'
        : '';

  if (!label) return null;

  const bgColor = isDraft ? '#ffa726' : syncStatus === 'conflict' ? '#ff6b6b' : '#90caf9';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        background: bgColor,
        color: '#fff',
      }}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Create OcrConflictModal**

Create `src/components/OcrConflictModal.tsx`:

```typescript
interface OcrConflictModalProps {
  fields: Array<{
    name: string;
    label: string;
    localValue: string;
    ocrValue: string;
  }>;
  onResolve: (resolutions: Record<string, string>) => void;
  onDismiss: () => void;
}

export default function OcrConflictModal({ fields, onResolve, onDismiss }: OcrConflictModalProps) {
  const resolutions: Record<string, string> = {};

  const handleKeepLocal = () => {
    fields.forEach((f) => {
      resolutions[f.name] = f.localValue;
    });
    onResolve(resolutions);
  };

  const handleUseOcr = () => {
    fields.forEach((f) => {
      resolutions[f.name] = f.ocrValue;
    });
    onResolve(resolutions);
  };

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>OCR 결과 확인</h2>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
          입력하신 정보와 OCR 결과가 다릅니다.
        </p>

        {fields.map((f) => (
          <div key={f.name} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>{f.label}</div>
            <div style={{ fontSize: 14, color: '#222', marginTop: 4 }}>
              내 입력: <strong>{f.localValue || '(없음)'}</strong>
            </div>
            <div style={{ fontSize: 14, color: '#4A90D9', marginTop: 2 }}>
              OCR 결과: <strong>{f.ocrValue || '(없음)'}</strong>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleKeepLocal}>
            내 입력 유지
          </button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={handleUseOcr}>
            OCR 결과 사용
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add gifticon/frontend/src/components/OfflineIndicator.tsx \
  gifticon/frontend/src/components/SyncBadge.tsx \
  gifticon/frontend/src/components/OcrConflictModal.tsx
git commit -m "feat(gifticon): add OfflineIndicator, SyncBadge, OcrConflictModal"
```

---

## Task 7: Migrate pages to offline-first hooks

**Files:**
- Modify: `gifticon/frontend/src/App.tsx`
- Modify: `gifticon/frontend/src/pages/MyGifticonsPage.tsx`
- Modify: `gifticon/frontend/src/pages/GifticonDetailPage.tsx`
- Modify: `gifticon/frontend/src/pages/RegisterGifticonPage.tsx`
- Modify: `gifticon/frontend/src/pages/ShareGroupsPage.tsx`
- Modify: `gifticon/frontend/src/components/GifticonCard.tsx`
- Modify: `gifticon/frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add OfflineIndicator and sync init to App.tsx**

Replace `src/App.tsx`:

```typescript
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import OfflineIndicator from './components/OfflineIndicator';
import LoginPage from './pages/LoginPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import MyGifticonsPage from './pages/MyGifticonsPage';
import RegisterGifticonPage from './pages/RegisterGifticonPage';
import GifticonDetailPage from './pages/GifticonDetailPage';
import ShareGroupsPage from './pages/ShareGroupsPage';
import SettingsPage from './pages/SettingsPage';
import { initSyncListeners, replayQueue } from './data/sync/SyncEngine';
import './App.css';

function AppLayout() {
  const location = useLocation();
  const hideNav = ['/login', '/oauth/callback'].some((p) =>
    location.pathname.startsWith(p),
  );

  useEffect(() => {
    const cleanup = initSyncListeners();

    // Listen for SW sync messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_REPLAY') {
        replayQueue();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Initial sync on load if online
    if (navigator.onLine) {
      replayQueue();
    }

    return () => {
      cleanup();
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="app-container">
      <OfflineIndicator />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/" element={<MyGifticonsPage />} />
        <Route path="/register" element={<RegisterGifticonPage />} />
        <Route path="/gifticons/:id" element={<GifticonDetailPage />} />
        <Route path="/share-groups" element={<ShareGroupsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Migrate MyGifticonsPage to useGifticons**

Replace `src/pages/MyGifticonsPage.tsx`:

```typescript
import { useNavigate } from 'react-router-dom';
import { useGifticons } from '../data/hooks/useGifticons';
import GifticonCard from '../components/GifticonCard';
import './MyGifticonsPage.css';

export default function MyGifticonsPage() {
  const { gifticons, loading } = useGifticons();
  const navigate = useNavigate();

  return (
    <div className="my-gifticons-page">
      <header className="page-header">
        <h1>내 기프티콘</h1>
      </header>

      {loading && gifticons.length === 0 ? (
        <div className="loading-state">불러오는 중...</div>
      ) : gifticons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎁</div>
          <p>등록된 기프티콘이 없습니다</p>
          <button className="btn-primary" onClick={() => navigate('/register')}>
            기프티콘 등록하기
          </button>
        </div>
      ) : (
        <div className="gifticon-list">
          {gifticons.map((g) => (
            <GifticonCard key={g.id} gifticon={g} />
          ))}
        </div>
      )}

      <button
        className="fab"
        onClick={() => navigate('/register')}
        aria-label="기프티콘 등록"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Update GifticonCard to accept LocalGifticon and show SyncBadge**

Replace `src/components/GifticonCard.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LocalGifticon } from '../data/types';
import { getImageBlobUrl } from '../data/repository/ImageRepository';
import ExpiryBadge from './ExpiryBadge';
import SyncBadge from './SyncBadge';
import './GifticonCard.css';

interface GifticonCardProps {
  gifticon: LocalGifticon;
}

export default function GifticonCard({ gifticon }: GifticonCardProps) {
  const navigate = useNavigate();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isDraft = gifticon.status === 'DRAFT';
  const detailId = gifticon.serverId ?? gifticon.id;

  useEffect(() => {
    if (gifticon.localImageKey) {
      getImageBlobUrl(gifticon.localImageKey).then(setThumbUrl);
    } else if (gifticon.imageUrl) {
      setThumbUrl(gifticon.imageUrl);
    }
  }, [gifticon.localImageKey, gifticon.imageUrl]);

  return (
    <div
      className={`gifticon-card ${gifticon.status === 'USED' ? 'used' : ''}`}
      style={isDraft ? { borderStyle: 'dashed', opacity: 0.85 } : undefined}
      onClick={() => navigate(`/gifticons/${detailId}`)}
    >
      <div className="gifticon-card-image">
        {thumbUrl ? (
          <img src={thumbUrl} alt={gifticon.productName || '기프티콘'} />
        ) : (
          <div className="gifticon-card-placeholder">
            <span>🎁</span>
          </div>
        )}
        {gifticon.status === 'USED' && (
          <div className="gifticon-card-used-overlay">사용완료</div>
        )}
      </div>
      <div className="gifticon-card-info">
        <span className="gifticon-card-brand">{gifticon.brand || '브랜드 미입력'}</span>
        <span className="gifticon-card-name">{gifticon.productName || '상품명 미입력'}</span>
        <div className="gifticon-card-footer">
          {gifticon.expiryDate && <ExpiryBadge expiryDate={gifticon.expiryDate} />}
          <SyncBadge syncStatus={gifticon.syncStatus} isDraft={isDraft} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Migrate RegisterGifticonPage to draft-first flow**

Replace `src/pages/RegisterGifticonPage.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUpload from '../components/ImageUpload';
import * as GifticonRepo from '../data/repository/GifticonRepository';
import { requestSync } from '../data/sync/SyncEngine';
import { getUserId } from '../api/client';
import './RegisterGifticonPage.css';

export default function RegisterGifticonPage() {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [barcodeNumber, setBarcodeNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    setSaving(true);
    try {
      const userId = getUserId();
      if (!userId) {
        alert('로그인이 필요합니다.');
        return;
      }

      const metadata = {
        brand: brand || undefined,
        productName: productName || undefined,
        barcodeNumber: barcodeNumber || undefined,
        expiryDate: expiryDate || undefined,
      };

      const draft = await GifticonRepo.createDraft(userId, imageFile, metadata);

      // Trigger sync if online (will OCR + register on server)
      if (navigator.onLine) {
        requestSync();
      }

      navigate(`/gifticons/${draft.id}`, { replace: true });
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="register-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← 뒤로
        </button>
        <h1>기프티콘 등록</h1>
      </header>

      {!imageFile ? (
        <div className="register-upload-section">
          <p className="register-guide">
            기프티콘 이미지를 촬영하거나 선택해주세요.
          </p>
          <ImageUpload onImageSelect={handleImageSelect} />
        </div>
      ) : (
        <form className="register-form" onSubmit={handleSubmit}>
          {imagePreview && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img
                src={imagePreview}
                alt="미리보기"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
              />
            </div>
          )}

          <p className="register-guide">
            정보를 입력하면 바로 사용할 수 있어요.
            {navigator.onLine
              ? ' 온라인 시 OCR로 자동 보완됩니다.'
              : ' 오프라인에서도 저장됩니다.'}
          </p>

          <div className="form-group">
            <label htmlFor="brand">브랜드</label>
            <input
              id="brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="예: 스타벅스 (선택)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="productName">상품명</label>
            <input
              id="productName"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="예: 아메리카노 Tall (선택)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="barcodeNumber">바코드 번호</label>
            <input
              id="barcodeNumber"
              type="text"
              value={barcodeNumber}
              onChange={(e) => setBarcodeNumber(e.target.value)}
              placeholder="바코드 번호 입력 (선택)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="expiryDate">유효기간</label>
            <input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Migrate GifticonDetailPage**

Replace `src/pages/GifticonDetailPage.tsx`:

```typescript
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGifticonDetail } from '../data/hooks/useGifticonDetail';
import { useShareGroups } from '../data/hooks/useShareGroups';
import * as GifticonRepo from '../data/repository/GifticonRepository';
import { requestSync } from '../data/sync/SyncEngine';
import ExpiryBadge from '../components/ExpiryBadge';
import SyncBadge from '../components/SyncBadge';
import './GifticonDetailPage.css';

export default function GifticonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { gifticon, imageUrl, loading, reload } = useGifticonDetail(id);
  const { groups } = useShareGroups();
  const [editing, setEditing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [barcodeNumber, setBarcodeNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const startEdit = () => {
    if (!gifticon) return;
    setBrand(gifticon.brand || '');
    setProductName(gifticon.productName || '');
    setBarcodeNumber(gifticon.barcodeNumber || '');
    setExpiryDate(gifticon.expiryDate || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!gifticon) return;
    await GifticonRepo.updateDetail(gifticon.id, { brand, productName, barcodeNumber, expiryDate });
    requestSync();
    setEditing(false);
    reload();
  };

  const handleMarkUsed = async () => {
    if (!gifticon || !confirm('사용 완료로 변경하시겠습니까?')) return;
    await GifticonRepo.updateStatus(gifticon.id, 'USED');
    requestSync();
    reload();
  };

  const handleDelete = async () => {
    if (!gifticon || !confirm('정말 삭제하시겠습니까?')) return;
    await GifticonRepo.remove(gifticon.id);
    requestSync();
    navigate('/', { replace: true });
  };

  if (loading) {
    return <div className="detail-page"><p className="loading-state">불러오는 중...</p></div>;
  }
  if (!gifticon) {
    return <div className="detail-page"><p className="loading-state">기프티콘을 찾을 수 없습니다.</p></div>;
  }

  const isDraft = gifticon.status === 'DRAFT';

  return (
    <div className="detail-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 뒤로</button>
        <h1>기프티콘 상세</h1>
      </header>

      <div className="detail-image">
        {imageUrl ? (
          <img src={imageUrl} alt={gifticon.productName || '기프티콘'} />
        ) : (
          <div className="detail-image-placeholder">🎁</div>
        )}
      </div>

      <div className="detail-status-row">
        {gifticon.expiryDate && <ExpiryBadge expiryDate={gifticon.expiryDate} />}
        <SyncBadge syncStatus={gifticon.syncStatus} isDraft={isDraft} />
        {!isDraft && (
          <span className={`status-tag ${gifticon.status.toLowerCase()}`}>
            {gifticon.status === 'ACTIVE' && '사용 가능'}
            {gifticon.status === 'USED' && '사용 완료'}
            {gifticon.status === 'EXPIRED' && '만료'}
            {gifticon.status === 'SHARED' && '공유됨'}
          </span>
        )}
        {isDraft && <span className="status-tag draft">등록 대기</span>}
      </div>

      {editing ? (
        <div className="detail-edit-form">
          <div className="form-group"><label>브랜드</label><input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
          <div className="form-group"><label>상품명</label><input value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
          <div className="form-group"><label>바코드 번호</label><input value={barcodeNumber} onChange={(e) => setBarcodeNumber(e.target.value)} /></div>
          <div className="form-group"><label>유효기간</label><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
          <div className="detail-edit-actions">
            <button className="btn-primary" onClick={handleSave}>저장</button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <div className="detail-info">
          <div className="detail-field"><span className="detail-label">브랜드</span><span className="detail-value">{gifticon.brand || '-'}</span></div>
          <div className="detail-field"><span className="detail-label">상품명</span><span className="detail-value">{gifticon.productName || '-'}</span></div>
          <div className="detail-field"><span className="detail-label">바코드 번호</span><span className="detail-value barcode">{gifticon.barcodeNumber || '-'}</span></div>
          <div className="detail-field"><span className="detail-label">유효기간</span><span className="detail-value">{gifticon.expiryDate || '-'}</span></div>
        </div>
      )}

      {!editing && (gifticon.status === 'ACTIVE' || isDraft) && (
        <div className="detail-actions">
          {!isDraft && <button className="btn-primary btn-full" onClick={handleMarkUsed}>사용 완료</button>}
          {!isDraft && <button className="btn-secondary btn-full" onClick={() => setShareModalOpen(true)}>공유하기</button>}
          <button className="btn-secondary btn-full" onClick={startEdit}>수정하기</button>
          <button className="btn-danger btn-full" onClick={handleDelete}>삭제하기</button>
        </div>
      )}

      {shareModalOpen && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>공유 그룹 선택</h2>
            {groups.length === 0 ? (
              <p className="modal-empty">공유 그룹이 없습니다.</p>
            ) : (
              <div className="modal-list">
                {groups.map((g) => (
                  <button key={g.id} className="modal-list-item" onClick={() => setShareModalOpen(false)}>
                    <span>{g.name}</span>
                    <span className="modal-list-count">{g.memberCount}명</span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn-secondary btn-full" onClick={() => setShareModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Migrate ShareGroupsPage**

Replace `src/pages/ShareGroupsPage.tsx`:

```typescript
import { useState } from 'react';
import { useShareGroups } from '../data/hooks/useShareGroups';

export default function ShareGroupsPage() {
  const { groups, loading, createGroup, addMember } = useShareGroups();
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState('');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim());
    setNewGroupName('');
    setShowCreate(false);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberGroupId || !memberUserId.trim()) return;
    await addMember(addMemberGroupId, memberUserId.trim());
    setMemberUserId('');
    setAddMemberGroupId(null);
  };

  return (
    <div className="share-groups-page" style={{ padding: 16, paddingBottom: 80 }}>
      <header className="page-header"><h1>공유 그룹</h1></header>

      <button className="btn-primary btn-full" style={{ marginBottom: 16 }} onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? '취소' : '+ 새 그룹 만들기'}
      </button>

      {showCreate && (
        <form onSubmit={handleCreateGroup} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="그룹 이름" style={{ flex: 1, padding: 12, border: '1px solid #ddd', borderRadius: 8, fontSize: 15 }} />
          <button type="submit" className="btn-primary">생성</button>
        </form>
      )}

      {loading ? (
        <div className="loading-state">불러오는 중...</div>
      ) : groups.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div><p>공유 그룹이 없습니다</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map((group) => (
            <div key={group.id} style={{ padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderStyle: group.syncStatus === 'pending' ? 'dashed' : 'solid', borderWidth: 1, borderColor: group.syncStatus === 'pending' ? '#ffa726' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>{group.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>멤버 {group.memberCount}명 · 기프티콘 {group.gifticonCount}개</div>
                </div>
                <button className="btn-text" onClick={() => setAddMemberGroupId(addMemberGroupId === group.id ? null : group.id)}>멤버 추가</button>
              </div>

              {addMemberGroupId === group.id && (
                <form onSubmit={handleAddMember} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input type="text" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} placeholder="사용자 ID 입력" style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
                  <button type="submit" className="btn-primary btn-sm">추가</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Add sync status section to SettingsPage**

Replace `src/pages/SettingsPage.tsx`:

```typescript
import { useAuth } from '../hooks/useAuth';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { useOfflineStatus } from '../data/hooks/useOfflineStatus';
import InstallPrompt from '../components/InstallPrompt';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { isSubscribed, isSupported, permission, subscribe, unsubscribe } = usePushSubscription();
  const { isOnline, pendingCount, failedCount, lastSyncAt, syncing } = useOfflineStatus();

  const handlePushToggle = async () => {
    if (isSubscribed) await unsubscribe();
    else await subscribe();
  };

  return (
    <div style={{ padding: 16, paddingBottom: 80 }}>
      <header className="page-header"><h1>설정</h1></header>

      {user && (
        <div style={{ padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>{user.nickname || user.email}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{user.email}</div>
        </div>
      )}

      {/* Sync Status */}
      <div style={{ padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 8 }}>동기화 상태</div>
        <div style={{ fontSize: 13, color: '#666' }}>
          <div>상태: {isOnline ? (syncing ? '동기화 중...' : '온라인') : '오프라인'}</div>
          <div>대기: {pendingCount}건 {failedCount > 0 && `· 실패: ${failedCount}건`}</div>
          {lastSyncAt && <div>마지막 동기화: {new Date(lastSyncAt).toLocaleString('ko-KR')}</div>}
        </div>
      </div>

      {/* Push Notification */}
      <div style={{ padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>푸시 알림</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {!isSupported ? '이 브라우저에서 지원하지 않습니다' : permission === 'denied' ? '알림이 차단되었습니다.' : isSubscribed ? '만료 알림을 받고 있습니다' : '만료 알림을 받으려면 켜주세요'}
            </div>
          </div>
          <button className={isSubscribed ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={handlePushToggle} disabled={!isSupported || permission === 'denied'}>
            {isSubscribed ? '끄기' : '켜기'}
          </button>
        </div>
      </div>

      <InstallPrompt />

      <button className="btn-danger btn-full" style={{ marginTop: 24 }} onClick={logout}>로그아웃</button>
    </div>
  );
}
```

- [ ] **Step 8: Verify dev server starts and pages render**

```bash
cd gifticon/frontend && npm run dev
```

Open http://localhost:5174/ and verify:
- OfflineIndicator appears when offline (DevTools > Network > Offline)
- Pages load without errors
- Registration creates local draft

- [ ] **Step 9: Commit**

```bash
git add gifticon/frontend/src/
git commit -m "feat(gifticon): migrate all pages to offline-first data layer"
```

---

## Task 8: Final verification and cleanup

**Files:**
- Modify: `gifticon/frontend/index.html` (cleanup if needed)

- [ ] **Step 1: Verify TypeScript compiles cleanly**

```bash
cd gifticon/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Verify build succeeds**

```bash
cd gifticon/frontend && npm run build
```

Expected: Build succeeds, `dist/` contains SW and manifest.

- [ ] **Step 3: Test offline scenario**

1. Open http://localhost:5174/
2. Register a gifticon (should save as draft)
3. Go to DevTools > Application > Service Workers > check "Offline"
4. Refresh page - gifticon list should still show the draft
5. Navigate to the draft detail page - image should load from IndexedDB
6. Uncheck "Offline" - sync should trigger automatically

- [ ] **Step 4: Remove unused old API imports if any remain**

Check each modified page file for lingering `import ... from '../api/gifticon'` that are no longer needed. Remove them.

- [ ] **Step 5: Final commit**

```bash
git add -A gifticon/frontend/
git commit -m "feat(gifticon): complete PWA offline app migration"
```
