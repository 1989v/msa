# WU-21 FE 검증 (2026-10-16)

## 구현 범위

- 시장 섹션은 `/api/v1/place/markets/dishes` 사전을 React Query 공용 키 `market-dishes`로 받는다. `staleTime`·`gcTime`은 1일. 사전 실패 시 기존 문자열 검색은 유지한다.
- NFKC·공백 제거·소문자 정규화, 이름 0 → 품목 1 → 메뉴 2 → 업종 3 → 관련 업종 4. 음식 사전은 `dish` 또는 `dishEn` 전체 정규화 일치와 `categorySub` 정확 일치로만 확장한다.
- 목록·지도 선택 시트에 관련 업종 구분, 착한가격 메뉴/가격/출처, TourAPI 대표·취급 메뉴/출처를 표시한다. 별도 `restaurants[]`는 관광지 상세 링크와 함께 섹션 하단에 표시한다.
- 선택 영문 필드 `nameEn/categoryEn/itemsEn`, `tourMenu.firstMenuEn/treatMenuEn`을 사용하고 누락 시 한글로 대체한다.
- 위치 안내는 SVG 아래에 놓는다. 가게 0개 도로 칩은 접되 선택 칩은 보존한다.

## 명령 및 결과

실행 위치: `portal-fe/`. npm 기본 캐시 쓰기 제한을 피하려고 `npm_config_cache=/private/tmp/wu21-npm-cache`를 사용했다.

1. `node scripts/render-content.mjs`
   - `[render-content] .../src/pages/place/generated/guides — 편집 페이지 3장`
2. `npx tsc -b`
   - exit 0 (출력 없음). 마지막 실행 래퍼 출력: `tsc exit=0`.
3. `npx vitest run src/pages/place src/api/__tests__/marketSearchApi.test.ts`
   - `Test Files  37 passed (37)`
   - `Tests  596 passed (596)`
   - `Duration  8.89s`
4. 변경 TS/TSX 파일 12개의 `npx eslint <files>`
   - exit 0 (출력 없음). 래퍼 출력: `eslint exit=0`.
5. `git diff --check -- portal-fe`
   - exit 0 (출력 없음).

전체 place 테스트의 다른 화면 테스트에서 jsdom 요청 `AggregateError` 및 기존 React 경고가 stderr에 남지만 위 테스트 결과는 전부 통과했다. 로그: `/private/tmp/wu21-final-vitest.log`.

## 회귀 주입

`marketView.ts`에서 관련 업종 반환 분기만 임시 제거 후 실행:

`npx vitest run src/pages/place/__tests__/marketView.test.ts -t 'expands only exact normalized dishes'`

- exit 1.
- `Tests  1 failed | 40 skipped (41)`
- `expected null to deeply equal { matchedBy: 'related', rank: 4, …(1) }`
- `try/finally`로 주입 직전 파일 전체를 복원한 뒤 위 전체 suite와 타입 검사를 통과했다. 로그: `/private/tmp/wu21-regression.log`.

## 계약 및 한계

- 진행 중인 WU-20의 최신 Kotlin DTO를 읽어 영문 필드 위치를 확인했다. backend 파일은 수정하지 않았다.
- `/markets/search`의 `StoreSummary`에는 현재 `tourMenu`가 없다. FE 타입은 선택 필드로 호환하되 실제 값이 없으면 TourAPI 메뉴를 만들어 내지 않는다.
- 착한가격 `nameEn` 및 음식점 목록의 선택 영문 필드는 응답에 있을 때만 쓴다. 현재 backend가 주지 않는 번역을 생성하지 않는다.
- 브라우저·CDP·컴퓨터 사용은 하지 않았다. 광장·남대문 국문·영문 실화면 검증은 별도 승인/수행이 필요하다.
- 커밋·스테이징은 하지 않았다.
