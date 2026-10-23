# 모바일 브라우저 PWA 설치 메뉴 — 게시 변경

## 기준 및 구현

- 기준: `origin/main`의 `efa32d6d3`, 격리 작업트리 `/private/tmp/msa-service-pwa-publish-20261023`.
- 기존 `AppInstallProvider`와 nginx `/app.webmanifest`의 페이지별 설치 모델을 재사용한다. URL query/hash 제외·경로/이름 정제·검색 `/search.webmanifest` 식별자·resume 호스트 비공개 정책은 보존한다. 이전 로컬의 별도 provider/정적 manifest 구현은 옮기지 않는다.
- Android(태블릿 포함), iPhone/iPad, iPadOS MacIntel+멀티터치 및 UA-CH mobile 신호로 설치 UI 표시 여부를 결정한다. 화면 너비는 판정에 사용하지 않으며, standalone/iOS standalone에서는 숨긴다.
- 데스크탑도 기존 manifest를 유지하고 `beforeinstallprompt`를 가로채지 않아 브라우저 자체 설치 기능을 사용할 수 있다.
- GNB 설치 버튼은 기존 햄버거 서랍으로 이동한다. 모바일 태블릿처럼 화면이 넓어도 설치 메뉴에 접근할 수 있다. 일반 메뉴는 보존한다.
- 자체 서비스 헤더는 공통 `AppInstallMenu`를 사용한다. 설치 버튼 클릭 시 서랍을 동기적으로 닫은 후 기존 install 함수를 호출하여 사용자 활성화를 유지하고 수동 안내 시트가 중첩되지 않게 한다.

## 변경 파일

- 설치 수명주기·기기 판정: `portal-fe/src/components/shell/AppInstall.tsx`, `portal-fe/src/shell/appInstall.ts`.
- 재사용 메뉴·스타일: 신규 `portal-fe/src/components/shell/AppInstallMenu.tsx`, `portal-fe/src/components/shell/AppInstall.css`.
- GNB: `portal-fe/src/components/GNB.tsx`, `GNB.css`.
- 자체 헤더: `portal-fe/src/components/ShopHeader.tsx`, `portal-fe/src/pages/UnifiedSearchPage.tsx`, `blog/BlogShell.tsx`, `deal/DealPage.tsx`, `place/{PlacePage,RegionPage,AttractionPage}.tsx`, `rank/{RankPage,RankBoardPage,CafePage}.tsx`.
- 테스트: `portal-fe/src/components/shell/__tests__/AppInstall.test.tsx`.

## 검증 (2026-10-23)

작업트리의 portal-fe에서 실행했다. `npm ci --cache /private/tmp/service-pwa-publish-npm-cache --ignore-scripts`로 잠금 파일의 의존성을 설치하고, `node scripts/render-content.mjs`로 기존 콘텐츠 생성 절차를 수행했다. 의존성·잠금 파일은 수정하지 않았다.

- 변경 전 `npx vitest run src/components/shell/__tests__/AppInstall.test.tsx`: `Test Files 1 passed (1)`, `Tests 28 passed (28)`.
- 변경 후 동일 명령: `Test Files 1 passed (1)`, `Tests 44 passed (44)`.
- `npx vitest run src/components/shell/__tests__/AppInstall.test.tsx src/pages/__tests__/UnifiedSearchPage.test.tsx src/pages/rank/__tests__/CafePage.test.tsx src/pages/deal/__tests__/DealPage.test.tsx`: `Test Files 4 passed (4)`, `Tests 87 passed (87)`.
- `npx tsc -b`: exit 0.
- 변경 TS/TSX 파일 ESLint: CafePage 이외 전부 exit 0. CafePage에는 기존 오류 4건(`react-refresh/only-export-components` 40행 및 `react-hooks/set-state-in-effect` 72~74행)이 있다. `git show HEAD:portal-fe/src/pages/rank/CafePage.tsx | npx eslint --stdin --stdin-filename src/pages/rank/CafePage.tsx`로 수정 전 동일 오류 4건을 재현했다. 관련 없는 코드·테스트를 변경하거나 lint를 무력화하지 않았다.
- `npx vite build --outDir /private/tmp/service-pwa-publish-dist`: exit 0, `2890 modules transformed`, `✓ built in 468ms`. 외부 outDir 경고가 있다. 전체 SEO crawl은 반복하지 않았다.
- `git diff --check`: exit 0.

컴퓨터 사용·브라우저/CDP·실제 OS 설치·배포 검증은 수행하지 않았다. 원래 공유 작업트리와 그 인덱스는 수정하지 않았다. 커밋·원격 푸시는 부모 세션에서 최종 검토 후 진행한다.
