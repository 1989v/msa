# 3라운드 엔지니어 리뷰 — implementation · test-strategy

범위: 2라운드 편집(E2-0~E2-16)이 고친 문장만 코드와 대조했다. 판정된 항목은 다시 열지 않았고, 새 결함만 적는다.
대조 기준은 워크트리 `wt-impl` 의 현재 코드다.

## implementation — REVISE (2건)

확인 결과 그대로 구현할 수 있는 것: E2-2 오버레이 칩 세 조건(`PlacePage.tsx:1364-1370` 의 onClick 에 분기 추가로 끝남), E2-4 사진 순번 eager(부모가 사진 순번을 계산해 카드에 넘기면 됨. React 19.2(`package.json:34`)라 `fetchPriority` prop 이 `fetchpriority` 로 나간다), E2-5 preconnect(`renderPlaceHubs` 의 `compose` 결과 `html`(`prerender-seo.mjs:1117-1134`)에 `</head>` 치환을 하면 `compose`·`metaTags` 와 다른 산출물을 건드리지 않는다).

### I3-1 숨겨 둔 지도를 다시 보일 때 진입 fitBounds 의 시점이 정해져 있지 않다 (심판 6절 확인 요청)
- 스펙: SR-1.5 「지도 상태로 들어갈 때마다(첫 진입 포함) 현재 결과로 fitBounds 를 한 번 한다」(spec.md:25), SR-1.3 「지도 div 는 … CSS 로만 숨긴다」(spec.md:23).
- 코드: 지도는 `mapDivRef` 위에 한 번만 만들어진다(`PlacePage.tsx:755-770`). 첫 진입은 「지도 보기」 클릭과 같은 렌더에서 div 가 보이게 된 뒤 생성되므로 크기가 맞다. 문제는 **목록→지도 두 번째 진입**과 **넓은 화면에서 만든 뒤 좁아진 경우**다. 숨겨진(크기 0) 동안 지도가 기억한 크기는 0이고, 지도 쪽 크기 갱신은 레이아웃 뒤 ResizeObserver 콜백에서 일어난다. 클릭 같은 이산 이벤트로 생긴 렌더의 effect 는 React 가 커밋 끝에 바로 돌리므로, 진입 fit 을 effect 안에서 곧바로 부르면 레이아웃 전에 0 크기 기준으로 줌을 계산할 수 있다. 그 뒤 크기가 갱신돼도 다시 맞추지 않는다.
- 수정안: SR-1.5 에 「진입 fit 은 지도 상태 클래스가 적용된 다음 프레임(`requestAnimationFrame`) 안에서 한다」를 더한다. SR-5.5 에는 「listFirst 390×844 에서 지도→목록→지도 왕복 뒤(idle 뒤) 결과 마커 bounds 가 `map.getBounds()` 안에 들고 줌이 첫 진입과 같은지」를 같은 표에 적는 확인을 더한다. jsdom 은 레이아웃이 없어 단위 테스트로는 못 잡는다.

### I3-2 지역 고르기 중 지도 상태로 들어가면 진입 fit 의 대상이 틀린다
- 스펙: SR-1.5 「현재 결과로 fitBounds」, 「목록 상태면 마커 effect 의 fit 도 건너뛴다」(spec.md:25). SR-1.6 「지역 고르기: 지도 상태면 시도 마커를 그리고」(spec.md:30).
- 코드: 마커 effect 는 `pickingRegion` 이면 관광지 대신 시도 마커를 그리고 **시도 bounds 로** fit 한다(`PlacePage.tsx:811-842`). 목록 상태에서 지역 고르기를 시작하면 이 fit 은 건너뛰고, 지도 상태로 들어갈 때의 진입 fit 은 「현재 결과(관광지)」로 맞춘다. 그래서 시도 마커가 화면 밖에 남을 수 있다.
- 수정안: SR-1.5 진입 fit 문장에 「`pickingRegion` 이면 시도 마커 bounds(:837 과 같은 집합)로, 아니면 관광지 결과로」를 더한다. idle 처리(`setMapMoved(false)`)는 두 경우 모두 같다(:841, :938).

## test-strategy — REVISE (2건)

확인 결과 그대로 쓸 수 있는 것: E2-8 matchMedia 목(`useMediaQuery.ts:9,12,15` 가 같은 mql 의 change 를 받으므로 쿼리별 단일 객체 + 리스너 보관이면 폭 전환을 흘릴 수 있다), E2-9 시트 닫힘 단언(`KhSheet.tsx:62,64` 가 `role="dialog"`·`aria-label={label}` 이라 `{ name: '필터' }` 로 잡힌다), E2-10 픽스처·셀렉터(`PlacePage.tsx:1792-1800`), E2-11 전제 단언(data-src·backgroundImage 어느 쪽이든 받으므로 jsdom 에서 dispenser 가 돌든 안 돌든 저절로 통과하지 않는다).

### T3-1 골든 CI 게이트의 회귀 주입이 vitest 를 거치지 않아 검사 자신을 잰다
- 스펙: SR-5.3 「커밋된 `secure-image-golden.json` 한 값을 바꾼 채 CI 두 명령을 로컬에서 실행 → 0 이 아닌 종료 코드」(spec.md:76).
- 코드: CI 단계는 바로 앞의 `npx vitest run`(`ci.yml:298-300`)이 골든을 **다시 쓴 뒤에** diff 를 본다(선례 `footerLinksGolden.test.ts:51`, `attractionJsonLdGolden.test.ts:374` 의 `writeFileSync`). 적힌 주입은 워킹트리 파일을 손으로 바꾸고 git 명령만 돌리므로, vitest 가 그 파일을 쓰지 않는 구현(읽기만 하는 테스트)이어도 빨간불이 난다. 게이트가 죽어 있어도 통과하는 주입이다.
- 수정안: 주입을 「임시 사본에서 골든 한 값을 바꿔 **커밋**하거나 `copy.mjs` 의 `secureImageUrl` 결과를 바꾼 뒤 → 그 골든을 쓰는 vitest 파일을 실행 → CI 두 명령이 0 이 아닌 종료」로 바꾸고, 대조군으로 「주입 없이 같은 순서 → 0」을 함께 적는다.

### T3-2 SR-5.4 문장이 편집으로 깨졌고, 「다른 산출물 바이트 동일」에 확인 절차가 없다
- 스펙: spec.md:77 「배포 뒤 측정 전에 운영 응답에 이번에 넣은 심볼(…, 허브 head 의 tong preconnect). 배포 전에는 빌드 산출물에서 `grep -l …` 결과가 place 허브 두 파일뿐인지 확인한다이 있는지와 허브 프리렌더 재생성 여부를 확인한다.」 — E2-14 삽입이 원래 문장 중간에 들어가 「배포 뒤 무엇을 확인하는지」의 서술어가 사라졌다.
- 스펙: SR-4.1 「다른 프리렌더 산출물은 바이트가 같아야 한다」(spec.md:49), SR-4.4 같은 조건(spec.md:55). SR-5 어디에도 이를 재는 절차가 없다. `grep -l` 은 preconnect 가 다른 파일에 없다는 것만 보이고, `compose` 를 고쳐 다른 파일의 공백·순서가 바뀐 경우는 못 잡는다.
- 수정안: 77행을 두 문장으로 나눈다 — 「배포 뒤 측정 전에 운영 응답에 이번에 넣은 심볼(…)이 있는지와 허브 프리렌더 재생성 여부를 확인한다. 배포 전에는 빌드 산출물에서 `grep -l 'rel="preconnect" href="https://tong'` 결과가 place 허브 두 파일뿐인지 확인한다.」 그리고 SR-5.3 또는 5.4 에 「변경 전·후 커밋에서 같은 입력으로 프리렌더를 빌드해 `diff -r` 하고, 차이가 place 허브 두 파일뿐인지 확인한다(SR-4.4 래퍼를 쓰면 같은 두 파일)」를 더한다.

## 요약

| 차원 | 판정 | 건수 |
|---|---|---|
| implementation | REVISE | 2 (I3-1, I3-2) |
| test-strategy | REVISE | 2 (T3-1, T3-2) |

BLOCK 사유 없음. 네 건 모두 스펙 문장 한두 줄 추가·분리로 닫힌다.

VERDICT: REVISE
