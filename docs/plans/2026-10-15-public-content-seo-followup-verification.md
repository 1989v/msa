# 공개 콘텐츠 SEO 후속 구현 검증 (2026-10-15)

작업 트리: `/Users/gideok-kwon/.codex/worktrees/d3c3/msa`. 실행 로그는 아래 일회성 `/tmp/public-seo-*.log`; 재검증 명령은 이 문서에 남긴다. 게임 소스와 서브모듈 포인터는 변경하지 않았다.

## 콘텐츠와 근거

- 카탈로그 스냅샷 82종 모두 한영 안내를 제공한다. 기존 4종에 78종을 추가했다. 목표·조작·첫 플레이 팁을 같은 gamePlayGuide로 화면과 초기 HTML에 전달하며 핀볼의 기존 4항목은 유지했다. 홈 추천은 block-burst·mine-pioneer·rift-front 3종 그대로다.
- 상세 제목 82개는 언어별로 고유하다. 일반 제목은 이름+장르, 동명 궁수 키우기는 거점 원정/좀비 개척으로 구분한다. titleOf가 초기 HTML·메타·상세 H1·VideoGame 이름에 같은 이름을 전달한다. 핀볼 편집 제목은 유지했다. 실제 편집일 2026-10-15를 82종 sitemap lastmod에 반영했다.
- 실제 로드되는 marine-command/js/origin/main.js의 튜토리얼을 기준으로 공격3·방어2 후 첫 목수500G를 안내한다. index.html의 옛100G 자리표시는 채택하지 않았다. circle-trace는 놓기 뒤 결과 버튼을 눌러야 제출된다. Nova Strike는 기체 슈팅으로 추정하지 않고 헌터/월점프/차지의 실제 UI를 따른다. Raging Fist는 stale touch설정 대신 input.js의 J/K/L/U/Space를 따른다.
- 관광지 지역 구분은 sidoName·region.sigunguName만 사용한다. 제목/H1/JSON-LD의 원래 장소 이름은 보존하고 메타 제목에 확인된 지역을 괄호로 추가한다. 제목에 이미 있는 지역·빈 값·중복은 생략하고 영어 지역의 한글은 제외한다. 주소로 영문 지역을 추정하지 않는다. JS/Kotlin 골든은 NBSP·대소문자·동명 지역·빈 지역·이스케이프까지 대조한다.
- 검증된 alternateId 투영·SSR hreflang·상대 언어 sitemap 수록 조건에 누락을 발견하지 않았다. 보수적 매칭 규칙과 색인 설정은 변경하지 않았다. 운영 활성화/배치쌍 수/계정 권한은 [별도 감사](2026-10-15-public-content-seo-audit.md)에 기록한다.

## 실행 근거

- FE: `npx vitest run src/seo/__tests__ src/pages/games/__tests__/GameAboutPanel.guide.test.tsx src/pages/games/__tests__/GamesPage.seo.test.tsx` → `Test Files 26 passed (26)`, `Tests 281 passed (281)` (public-seo-focused.log). 카탈로그 전체의 초기HTML/React 안내·제목 유일성·소스경로·실제 lastmod를 확인했다.
- Kotlin: `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*AttractionJsonLdParityTest' --tests '*AttractionHreflangParityTest' --tests '*AttractionPageControllerTest'` → `BUILD SUCCESSFUL in 11s`; XML 합계200 tests, failures0, errors0 (public-seo-kotlin.log). 8개 HTML 골든은 명시 UPDATE_RENDER_GOLDEN 플래그로 갱신한 뒤 정상 모드로 다시 대조했다.
- nginx: `python3 scripts/check-nginx-public-aliases.py` → `nginx: configuration file /etc/nginx/nginx.conf test is successful`, `PASSED: 88 nginx HTTP public alias/private/asset/host checks` (public-seo-nginx.log). Docker nginx:1.27-alpine의 실제301/Location, 중복·빈·인코딩쿼리, 언어, apex/en, 로컬·다른호스트, 게임프레임·자산, party, root r초대의 prerender 유무를 확인했다.
- 초대 회귀를 검사하며 기존 root초대의 index.html 폴백에서 noindex가 유실됨을 발견했다. 원래 request_uri 기준 root_robots_tag를 generic HTML에도 적용해 고쳤다. resume/ads의 엄격한 호스트 정책은 그대로 전달되며 /en?r·/draw?r은 public이다.
- `npm run lint`는 기존25 errors/2 warnings로 실패했다 (public-seo-lint.log). 새 가이드 테스트와 변경 copy/gameSitemap 테스트에 한정한 eslint는 exit0. 변경한 기존 attractionJsonLdGolden.test.ts의 no-explicit-any1건은 HEAD와 작업본을 같은 eslint stdin경로로 대조해 동일함을 확인했다 (public-seo-lint-baseline.log). JS4개는 node --check exit0. 기존 게임 내부/블로그 lint 문제는 승인 범위 밖이라 변경하지 않았다.
- 정상 전체 빌드: `npm run build` exit0, `tsc -b`·Vite `built in 4.65s`, `[seo] 프리렌더 188개 페이지 · 게임 82종 (https://api.1989v.com)`, `[html] 주석 제거 896개 파일` (public-seo-build.log). 실제 dist HTML164장 모두 언어별 제목82개 유일성·안내·H1·canonical을 대조했고, 게임 sitemap 상세164 URL의 lastmod=2026-10-15를 확인했다.
- 관광지 빌드 sitemap4개: 상세62,987 URL, hreflang7,040 URL=상호 연결3,520쌍, 비상호 연결0 (public-seo-built-pairing.json). 운영 구 sitemap의2,651쌍보다 늘었다. 최신 배치 로그3,521쌍과1쌍 차이는 이 수치만으로 누락이라고 단정하지 않는다. sitemap의 개요·숙박 사진 요건/조회시점이 달라질 수 있으며 기존 안전 규칙을 유지했다.
- 마지막 displayTitle 정합성 수정 후에는 `npx vitest run src/seo/__tests__/gameCatalogGuides.test.tsx src/api/__tests__/gameProfileApi.test.ts src/pages/games/__tests__/GamesPage.seo.test.tsx` → `Tests 15 passed (15)`; `npx eslint src/api/gameApi.ts src/seo/__tests__/gameCatalogGuides.test.tsx` exit0, `npx tsc -b` exit0. 마지막 소스 번들은 `npx vite build --outDir /tmp/public-seo-final-bundle-20261015` → `built in 2.20s` (public-seo-final-bundle.log).
- **산출물 구분**: 전체 prod API 프리렌더 빌드는 마지막 displayTitle 수정 전에 시작했다. SEO 카피·초기HTML은 바뀌지 않았으므로 위 HTML audit은 유효하지만 `portal-fe/dist` JS가 최종 displayTitle을 포함한다고 주장하지 않는다. 최종 helper를 포함한 별도 Vite 번들은 `/tmp/public-seo-final-bundle-20261015`; 다음 CI/배포 이미지의 정상 빌드가 두 층을 함께 생성해야 한다. 동일65,180건 API 열거를 두 번 반복하지 않았다.
- `git diff --check` exit0; fresh-context 리뷰의 두 내용 지적(circle-trace 제출·marine 실제 튜토리얼)을 수정하고 마지막 nginx/apex/en·displayTitle 변경까지 부모가 재리뷰해 SHIP을 확인했다.
- 부모 문서 영향 검사: 설치된 hns `scripts/doc_scan.py --repo . --base HEAD` exit0. 기존 매핑의 아키텍처·Kotlin 스타일·검색 서비스 개요는 구조 변경이 없어 별도 개정하지 않았다. `doc_map.py --check`는 저장소 전체의 기존 lock drift로 exit1이다. 현재 source2544/doc997, 이번 신규 문서3개를 뺀 비교도 doc994이며 커밋된 lock은 source2506/doc849다. 이번 SEO 변경과 무관한 문서 대량 재색인은 수행하지 않고 이 제한을 기록한다. 표준에 적힌 `ai/plugins/...`는 이 작업 공간에서 초기화되지 않아 설치된 동일 버전 hns 스크립트로 검사했다.

## 게임별 소스

경로는 portal-fe/public/games 기준이다. 런타임이 소스를 읽지는 않으며 gameGuideSources가 검증용 경로를 제공한다. 카탈로그 스냅샷: portal-fe/src/seo/__tests__/fixtures/game-catalog-20261015.json.

| 게임 | 확인한 소스 |
|---|---|
| duel-defense | `duel-defense/index.html` |
| marine-command | `marine-command/js/origin/main.js` · `marine-command/index.html` |
| epoch-of-nations | `epoch-of-nations/src/ui.js` |
| gwiyahaeng | `gwiyahaeng/index.html` |
| landslide | `landslide/index.html` |
| arena | `arena/assets/index-F7xs6Hpa.js` |
| circle-trace | `circle-trace/js/main.js` |
| seven-seconds | `seven-seconds/js/main.js` |
| zombie-lane | `zombie-lane/js/08-ui.js` |
| zombie-march | `zombie-march/js/10-ui.js` |
| infinity-step | `_src/infinity-step/Assets/Scripts/Actors/Climber.cs` · `_src/infinity-step/Assets/Scripts/GameEntry.cs` |
| last-one | `_src/last-one/Assets/Scripts/Ui/Menu.cs` |
| nine-bells | `_src/nine-bells/Assets/Scripts/Ui/Menu.cs` |
| archer-outbreak | `_src/archer-outbreak/Assets/Scripts/Core/Loc.cs` · `archer-outbreak/index.html` |
| random-card-defense | `random-card-defense/js/ui.js` |
| infinity-tower | `infinity-tower/js/17-scenes.js` |
| random-tower-defense | `random-tower-defense/js/render/ui.js` |
| bee-guard | `bee-guard/js/main.js` |
| card-flip | `card-flip/js/main.js` |
| marble-race | `marble-race/js/setup.js` · `marble-race/js/main.js` · `marble-race/js/courses.js` |
| ladder-draw | `ladder-draw/js/main.js` |
| pixel-logic | `pixel-logic/js/main.js` |
| hoop-order | `hoop-order/js/main.js` |
| sum-trail | `sum-trail/js/main.js` |
| coin-corgi | `coin-corgi/js/main.js` |
| aero-vendetta | `aero-vendetta/js/scenes.js` |
| curfew-siren | `curfew-siren/index.html` |
| deadline | `deadline/index.html` |
| ashen-warband | `ashen-warband/js/core/input.js` · `ashen-warband/index.html` |
| nova-strike | `nova-strike/js/ui.js` · `nova-strike/js/input.js` |
| raging-fist-saga | `raging-fist-saga/js/input.js` |
| abyssal-crown | `abyssal-crown/js/ui.js` |
| nether-return | `nether-return/index.html` |
| sketch-sleuth | `sketch-sleuth/index.html` |
| drift-continent | `drift-continent/index.html` |
| moon-angler | `moon-angler/index.html` |
| cliff-climber | `cliff-climber/index.html` |
| relic-heir | `relic-heir/index.html` |
| element-pilgrim | `element-pilgrim/index.html` |
| hand-alchemy | `hand-alchemy/index.html` |
| spud-arena | `spud-arena/index.html` |
| midnight-tide | `midnight-tide/index.html` |
| serpent-legion | `serpent-legion/index.html` |
| dawn-ward | `dawn-ward/index.html` |
| beat-dojo | `beat-dojo/index.html` |
| breeze-links | `breeze-links/index.html` |
| alley-pool | `alley-pool/index.html` |
| starlight-farm | `starlight-farm/index.html` |
| hero-dispatch | `hero-dispatch/index.html` |
| cog-foundry | `cog-foundry/index.html` |
| abyss-drill | `abyss-drill/index.html` |
| bracket-battle | `bracket-battle/index.html` |
| acid-rain | `acid-rain/index.html` |
| rope-works | `rope-works/index.html` |
| stone-sage | `stone-sage/index.html` |
| mine-pioneer | `mine-pioneer/index.html` |
| crate-shift | `crate-shift/index.html` |
| block-burst | `block-burst/index.html` |
| number-garden | `number-garden/index.html` |
| royal-grid | `royal-grid/index.html` |
| pixel-mine | `pixel-mine/index.html` |
| quad-weave | `quad-weave/index.html` |
| word-warden | `word-warden/index.html` |
| rift-front | `rift-front/index.html` |
| dice-citadel | `dice-citadel/index.html` |
| storm-corridor | `storm-corridor/index.html` |
| crimson-ravine | `crimson-ravine/index.html` |
| wall-breaker | `wall-breaker/index.html` |
| cave-glide | `cave-glide/index.html` |
| rune-merge | `rune-merge/index.html` |
| golden-forge | `golden-forge/index.html` |
| echo-duel | `echo-duel/index.html` |
| frost-outpost | `frost-outpost/index.html` |
| ember-temple | `ember-temple/index.html` |
| iron-vanguard | `iron-vanguard/index.html` |
| gear-bastion | `gear-bastion/index.html` |
| gate-holdout | `gate-holdout/index.html` |
| outlaw-frontier | `outlaw-frontier/index.html` |
| monster-tamer | `monster-tamer/index.html` |
| depth-delver | `depth-delver/index.html` |
| overworld-quest | `overworld-quest/index.html` |
| snake | `snake/index.html` · `snake/game.js` |

## 수행하지 않은 것

브라우저·CUA·Playwright/UI 접근, Search Console/서치어드바이저 계정 조회·제출, 외부 게시·전송·배포, 게임 물리 전수검사는 수행하지 않았다. 검색엔진 색인·순위 상승은 검증 결과가 아니다. 부모 세션이 fresh-context 리뷰를 완료했고 통합을 담당한다.
