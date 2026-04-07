# ADR-0010: 기프티콘 OCR을 클라이언트 사이드로 이전

## Status
Proposed

## Context
현재 기프티콘 이미지 OCR은 별도 Python FastAPI 서비스(`docker/ocr/`)에서 Tesseract를 이용해 수행된다.
프론트엔드는 이미지를 서버에 동기화한 뒤에야 OCR 결과를 받을 수 있어, 오프라인 환경에서 즉시 인식이 불가능하다.

PWA로 서빙 예정이며, offline-first 아키텍처(IndexedDB + SyncEngine)가 이미 구축되어 있다.
서버와 클라이언트가 동일한 Tesseract 엔진을 사용하므로, 서버 OCR은 이중 실행에 해당한다.

## Decision
- **Tesseract.js**(WASM)를 프론트엔드에 도입하여 클라이언트 사이드 OCR 수행
- `tessdata_fast` 모델(kor+eng) 사용, Service Worker로 캐싱
- 서버 OCR 인프라 제거: `docker/ocr/`, 백엔드 `OcrPort`/`OcrClientAdapter`
- 서버는 프론트에서 전달한 메타데이터(brand, barcodeNumber, expiryDate)만 수신하여 저장
- 기존 텍스트 파싱 로직(`app.py`)을 TypeScript로 포팅

## Alternatives Considered
- **하이브리드 (클라이언트 1차 + 서버 보정)**: 같은 Tesseract이므로 서버 재실행 의미 없음
- **Naver Clova OCR (서버)**: 네트워크 필수, 오프라인 지원 불가, 비용 발생. 정확도 이슈 발생 시 별도 검토
- **현상 유지**: PWA 오프라인 경험과 맞지 않음, UX 지연 지속

## Consequences
- 이미지 선택 즉시 OCR 결과 확인 가능 (UX 개선)
- 서버 OCR 서비스 제거로 인프라 단순화 (Docker 서비스 1개 감소)
- 프론트엔드 번들에 ~5MB (WASM + 언어팩) 추가, Service Worker 캐싱으로 1회만 다운로드
- 모바일 기기에서 2-8초 처리 시간 발생
- 정확도 한계 시 서버 측 상용 OCR(Clova 등) 도입을 별도 ADR로 추진 가능
