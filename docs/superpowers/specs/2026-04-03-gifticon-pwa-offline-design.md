# Gifticon PWA Offline App Design

## Overview

기프티콘 프론트엔드를 완전한 오프라인 앱으로 업그레이드한다. 핵심은 서비스워커 교체가 아니라 **데이터 계층(api -> local store -> sync queue)** 신설이다.

## Goals

- 오프라인에서 기프티콘 조회, 등록(draft), 상태변경이 가능
- 온라인 복귀 시 자동 동기화
- 매장에서 인터넷 없이 바코드/이미지를 즉시 보여줄 수 있는 UX

## Non-Goals

- 공유 그룹의 외부 공유(초대 링크 등)는 온라인에서만 동작
- 전체 기프티콘 캐싱 (미사용 + 만료임박만 캐싱)

---

## Architecture

### Current State

```
Page Component --> api/client.ts --> Server API
```

모든 페이지가 서버 API에 직접 의존. 오프라인 시 전체 기능 불가.

### Target State

```
Page Component --> Repository --> IndexedDB (local store)
                                       |
                                       v
                              Sync Engine <--> Server API
                                   |
                              Mutation Queue
```

Repository 계층이 로컬 스토어를 1차 소스로 사용하고, Sync Engine이 백그라운드로 서버와 동기화.

---

## Tech Stack

| 역할 | 선택 | 이유 |
|------|------|------|
| SW 관리 | vite-plugin-pwa (injectManifest) | Workbox 캐시 전략 + 커스텀 SW 유지 |
| IndexedDB | idb (~1KB) | 가볍고 Promise 기반, 복잡한 쿼리 불필요 |
| Background Sync | Workbox Background Sync plugin + onLine 폴백 | iOS Safari 미지원 대응 |

---

## IndexedDB Schema

Database: `gifticon-offline-db`, version: 1

### Stores

#### `gifticons`
기프티콘 엔터티 로컬 캐시.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| id | string | primary (keyPath) | 서버 ID 또는 로컬 UUID (draft) |
| serverId | number? | unique | 서버에서 부여된 ID (draft면 null) |
| status | string | yes | ACTIVE, USED, EXPIRED, DRAFT |
| expiryDate | string? | yes | ISO date, 캐싱 우선순위 판단용 |
| brand | string? | | |
| productName | string? | | |
| barcodeNumber | string? | | |
| memo | string? | | |
| imageUrl | string? | | 서버 이미지 URL |
| localImageKey | string? | | images 스토어 참조 키 |
| userId | number | yes | 소유자 |
| updatedAt | string | yes | ISO timestamp, LWW 충돌 판단용 |
| syncStatus | string | yes | synced, pending, conflict |

#### `images`
이미지 Blob 저장. 기프티콘과 분리하여 메타데이터 쿼리 성능 유지.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| key | string | primary | `img-{gifticonId}` |
| blob | Blob | | 이미지 바이너리 |
| mimeType | string | | image/jpeg, image/png |
| cachedAt | string | yes | 캐시 시점, 정리용 |

#### `mutationQueue`
오프라인 변경사항 대기열. FIFO 순서로 서버에 replay.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| id | string | primary | auto-generated UUID |
| type | string | yes | CREATE, UPDATE_STATUS, UPDATE_DETAIL, DELETE |
| entityId | string | yes | 대상 gifticon ID |
| payload | object | | 변경 내용 (status, fields 등) |
| timestamp | string | yes | 클라이언트 시각 (LWW 기준) |
| retryCount | number | | 재시도 횟수 |
| status | string | yes | pending, in_flight, failed |

#### `viewHistory`
열람 기록. Append-only, 충돌 없음.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| id | string | primary | auto-generated |
| gifticonId | string | yes | |
| userId | number | yes | |
| viewedAt | string | yes | 열람 시점 |
| synced | boolean | yes | 서버 전송 여부 |

#### `syncMeta`
동기화 메타데이터.

| Field | Type | Description |
|-------|------|-------------|
| key | string (primary) | e.g. `lastSyncAt`, `lastFullFetchAt` |
| value | any | |

---

## Repository Layer

`src/data/` 디렉토리에 Repository 패턴으로 구성.

### 구조

```
src/data/
  db.ts                    # IndexedDB 초기화 (idb)
  repository/
    GifticonRepository.ts  # 기프티콘 CRUD (로컬 우선)
    ImageRepository.ts     # 이미지 Blob 저장/조회
    SyncRepository.ts      # mutationQueue, syncMeta 관리
    ViewHistoryRepository.ts
  sync/
    SyncEngine.ts          # 동기화 오케스트레이터
    SyncWorker.ts          # SW 내 Background Sync 핸들러
    ConflictResolver.ts    # 충돌 처리 정책
  hooks/
    useGifticons.ts        # 기존 API 호출 대체
    useGifticonDetail.ts
    useOfflineStatus.ts    # 온/오프라인 상태 관리
```

### GifticonRepository 핵심 메서드

```typescript
interface GifticonRepository {
  // 로컬 조회 (IndexedDB)
  getAll(userId: number): Promise<Gifticon[]>
  getById(id: string): Promise<Gifticon | undefined>

  // 로컬 저장 + mutation queue 적재
  createDraft(image: Blob, metadata?: Partial<GifticonMeta>): Promise<Gifticon>
  updateStatus(id: string, status: GifticonStatus, timestamp: string): Promise<void>
  updateDetail(id: string, fields: Partial<GifticonMeta>): Promise<void>
  delete(id: string): Promise<void>

  // 서버 동기화 결과 반영
  applyServerState(gifticons: ServerGifticon[]): Promise<void>
}
```

---

## Sync Engine

### 동기화 흐름

```
1. 온라인 감지 (navigator.onLine 또는 Background Sync 이벤트)
2. mutationQueue에서 pending 항목을 FIFO 순서로 처리
3. 각 mutation을 서버 API로 전송
   - 성공: queue에서 제거, 로컬 엔터티 syncStatus = synced
   - 409 충돌: ConflictResolver 호출
   - 네트워크 에러: retryCount++, 3회 초과 시 failed 마킹
4. mutation 처리 완료 후 서버에서 최신 목록 fetch
5. applyServerState로 로컬 반영
```

### 충돌 해결 정책 (ConflictResolver)

| 필드 유형 | 정책 |
|-----------|------|
| status (ACTIVE->USED 등) | 타임스탬프 LWW - 더 이른 시점의 변경 우선 |
| viewHistory | append-only, 충돌 없음 |
| 메타데이터 (brand, productName 등) | 서버 값 우선, 사용자에게 알림 |

### Background Sync (Service Worker)

Workbox의 `registerRoute` + `BackgroundSyncPlugin`은 사용하지 않는다.
mutation queue는 IndexedDB에서 직접 관리하므로, SW에서는 Background Sync API 이벤트를 받아 메인 스레드의 SyncEngine에 replay를 위임한다.

```typescript
// sw.ts 내부
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'mutation-sync') {
    event.waitUntil(
      // SW에서 직접 IndexedDB의 mutationQueue를 읽어 서버에 전송
      replayMutationQueue()
    );
  }
});
```

앱 코드에서 mutation 적재 시 sync 등록:

```typescript
// SyncEngine.ts
async function enqueueMutation(mutation: Mutation) {
  await syncRepository.addToQueue(mutation);
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('mutation-sync');
  }
}
```

### iOS 폴백

```typescript
// SyncEngine.ts
window.addEventListener('online', () => {
  if (!('SyncManager' in window)) {
    // Background Sync 미지원 - 직접 replay
    syncEngine.replayQueue();
  }
});
```

---

## Caching Strategy

### 스마트 캐싱 정책

| 대상 | 캐싱 조건 | 제거 조건 |
|------|-----------|-----------|
| 미사용(ACTIVE) 기프티콘 | 항상 캐싱 | 상태 변경 시 |
| 만료 7일 이내 | 우선 캐싱 + 이미지 포함 | 만료 후 7일 경과 |
| 사용완료(USED) | 캐시 제거 | 상태 변경 즉시 |
| 만료(EXPIRED) | 캐시 제거 | 만료 감지 즉시 |
| 공유받은 기프티콘 | ACTIVE만 캐싱 | 위와 동일 |

### 이미지 캐싱

- 이미지는 IndexedDB `images` 스토어에 Blob으로 저장
- 서버 imageUrl 대신 로컬 Blob URL 우선 사용
- 캐시 정리: 기프티콘 제거 시 연관 이미지도 삭제

### Service Worker 캐시 전략

```
정적 자산 (JS, CSS, HTML): precache (vite-plugin-pwa 자동)
API 응답: NetworkFirst (온라인 시 서버 우선, 실패 시 캐시)
이미지: CacheFirst (로컬 우선, 없으면 네트워크)
```

---

## Registration Flow Redesign

### Current Flow
```
이미지 선택 --> registerGifticon(file) --> OCR + 서버 등록 (동시)
```

### New Flow
```
이미지 선택 --> 로컬 draft 생성 (IndexedDB)
                   |
                   +--> 사용자 수동 입력 (선택적: 브랜드, 만료일, 바코드)
                   |
                   +--> 목록에 "등록 대기" 또는 수동입력된 카드로 표시
                   |
           [온라인 복귀]
                   |
                   +--> OCR 실행
                   |
                   +--> OCR 결과 병합:
                          - 빈 필드: 자동 채움
                          - 사용자 입력 있는 필드: 사용자 값 유지
                          - expiryDate/barcodeNumber 불일치: 사용자 확인 UI
                   |
                   +--> 서버 등록 (승격)
                   |
                   +--> 로컬 draft -> synced 전환
```

### Draft 상태 표시

- 목록에서 draft는 점선 테두리 + "동기화 대기" 뱃지
- 메타데이터 입력 없는 draft: 이미지 썸네일 + "OCR 대기" 표시
- 메타데이터 입력된 draft: 일반 카드와 동일하되 "동기화 대기" 뱃지

---

## Share Group Offline Behavior

| 기능 | 오프라인 | 온라인 |
|------|---------|--------|
| 그룹 목록 조회 | 로컬 캐시 | 서버 fetch + 캐시 갱신 |
| 그룹 생성 | 로컬 생성 (임시 UUID) | mutation queue로 서버 생성 |
| 멤버 추가 | 로컬 추가 | mutation queue로 서버 반영 |
| 기프티콘 공유 | 로컬 매핑 | mutation queue로 서버 반영 |
| 초대 링크 공유 | **불가** (온라인 필요 표시) | 서버에서 링크 생성 |

---

## Offline Status UX

### 상태 표시
- 상단 바에 온/오프라인 인디케이터 (아이콘 + 색상)
- 오프라인 진입 시 토스트: "오프라인 모드 - 변경사항은 자동 동기화됩니다"
- 온라인 복귀 시 토스트: "동기화 중..." -> "동기화 완료"

### 동기화 대기 표시
- 미동기화 항목 수 뱃지 (설정 페이지 또는 하단 네비게이션)
- 설정 페이지에 동기화 상태 섹션: 대기 N건, 실패 N건, 마지막 동기화 시각

---

## File Changes Summary

### New Files
```
src/data/db.ts
src/data/repository/GifticonRepository.ts
src/data/repository/ImageRepository.ts
src/data/repository/SyncRepository.ts
src/data/repository/ViewHistoryRepository.ts
src/data/sync/SyncEngine.ts
src/data/sync/SyncWorker.ts          # SW용 (injectManifest에서 import)
src/data/sync/ConflictResolver.ts
src/data/hooks/useGifticons.ts
src/data/hooks/useGifticonDetail.ts
src/data/hooks/useOfflineStatus.ts
src/sw.ts                            # 기존 public/sw.js 대체 (TypeScript)
```

### Modified Files
```
vite.config.ts                       # vite-plugin-pwa 설정 추가
package.json                         # idb, vite-plugin-pwa 의존성
src/main.tsx                         # SW 등록 로직 제거 (vite-plugin-pwa가 처리)
src/pages/MyGifticonsPage.tsx        # API 직접 호출 -> useGifticons hook
src/pages/GifticonDetailPage.tsx     # API 직접 호출 -> useGifticonDetail hook
src/pages/RegisterGifticonPage.tsx   # draft 기반 등록 플로우로 재설계
src/pages/ShareGroupsPage.tsx        # 로컬 캐시 기반으로 전환
src/pages/SettingsPage.tsx           # 동기화 상태 섹션 추가
src/components/GifticonCard.tsx      # draft/sync 상태 뱃지 표시
src/App.tsx                          # 오프라인 인디케이터, InstallPrompt 통합
```

### Deleted Files
```
public/sw.js                         # src/sw.ts로 대체
```

---

## Migration Strategy

기존 기능을 깨지 않으면서 점진적으로 전환:

1. **Phase 1: 기반** - idb, vite-plugin-pwa 도입, IndexedDB 스키마, Repository 스켈레톤
2. **Phase 2: 읽기 오프라인화** - 기프티콘 목록/상세를 Repository 경유로 전환, 이미지 캐싱
3. **Phase 3: 쓰기 오프라인화** - mutation queue, 상태변경 오프라인 지원
4. **Phase 4: 등록 재설계** - draft 기반 등록, OCR 병합 로직
5. **Phase 5: 동기화** - SyncEngine, Background Sync, iOS 폴백
6. **Phase 6: UX 마무리** - 오프라인 인디케이터, 충돌 확인 UI, 설정 페이지
