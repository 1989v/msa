<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/RegionPage.tsx, portal-fe/src/pages/place/__tests__/PlaceDiscovery.test.tsx -->
# 구현·검증

## 결과

구현 커밋: `b21ebdfcb0505163ea8f2afd140db9363d05acba`.

- 홈 ko/en 소개를 `placeHubIntro`로 통일했다. 프리렌더 본문과 런타임 부제가 같은 문장을 사용한다.
- 지역 본문은 `regionIntro`의 완전한 문장을 사용하고, 메타 설명에는 기존 길이 제한을 적용한다.
- 서울·제주·부산에 `regionVisitGuide` 안내를 ko/en으로 추가했다. SIDO 레벨과 코드가 일치할 때만 표시한다.
- 기존 타이틀·canonical·hreflang·robots·링크·수량 의미·속성 랜딩 설명·미로딩 처리·문단 클래스를 유지한다. 새 색인 정책·경로·백엔드·스타일은 추가하지 않았다.

## 수행한 검증

명시적 gpt-6.1-sol 구현 worker가 수행한 결과를 부모가 변경 내용 및 보고와 대조했다.

| 검증 | 실행·결과 |
|---|---|
| 생성 콘텐츠 | `node scripts/render-content.mjs` → exit 0 |
| FE 타입 | `npx tsc -b` → exit 0 |
| 관련 Vitest | 관광·공유 SEO·게임 회귀 **12 files / 262 tests passed** |
| 변경 TS/TSX lint | ESLint → exit 0 |
| 변경 MJS 문법 | `node --check` → exit 0 |
| FE 번들 | `npx vite build` → **✓ built in 1.53s** |
| 변경 점검 | `git diff --check` → exit 0 |
| 메타 보존 대조 | 지역 24/24, 홈 2/2 변경 전후 동일 |
| 확정 지역 안내 | 6/6 글자 단위 일치 |
| 정상 커밋 훅 | Doctor **100/100 PASS** |

새 통합 회귀는 SSR·런타임 홈, 3개 지역 × 2언어, 비대상 지역·레벨·미로딩·실패 시 메타 보존을 확인한다. 첫 타입 검사에서 JS의 null 기본인자 추론을 수정했고, 최종 검사에서 통과했다. 기존 테스트의 주입된 503·라우트·JSDOM 경고는 assertion 실패와 구분한다.

## 최신 main 통합 검증

다른 작업의 주문·광고 기술 화면이 main에 추가돼 충돌 없이 통합했다. 기존 전체 검증을 이유 없이 반복하지 않고, 새 통합의 공유 copy·FE 컴파일 영향을 worker가 한 번 확인했다.

통합 HEAD: `6ccdc3577219db3322c0246f35d1133d67e3517c`.

- `node scripts/render-content.mjs` → exit 0. 기존·신규 기술 drill 콘텐츠 생성.
- `npx tsc -b` → exit 0.
- PlaceDiscovery/placeCopy/prerenderPlace/copy/prerenderGames/gameSitemap/GamesPage.seo → **7 files / 146 tests passed**.
- `npx vite build` → **✓ built in 835ms**, exit 0.
- `git diff --check` → exit 0.

검증 전후 HEAD는 동일하며 새 코드 수정·push·운영 배포는 없었다. 다른 기여자의 변경과 generated 파일은 보존했다.

원래 작업 디렉터리에 문서 8개를 동기화한 커밋 `7e4569165`는 정상 훅을 실행해 완료됐다. 해당 디렉터리의 Doctor는 83/100 FAIL을 출력했고, 표시된 원인에는 기존 문서들의 source citation 누락이 있다. 이 전역 문서 진단을 통과했다고 주장하지 않는다. 위 FE 검증과 워크트리 커밋의 Doctor 100/100은 별도의 검증이며, 이번 변경에 속하지 않는 문서를 수정하거나 훅을 우회하지 않았다.

## 검증 경계

worker는 브라우저·컴퓨터 유즈·push·운영 배포·콘솔 제출을 수행하지 않았다. 부모의 Google 영문 서울 실시간 렌더 검사는 **현재 운영 버전**에 대한 것으로 이 커밋의 화면 검증이 아니다. 새 본문의 실제 브라우저 화면·운영 초기 HTML은 배포/별도 승인 범위에서 확인한다. 전체 게임 프리렌더 빌드는 로컬에서 재실행하지 않았다.
