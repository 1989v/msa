# Test Strategy: Client-Side OCR Migration

## Test Scope

### Unit Tests (프론트엔드)

| 대상 | 테스트 내용 | 도구 |
|------|-----------|------|
| 텍스트 파서 (만료일) | 3가지 패턴 + 엣지케이스 (잘못된 날짜, 빈 문자열) | Vitest |
| 텍스트 파서 (바코드) | 12-16자리 추출, 공백/하이픈 제거 | Vitest |
| 텍스트 파서 (브랜드) | 30+ 브랜드 매칭, 대소문자 무시 | Vitest |
| 이미지 전처리 | Canvas API mock, 리사이즈/grayscale 로직 | Vitest |

### Integration Tests (프론트엔드)

| 대상 | 테스트 내용 | 도구 |
|------|-----------|------|
| OCR 워크플로우 | 이미지 → 전처리 → OCR → 파싱 E2E | Vitest + Tesseract.js |
| RegisterGifticonPage | 이미지 선택 → OCR → 폼 자동입력 | React Testing Library |
| SyncEngine | OCR 메타데이터 포함 동기화 | Vitest |

### Backend Tests

| 대상 | 테스트 내용 | 도구 |
|------|-----------|------|
| GifticonService | OCR 호출 제거 후 메타데이터만 수신 동작 확인 | Kotest + MockK |
| 등록 API | 이미지 + 메타데이터 수신, OCR 없이 저장 | Kotest + MockMvc |

## Test Priority

1. **P0**: 텍스트 파서 (만료일/바코드/브랜드) — 핵심 비즈니스 로직 포팅
2. **P1**: RegisterGifticonPage OCR 통합 — UX 플로우 검증
3. **P1**: 백엔드 서비스 — OCR 제거 후 정상 동작
4. **P2**: 이미지 전처리 — Canvas API 의존, mock 복잡

### Golden-File Parity Tests (프론트엔드)

| 대상 | 테스트 내용 | 도구 |
|------|-----------|------|
| TextParser 포팅 검증 | Python app.py와 동일한 rawText 샘플을 입력하여 TypeScript 파서와 결과 일치 검증 | Vitest |

> `docker/ocr/app.py`에서 사용하는 실제 테스트 케이스를 추출하여 golden-file로 보관.
> Python `extract_expiry_date`/`extract_barcode`/`extract_brand`의 입출력 쌍을 TypeScript 테스트에서 동일하게 검증.

## Quality Gate

- 텍스트 파서 단위 테스트 커버리지 100%
- 등록 플로우 통합 테스트 통과
- 백엔드 기존 테스트 모두 통과
- 실제 기프티콘 이미지 3장 이상으로 수동 E2E 검증
