# 스펙 E(place-hub-mobile-perf) TG5.1·5.2 — 회귀 주입(SR-5.3) · 프리렌더 산출물 diff(SR-5.5)

- 2026-10-09 KST. 임시 사본 `scratchpad/wt-inject-e`(detached `e27ec1639`), 원본 wt-impl·메인 트리는 손대지 않음. 끝난 뒤 사본 제거.
- 사본 준비: 서브모듈 ai·auth·gifticon 을 메인 `.git/modules` 에서 `clone --shared` + 포인터 sha checkout. `portal-fe/node_modules` 는 wt-impl 것 심링크(package-lock.json `cmp` 동일 확인).
- 주입 전 기준선: vitest `src/pages/place src/seo src/pages/search src/components/home` 26 파일 362 passed. Kotlin `AttractionSeoTextTest` 6/0, `AttractionPageRendererTest` 73/0, `SecureImageParityTest` 10/0.
- 각 주입은 한 번에 하나, 대상 테스트만 돌린 뒤 `git checkout -- .` 로 되돌리고 `git status --porcelain` 이 비었는지 확인(13건 모두 clean). 골든 테스트는 `UPDATE_RENDER_GOLDEN` 없이 돌렸다.
- 컴파일 여부: 주입마다 따로 `npx tsc -b`(FE)·`compileKotlin`/`compileTestKotlin`(Kotlin)를 돌렸다. FE 는 기준선에도 있는 오류 2건(`routes.test.tsx` 의 생성 파일 `search-architecture.json` 부재)만 나왔고 주입 때문에 생긴 오류는 0건이다. Kotlin 은 종료 0. 7번은 첫 판(`url: u`)에서 `secureImageUrl` import 가 안 쓰여 TS6133 이 났다. 그래서 `url: secureImageUrl === undefined ? '' : u` 로 바꿔 tsc 를 통과시킨 뒤 다시 쟀다.
- 빨강은 모두 해당 단언의 실패다(구문 오류 아님). 같은 파일의 다른 테스트가 통과하므로 모듈은 정상 로드됐다. 실패한 테스트 이름은 `scratchpad/inject-e/inj*.log` 에 있다.

## SR-5.3 회귀 주입

| # | 주입 | 대상 테스트 | 결과 |
|---|---|---|---|
| 1 | 지도 지연 로드 제거 — `mapRequested` 초기값을 항상 true | PlacePage.layout.test.tsx | 종료 1 · 2 failed \| 18 passed (20) — 「지도 보기 전 미호출」·「넓은 화면 갔다 오면」 |
| 2 | 변형이 질의를 바꿈 — `size: layout === 'mapSplit' ? 20 : 30` (+deps `layout`) | PlacePage.layout.test.tsx | 종료 1 · 1 failed \| 19 passed (20) — 「변형이 달라도 목록 질의는 같다」 |
| 3 | eager 전부 lazy — `loading="lazy"` 고정 | PlacePage.layout.test.tsx | 종료 1 · 2 failed \| 18 passed (20) — eager 2·fetchpriority (좁은/넓은) |
| 4 | 카드 img `width`/`height` 제거 | PlacePage.layout.test.tsx | 종료 1 · 2 failed \| 18 passed (20) — 88×88 단언 (좁은/넓은) |
| 5 | `secureImageUrl` 본문 제거 (FE copy.mjs → `return url`) | secureImageUrl.test.ts | 종료 1 · 2 failed \| 10 passed (12) |
| 5 | 〃 | attractionJsonLdGolden.test.ts | 종료 1 · 1 failed \| 8 passed (9) |
| 5 | 〃 | PlacePage·AttractionPage·RegionPage·UnifiedSearchPage 테스트 | 종료 1 · 4 files failed · 5 failed \| 109 passed (114) — 허브 카드·상세 패널·뽑기·상세·지역·통합 검색 렌더 단위 전부 |
| 6 | `secureImageUrl` 본문 제거 (Kotlin `AttractionSeoText` → `url`) | :search:domain AttractionSeoTextTest | 종료 1 · tests=6 failures=1 errors=0 |
| 6 | 〃 | :search:app AttractionPageRendererTest + SecureImageParityTest | 종료 1 · Renderer tests=73 failures=3 · Parity tests=10 failures=1 |
| 7 | 갤러리 호출부(`placeView.galleryImages`)에서 `secureImageUrl` 제거 | AttractionPage.test.tsx | 종료 1 · 1 failed \| 54 passed (55) — 「큰 사진·타일·크게 보기… https」 |
| 8 | `<main>` 제거 — 허브 PlacePage (main→div) | PlacePage.layout.test.tsx | 종료 1 · 2 failed \| 18 passed (20) — `<main>` 하나 (좁은/넓은) |
| 9 | `<main>` 제거 — 상세 AttractionPage | AttractionPage.test.tsx | 종료 1 · 1 failed \| 54 passed (55) |
| 10 | `<main>` 제거 — 지역 RegionPage | RegionPage.test.tsx | 종료 1 · 1 failed \| 10 passed (11) |
| 11 | `<main>` 제거 — SSR `AttractionPageRenderer` | :search:app AttractionPageRendererTest | 종료 1 · tests=73 failures=14 errors=0 — main 단언 3 + 골든 11 |
| 12 | 결과 패널을 두 번째 렌더로 — 지도 상태에서 카드 목록을 한 벌 더 그림 | PlacePage.layout.test.tsx | 종료 1 · 1 failed \| 19 passed (20) — 「카드는 하나씩만」 |
| 13 | 「뽑기」 시트 render 호출부에서 `secureImageUrl` 제거 | PlacePage.test.tsx | 종료 1 · 1 failed \| 45 passed (46) — 「뽑기 시트 카드의 사진 주소도 https」 |
| 14 | 골든 CI 게이트 — `secure-image-golden.json` 의 tong-http `expected` 를 http 로 바꿔 커밋 → vitest(secureImageUrl.test.ts, 골든 재작성) → CI 두 명령 | ci.yml 「Secure image golden fixture is current」 | vitest 12 passed · `git diff --exit-code` 종료 1 · `test -z "$(git status --porcelain …)"` 종료 1 |
| 14-대조 | 주입 없이 같은 순서 | 〃 | vitest 12 passed · diff 종료 0 · status 종료 0 |

합계: 주입 14건(SR-5.3 목록 10항목. `secureImageUrl` 본문은 FE·Kotlin 2건, `<main>` 은 FE 3페이지·SSR 4건으로 나눔). 빨강 14/14, 초록으로 남은 주입 0건. 14번의 임시 커밋은 `git reset --hard e27ec1639` 로 버렸다.

## SR-5.5 다른 프리렌더 산출물 불변

- 비교 대상: 「후」= `e27ec1639`. 「전」= `e27ec1639` 에서 스펙 E 세 커밋(`04d9c095e`·`948f34bc3`·`e27ec1639`)의 portal-fe 변경을 역적용한 트리다. 그 사이에 끼인 다른 스펙 커밋은 빼지 않았다. 「전」 트리와 `3d75179aa`(스펙 E 직전)의 portal-fe 차이는 스펙 D 의 `src/api/placeApi.ts` +10줄 하나뿐이다.
- 빌드: `npm run build` 를 순서대로 세 번(후 → 전 → 후 재빌드). 빌드는 운영 API `https://api.1989v.com` 을 GET 으로만 부른다. 세 번 모두 관광지 ko 50158·en 15007, 지역 273·266, 프리렌더 184 페이지로 같은 수치였다.
- 대조군(후 vs 후 재빌드): `diff -rq dist/prerender` 0건. 빌드는 결정적이고, 빌드 사이에 데이터 변동도 없었다.

| 비교 | 결과 |
|---|---|
| 원본 바이트 `diff -rq` 전 vs 후 (`dist/prerender`, 752 파일) | **752 파일 전부 다름** — 차이는 Vite 번들 해시가 든 `/assets/*-<hash>.js` 의 `script`·`modulepreload` 주소뿐(예: `about.html` 의 `index-BT3EMt4E.js`→`index-DVfpMrps.js`). FE 소스를 바꾸면 엔트리 해시가 바뀌어 모든 페이지에 번진다 |
| `/assets/<name>-<8자 해시>.<ext>` 를 `-HASH` 로 정규화한 뒤 `diff -rq` (dist 전체, assets 디렉터리 제외. index.html·prerender·seo 포함) | **2 파일만 다름** — `prerender/_hosts/place.1989v.com.html`, `prerender/_hosts/place.1989v.com.en.html` |
| 그 두 파일의 내용 차이 | 각각 head 에 `<link rel="preconnect" href="https://tong.visitkorea.or.kr" />` 한 줄이 추가됨. 그 밖에는 없음 |
| `grep -rl 'rel="preconnect" href="https://tong'` (후 dist) | 위 허브 두 파일뿐(`index.html`·다른 프리렌더 0). 전 dist 에서는 0건 |
| assets 파일 수 | 113 / 113 |

판정: SR-5.5 의 문구를 그대로 읽으면(「바이트 동일」) 752 파일 전부가 번들 해시만큼 달라 충족하지 못한다. 해시를 정규화하면 차이는 허브 두 파일의 preconnect 한 줄뿐이다. 스펙은 FE 변경에 늘 따라오는 해시 차이를 감안하지 않았다. 문구를 「해시 정규화 후」로 고칠지는 스펙 소유자가 정한다.

## 근거 파일
- `scratchpad/inject-e/run.py` — 주입 정의·실행기. `inj*-vt.log`·`inj*-kt.log` 는 주입별 테스트 출력, `tsc-inj*.log` 는 컴파일 확인, `rows.tsv`·`rows-tsc.tsv` 는 결과 행
- `scratchpad/inject-e/build-{after,before,after2}.log`
