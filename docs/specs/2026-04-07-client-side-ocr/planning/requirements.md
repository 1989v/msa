# Requirements: Client-Side OCR Migration

## Background

현재 gifticon 서비스의 OCR은 서버 사이드(Python FastAPI + Tesseract)에서 실행된다.
이미지 등록 → 서버 동기화 → 서버 OCR → 결과 반환 순서로 동작하여,
오프라인 상태에서는 OCR 결과를 확인할 수 없고 UX 지연이 발생한다.

PWA로 서빙할 예정이므로, OCR을 클라이언트(브라우저)로 이전하여
이미지 선택 즉시 만료일 등을 자동 인식하는 경험을 제공한다.

## Goals

1. **즉시 인식**: 이미지 선택 시 브라우저에서 OCR 수행 → 만료일/바코드/브랜드 즉시 자동입력
2. **오프라인 지원**: Service Worker 캐싱으로 OCR 엔진/모델 오프라인 사용 가능
3. **서버 OCR 제거**: 동일 엔진(Tesseract) 이중 실행 제거 → 서버 부하 감소, 인프라 단순화
4. **기존 UX 유지**: OcrConflictModal 등 기존 충돌 해결 UI 재활용 (클라이언트 OCR ↔ 사용자 수동 입력)

## Non-Goals

- OCR 엔진 변경 (Naver Clova, Google Vision 등) — 추후 정확도 이슈 발생 시 별도 검토
- 바코드 스캐너 기능 추가 (Barcode Detection API) — 별도 피처
- 서버 사이드 OCR fallback 유지 — 같은 Tesseract이므로 의미 없음

## Functional Requirements

### FR-1: 클라이언트 OCR 엔진 통합
- Tesseract.js (v5+) WASM 기반 OCR을 프론트엔드에 통합
- 한국어 + 영어 언어팩 (`kor+eng`) 사용
- `tessdata_fast` 모델 사용 (경량, ~2.5MB kor + ~2.5MB WASM core)
- Web Worker에서 실행하여 메인 스레드 블로킹 방지

### FR-2: 이미지 전처리
- Canvas API를 이용한 전처리 파이프라인:
  - 리사이즈 (최대 1500px 너비)
  - Grayscale 변환
  - Contrast 강화
  - 선택적 하단 크롭 (만료일은 보통 기프티콘 하단에 위치)

### FR-3: 텍스트 파싱 (기존 로직 포팅)
- 현재 서버(`docker/ocr/app.py`)의 파싱 로직을 TypeScript로 포팅:
  - 만료일 추출: 3가지 정규식 패턴
  - 바코드 추출: 12-16자리 숫자 패턴
  - 브랜드 인식: 30+ 한국 브랜드 매칭
- 동일한 `OcrResult` 구조 유지 (rawText, brand, productName, barcodeNumber, expiryDate)

### FR-4: 등록 플로우 변경
- `RegisterGifticonPage`: 이미지 선택 즉시 OCR 실행
- OCR 진행 중 로딩 인디케이터 표시
- OCR 완료 시 폼 필드 자동 입력 (사용자가 수정 가능)
- OCR 실패 시 기존대로 수동 입력 가능 (graceful degradation)

### FR-5: OCR 모델 캐싱
- Service Worker를 이용한 Tesseract WASM + 언어팩 캐싱
- 최초 사용 시 "OCR 엔진 준비 중" 프로그레스 표시
- 이후 캐시에서 즉시 로드

### FR-6: 서버 OCR 인프라 제거
- `docker/ocr/` 디렉토리 제거 (Python FastAPI OCR 서비스)
- `docker-compose`에서 OCR 서비스 정의 제거
- 백엔드 `OcrPort`, `OcrClientAdapter` 제거
- `GifticonService`에서 OCR 호출 로직 제거 → 프론트에서 전달받은 메타데이터만 사용
- 기프티콘 등록 API는 이미지 + 메타데이터(brand, barcodeNumber, expiryDate) 수신 유지

### FR-7: SyncEngine 변경
- CREATE mutation: OCR 결과를 메타데이터에 포함하여 서버 전송
- 서버는 프론트에서 전달한 메타데이터를 그대로 저장 (별도 OCR 수행 안함)

## Non-Functional Requirements

### NFR-1: 성능
- OCR 처리 시간: 모바일 기준 5초 이내
- 초기 OCR 엔진 다운로드: 5MB 이내 (gzipped)
- 메모리 사용: 피크 200MB 이내

### NFR-2: 호환성
- Chrome/Edge (Android) 지원
- Safari (iOS 15+) 지원
- PWA(Add to Home Screen) 환경에서 카메라 접근 정상 동작

### NFR-3: 오프라인
- OCR 엔진 캐싱 후 네트워크 없이 OCR 수행 가능
- 기존 offline-first 동기화 패턴과 일관성 유지

## Affected Components

| 컴포넌트 | 변경 유형 |
|---------|---------|
| `gifticon/frontend/` | 수정 — Tesseract.js 통합, 전처리, 파싱 |
| `gifticon/frontend/src/pages/RegisterGifticonPage.tsx` | 수정 — OCR 자동 실행 |
| `gifticon/frontend/src/data/sync/SyncEngine.ts` | 수정 — OCR 메타데이터 전송 |
| `gifticon/app/.../port/OcrPort.kt` | 삭제 |
| `gifticon/app/.../adapter/OcrClientAdapter.kt` | 삭제 |
| `gifticon/app/.../service/GifticonService.kt` | 수정 — OCR 호출 제거 |
| `docker/ocr/` | 삭제 |
| `docker/docker-compose*.yml` | 수정 — OCR 서비스 제거 |

## Open Questions

- Q1: `tessdata_fast` 정확도가 실제 기프티콘 이미지에서 충분한지 → PoC로 검증 필요
- Q2: iOS PWA에서 카메라 접근이 안정적인지 → 현재 `<input capture>` 사용 중이므로 큰 이슈 없을 것으로 예상
- Q3: 저사양 모바일(2GB RAM)에서 OOM 발생 가능성 → 이미지 리사이즈 + Worker 종료로 완화
