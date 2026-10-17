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
- **신거북시장(`2765404`, market 95) 상세 500** — MySQL 8.0.46 `Out of sort memory, consider increasing server sort buffer size`(`sort_buffer_size` 262144). `findForDisplay` 의 넓은 select(TEXT 5열) + `ORDER BY id` 가 filesort 를 타는데, 가게 573행(IN 0, items 최대 49자)인 이 시장만 터지고 남대문 3,929행은 통과. 운영 DB 에 같은 SQL 로 재현: ORDER BY 있음 → 오류, 없음 → 577줄, `sort_buffer_size=1M` → 통과. 한 시간에 60회 발생. 수정: SQL 정렬을 빼고 메모리에서 `sortedBy { it.id }`(전 행을 읽는 조회라 결과 동일). 확인은 배포 뒤 `curl /api/v1/place/markets/2765404` 200 과 바탕 재렌더로.
- content 메모리(MALLOC_ARENA_MAX=2 뒤): 기동 48분 709Mi · 56분 715Mi · 65분 720Mi, 재시작 0.
- 측정 함정(재발): 관광지 상세 경로는 `contentId` 가 아니라 관광지 id(남대문 34550·망원 22534). contentId 로 열면 「찾을 수 없는 관광지」가 뜨고 계측기는 SVG 없음으로 죽는다 — P5 기록의 함정 그대로.
