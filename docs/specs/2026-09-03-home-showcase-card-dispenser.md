<!-- source: portal-fe/src/lib/card-dispenser/index.ts, portal-fe/src/components/dispenser/DispenserStage.tsx, portal-fe/src/components/home/ServiceShowcase.tsx, portal-fe/src/components/brand/SystemCore.tsx -->
# 메인 개편 — 서비스 섹션 + 카드 디스펜서, 서비스별 "뽑기"

- 상태: 구현 완료 (2026-09-03)
- 관련: ADR-0066(메인은 런처다 — 본 건으로 개정), ADR-0062(프리렌더), DESIGN.md §12(여섯 번째 동사 "흐름", 디스펜서 프리미티브)
- 참고: https://lazyowen.com/guides/fable5-website — "코드 복잡도가 아니라 시각 콘텐츠의 유무가 차이를 만든다"

## 배경

1989v.com 메인이 "너무 정적"이었다. 운영 화면 실측(2026-09-03): 이미지 0장·영상 0개, 히어로 판은
`< / system_core >` 글자만 있는 빈 상자, 같은 크기 검은 타일 9장(가드레일이 금지한 동일 카드 그리드),
모션은 1회성 등장뿐, 먹 캔버스의 첫 낙묵은 히어로 판 뒤(가로 66%)에 찍혀 보이지 않았고,
ADR-0066 의 타임라인 원안(재직 막대 + 점)은 글 목록으로만 구현돼 있었다.

시안(Claude 아티팩트)으로 방향을 잡고, 사용자 피드백을 세 번 거쳐 확정했다.

## 요구사항 (확정 순서대로)

1. 컨셉(K-Heritage 재료·활자·여백·형태·다섯 동사)은 그대로, 움직임만 더한다.
2. 히어로 판은 실제 운영 토폴로지가 된다. 포인터가 없어도 첫 화면이 움직인다.
3. 살아 있는 숫자 — 전부 공개 API 응답값.
4. **카드 디스펜서**: 회전판에 카드가 옆으로 꽂혀 있고, 돌다가 정면에 온 하나가 일어난다.
   place 의 "필터 걸고 랜덤 픽" 장치로도 쓰고 다른 서비스에도 재사용 → 라이브러리화(오픈소스 가능).
5. 카드는 **실제 개수 비례**로 촘촘히. 뒤쪽 카드는 내용이 안 보여도 된다.
6. 공유 고정 판과 긴 스크롤 여백은 걷어내고, **섹션마다** 디스펜서가 글 옆에 선다.
7. 카드 제목이 잘리지 않는다.
8. 모바일: 스크롤은 판을 돌리지 않는다. 판은 멈춰 있고 "뽑기"가 돌려 하나를 세운다.
9. 블로그도 디스펜서로 — 항목이 적으면 **최소 칸 수**만큼 있는 것으로 채우되 뽑히는 건 실제 글뿐.
10. 스핀 중에는 "지금 뽑힌 것" 제목을 바꾸지 않는다. 멈춘 뒤 한 번만.
11. 모바일 순서: 서비스명·소개 → 디스펜서 → 뽑힌 것·태그·링크.
12. 각 서비스 페이지에 **지금 건 필터 기준 랜덤 픽**.

## 설계

### 메인 구조 (ADR-0066 개정)

```
히어로 — 카피 | 시스템 코어(캔버스, 판 위) · 먹 캔버스는 그대로(첫 낙묵 42% 로 이동)
지금 이 순간 — 운영 서비스 · 웹게임 · 공개 저장소 · 경력 (공개 API 응답값, 카운트업 1회)
01_ 만든 서비스
   섹션 × 4 (관광 · 게임 · 블로그 · 커머스) — 글 | 판(디스펜서), 좌우 번갈아
   전체 진입점 색인 격자 (display_service, 호버 어긋남)
02_ 지나온 것 — 재직 막대 시간축(흐름) + 프로젝트 목록
03_ 오픈소스 · About · Footer (그대로)
```

| 섹션 | 데이터 | 카드 | 링크 |
|---|---|---|---|
| 관광 | `searchAttractions({areaCode:'1', category: 관광4분류, size:80})` | 사진·분류 인장·이름·구 | `place.1989v.com/attractions/:id` |
| 게임 | `listGames({sort:'top', size:100})` — 전부 | 썸네일·장르(연지)·제목 | `game.1989v.com/games/:slug` |
| 블로그 | `fetchPosts({size:30})` — 전부, 최소 24칸 | 글자 카드 | `blog.1989v.com/posts/:slug` |
| 커머스 | `fetchProducts(0,100)` — 전부, 최소 24칸 | 글자 카드(가격) | `/shop/products/:id` |

각 10분 캐시(react-query). 어느 하나가 실패하면 그 판만 "비어 있습니다"로 퇴화한다.
프리렌더(ADR-0062)는 Node 문자열 템플릿이라 React 를 돌리지 않는다 — 캔버스·디스펜서는
크롤러에 보이지 않고, 진입 링크(색인 격자·섹션 링크)는 DOM 에 그대로 있다.

### 라이브러리 `portal-fe/src/lib/card-dispenser`

```ts
createDispenser(host, { items, render, onChange, minCards, radius, cardW, cardH, tilt, lift, forward, pullScale, dwell, ticksEvery, label })
  → { setAngle, rotateBy, snap, spinTo(i | 'random'), current, currentIndex, destroy }
```

- 각도 하나로 움직인다: 드럼 각 = 스크롤이 주는 `angle` + 사용자 조작(드래그·스핀) `offset`.
  카드의 "뽑힘 정도"는 정면과의 각 거리로만 정해지므로(`pullAmount`) 입력 방식마다 다른 코드가 없다.
- `minCards`: 칸 s 의 항목은 `items[s % n]` — 뽑히는 것은 언제나 실제 항목.
- 정면 근처 다섯 장에만 `render` 가 불린다. 카드가 수백 장이어도 그리는 앞면은 다섯.
- 스핀 중 `onChange` 를 미루고 멈춘 뒤 한 번만 부른다.
- 다른 모듈을 import 하지 않는다. 색은 `--cd-*` 변수뿐. → 그대로 떼어 `1989v/card-dispenser` 로 낼 수 있다.
  이 레포는 `packages/*` 를 vendored tarball 로 소비하므로(`scripts/sync-design-system.sh`) 별도 패키지는
  npm 배포(fencesvg 와 같은 경로)가 맞다.
- 3D 함정: `.cd-world` 의 `rotateX` 는 음수여야 정면이 화면 아래·가까운 쪽으로 온다. 뽑힌 카드는 `rotateX(+tilt)` 로 되돌린다.

React 다리는 `components/dispenser`: `useDispenser`(mount/unmount), `DispenserStage`(판 + 뽑기 버튼 + 캡션 + 스크럽),
`PickLine`(지금 뽑힌 것), `PickSheet`(KhSheet 다이얼로그 — 열리자마자 한 번 돈다).

### 입력 정책

| 입력 | 데스크탑 | 터치(`pointer: coarse`) |
|---|---|---|
| 스크롤 | 섹션이 화면을 지나는 동안 110° | **돌리지 않는다** |
| 가로 끌기 | 돈다, 놓으면 snap | 같음 (`touch-action: pan-y`) |
| ← → | 한 칸 | — |
| 뽑기 | 있음 | 주 조작, 44px, 뽑힌 카드 1.32배 |

### 서비스 페이지 "뽑기"

| 화면 | 후보 | 자리 |
|---|---|---|
| place | 지금 조건(`query`)의 결과 중 **무작위 페이지 하나(60곳)** — 첫 페이지만 꽂으면 늘 같은 60곳 | 검색·내 주변 옆 "뽑기" |
| games | 지금 장르·태그·정렬 목록(48개, 클라이언트) | 툴바 "뭐 하지" (기존 파티 뽑기는 그대로) |
| blog 홈·분류 | 지금 분류의 글 60편 (`enabled: pickOpen`) | 섹션 제목 옆 "아무 글이나" |
| shop | 지금 모드(브라우즈/검색)의 무작위 페이지(60개). 검색 모드의 뽑기도 클릭 로그 | 검색 옆 "아무거나" |

### 모션·테마

- 여섯 번째 동사 **흐름** `.kh-flow-rule` / `.kh-flow-grow` — `animation-timeline: view()`, `@supports` 안에서만.
- 테마 토글은 누른 자리에서 원으로 번진다 (View Transitions, `data-theme-wipe` 로 화면 전환과 범위 분리).
- GNB: 보고 있는 섹션의 메뉴에 긋기(밑줄).

## 변경 파일

- 라이브러리: `portal-fe/src/lib/card-dispenser/{index.ts, card-dispenser.css, README.md, __tests__/dispenser.test.ts}`
- 다리: `portal-fe/src/components/dispenser/{useDispenser.ts, DispenserStage.tsx, PickLine.tsx, PickSheet.tsx, dispenser.css}`
- 메인: `components/brand/{SystemCore.tsx,.css}`, `components/home/{ServiceShowcase.tsx, PulseStrip.tsx, TileGrid.tsx, PortfolioTimeline.tsx, careerAxis.ts, Home.css}`, `pages/HomePage.tsx`, `components/brand/InkWash.tsx`(첫 낙묵)
- 공통: `components/ThemeToggle.tsx`, `components/GNB.{tsx,css}`, `styles/kh-motion.css`(흐름), `styles/k-heritage.css`(테마 번짐)
- 서비스 페이지: `pages/place/PlacePage.tsx`, `pages/games/GamesPage.tsx`, `pages/blog/{BlogHomePage,BlogCategoryPage}.tsx` + `Blog.css`, `pages/ShopPage.tsx`
- 문서: `DESIGN.md`(2.4.0), `docs/design/k-heritage.html`, `docs/adr/ADR-0066`(개정), `CLAUDE.md`

## 검증

- `tsc -b` 통과, `vitest` 16 tests 통과(디스펜서 11 · 시간축 2 · 기존 3), 새 파일 eslint 0.
- 로컬 dev 서버가 운영 API 를 프록시(`vite.verify.config.ts`, 미커밋)한 상태에서 CDP 로 4조합(데스크탑/모바일 × 라이트/다크):
  콘솔 오류 0, 카드 80/76/24/24, 카운터 7·76·6·11 실제값, 시스템 코어 캔버스 렌더.
- 대비: 작은 글씨는 `--ko-text-muted`(한지 위 4.23:1)를 쓰지 않고 `--ko-text-secondary` 로 — 뽑힌 것 메타·카운터 라벨·연도 눈금.
  카드 메타는 황토 70% + 송연 혼합으로 한지 위 4.9:1.
- 모바일 가로 넘침: 연도 눈금 격자가 열보다 넓어 넘쳤다 → `minmax(0, 1fr)` + 눈금 `overflow: hidden`.

## 보류·후속

- 웹폰트(Hanken Grotesk + JetBrains Mono)는 싣지 않았다 — 무료 티어로 미뤄 둔 결정 그대로. 시스템 서체.
- 관광 판의 80장은 서울 관광 분류 결과의 첫 80곳이다. place 페이지의 뽑기는 무작위 페이지를 쓴다.
- 오픈소스 분리: `lib/card-dispenser` 를 그대로 새 레포로 옮기고 npm 에 내면 된다(README 포함). 이 레포에서는
  `fencesvg` 처럼 npm 의존성으로 바꾸는 것이 마지막 단계.
- `vite.verify.config.ts` 는 검증 전용이라 커밋하지 않는다.
