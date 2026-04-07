# Tasks: Client-Side OCR Migration

## Group A: 프론트엔드 OCR 모듈 (독립 구현 가능)

### A-1: TextParser.ts 구현 + golden-file 테스트
- `gifticon/frontend/src/ocr/TextParser.ts` 생성
- `docker/ocr/app.py`의 `extract_expiry_date`, `extract_barcode`, `extract_brand` 포팅
- `KNOWN_BRANDS` 배열 포팅
- golden-file parity test: Python과 동일 입력에 동일 출력 검증
- **의존**: 없음

### A-2: ImagePreprocessor.ts 구현
- `gifticon/frontend/src/ocr/ImagePreprocessor.ts` 생성
- Canvas API: resize(1500px), grayscale, contrast enhance
- 선택적 하단 40% crop (토글 가능)
- **의존**: 없음

### A-3: OcrEngine.ts 구현
- `gifticon/frontend/src/ocr/OcrEngine.ts` 생성
- Tesseract.js Worker 관리 (lazy init, 30초 유휴 종료)
- `recognizeImage(file): Promise<OcrResult>` API
- `preloadEngine()`, `terminateEngine()` API
- `tessdata_fast` (kor+eng) self-hosted 모델 사용
- **의존**: A-1 (TextParser), A-2 (ImagePreprocessor)

### A-4: types.ts 생성
- `gifticon/frontend/src/ocr/types.ts` — OcrResult 인터페이스
- **의존**: 없음

### A-5: Tesseract.js 패키지 + 모델 파일 설정
- `npm install tesseract.js` 
- `public/ocr/` 디렉토리에 WASM + traineddata 배치
- **의존**: 없음

## Group B: Service Worker 캐싱

### B-1: sw.ts에 OCR 모델 캐싱 추가
- Workbox `registerRoute` + `CacheFirst` 전략
- `/ocr/*` 경로 매칭
- 캐시 이름: `ocr-models-v1`
- **의존**: A-5

## Group C: UI 통합

### C-1: RegisterGifticonPage.tsx 수정
- `handleImageSelect`에서 `recognizeImage()` 호출
- OCR 로딩 상태 (`ocrLoading`) + 스피너 UI
- OCR 결과로 폼 필드 자동입력
- OCR 실패 시 graceful degradation (수동 입력)
- **의존**: A-3 (OcrEngine)

## Group D: 백엔드 정리

### D-1: GifticonService에서 OCR 호출 제거
- `RegisterGifticonUseCase`에서 `OcrPort` 의존 제거
- 프론트에서 전달받은 메타데이터만 사용
- `ocrRawText` 필드 제거 cascade:
  - UseCase Result 클래스
  - Controller 응답 DTO
- 백엔드 테스트 수정
- **의존**: 없음

### D-2: OcrPort, OcrClientAdapter 삭제
- `OcrPort.kt` 삭제
- `OcrClientAdapter.kt` 삭제
- **의존**: D-1

### D-3: 설정 정리
- `application.yml`에서 `gifticon.ocr.url` 제거
- `application-docker.yml`에서 OCR 관련 설정 제거
- **의존**: D-2

## Group E: 인프라 정리

### E-1: docker/ocr/ 삭제 + docker-compose 수정
- `docker/ocr/` 디렉토리 삭제
- docker-compose에서 OCR 서비스 정의 제거
- `OCR_SERVICE_URL` 환경변수 제거
- **의존**: D-2

## Group F: 프론트엔드 타입 정리

### F-1: 프론트엔드 OCR 관련 타입/참조 정리
- `types/index.ts`에서 `ocrRawText` 관련 타입 제거 (있다면)
- `GifticonRepository`에서 서버 OCR 결과 처리 로직 제거/수정
- **의존**: C-1

## 병렬 실행 가능 구조

```
A-1, A-2, A-4, A-5, D-1  ← 동시 시작 가능
         ↓
A-3 (A-1 + A-2 의존)
         ↓
B-1, C-1 (A-3 의존)
         ↓
D-2 → D-3 → E-1  (순차)
         ↓
F-1 (C-1 의존)
```

## 예상 작업량
- Group A: 프론트엔드 OCR 코어 (~4 파일)
- Group B: SW 캐싱 (~1 파일 수정)
- Group C: UI 통합 (~1 파일 수정)
- Group D: 백엔드 정리 (~3-5 파일 수정/삭제)
- Group E: 인프라 정리 (~2-3 파일 수정/삭제)
- Group F: 타입 정리 (~1-2 파일 수정)
