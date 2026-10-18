# P7 운영 반영 기록 (2026-10-16 22:27 ~ 10-17)

main 에 올라간 순서와 운영에서 확인한 것. 시각은 KST.

## 배포 순서
| 커밋 | 내용 | 운영 확인 |
|---|---|---|
| `28e707dfb` (WU-15~21) | 전국 덮기 · 지도 조작 · 검색 · 내 위치 · 음식 사전 · TourAPI 메뉴 · 영문 | Flyway `V44`·`V45` 적용(`now at version v45`), `name_roman` 백필 `markets=828, succeeded=828, failed=0`(45초). **시장 상세 500** → 아래 핫픽스 |
| `9d42390ea` | 시장 상세 500 핫픽스 — `market_store.tour_content_id`(unicode_ci) ↔ `attractions.content_id`(0900_ai_ci) 조인을 cast 로 | 네 시장 `http=200`(남대문 2,314 · 광장 977 · 망원 245 · 서문 942) |
| `4ce12e1bf` | 중분류 71종 영문 + 끝 공백 라벨 | 기동 경고 58 → 1 |
| `1f3e75f54` | 온누리 품목 168종 영문 + 대분류 「과학·기술」 | 기동 경고 0. 광장 영문 응답 `itemsEn` 483/977 · `categoryEn` 432/977 · `nameEn` 977/977 |
| `4e4b002b6` | 전체 메뉴 붙이기 비동기·시장별 트랜잭션·0.3초 간격·근처 음식점 없는 시장은 가게 행 안 읽음 + 좁은 경계 뷰포트·맞은 가게 라벨 | content OOM 2회 뒤 재발 없음 |
| `911e10534` | 핀 묶음을 리더 기준으로(연쇄 병합 제거) · 주변 가게 색 · 전체 보기에서 골목 이름 3개만 | 로컬 최신 코드: 망원 핀 1 → 8, 남대문 5 → 18, 광장 5 → 19 (모바일 390) |

## 사고 둘
1. **시장 상세 500 (22:49~23:1x)** — 콜레이션 섞임. 저장소 테스트 컨테이너가 `--collation-server=utf8mb4_unicode_ci` 라 두 테이블이 같았다. 테스트는 이제 `beforeSpec` 에서 `attractions` 를 0900_ai_ci 로 바꿔 운영 분리를 재현한다(cast 를 빼면 TourAPI 테스트 2건 빨간불).
2. **content OOMKilled 2회 (23:35, 00:01)** — `POST /internal/markets/tour-menus` 가 한 요청·한 트랜잭션에 828곳을 돌아 1Gi 를 넘겼고, 시장별 엔드포인트를 연속 호출해도 같았다(`MaxRAMPercentage=60` → 힙 614Mi + 비힙). 비동기·시장별 트랜잭션·0.3초 간격·불필요한 가게 행 로드 제거 뒤 828곳 완주: `Tour menu attach end: markets=828, matched=899, failed=0`, 최고 메모리 873Mi, 재시작 0.

## 운영 수치 (10-17 01:30 기준)
- TourAPI 메뉴 붙음: 899곳 / 350개 시장. 광장 2(순희네빈대떡·우래옥) + 미매칭 음식점 2, 남대문 3(은호식당·전주식당·남문토방) + 5.
- 검색: `q=떡볶이` 362건(첫 페이지 NAME 18 · MENU 1 · RELATED_CATEGORY 31), `q=tteokbokki` 363건, `q=빈대떡` 28건, `q=gukbap` 171건.
- 주변 표시: 망원 `nearbyRadiusMetres=100` 152곳, 서문시장 100 m 942곳.

## 운영 CDP (prod.mjs, 번들 `index-zxkGhTmE.js` 까지)
- 남대문 8조합 모두 ready, 핀 색은 사이트 테마만 따름, 검색 「칼국수」 5건, 결과 선택 4배 확대, 「시장 안입니다」.
- 광장: 검색 「빈대떡」 → 순희네빈대떡에 대표·취급 메뉴와 출처, 「관광공사 소개 음식점」 모녀김밥·오라이등심.
- 망원·서문: 「시장 주변 100 m 안 가게」 안내와 「주변 · 소속 미확인」 배지. 망원은 묶음 수정 전 번들에서 핀이 한 덩어리(1)였고, `911e10534`(번들 `index-D5REybK5.js`) 반영 뒤 재촬영: 망원 핀 8(모바일)·22(데스크톱), 남대문 18·42 — 8조합 모두 ready.
- 첫 촬영에서 남대문 데스크톱 다크 2조합이 비어 있었던 것은 OOM 재시작 시각과 일치, 재촬영에서 정상.

## 남은 것
- content 메모리 여유: 힙 비율(`MaxRAMPercentage=60`)을 낮출지는 별도 제안.
- 7-2 이후(블록·도식·순서 입력), 바탕 지도(OpenFreeMap) 도입 여부는 사용자 결정 대기.

## 10-17 오전 — OOM 수정과 바탕 지도 ③ 첫 반영
| 커밋 | 내용 | 운영 확인 |
|---|---|---|
| `20e722d6b` | 공개 상세·메뉴 붙이기가 원천 JSON 두 열을 안 읽는 투영(`findStoresForDisplay`) | `./gradlew --no-daemon :place:feature:test --rerun --tests '*Market*'` → BUILD SUCCESSFUL, tests 209 failures 0 |
| `646c15184` | content 전용 `MALLOC_ARENA_MAX=2` | 새 파드 env 확인. 바닥 메모리: 기동 2.5분 590Mi, 12분 673Mi (수정 전 4분 878Mi) |
| `626de7d6e` | WU-23 렌더 잡(`scripts/market-basemaps/render.mjs`, 워크플로) | 로컬 실행 3곳 1536×1152 성공. CI run 38995080575 success(light·dark·index), 버킷 11객체(5시장×2 + index.json) |
| `a0a16f1c4` | WU-24 FE 바탕 `<image>` | 운영(번들 `index-ZLg9SAyy.js`): 남대문 light/dark·망원·광장 모두 `image.href=markets/{id}/z18-*.png`, 골목 선 0/0, 출처 줄 true, 핀 18·8·19 |
| `2e7eb67a7` | CI 러너에 Noto Sans CJK 설치 | 첫 CI 렌더(서문·광명)의 한글 도로명이 □□□ — 재실행 run 38995722148 |

- 버킷 `msa-market-basemap`(공개 읽기) · 쓰기 PAR 만료 2027-10-17 · 시크릿 `MARKET_BASEMAP_PAR`.
- Codex 샌드박스는 크롬이 SIGABRT 라 렌더 실측은 세션 로컬에서 했다.

## 10-17 낮 — 바탕 프록시·정합 수정·네이버 기본 배선·전체 렌더
| 커밋 | 내용 | 확인 |
|---|---|---|
| `1521d6449` | WU-25: nginx `/basemaps/` → OCI 버킷 프록시(`proxy_cache` 200m), portal-fe 공인 443 이그레스 NP, 렌더러가 `meta.json`(bounds) 동반 업로드 | 배포 뒤 `curl -D - https://place.1989v.com/basemaps/markets/132180/meta.json` → `200 · content-type: application/json · cache-control: public, max-age=3600`, PNG `200 image/png 333478B`, 없는 시장 `404`. NP `allow-portal-fe-egress-https-public` 생성 확인 |
| `b660349ef` | FE 바탕 프레임이 **2배 넓었다** — 256px 타일 공식을 썼는데 MapLibre 는 512px 타일(줌 18 1536px = 약 364 m). `meta.bounds` 우선 + 공식 `2 ** (zoom + 1)` | 렌더러 실측 `bounds width 363.2 m, height 272.4 m`. 운영(번들 `index-CyJrhgNs.js`): 남대문 `image w 357.10 h 267.83`(수정 전 714), 망원 `303.93×227.95`, 핀 18·8, 골목 선 0, 출처 줄 표시 |
| `3b6371e8e` · `95c590832` | WU-26 `MarketNaverMap`(SDK 1회 로드·핀·경계·내 위치) + meta 배선 테스트 | `npx tsc -b` exit 0, `vitest run src/pages/place` 37 files · 615 tests |
| `f10696523` | WU-27: `MarketMap` 이 공급자를 고른다 — 키 있고 window 있으면 네이버, SDK 실패·키 없음·SSR 은 SVG 지도. 토글 + 선택 기억, 줌·idle 마다 24px 재묶음, 공통 `MarketClusterSheet`(MarketCanvas 에서 분리), 검색 결과 `panTo`+줌 19, 내 위치 마커+정확도 원, 경계선·골목 이름, `language=en`, 네이버일 때 OpenFreeMap 출처 숨김 | Codex 구현 → 직접 재검증 `tsc` exit 0, vitest **38 files · 625 tests**. 폴백 조건 제거 시 SDK 실패 테스트 빨간불(Codex 확인). 키가 비어 있어 운영 화면은 그대로(AttractionMarket 테스트가 토글 부재를 고정) |

- 전체 렌더 run 38997645505(light·dark·index 모두 success): **요청 124 · 완료 123 · 실패 2**(`2765404` light·dark, `API HTTP 500`). 124 = `/markets/content-ids` 가 주는 「가게 행이 있거나 경계가 있는 시장」 — 지도가 그려지는 곳만이라 828 전부를 렌더하지 않는 것이 맞다. `markets/index.json` renderedAt 03:20:20Z.
- **신거북시장(`2765404`, market 95) 상세 500** — MySQL 8.0.46 `Out of sort memory, consider increasing server sort buffer size`(`sort_buffer_size` 262144). `findForDisplay` 의 넓은 select(TEXT 5열) + `ORDER BY id` 가 filesort 를 타는데, 가게 573행(IN 0, items 최대 49자)인 이 시장만 터지고 남대문 3,929행은 통과. 운영 DB 에 같은 SQL 로 재현: ORDER BY 있음 → 오류, 없음 → 577줄, `sort_buffer_size=1M` → 통과. 한 시간에 60회 발생. 수정(`038d42713`): SQL 정렬을 빼고 메모리에서 `sortedBy { it.id }`(전 행을 읽는 조회라 결과 동일). `:place:feature:test` 시장 3클래스 55 tests · 0 failures. 배포(content `038d427`, 12:42 기동) 뒤 `curl /api/v1/place/markets/2765404` → **200** 2.74s, 새 파드 로그 `Out of sort memory` 0건 · ERROR 0건, 20분 589Mi. 바탕 재렌더 run 39001125456 success: `z18-light.png` 143971B · `z18-dark.png` 137998B · meta.json 04:04Z.
## 10-17 오후 — 사용자 지적 넷(커버 범위·진입점·검색·핀 탭)
운영 재현(남대문 34550, 번들 `index-BK_N8eYb.js`)으로 원인을 먼저 잡았다.

| 지적 | 재현 | 원인 | 수정 | 운영 확인(번들 `index-Di3AH0L_.js`) |
|---|---|---|---|---|
| 핀을 눌러도 반응 없음 | 지터 0px 탭만 시트가 뜨고 3·6·12px 탭, 데스크톱 3px 클릭은 전부 무반응 | 드래그 판정이 **viewBox 단위 2**(모바일에서 약 1.3 px) 를 연속 move 차로 재서, 손가락이 조금만 움직여도 `dragged` → 선택 버림. 시트 z 40 이 액션 바 200 아래라 아래쪽 줄도 가려짐 | 눌린 자리 기준 **화면 픽셀 슬롭**(터치 10 px·마우스 4 px), 시트 층 300 (`56612a7e4`, `42af0fa5b`). 회귀 테스트: 옛 판정 주입 시 빨간불 확인 | 모바일 3px 탭 → 시트 top 380 · z 300 · 「같은 필지 가게 (85)」 85행, 데스크톱 3px 클릭 → 48행. 40px 스와이프는 선택 안 함 |
| 진입점이 어색 | 「시장 지도」 링크가 페이지 1,646px 아래(이용 안내 뒤 점프 내비)에만 있고 시장 섹션은 1,996px | 시장 관광지도 일반 관광지 순서(역·정류장 → 이용 안내 → 방문 정보 → 시장) | 첫 화면 액션 줄에 `시장 지도` 버튼(`#market`), 시장 섹션을 점프 내비 바로 뒤(방문 정보 앞)로, 점프 순서도 맞춤 (`56612a7e4`, `a16287caa`) | 액션 줄 버튼 top 234(모바일)·217(데스크톱), 섹션 1,761 → 방문 정보 3,996 앞 |
| 시장 전체가 안 덮임 | 바탕 이미지가 지도 왼쪽 아래 한 조각, 핀은 그 밖까지 | 줌 18 고정 프레임 364×272 m < 남대문 IN 가게 범위 342×322 m(+주변 300 m 핀) | 렌더러가 IN 가게 ∪ 경계 범위(+15%)가 들어가는 줌(18→17→16)을 고르고 중심은 그 범위 가운데, 파일명 `{theme}.png` (`635f98e85`) | 남대문·망원 meta `zoom 17`(727×545 m). 운영 `<image>` 714×536 단위, x −57·y −52 → 뷰박스 600×440 을 다 덮음. 전체 재렌더 run 39002883536 |
| 검색엔진 기반이 아님 | 섹션은 브라우저 부분 문자열, `/markets` 는 MySQL LIKE | 설계 사안 | `p7-plan.md §9` 설계안(OpenSearch 전용 색인 12.6k 문서 + 배치 + 폴백, ADR 필요) — 결정 대기 | — |

- FE 검증: `npx tsc -b` exit 0, `vitest run src/pages/place` 38 files · 626 tests(지터 탭 테스트 1 추가). 렌더러 로컬: 남대문·망원 `--only` 렌더 → zoom 17, PNG 가 남대문로~퇴계로 블록 전체를 담음.
- 전체 재렌더 run 39002883536 success: **요청 124 · 완료 124 · 실패 0**(`styleVersion …-zfit-v2`). 줌 분포 18: 94곳 · 17: 27곳 · 16: 3곳 — 넷에 하나는 고정 줌 18 로는 안 들어가던 시장이었다. 남대문 light.png 565,960B(줌 18 때 333KB).
- 최종 FE(`a16287caa`, 번들 `index-Y5LaXt-F.js`, 13:53 배포): 모바일 3px·6px 탭 모두 시트(z 300, 85행), 데스크톱 3px 클릭 48행, 40px 스와이프는 선택 안 함. 액션 줄 「시장 지도」 top 234, 점프 내비 순서 요약·가는 법·시장 지도·방문 정보·주변.
- 계측 함정: 손가락 지터를 양 축에 같이 주면 6px 이 8.5px 이라 8px 슬롭에서도 떨어졌다 → 10px.
- 배포 함정(보고만): FE 커밋 둘(`42af0fa5b`·`a16287caa`)이 15분 간격으로 들어가 images 가 거의 동시에 돌았다. 뒤 빌드의 「직전 이미지」는 그 커밋 매니페스트의 태그(아직 `56612a7`)라 `42af0fa5b` 의 번들 `index-BQ0pyKlu.js` 가 보존 목록에서 빠졌고, 롤아웃 직후 한 번 그 번들 404 를 봤다(옛 HTML 을 든 클라이언트만 영향, 새 로드는 정상). `retain-assets` 는 순차 배포를 전제한다 — FE 는 커밋을 모아 한 번에 올리는 편이 안전하다. 첫 재현 때 contentId 로 상세를 열어 「찾을 수 없는 관광지」를 재고 있었다(관광지 id 34550 이 맞다).
- `markets/index.json` 은 README 계약대로 **최신 실행의 결과**다 — 신거북시장만 다시 돌린 뒤 `requested 1 · ok 1` 로 바뀌었고, 전체 run 의 124/123/2 는 run 38997645505 의 아티팩트(14일)와 이 문서에만 남는다. 누적 목록으로 바꿀지는 결정 대기(FE 는 시장별 meta.json 만 읽어 영향 없음).
- content 메모리(MALLOC_ARENA_MAX=2 뒤): 기동 48분 709Mi · 56분 715Mi · 65분 720Mi, 재시작 0.
- 측정 함정(재발): 관광지 상세 경로는 `contentId` 가 아니라 관광지 id(남대문 34550·망원 22534). contentId 로 열면 「찾을 수 없는 관광지」가 뜨고 계측기는 SVG 없음으로 죽는다 — P5 기록의 함정 그대로.

## 10-17 저녁 — 남대문 재측정과 구조 진단
사용자: 「지도가 잘려 그림 위에 마커를 올린 느낌 — 지도를 그대로, 폴리곤 옅게, 점포 마커로. 우측 목록 UI 깨짐」. 배포(`a16287caa`, 번들 `index-Y5LaXt-F.js`) 그대로 남대문 34550 을 세 뷰포트에서 쟀다(`prod-structure.mjs` · `prod-dom.mjs` · `prod-drag.mjs` · `prod-hashscroll.mjs`, 캡처 `struct-*.png`). 판정과 개편안은 `p7-plan.md §10`.

| 항목 | 1280×900 | 1024×768 | 390×844 (DPR 2) |
|---|---|---|---|
| 지도(svg) | 706×518 | 552×405 | 358×263 |
| 우측 패널 / 열 | 470px, 3fr/2fr | 368px | 지도 아래 1열 |
| 바탕 원본px/화면px 1배 → 4배 | 1.83 → 0.46 | 2.34 → 0.58 | 3.6 → 0.9 |
| 뷰박스 덮음(1배 · 4배) | 1.0 · 1.0 | 1.0 · 1.0 | 1.0 · 1.0 |
| 묶음 핀 1배 → 4배 | 42 → 123 | 31 → 110 | 18 → 85 |
| 패널 행 / 목록 scrollHeight(448px 상자) | 2,317 / 368,479 | 2,317 / 369,895 | 2,317 / 370,687 |
| 핀 선택 뒤 | 패널 사라지고 시트(h 490) 옆 칸 | 시트 top 518(툴바 높이), 지도 그림 top 570 | 고정 시트 top 380 · h 464 가 지도(641~904)를 전부 덮음 |
| 검색 「떡볶이」 | 12행, 이름이 버튼 상자 | 같음 | 같음 |

- 바탕 이미지 `/basemaps/markets/132180/dark.png` 1536×1152, `<image>` x −57 · y −52 · 714×536 단위. 1배는 선명하지만 4배 캡처(`struct-desktop1280-3-zoom4.png`)에서 건물·도로가 흐리고 구워진 도로명이 핀보다 크게 보인다.
- DOM: 페이지 18,534 노드 중 시장 섹션 17,074(92%), 그중 목록 16,847. JS 힙 32MB. 검색 입력 → 2프레임: 「떡」 41ms · 「떡볶」 25ms · 「떡볶이」 33ms · 지우기 102ms, 구역 칩 클릭 32ms.
- 스티키: 데스크톱은 머리띠가 안 붙고 패널·지도가 top 80px 에 붙는다(겹침 없음). 모바일은 `place-header` 60px + `place-jump` 44px(z 200) + 액션 바 56px.
- 터치 드래그(390px): 지도 중앙에서 120px 느린 드래그 → pointerdown 1 · pointermove 12 · pointerup 1 · pointercancel 0, viewBox `0 0 600 440` → `201.1 120.7 600 440`, scrollY 2036 불변. 대조군(안내문 위 같은 드래그) → scrollY 2036 → 2176. `touch-action: none` 이 운영에서 듣는다.
- HTML 가로 넘침 0(scrollWidth 초과로 잡힌 것은 전부 SVG `<text>`).
- 계측 함정: 첫 실행에서 모바일 `scrollBy(0,500)` 뒤 scrollY 가 5,566(최대)으로 튀었는데, 직전에 2,163px 섹션을 `captureBeyondViewport` 로 찍은 뒤였다. 해시 있음 / 없음 / 「시장 지도」 버튼 진입 셋 다 `scrollBy(100)` → +100 으로 재현 안 됨 — 긴 클립 캡처가 스크롤 위치를 바꾼 것이지 사이트 문제가 아니다.

## 10-17 밤 — 구글맵 운영 확인과 바탕 데이터 비교
사용자 질문 「구글맵에 하는 건?」. 판정은 `p7-plan.md §10.5`.

- 운영 번들(`find-gmaps-chunk.mjs`, 엔트리부터 98 청크 순회): 구글맵 로더는 `useMediaQuery-B88sbR73.js`(19,562B) 에 있고 `AIza…` 키 리터럴 1개 + `VITE_GOOGLE_MAPS_KEY not set` 분기. 엔트리 `index-Y5LaXt-F.js` 에는 없다(지도 코드는 lazy 청크). 네이버 `ncpKeyId` 리터럴은 없음(운영은 SVG 폴백 — 기존 판정과 같다).
- 실제 로드(`prod-gmaps.mjs`, 1280×900, 캐시 끔): `/` 지역 목록 → `google.maps` 3.66.9d, `.gm-style` 830×642, `maps/api/js` 200 · 타일 16건 200, 「development purposes」 워터마크 없음, 캡처 `gmaps-region-list.png`(하단 「지도 데이터 ©2026 TMap Mobility」). `/attractions/34550` → 근처 탐색 지도 768×510(top 3,187), `maps/api/js` 200 · 타일 12건 200, 워터마크 없음. `gmaps-attraction-detail.png` 는 뷰포트 밖 clip 을 `captureBeyondViewport` 없이 찍어 검정 — 계측 함정, 수치는 유효.
- 바탕 비교(`gtiles.mjs`): 구글 래스터 타일(`mt1.google.com/vt`, scale 2 — **평가용 1회 조회, 운영 경로 아님**) 2×2 를 이어 중심 768px 을 자르고, 운영 PNG `/basemaps/markets/{id}/light.png`(2x, 줌 17) 중심 768px 과 같은 축척으로 붙였다 → `compare-{namdaemun|seokgok|muju}-z17-ko.png`(좌 구글 · 우 OpenFreeMap), 영문 `compare-namdaemun-z17-en.png`, 남대문·천안 z18 `gmap-*-z18-ko-crop.png`. 바탕 PNG 가 없는 세 곳(설악눈메골 2990069 · 천안역전 2762950 · 덕계 1012430 — 지도 124곳 밖, 가게 180·637·414)은 구글만 `gmap-*-z17-ko-crop.png`.
- 결과: 구글은 여섯 곳 모두 건물 외곽선·도로명·POI(식당·마트·정류장) 가 있고 남대문은 상가 건물 이름까지. OpenFreeMap positron 은 도로·도로명(한/영 병기)은 있으나 POI 가 없고 석곡·무주는 건물이 거의 없다. 50% 축소 비교 이미지에서 OpenFreeMap 쪽이 빈 면처럼 보이는 것은 옅은 색 때문이고 원본 768px(`ofm-namdaemun-z17-crop.png`)에는 건물·길이 있다.
- 가격(공식 pricing 페이지 2026-10-17): Dynamic Maps Essentials 월 10,000 무료 → $7/1,000(~100k). Static Maps 10,000 무료 → $2/1,000.

## 10-17 밤 — 네이버 키 반영 배포 확인
커밋 `1b82427dc`(`NAVER_MAP_KEY_ID`), images run 39032691068 21:29 → 21:35 완료, portal-fe 교체 21:35:42, 번들 `index-BZaEm6V7.js`. 스크립트 `prod-naver2.mjs`(수치) · `prod-naver3.mjs`(뷰포트 캡처), 캐시 끔, `window.navermap_authFailure`·`alert` 를 가로채 인증 실패를 잡는다.

| 페이지 | SDK `maps.js?ncpKeyId=52axkewhxc&language=` | `/v3/auth` | 타일 200 | 인증 실패 콜백 | 네이버 핀 / 골목 라벨 | 토글 | 출처 줄 |
|---|---|---|---|---|---|---|---|
| 남대문 34550, 1280×900 | 200, `ko` | 200 | 32 | 없음 | 41 / 0 | 「우리 지도로 보기」 | TourAPI · 공공누리 |
| 남대문 34550, 390×844 DPR 2 | 200, `ko` | 200 | 21 | 없음 | 41 / 0 | 〃 | 〃 |
| 망원 22534, 1280×900 | 200, `ko` | 200 | 28 | 없음 | 22 / 7 | 〃 | **© OpenStreetMap contributors** · TourAPI |

- 뷰포트 캡처 `naver3-viewport-light.png` · `naver3-viewport-dark.png`: 네이버 바탕(숭례문·회현역·건물 이름) 위에 구역 색 묶음 핀, 줌 컨트롤, NAVER 로고·©NAVER Corp·50 m 축척. 지도 영역 평균색 라이트/다크 모두 밝은 지도(다크 테마에서 mean 227 · std 51).
- 영문: 가게 좌표가 있는 시장 관광지에 `lang='en'` 행이 없어(쿼리 0건) 영문 시장 상세 자체가 없다. `language=` 는 페이지 언어를 따르므로 영문 행이 생기면 `en` 으로 나간다(`MarketNaverMap.tsx:42·65`).
- 계측 함정 둘: ① `Page.captureScreenshot` 의 `clip` 은 **페이지 좌표**라 뷰포트 rect 를 그대로 주면 스크롤만큼 위를 찍는다 — 1차 캡처가 전부 단색(19,19,19 = 히어로 배경)이었던 이유. `prod-structure.mjs` 처럼 `scrollY` 를 더해야 한다. ② 네이버 핀은 `.place-market-naver-pin`(SVG 는 `.place-market-pin`) — 1차 probe 의 `pins: 0` 은 선택자 문제.

## 10-17 밤 — WU-29 배포 확인 (네이버 위 폴리곤·골목선·줌 단계별 마커)
커밋 `69ce8751e`(Codex 구현) → run 39034421750 22:02 완료 → 운영 `index-Ct06Mw3O.js` 에서 두 결함 발견 → 수정 `775a08b35` → run 39035680548 22:20 완료 → 운영 `index-BJWpm5Gi.js`. 스크립트 `prod-naver4.mjs`(줌은 지도 중앙 휠, 캡처는 페이지 좌표, 예외는 스택 포함), 감시 `deploy-watch-wu29.sh`(배포 뒤 운영 HTML 의 엔트리 번들이 바뀔 때까지 기다린 뒤 측정).

| 페이지 (1280×900) | z17 | 휠 2단 확대(≈z19) | 핀 탭 | 휠 3단 축소(≈z16) | 폴리곤·선(svg path) | SDK/auth/타일 |
|---|---|---|---|---|---|---|
| 남대문 34550 | 묶음 41 | **묶음 6**(화면 안 150곳 초과 → 묶음 유지), 이름 라벨 0 | 시트 열림 | 시장 마커 1 「남대문시장 · 2314」 | 5 (시장 hull + 구역 4) | 200/200/137 |
| 남대문 390×844 DPR2 | 묶음 39(화면 범위 필터) | 휠이 페이지를 스크롤해 측정 불가(터치 핀치는 별도) | 시트 열림 | 〃 | 5 | 200/200/21 |
| 석곡 22679 | 묶음 8 | 개별 16 + 이름 16, 골목 라벨 1 | 시트 열림 | 시장 마커 1 | 6 (경계 + 구역 + 골목 3) | 200/200/124 |
| 망원 22534 | 묶음 22 | 개별 82 + 이름 82, 골목 라벨 7 | 시트 열림 | 시장 마커 1 | 22 (경계 + 구역 + 골목 20) | 200/200/124 |

- 캡처 `wu29-{namdaemun|namdaemun-mobile|seokgok|mangwon}-{z17|zoom-in-2|zoom-out-1|zoom-out-2}.png`: 남대문 z17 에 옅은 회색 시장 폴리곤과 분홍·초록·갈색 구역 hull, 구역 색 묶음 핀이 네이버 바탕(상가 이름·회현역) 위에 보인다. 축소하면 폴리곤 + 「남대문시장 · 2314」 마커 하나. 석곡 z19 는 가게 이름 라벨이 겹치지 않게 아래로 비켜 선다.
- 수정 전(`index-Ct06Mw3O.js`) 결함 둘: ① 폴리곤 자리가 **검은 상자** — `.place-market-map svg { background; border }` 가 네이버가 오버레이마다 만드는 svg 요소에도 적용됐다. 선택자를 `.place-market-canvas svg` 로 좁혀 해결(`wu29-namdaemun-z17.png` 전/후). ② 남대문 z19 한 화면에 개별 마커 **794개** — 화면 안 150곳 초과면 줌 19 이상에서도 묶음 유지(`INDIVIDUAL_LIMIT`, 단위 테스트 + 회귀 주입으로 빨간불 확인).
- 콘솔 예외 1건 `TypeError: Cannot read properties of undefined (reading 'x')` 는 스택이 전부 `maps.js`(네이버 SDK `distance`) 안이고, 합성 휠 이벤트 중에만 나며 페이지 로드 12초 동안(`prod-err.mjs`)에는 없다. 우리 코드 프레임 없음 — 추적만.
- 구글 폴백 실측(`prod-fallback.mjs`, 배포 없이 운영에서): ① `Network.setBlockedURLs` 로 네이버 SDK 를 막자 → `naverHost:false, googleHost:true, gmStyle:true`, `maps.googleapis.com/maps/api/js` 200, 구글 마커 82, 경고문 없음, 토글 「우리 지도로 보기」. ② 네이버 정상 로드 뒤 `window.navermap_authFailure()` 호출 → 네이버 호스트 사라지고 구글 지도(마커 82)로 교체, 콘솔 예외 0. 캡처 `fallback-google-blocked.png` · `fallback-google-auth.png`.
- 계측 함정: 디플로이먼트가 `1/1 updated` 가 된 26초 뒤에 재도 옛 파드 응답이 왔다(엔드포인트 전파 지연). 첫 측정이 `index-Ct06Mw3O.js` 대신 `index-BZaEm6V7.js` 였고 수치(z16 에서 묶음 6개)로 알아챘다. 이후 감시는 운영 HTML 의 엔트리 번들이 이전 값과 달라질 때까지 기다린다. 다만 **엔트리 해시는 lazy 청크만 바뀌어도 같이 바뀐다**는 전제에 기대므로, 확실한 건 새로 넣은 심볼(`gm_authFailure`)이 파드 자산에 있는지였다(`kubectl exec … grep -rl gm_authFailure`).

## 10-17 밤 — WU-30 배포 확인 (전용 화면 `/attractions/:id/market`)
`31c641888`(Codex) → 운영 `index-_BGLUziT.js` 측정 → 수정 `dfd2afee1` → 운영 `index-4OJ6MOpM.js` 재측정. 스크립트 `prod-wu30.mjs`(시트 손잡이 탭으로 peek→half→full, 핀 탭, 검색 입력, 더 보기), 감시 `deploy-watch-wu30.sh`(새 번들 확인 뒤 측정).

| 상태 (남대문 34550) | 390×844 수정 전 → 후 | 1024×768 | 1280×900 |
|---|---|---|---|
| 문서 스크롤 높이 / 뷰포트 | **904 / 844 → 844 / 844** | 768 / 768 | 900 / 900 |
| 지도(stage) peek · half · full | 506 · 325 · 108 → 464 · 298 · 99 px | 좌 400 패널, 지도 624×647 | 좌 400 패널, 지도 880×779 |
| 시트 높이 peek · half · full | 217 · 398 · 615 → 199 · 365 · 564 px | 패널 647 | 패널 779 |
| 목록 | 「현 지도에서 1267곳 · 지도 위치 없음 1047곳」, 50행 + 더 보기 | 〃 | 〃 |
| 핀 탭 | snap half, 첫 두 행 「선택한 필지」(0심이 · 88체육사, 남대문시장4길 21) | 〃 | 〃 |
| 검색 「떡볶이」 | URL `?marketQuery=%EB%96%A1%EB%B3%B6%EC%9D%B4`, 「찾은 가게 12곳」 12행 | 〃 | 〃 |
| DOM 노드 | 720 → 검색 뒤 432 (상세 페이지 18,534 대비) | 736 | 746 |
| 제목 · canonical | 「남대문시장 가게 지도 \| K-관광」 · `/attractions/34550/market` | 〃 | 〃 |

- 망원 22534 모바일: 「현 지도에서 152곳 · 지도 위치 없음 93곳」, 핀 22, 구역 칩 8, 검색 「떡볶이」 7행.
- 수정 전 캡처(`wu30-mobile-initial.png` 1차)에서 잡힌 셋: ① 네이버 핀마다 어두운 네모 — `.market-map-page button { background; border; padding }` 이 HTML 마커(button)에도 적용. 상단 바·구역 칩·목록 버튼으로 선택자를 좁혔다. ② 모바일에서 문서가 60px 스크롤 — 셸이 탭바 몫으로 body 아래를 비우는데(`kh-shell.css` `--kh-shell-bottom`) 페이지가 `100dvh` 를 통째로 잡았다. 같은 값을 뺐다. ③ 「우리 지도로 보기」가 네이버 줌 컨트롤 자리(왼쪽 위)와 겹침 — 오른쪽으로.
- nginx: apex `1989v.com/attractions/:id/market` 가 place 호스트로 안 넘어갔다(리다이렉트 맵이 id 뒤를 모름). `(/market)?` 를 더하고 `scripts/check-nginx-public-aliases.py` 에 케이스를 넣어 옛 설정에서 실패(200 SPA 셸) → 새 설정 통과(94건)를 확인. 새 경로는 상세 렌더 프록시(`/attractions/{id}$`)에 안 걸리고 SPA 셸로 떨어진다(의도).
- 계측: 모바일 에뮬레이션에서 휠은 페이지 스크롤이라 시트 전환은 손잡이 탭으로 쟀다. 콘솔의 네이버 SDK `distance` 예외는 합성 클릭에서도 난다 — 우리 프레임 없음, 추적만.

## 10-17 밤 — WU-31 배포 확인 (상세 절 → 요약 카드, 옛 목록 제거)
`b987e4094` → 운영 `index-BaEzC6oe.js`(23:33). 스크립트 `prod-wu31.mjs`.

| 측정 | 1280×900 | 390×844 |
|---|---|---|
| 상세 페이지 DOM 노드(전) → (후) | 18,534 → **1,613** | → 1,301 |
| `#market` 절 노드 | 150 | 98 |
| 카드 구성 | facts 1 · 구역 링크 3(남대문시장4길 949 · 남대문시장길 202 · 남대문시장6길 83) · 「지도 전체 보기」 링크 2(투명 레이어 + 글자) · 관광공사 음식점 3 | 〃 |
| 미리보기 지도 | 1166×656(16:9), 타일 36, 줌 컨트롤 없음, 마커 1 「남대문시장 · 2314」 | 324×182, 타일 10 |
| 옛 검색 입력 / 패널 / 시트 | 0 / 0 / 0 | 〃 |
| 액션 줄 「시장 지도」 href | `/attractions/34550/market` | 〃 |

- 리다이렉트: `/attractions/34550?marketQuery=떡볶이` → `/attractions/34550/market?marketQuery=…`(검색창 「떡볶이」), `/attractions/34550#market` → `/attractions/34550/market`.
- 전용 화면 핀(`.place-market-naver-pin`) 계산 스타일: `background rgba(0,0,0,0) · border 0 · padding 0 · 44px` — 브라우저 기본 button 상자가 사라졌다(`wu31-screen-mobile-screen.png`).
- 콘솔 예외 0(이번엔 합성 휠·클릭 없이 로드만).
- 캡처(`wu31-detail-desktop-card.png`)에서 미리보기 지도가 16:9 상자(1166×656) 가운데 약 512×470 만 그리고 있었다 — 네이버 지도는 만들어질 때의 상자 크기를 기억하고, 호스트는 어댑터 기본 비율(600/440)·최소 높이를 갖고 있었다. 두 어댑터에 ResizeObserver 로 `setSize`(네이버)/`resize` 이벤트(구글)를 넣고 미리보기 호스트의 비율·최소 높이를 풀었다(`bb1943a46`). 확인은 `prod-preview.mjs`(타일이 상자를 덮는지): 운영 `index-BqEvTk6h.js`(23:51)에서 데스크톱 `box [1166,656] = host [1166,656]`, 타일 36장이 1792×1280 을 덮어 `coversBox: true`; 모바일 `box [324,182] = host`, 타일 10장 768×768, `coversBox: true`(`preview-desktop.png` · `preview-mobile.png`). 이번엔 파드 교체 뒤 운영 HTML 의 번들 해시가 바뀌기까지 약 4분이 걸렸다 — 엔드포인트 전파 지연의 상한을 다시 올려 잡는다.
  **그러나 캡처는 여전히 가운데 512×470 만 그려져 있었다**(15초 대기 뒤에도 좌상단 120px 픽셀 표준편차 0, 평균 249 = 빈 바탕). 네이버 내부 컨테이너는 1166×656 이었으니 `setSize` 는 먹었지만 타일 레이어가 만들 때 크기에 묶여 있었다. 두 어댑터를 「상자 크기가 0 이면 만들지 않고, 첫 비-0 크기에서 그 크기(`size` 옵션)로 만든다, 이후 변경은 `setSize` + `resize` 이벤트」로 바꿨다(`d63aee011`, 다른 세션의 `df3ac4b4c` 빌드에 실려 배포, 번들 `index-COGnv78P.js`). 결과: 좌상단 표준편차 데스크톱 22 · 모바일 33(지도가 모서리까지 그려짐), `coversBox: true`. 교훈: DOM 크기와 그려진 픽셀은 다른 증거다 — 숫자가 초록이어도 크롭 캡처를 봐야 한다.

## 10-17 밤 — WU-32 배포 확인 (바탕 PNG 파이프라인 제거)
`2d476f12c` → 운영 `index-W5oJ9JjS.js`(23:39). 배포 전 검사: tsc 0건 · vitest 9파일 129건 · `grep -rni "basemap|openfreemap|openmaptiles"` 0건 · nginx 계약 검사 94건 통과 · `kubectl kustomize k8s/overlays/oci-arm` 정상(378,637B, 삭제한 NetworkPolicy 이름 0회).
- `curl -sI https://place.1989v.com/basemaps/markets/132180/meta.json` → `HTTP/2 200 · content-type: text/html` — `/basemaps/` location 이 사라져 SPA 셸 폴백으로 떨어진다(이전엔 OCI 버킷 프록시의 JSON).
- 같은 배포에서 `prod-wu31.mjs` 재실행: 상세 카드 1,614 노드 · 미리보기 마커 1 · 리다이렉트 둘 · 전용 화면 핀 투명 — 바탕 코드가 빠져도 화면은 그대로.
- 남은 수동 작업(사용자): GitHub 시크릿 `MARKET_BASEMAP_PAR`, OCI 버킷 `msa-market-basemap` 삭제. 코드 참조 0건이라 지우지 않아도 동작엔 영향 없다.

## 10-18 새벽 — WU-28a 배포 확인 (가게 검색 전용 색인 `market-stores`)
`6b885df75`(ADR-0111) → images run 39042286427 23:54 완료 → search·gateway 파드와 CronJob 이미지 `6b885df` 23:58. 재색인 잡을 수동으로 한 번(`kubectl create job --from=cronjob/market-store-reindex market-store-reindex-manual-2358`, `deploy-watch-wu28a.sh`).

```
MarketStoreApiReindexTasklet : Market stores: 21387 documents; 0/124 markets failed; missing nameRoman=21387 categoryEn=8904
IndexAliasManager            : Alias 'market-stores' 교체 검사 통과 — 새 21387 건 / 라이브 0 건
IndexAliasManager            : Alias 'market-stores' → 'market-stores-20261017-1458' (removed 0 old)
Step: [marketStoreReindexStep] executed in 2m16s258ms · job succeeded=1
_cat/indices: market-stores-20261017-1458  docs.count 21387  store.size 4.1mb
```

| 질의 (`GET /api/v1/search/market-stores`, 게이트웨이 경유) | 결과 |
|---|---|
| `q=떡볶이&contentId=132180` | 200, items 첫 건 `matchedBy ["DISH"]` score 5.52 |
| `q=떡복이`(오타) | 200, 첫 건 `["DISH","CATEGORY","NAME","ITEMS"]` score 19.17 — fuzziness 가 잡는다 |
| `q=순대 국밥`(띄어쓰기) | 200, 첫 건 `["DISH","NAME"]` 32.38, 둘째 `["MENU","DISH"]` |
| `q=tteokbokki`(로마자) | 200, `["DISH"]` — 영문 음식명 전개(`dishesEn`)로 적중 |
| `q=떡볶이`(전체, 시장 집계) | 200, total 402, 첫 건 score 74.39, `markets[]` 집계 포함 |

- 색인 문서 수 21,387 은 `market_store_search` 12,606 보다 많다 — 공개 시장 응답의 가게 전부(좌표 없는 가게 포함, 영문 병합)를 넣었기 때문. 주의: API 의 `matchedBy` 는 **배열**인데 WU-28b 의 FE 검증 함수는 문자열을 기대한다 → FE 가 응답을 버리고 폴백한다. WU-28c 와 함께 FE 쪽을 배열로 맞춘다(아래 절).
- 원천에 없는 것: `nameRoman`(place 응답에 없음 — 21,387 전부 비어 있음, 로마자 질의는 `dishesEn`·`nameEn` 으로만), `categoryEn` 8,904건 비어 있음.

### 판정 세트 Recall@10 (`recall-eval.mjs`, 2026-10-18 00:10, 운영 API)
음식 10개(떡볶이·순대국밥·칼국수·김밥·호떡·만두·족발·빈대떡·잔치국수·튀김) × 변형 3(오타·띄어쓰기·로마자) × 시장 2(남대문 132180 · 망원 2499807). 정답 = 시장 응답(`/api/v1/place/markets/{id}`)에서 정규 표기가 이름·품목·업종·메뉴에 부분 일치하는 가게(엔진과 무관한 기준). 정답 0 인 조합 9개 제외 → **33문항**. 전 = 변형 질의를 그대로 부분 일치(브라우저 매칭의 근사), 후 = 엔진 상위 10.

| | 문항 | 전 (부분 일치) | 후 (엔진) |
|---|---|---|---|
| 전체 | 33 | 0.33 | **0.76** |
| 오타(떡복이·김빱·만뚜·족빨 …) | 11 | 0.00 | 0.63 |
| 띄어쓰기(순대 국밥·김 밥 …) | 11 | 1.00 | 0.92 |
| 로마자(gimbap·mandu·jokbal …) | 11 | 0.00 | 0.73 |

- 엔진이 못 잡은 것: `칼국쑤`·`호덕`·`빈데떡`(nori 가 음절 단위로 쪼개 fuzziness 가 안 닿음), `hotteok`·`kalguksu`(망원)(영문 음식명 사전에 없음). 띄어쓰기에서 조금 내려간 건 `김 밥`·`만 두` 가 「김」「밥」 단일 음절 토큰까지 맞춰 상위 10 에 다른 가게가 섞여서다 — `minimum_should_match` 나 구문 가중치로 다음 조정.
- 로그: `verify-p7/prod/recall-eval.log`(문항별 전·후·API total).

## 10-18 새벽 — WU-28b·28c 배포 확인 (FE 검색 연결 · 표시 필드 · `/markets` 한 번 호출)
- 28b(`575804b08`, 번들 `index-vwt9zK9C.js`): 전용 화면에서 한 글자씩 입력해도 `/api/v1/search/market-stores` 호출은 질의당 **1회**(마지막 입력 뒤 457~904ms), 전부 200. 단 목록은 폴백 수치(「떡볶이」 12곳 · 「떡복이」 0곳) — API 의 `matchedBy` 배열을 FE 가 문자열로 검증해 응답을 버렸다(`prod-wu28.mjs`).
- 28c(`518efcf27`): images run 39043691274 00:17 완료, search·portal-fe·CronJob `518efcf` 00:18, 수동 재색인 `market-store-reindex-manual-0018` 성공(alias → `market-stores-20261017-1519`, 옛 인덱스 1개 제거, 0 errors). API `q=떡볶이&size=2`: total 402 · markets 97 · item 에 `name 강남떡볶이 · address · goodPrice · marketName 계양산전통시장 · attraction {33245, ko}`, 응답 20,972B(시장 집계 97건 포함).
- 운영 번들 `index-C8dKICFB.js`(`prod-wu28c.mjs` · `prod-wu28.mjs`):

| 화면 | 결과 |
|---|---|
| `/markets?q=떡볶이` | API 호출 `/api/v1/search/market-stores` **1회**(시장 상세 호출 0), 행 117(시장 97 + 가게 20), 첫 행 「용인중앙시장 경기도 용인시 · 거리형 · 18 가게」, 링크 `/attractions/34456/market?marketQuery=…` |
| 전용 화면 「떡볶이」 | 호출 1 · 200 · 「찾은 가게 12곳」, 배지 「음식」(엔진 DISH) |
| 「떡복이」(오타) | 호출 1 · 200 · **「찾은 가게 17곳」**(폴백이던 0곳에서 엔진 결과로), 첫 행 남대문떡마을 「음식」 |
| 「순대 국밥」 | 호출 1 · 200 · 17곳, 「메뉴에 맞음」·「음식」 배지 |
| 「tteokbokki」 | 호출 1 · 200 · 12곳 |

- 정밀도 메모: 「떡볶이」 남대문 상위에 `KARL안경`(안경점)이 「음식」으로 들어온다 — 사전 전개(`dishes`)가 업종을 넓게 잡는 경우. 점수가 생기자 정밀도 문제가 보이기 시작했다(판정 세트의 띄어쓰기 하락과 같은 결) → 다음 조정 후보.

## 10-18 새벽 — WU-33a 남대문 경계 (OSM `way/78503350`, 수동 1회) + 수집 미도달 원인

- **원인**: `market_osm_raw` 가 247곳뿐이고 좌표 있는 시장 581곳(남대문 738 포함)은 한 번도 수집되지 않았다. 잡 이력: `market-osm-manual-1016`(10-15 15:18Z)·`market-osm-manual-1016d`(10-15 22:28Z) 둘 다 `DeadlineExceeded`(4시간), 수집일별 market_id 범위 10-15 = 1~117(116곳) · 10-16 = 118~249(131곳) — **id 순서로 ~120곳/4시간**. 주간 잡은 아직 한 번도 돌지 않았고(`lastScheduleTime` 없음, 첫 예정 10-19 20:20Z), 돌아도 id 순서 + 28일 갱신이면 앞 ~480곳만 돌고 뒤는 못 닿는다.
- **OSM 확인**(Overpass, UA 없으면 406): `way 78503350 남대문시장 amenity=marketplace tourism=attraction wikidata=Q494687`, 17꼭짓점, lat 37.557634~37.5610666 · lng 126.9760425~126.9788417(≈382×247m). 1.5km 안 다른 marketplace 는 만리시장(`way 314516468`)뿐.
- **적합도**(쓰기 전 로컬 계산, `market_store` 좌표 2,882행): 현재 IN 1,271 중 1,241 이 폴리곤 안(30 밖), 현재 OUT 1,611 중 544 가 안 → 새 IN 1,785.
- **실행**: `ssh msa-oci` 로 `svc/content:8097` 포트포워드 → 로컬에서 `place/ingest/src/market_osm.py` 의 `fetch_overpass → prepare` 뒤 Job 과 같은 `PUT /internal/markets/738/osm` + `POST …/rejudge`(스크립트는 스크래치패드 `ov/namdaemun_osm.py`, 드라이런 먼저). 응답: 경계 `{"source":"OSM","osmId":"way/78503350"}` 17꼭짓점, 골목 21(이름 17: 남대문시장길·2가길·2길·4길·6길·8길 + `서울한양도성 3코스 남산구간` 한 토막이 경계와 교차해 들어옴), `changedStores: 3929`, 재판정 뒤 **IN 1,781 · OUT 1,097 · UNKNOWN(좌표 없음) 1,047**, `osmFetchedAt 2026-10-18T01:02:33`(로컬 KST 시각 — 28일 창에서 무시된다).
- **운영 확인**: `GET /api/v1/place/markets/132180?lang=ko` → `boundary.source=OSM` 17꼭짓점 · `paths` 21(named 17) · stores 2,828(IN 1,781 · UNKNOWN 1,047; OUT 은 기본 응답에서 빠짐). 전용 화면 모바일(390×844, `index-COGnv78P.js`, 배포 없이 데이터만): 핀 51, 목록 머리말 「현 지도에서 1781곳 · 지도 위치 없음 1047곳」, 출처에 `© OpenStreetMap contributors` 추가, 폴리곤이 세종대로·남대문로·퇴계로 블록을 따라간다(캡처 `verify-p7/prod/namdaemun-boundary-mobile.png`). 구역 칩은 아직 길 이름(WU-33c 가 바꾼다).
- **WU-33b 테스트**: `plan()` 순서(미수집 큰 시장 → 작은 시장 → 오래된 순 → 최근 것 제외 → 읽기 실패는 끝) + 오케스트레이션 read 수·쓰기 순서. 옛 코드에 새 테스트를 대면 **6 failed / 27 passed**, 바꾼 뒤 **33 passed**(`python3 -m pytest tests/market_osm_test.py`).

## 10-18 새벽 — WU-33b 수집 순서 배포 · WU-33c 가게 유형 필터 배포 확인

- **WU-33b** `4ba40e105` → images run 39048440876 성공, CronJob 이미지 `place-ingest:4ba40e1`, 수동 Job `market-osm-manual-1018`(01:15:34Z 시작). 계획 줄 `[market-osm] plan {"ingested": 828, "due": 580, "neverFetched": 580, "skippedRecent": 248, "unreadable": 0}` — 미수집 580 = 좌표 있는 시장 581 − 수동 적용한 남대문. 첫 배치 50곳이 Overpass 를 도는 중(한 곳 ≈2분).
- **WU-33c** `ccafb5333` → images run 39048857742 성공(01:25:50), 운영 번들 `index-COGnv78P.js → index-DQM-VKPV.js`(01:27:38). 모바일 390×844 라이트, 캡처 `verify-p7/prod/wu33-{screen,fashion,card}-light.png`:
  - 전용 화면: 구역 칩 0, 유형 칩 「전체」+9 — 의류·신발 606 · 생활용품·가전 380 · 잡화·귀금속·안경 219 · 음식점 82 · 식료품 58 · 건강·미용 57 · 카페·주점 40 · 분식·간식 29 · 기타·서비스 1,357. 칩마다 유형 토큰 색점. 줌 17 핀 51 = **20px 16 · 26px 31 · 32px 4**(전 32px 고정), 색 분포 유형5 17 · 유형1 14 · 유형6 6 · 유형9 5 · 유형7 3 · 유형2 2 · 유형8 2 · 유형3 1 · 유형4 1. 머리말 「현 지도에서 1781곳 · 지도 위치 없음 1047곳」.
  - 「의류·신발」 탭: URL `?type=fashion`, 핀 32(20px 21 · 26px 10 · 32px 1) 전부 유형 5 색, 머리말 「현 지도에서 606곳」.
  - `?type=grocery` 직접 진입: 「식료품 (58)」 눌림, 핀 17(20px 16 · 26px 1) 전부 유형 4 색, 머리말 「현 지도에서 58곳」.
  - 상세 요약 카드: nav 「가게 유형」 링크 3 — `의류·신발 (606)` → `/attractions/34550/market?type=fashion`, `생활용품·가전 (379)` → `?type=living`, `잡화·귀금속·안경 (217)` → `?type=goods`(카드는 IN 만 세고 전용 화면 칩은 주변 가게도 세어 1~2 차이). 옛 구역 nav 0.
  - 첫 캡처는 롤아웃 직후라 데이터가 안 실려 칩 0·핀 0 이 나왔고 1분 뒤 재실행에서 위 값 — 번들이 바뀐 뒤에도 첫 요청은 비어 올 수 있다.
- **남은 관찰**: 「기타·서비스 1,357」 이 남대문에서 가장 큰 칩이다 — 좌표 없는 1,047곳이 대부분 업종 빈 값이어서다. 칩 수를 좌표 있는 가게로 좁힐지는 목록 머리말(「지도 위치 없음 N곳」)과 같이 정해야 한다. 골목 라벨에 「서울한양도성 3코스 남산구간」이 들어온다(경계와 교차하는 OSM footway).
- **WU-33b 첫 배치(02:52 KST)**: `batch {"markets": 50, "failedMarkets": 0, "calls": 50, "failedCalls": 0}` — 한 곳 ≈45초(마감 산정 2분보다 빠름), 50곳 쓰기(PUT + 재판정)에 ≈50분. DB: `market_osm_raw` 249 → 305곳, `market_boundary` OSM 76 → 103 · DERIVED 9 → 11, `market_path` 269곳. 오늘 쓴 시장의 경계 출처 OSM 30 · DERIVED 2 · 없음 29. 가게 수 상위 50 중 47곳 수집(나머지 3은 두 번째 배치). 재판정 뒤 IN: 광장시장 212/1,540 · 서울 평화시장 200/2,067 · 인현시장 24/1,967 — 셋 다 **전엔 IN 0**(원천 적재가 전부 OUT). 의정부 제일시장(674)은 OSM `way/705397631` 이 건물 한 채(꼭짓점 20, ≈60m)라 주변 500m 안 2,291곳이 전부 OUT 그대로 — 건물형 폴리곤 + 엄격 포함 판정의 한계. 서문시장·아리랑거리·조명의거리 등 29곳은 OSM 폴리곤이 없고 IN 가게도 0 이라 경계 없음(파생 불가).

## 2026-10-18 오전 — 마우스 핀 클릭·한글 검색 입력·데스크톱 목록 높이 (`873b74db5`, 번들 `index-Uyo1BA4Q.js`)
- 배포 전 진단(`index-DQM-VKPV.js`, CDP 실제 입력 이벤트): 핀 중심의 `elementFromPoint` 가 SDK 의 div 이고 mousedown/click 대상도 div(핀 밖) — 데스크톱·모바일 마우스 모두 무반응. 터치는 대상이 `button.place-market-naver-pin` 이라 snap half 로 반응. 검색창에 IME 순서로 「남대문」 → 값 `ㄴ나남남ㄷ대댐대무문문`, React 의 value 대입 기록 `["", "ㄴ", "ㄴ", "ㄴ나", …]`(입력 직후 옛 값 되쓰기). 데스크톱 1440×900 에서 핀 선택 뒤 목록 428px / 지도 779px(55%), 고친 CSS 주입 시 779px.
- 배포 후(`prod-fixes.mjs`·`prod-labels.mjs`): 남산상회 핀 위치 동일(데스크톱 898,505 · 모바일 173,347). 데스크톱 마우스 클릭 → snap half, 선택 행 3개가 맨 위(「선택한 필지」), 목록 779 = 지도 779. 모바일은 마우스·터치 모두 같은 결과. IME 「남대문」 → 값 `남대문`, URL `?marketQuery=남대문`, 「찾은 가게 75곳」(데스크톱·모바일). 휠 줌 4단에서 핀 28 · 이름 라벨 28, 래퍼 overflow visible, 잘림 없음.

## 2026-10-18 오전 — WU-34 핀 숫자·목록 번호·InfoWindow·상세 패널 (`2a904e6d9`, 번들 `index-BqWJW0w-.js`, `prod-wu34.mjs`)
- 데스크톱 1440×900 줌 17: 핀 51 = 2곳 이상 묶음 49 · 빈 글자 2 · 「1」 0. 352곳 핀을 마우스로 클릭 → `.place-market-naver-info` 3행(상세보기 3) + 「외 349곳 · 목록 보기」, 배경 surface-0, snap 은 peek 그대로, 목록 행 번호 1~8…(선택 필지 352곳). 「상세보기」 → 패널(x 1056 · 384×779, 포커스 있음) 제목 「282 지일사」, 유형 「생활용품·가전 · 소매」, 배지 가맹점·상가정보. Esc → 패널 닫힘(정보 창은 유지), 지도 빈 곳 클릭 → 정보 창 닫힘. 검색 「남대문」 → 「찾은 가게 75곳」, 목록 번호 1~8….
- 모바일 390×844: 터치 → 정보 창 3행, snap peek 유지 → 「외 349곳 · 목록 보기」 → half. 「상세보기」 → 패널 전체 폭.
- 캡처로 잡힌 것 3건(보완 `8ffce8b7d`): ① 정보 창의 가게 순서가 데이터 순서라 첫 행 「지일사」의 목록 번호가 282 — 번호 Map 이 오면 창을 목록 순서·번호 배지로 다시 채움 ② 모바일 패널이 x −12 로 밀려 왼쪽 글자가 잘림 — 들어오는 애니메이션 중 focus() 가 overflow:hidden 화면을 가로로 민 것, `preventScroll` ③ 네이버 줌 컨트롤이 패널 위에 보임 — 지도 무대에 z-index 0. 첫 행 「지도에서 보기」 확인은 좌표 없는 「남대문인삼」을 눌러 상세 패널이 열린 것이라 보완분에서 좌표 있는 행으로 다시 잰다.
