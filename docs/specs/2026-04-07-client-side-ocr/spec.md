# Spec: Client-Side OCR Migration

> 기프티콘 OCR을 서버(Python Tesseract)에서 클라이언트(Tesseract.js)로 이전.
> 이미지 선택 즉시 만료일/바코드/브랜드를 자동 인식하고, 서버 OCR 인프라를 제거한다.

## 1. Overview

### 현재 상태
```
이미지 선택 → IndexedDB draft → 서버 동기화 → 서버 OCR → 결과 반환 → 충돌 해결
```

### 목표 상태
```
이미지 선택 → 클라이언트 OCR (즉시) → 폼 자동입력 → IndexedDB draft → 서버 동기화 (메타데이터만)
```

### 변경 범위
- **추가**: 프론트엔드 OCR 모듈 (Tesseract.js + 전처리 + 파서)
- **수정**: RegisterGifticonPage, SyncEngine, 백엔드 GifticonService
- **삭제**: `docker/ocr/`, 백엔드 OcrPort/OcrClientAdapter

## 2. Frontend: OCR Module

### 2.1 디렉토리 구조

```
gifticon/frontend/src/
├── ocr/
│   ├── OcrEngine.ts          # Tesseract.js Worker 관리
│   ├── ImagePreprocessor.ts   # Canvas 전처리 파이프라인
│   ├── TextParser.ts          # 만료일/바코드/브랜드 추출 (app.py 포팅)
│   └── types.ts               # OcrResult 타입
```

### 2.2 OcrEngine.ts

Tesseract.js Worker 생명주기 관리:

```typescript
// 핵심 API
export async function recognizeImage(imageSource: File | Blob): Promise<OcrResult>
export async function preloadEngine(): Promise<void>  // Service Worker에서 호출
export function terminateEngine(): void               // 메모리 해제
```

동작:
1. Worker가 없으면 `createWorker('kor+eng')` 호출 (lazy init)
2. `tessdata_fast` 모델 사용 — CDN 또는 self-hosted에서 로드
3. 이미지 전처리 후 `worker.recognize()` 실행
4. 결과 텍스트를 `TextParser`로 파싱
5. 사용 후 일정 시간(30초) 유휴 시 Worker 종료 (메모리 관리)

### 2.3 ImagePreprocessor.ts

Canvas API 기반 전처리:

```typescript
export async function preprocessImage(file: File): Promise<Blob>
```

파이프라인:
1. **리사이즈**: 최대 너비 1500px (비율 유지)
2. **Grayscale**: RGB → Luma 변환
3. **Contrast 강화**: histogram stretching
4. **하단 크롭 (선택)**: 이미지 하단 40% 영역 — 만료일이 주로 하단에 위치

> 하단 크롭은 실험적 — 정확도 비교 후 토글 가능하게 구현

### 2.4 TextParser.ts

`docker/ocr/app.py` 로직의 TypeScript 포팅:

```typescript
export function parseOcrText(rawText: string): ParsedResult

interface ParsedResult {
  brand: string | null
  productName: string | null  // null (현재도 서버에서 null 반환)
  barcodeNumber: string | null
  expiryDate: string | null   // ISO format: "YYYY-MM-DD"
}
```

**만료일 패턴** (기존 서버 로직 동일):
1. `(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일`
2. `(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})`
3. `~\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})`

**바코드 패턴**: 공백/하이픈 제거 후 `\d{12,16}` 매칭

**브랜드**: OCR 자동 인식 안 함 — 사용자 수동 입력. 하드코딩 브랜드 목록은 유지보수 부담이 크고 OCR 텍스트 매칭 정확도가 낮아 제거.

### 2.5 types.ts

```typescript
export interface OcrResult {
  rawText: string
  brand: string | null
  productName: string | null
  barcodeNumber: string | null
  expiryDate: string | null
}
```

## 3. Frontend: UI 변경

### 3.1 RegisterGifticonPage.tsx 수정

현재: 이미지 선택 → 수동 입력 (OCR은 서버 동기화 후)
변경: 이미지 선택 → **즉시 OCR** → 폼 자동입력

```
handleImageSelect(file)
  → setImage(file)
  → setOcrLoading(true)
  → recognizeImage(file)
  → setOcrLoading(false)
  → 폼 필드 자동입력 (brand, barcodeNumber, expiryDate)
  → 사용자가 수정 가능
```

UI 추가:
- OCR 진행 중: 스피너 + "이미지 인식 중..." 텍스트
- OCR 완료: 자동입력된 필드에 "OCR" 뱃지 표시 (사용자가 수정했는지 구분)
- OCR 실패: 무시하고 수동 입력 유도 (에러 토스트 불필요 — graceful)

### 3.2 OcrConflictModal 처리

현재 구조에서 OcrConflictModal은 서버 OCR 결과와 로컬 입력 간 충돌을 해결한다.
클라이언트 OCR로 이전하면 OCR 즉시 실행 → 폼 자동입력이므로:

- **충돌이 발생하지 않음** (OCR 결과가 곧 초기값, 사용자가 직접 수정)
- OcrConflictModal은 **제거하지 않고 보존** — 향후 서버 OCR 도입 시 재활용 가능
- 단, 현재 플로우에서는 호출되지 않음

## 4. Frontend: Service Worker 캐싱

### 4.1 OCR 모델 캐싱 전략

기존 `sw.ts`에 OCR 모델 캐싱 로직 추가. 현재 sw.ts에는 runtime caching route가 없으므로
Workbox `registerRoute` + `CacheFirst` 전략을 새로 구현해야 함.

**모델 호스팅**: self-hosted (프론트엔드 `public/ocr/` 디렉토리)
- CORS 이슈 없음, 오프라인 신뢰성 확보, 버전 관리 용이
- CDN 사용 시 외부 의존성 + CORS 설정 필요 → self-hosted 선택

```
캐시 이름: 'ocr-models-v1'
캐시 대상 (public/ocr/):
  - tesseract-core.wasm (~2.5MB gzipped)
  - kor.traineddata (~2.5MB)
  - eng.traineddata (~1MB)
전략: CacheFirst (Workbox registerRoute)
```

lazy 캐싱: OCR 최초 사용 시 캐시에 저장. precache하지 않음 (5MB+ 초기 로드 방지).

### 4.2 preloadEngine

앱 시작 시 또는 등록 페이지 진입 시 `preloadEngine()` 호출 가능:
- 모델이 캐시에 있으면 즉시 Worker 초기화 (~1초)
- 캐시에 없으면 다운로드 + 캐시 + Worker 초기화 (~3-5초, 네트워크 의존)

## 5. Frontend: SyncEngine 변경

### 5.1 CREATE mutation 변경

현재 `replayMutation`의 CREATE 케이스:
- 서버로 이미지 + 메타데이터 전송
- 서버가 OCR 수행 후 저장

변경:
- 서버로 이미지 + **OCR 결과 메타데이터** 전송
- 서버는 메타데이터를 그대로 저장 (OCR 수행 안 함)

변경 범위가 작음 — 이미 메타데이터를 전송하는 구조이므로, 서버 쪽에서 OCR 호출만 제거하면 됨.

## 6. Backend 변경

### 6.1 삭제 대상

| 파일 | 이유 |
|------|------|
| `OcrPort.kt` | 클라이언트 OCR로 대체 |
| `OcrClientAdapter.kt` | OCR 서비스 호출 불필요 |
| `docker/ocr/` 전체 | Python OCR 서비스 제거 |
| `application.yml`의 `gifticon.ocr.url` | 설정 잔여물 제거 |
| `docker-compose.yml`의 `OCR_SERVICE_URL` | 환경변수 잔여물 제거 |

### 6.2 GifticonService 수정

기프티콘 등록 시:
- 기존: 이미지 저장 → OCR 수행 → 메타데이터 병합 → 저장
- 변경: 이미지 저장 → **프론트에서 전달받은 메타데이터 사용** → 저장

`RegisterGifticonUseCase`(또는 `GifticonService`) 에서 `OcrPort` 의존 제거.

**`ocrRawText` 제거 cascade**:
- `RegisterGifticonUseCase.Result.ocrRawText` 필드 제거
- Controller 응답 DTO에서 `ocrRawText` 제거
- 프론트엔드 `types/index.ts`에서 `ocrRawText` 타입 제거 (있다면)
- `GifticonRepository.applyServerState()`에서 `ocrRawText` 참조 제거 (있다면)

### 6.3 API 변경

등록 API (`POST /api/gifticons`) 시그니처는 **변경 없음**:
- 여전히 `image` (multipart) + `metadata` (JSON) 수신
- 응답에서 `ocrRawText` 필드 제거 (더 이상 서버에서 OCR하지 않으므로)

## 7. Docker 변경

### 7.1 docker-compose에서 OCR 서비스 제거

`docker/docker-compose.yml` (또는 관련 compose 파일)에서:
- `ocr` 서비스 정의 삭제
- 다른 서비스의 `depends_on: ocr` 제거 (있다면)

### 7.2 docker/ocr/ 디렉토리 삭제

- `docker/ocr/app.py`
- `docker/ocr/Dockerfile`
- `docker/ocr/requirements.txt`

## 8. Migration Plan

### Phase A: 프론트엔드 OCR 모듈 구현
1. `TextParser.ts` 구현 + 단위 테스트 (서버 로직 포팅)
2. `ImagePreprocessor.ts` 구현
3. `OcrEngine.ts` 구현 (Tesseract.js 통합)
4. Service Worker 캐싱 추가

### Phase B: UI 통합
5. `RegisterGifticonPage.tsx` 수정 — 이미지 선택 시 즉시 OCR
6. OCR 로딩 UI 추가

### Phase C: 백엔드 정리
7. `GifticonService`에서 OCR 호출 제거
8. `OcrPort`, `OcrClientAdapter` 삭제
9. 백엔드 테스트 수정

### Phase D: 인프라 정리
10. `docker/ocr/` 삭제
11. docker-compose 수정

## 9. Rollback Plan

클라이언트 OCR 문제 발생 시:
- `docker/ocr/` 는 git 히스토리에서 복원 가능
- 백엔드 `OcrPort`/`OcrClientAdapter` 도 git에서 복원
- 프론트엔드 OCR 모듈은 feature flag 없이 바로 제거 가능 (독립 모듈)

## 10. Risks

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| tessdata_fast 정확도 부족 | 중 | 중 | `tessdata` (16MB)로 업그레이드 가능 |
| 저사양 모바일 OOM | 낮 | 중 | 이미지 리사이즈 + Worker 즉시 종료 |
| iOS PWA Worker 제한 | 낮 | 높 | 메인 스레드 fallback 구현 |
