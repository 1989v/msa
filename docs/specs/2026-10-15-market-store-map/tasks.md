# Tasks — 전통시장 구역·가게 지도

정본: `prd.md`. 작업 위치: 브랜치 `feat/market-store-map` (origin/main 기준 워크트리). 한 단위 = 한 Codex 작업 = 한 커밋 이상. **순서대로 하나씩** 진행한다(앞 단위의 산출물을 뒤 단위가 쓴다).

PRD 열린 질문에 대한 진행 가정 (사용자가 바꾸면 해당 단위부터 다시):
- 범위는 P1~P3 전부, 단계 순서대로.
- `pois` 를 확장하지 않고 새 테이블(`market*`)로 간다 — 시장 소속·구역·층·덮어쓰기가 `pois` 의 전체 동기화 모양과 맞지 않는다. ADR 에 근거를 남긴다.
- 상인회 신청 진입점은 시장 섹션 하단 링크.
- 영문 화면은 가게 이름 국문 그대로, 번역 없음.
- 시장 품목 시세는 후속 PRD.

선례: `transit`(V35 마이그레이션, `place/ingest/src/transit_stops.py`, `k8s/base/place-ingest/cronjob-transit-stops.yaml`, `place/feature/.../application/transit`).

## WU-1 ADR + 스키마 + 도메인 골격 (P1)
- `docs/adr/ADR-0109-place-market-store-map.md` (템플릿 `docs/adr/_template.md`): 세 층(원천/판정/추가), 새 테이블 선택 이유, 시장별 권한 행(`market_steward`), 재적재 보호 규칙.
- Flyway `V36__create_market_tables.sql`: `market`, `market_zone`, `market_store`, `market_store_override`, `market_change_log`, `market_steward` (PRD §4.5). 원천 필드 전부 컬럼 또는 raw JSON 보존.
- 도메인 모델 + application/market/{port,usecase,service} + infrastructure/persistence 어댑터. 레이어 표준(ADR-0083), JPA 컨벤션(enum STRING, FK-as-ID).
- 테스트: 도메인 Kotest BehaviorSpec(소속 판정·override 적용 규칙). 검증: `./gradlew :place:feature:test --tests '*Market*'` 와 컴파일.

## WU-2 적재 잡 (P1, 파이썬 place-ingest)
- `place/ingest/src/market_stores.py`: 전통시장표준데이터 · 온누리 가맹점 CSV(#15091259) · 상가정보 벌크(#15083033, 시도별 CSV 스트리밍) · 상가정보 API(#15012005) 로 시장·구역·가게를 만들고 place 내부 API 로 넣는다. 키는 raw 로 URL 에 붙인다(이미 인코딩된 값).
- 소속 판정(PRD §4.3): 반경 1차 + 골목별 가맹점 밀도 임계값(상수). 실패 비율 상한 초과 시 잡 실패.
- place 쪽 내부 적재 API(upsert, 원천 행만 갱신, override·MANUAL 행 불변).
- `cronjob-market-stores.yaml` + kustomization, `main.py` 잡 등록, `docs/architecture/data-sources.md` 대장 3종 추가.
- 테스트: `place/ingest/tests` 에 판정·매칭 단위 테스트(광명 골목 표본 고정값), 재적재 보호 테스트(JVM).

## WU-3 공개 조회 API (P1)
- `GET /api/v1/place/markets/{contentId}?lang=&includeOutside=` → 시장 정보 + 구역 + 가게(override 반영, 출처 배지 값 포함). `ApiResponse<T>`.
- 게이트웨이 라우트가 필요하면 추가. 테스트: 컨트롤러·서비스 BehaviorSpec.

## WU-4 시장 섹션 화면 (P1, portal-fe)
- `AttractionPage` 에 시장 섹션: 기본정보 + 출처 표시, 지도(가게 점·구역 색, 골목 칩 / 건물·동·층 목록), 가게 목록 패널(점 클릭 → 같은 필지, 이름 찾기 강조·없음 안내), 출처 배지, 시장 밖 토글, 모바일 시트.
- DESIGN.md 토큰·k-heritage 견본 준수, hex 금지. 검증: `pnpm tsc`, 관련 테스트, CDP 4조합 캡처(`docs/standards/fe-visual-verification.md`).

## WU-5 운영자 편집 API (P2)
- `/api/v1/admin/place/markets/**`: 목록·상세, 가게 override(이유 필수), 수동 가게·참고 핀, 구역·폴리곤·이름·순서, 변경 이력 조회·되돌리기. 모든 쓰기는 `market_change_log` 에 전후 값.
- 테스트: 되돌리기·재적재 보호(AC-5).

## WU-6 운영자 편집 화면 (P2, admin/frontend)
- 시장 목록 → 상세(가게 표·소속 토글·구역 재배정·추가·참고 핀), 지도 편집(폴리곤 그리기·핀 이동·배정), 건물형 동·층 목록 편집, 이력·되돌리기.

## WU-7 상인회 권한 API (P3)
- 신청 `POST /api/v1/place/markets/{id}/steward-applications`(로그인), 승인·반려·정지 `PUT /api/v1/admin/place/stewards/{id}`, 상인회 편집 `/api/v1/place/markets/{id}/manage/**`(로그인 + ACTIVE 행 확인, 매 요청 DB 확인). 입력에 `STEWARD` 출처. 운영자 전용 동작 차단.
- 테스트: 다른 시장 403, 정지 직후 403(AC-6).

## WU-8 상인회 화면 (P3)
- portal-fe: 시장 섹션 하단 신청 폼, 승인된 담당자용 편집 화면(WU-6 컴포넌트 재사용 가능 범위), "상인회 제공" 배지.
- admin/frontend: 신청 목록·승인·정지.

## 단위마다 완료 조건
- 해당 모듈 컴파일 + 변경한 테스트 클래스 통과 출력.
- 커밋은 이번 단위 경로만 `git add` 로 지정. 푸시·배포 안 함.

---

# P4 — 골목 구조 보강 (PRD §11)

진행 가정: OSM 데이터는 지도 표시용으로만 쓰고 공개 배포하지 않는다(ODbL share-alike 회피, ADR 에 기록). 상인회는 변경 요청 → 운영자 승인. 광명 표본 픽스처는 `place/domain/src/test/resources/market/gwangmyeong_osm.json`(OSM 2026-10-15 © OpenStreetMap contributors ODbL + 상가정보 매칭 결과. `cur`·`poly`·`snap`·`sd` 는 분석 스크립트가 낸 기대값이라 테스트 입력으로 쓰지 않는다).

## WU-9 ADR-0110 + 스키마 + 재판정 도메인
- `docs/adr/ADR-0110-market-alley-geometry-osm.md`: OSM 채택·ODbL 범위(표시만, 배포 안 함)·판정 순서·MANUAL 보호.
- Flyway `V37__market_alley_geometry.sql`: PRD §11.3 테이블·컬럼.
- 도메인 순수 함수: 점-다각형 포함, 점-선 거리(m), 판정 순서(§11.1), 골목 배정(§11.2), 둘레 초안(볼록 껍질 + 여유), 출입구 후보(경계×골목 선 교차).
- 재판정 서비스: 시장 하나의 원천 가게를 읽어 파생 컬럼만 쓴다.
- 테스트: 광명 픽스처로 AC-P4-1 기대값(153·29·104·49·14·9), 도로 규칙 구간, 경계 없는 시장 폴백.

## WU-10 OSM 적재
- `place/ingest/src/market_osm.py`: Overpass 조회(시장마다 한 조회, 일시 오류 최대 2회 재시도), `market_osm_raw` 전체 보존, 경계·골목 선 초안 upsert(MANUAL 행 불변), 없으면 DERIVED 둘레. 관광지 순서의 50개 배치마다 실패율 검사 후 저장·시장별 재판정. 실패 배치부터 즉시 중단하고 앞선 배치 결과는 보존.
- place 내부 API `/internal/markets/{id}/osm`·`/internal/markets/{id}/rejudge`.
- CronJob(기존 market-stores 뒤, suspend 유지), `data-sources.md` OSM 행, egress 는 기존 place-ingest :443 정책 안.
- 테스트: 파싱·DERIVED·MANUAL 보호(AC-P4-2).

## WU-11 운영자 편집 API (경계·골목·출입구·도로 규칙·중심/반경)
- `/api/v1/admin/place/markets/{id}/geometry`(GET), boundary PUT/초안 되돌리기, paths·entrances·road-rules CRUD, geo(center/radius) PUT, needs-review 목록·가게 골목 지정.
- 저장마다 같은 트랜잭션에서 재판정 + `market_change_log`, 응답에 바뀐 가게 수. 되돌리기 지원(AC-P4-3).

## WU-12 공개 API + 시장 섹션 표시
- 공개 응답에 boundary·paths(이름)·entrances·가게 path_id. needs_review·OSM payload 제외(AC-P4-5).
- portal-fe `AttractionMarket`: 경계·골목 선·라벨·출입구, 골목 색, OSM 출처. 경계 없으면 지금 그대로. CDP 4조합.

## WU-13 어드민 지도 편집 화면
- OSM 배경 선, 경계 꼭짓점 편집, 골목 선 그리기·이름, 출입구, 도로 규칙 표, 중심 핀·반경, 확인 필요 목록, 저장 후 바뀐 가게 수, OSM 출처. CDP 4조합.

## WU-14 상인회 변경 요청
- API: 상인회 `POST …/manage/geometry-requests`(그림 JSON + 설명), 운영자 목록·승인·반려. 승인 시 WU-11 경로로 반영·이력(AC-P4-6).
- 화면: portal-fe 관리 화면에 요청 작성(경계·골목 선 그리기 대신 지도 위 메모 핀 + 설명도 허용), admin 에 요청 목록·미리보기·승인.

---

# P7 — 현장에서 길 찾는 지도 (`p7-plan.md`)

진행 가정(2026-10-16 사용자 결정): 7-0 은 **판정을 바꾸지 않고 표시만**(안 (b)). 7-0 과 7-1 을 함께 진행한다. 망원 경계는 미결.
Codex 보내는 순서: WU-15 ∥ WU-16 → WU-17 ∥ WU-18. 같은 워크트리에서 돌리므로 단위마다 **손대는 파일을 아래로 한정**하고, 커밋은 세션이 경로를 지정해 한다.

## WU-15 전국 덮기 — IN 이 없는 시장은 주변 가게를 기본 표시 (place, Kotlin)
- 파일: `place/feature/.../application/market/service/MarketService.kt`, `MarketPublicProjection.kt`, `usecase/MarketUseCases.kt`, 공개 응답 DTO(`MarketResponse`), 해당 테스트. **적재·판정·DB 는 손대지 않는다.**
- 규칙: `find(contentId, includeOutside=false)` 결과에 실효 소속 IN 인 가게가 0 이면, 시장 중심(경계가 있으면 경계 중심, 없으면 `market.latitude/longitude`)에서 반경 R 안의 OUT 가게를 더한다. R 은 100 m 에서 시작해 50 m 씩 넓히고 가게가 30곳 이상이면 멈춘다. 상한 300 m(상한에서도 30 미만이면 그만큼만). 중심이 없으면 아무것도 더하지 않는다.
- 더한 가게는 `membership` 을 OUT 그대로 두고 `Store.display` 에 `nearby: true`(응답 `nearby`)를 붙인다. `MarketResult` 에 `nearbyRadiusMetres: Int?` 를 넣어 응답에 내보낸다(IN 이 있으면 null).
- `includeOutside=true` 는 지금처럼 전부(이 경우 `nearby` 는 같은 규칙으로 붙이되 `nearbyRadiusMetres` 는 null).
- 거리 계산은 적재 잡과 같은 등거리 근사(위도 평균·미터 환산). `MarketPublicProjection` 에 순수 함수로 두고 테스트한다.
- 테스트(Kotest BehaviorSpec): IN 이 있으면 안 붙음 / 0 이면 100 m 에서 30곳 넘을 때 멈춤 / 300 m 상한 / 중심 없음 / `nearby` 가 OUT 소속 값을 바꾸지 않음. 회귀 주입: 반경 확장 제거 → 빨간불.
- 검증: `./gradlew --no-daemon :place:feature:test --tests '*Market*'` 결과 줄.

## WU-16 지도 조작 — 확대·이동·충돌 묶음·시트 (portal-fe)
- 파일: 새 `portal-fe/src/pages/place/MarketCanvas.tsx`(지도 SVG 를 `AttractionMarket.tsx` 에서 분리), `marketView.ts`(묶음 함수 추가만), `AttractionMarket.css`, 테스트 `__tests__/MarketCanvas.test.tsx`·`marketView.test.ts`. `AttractionMarket.tsx` 는 분리된 컴포넌트를 부르는 변경까지만(검색·패널 로직은 WU-17 이 손댄다).
- viewBox 상태(`{x,y,w,h}`)로 확대·이동: 휠(ctrl 없이도), 두 손가락 핀치, +/− 버튼, 더블탭 2배, 「전체 보기」 버튼. 배율 1~8. 라이브러리 없음.
- **핀 버튼을 SVG 안으로**: 지금의 HTML 백분율 오버레이 버튼(`place-market-pin-button`)을 없애고 `<g role="button" tabIndex=0>` + `aria-label` 로. 키보드 Enter/Space 동작. 이동·확대 뒤에도 그림과 클릭 영역이 같다(테스트로 좌표 일치 검사).
- **화면 거리 묶기**: `groupMarketPins` 결과에 `clusterByScreenDistance(points, scale, 24px)` 를 더해 현재 배율에서 24 px 안의 묶음을 하나로 합친다(가게 수 합산, 색은 첫 묶음). 배율이 오르면 풀린다. `marketView.ts` 의 순수 함수로.
- 묶음 탭 → 바닥 시트(모바일) / 옆 패널(데스크톱 ≥1024px) 에 가게 목록: 건물 → 층 → 호 자연 정렬, 없으면 이름순. 200 넘으면 50행씩 「더 보기」. 시트는 `AttractionMarket` 의 기존 `parcel` 선택 상태를 그대로 쓴다(묶음 = 여러 parcel).
- 핀 크기·글자는 배율에 반비례(화면에서 항상 같은 크기). 골목 이름·축척 막대도 같이.
- `prefers-reduced-motion` 존중, DESIGN.md 토큰만.
- 검증: `npx tsc -b`, `npx vitest run src/pages/place`, CDP 4조합 캡처는 세션이 한다. 회귀 주입: 묶음 함수 제거 → 빨간불.

## WU-17 검색 일치·결과→지도·칩 접기 (portal-fe)
- 파일: `marketView.ts`(검색 함수), `AttractionMarket.tsx`(검색·패널·칩), `MarketSearchPage.tsx` 는 손대지 않음. 테스트 `marketView.test.ts`·`AttractionMarket.test.tsx`.
- `matchesMarketStore(store, query)`: 이름·품목·업종 대/중/소·착한가격 메뉴 이름. 정규화는 `/markets` 와 같다(공백 제거·소문자·NFKC). 순위: 이름 0 > 품목 1 > 메뉴 2 > 업종 3. **동의어·상위 분류 확장 없음.** 어디에 맞았는지(`matchedBy`)를 돌려준다.
- 결과 행: 「이름에 맞음/품목에 맞음/업종에 맞음」 표시, UNKNOWN 은 「위치 미확인」. 행을 버튼으로 — 누르면 `MarketCanvas` 에 `focusStoreId` 를 넘겨 그 핀으로 이동·확대(배율 4)하고 묶음 시트를 열어 해당 행을 강조·스크롤.
- `nearby` 가게(WU-15)는 배지 「주변 · 소속 미확인」, 응답 `nearbyRadiusMetres` 가 있으면 지도 위에 「시장 주변 {R} m 안 가게를 보입니다」 한 줄.
- 구역 칩: 가게 수 내림차순, 시장 이름 포함 길 우선, 기본 8개 + 「다른 길 N개」 접기/펼치기. 선택된 칩은 접혀도 보인다.
- 검증: `npx tsc -b`, `npx vitest run src/pages/place`. fixture 로 「떡볶이」 검색이 품목·메뉴·업종에서 예상 id 를 순위대로 내고, 이름만 맞는 옛 함수와 결과가 다른 것을 검사(회귀 주입: 품목 매칭 제거 → 빨간불).

## WU-18 내 위치 (portal-fe)
- 파일: 새 `portal-fe/src/pages/place/MarketLocate.tsx`(버튼·상태·문구), `MarketCanvas.tsx` 는 `userPosition` prop 받아 그리는 부분만, 테스트 `MarketLocate.test.tsx`. `PlacePage.tsx` 의 기존 위치 코드를 재사용할 수 있으면 공유 훅으로 뽑되 그 파일의 동작은 바꾸지 않는다.
- 버튼을 눌러야 `navigator.geolocation.getCurrentPosition`(자동 요청 없음, `enableHighAccuracy`, 10초 시간 초과). 거부·시간 초과·미지원 문구. 「다시 재기」, 측정 시각·정확도(m) 표시.
- 화면(viewBox) 안이면 점 + 정확도 원, 밖이면 가장자리 화살표 + 「시장 중심까지 {d} m · {8방위}」. 기준점은 경계 중심, 없으면 시장 중심. 이미 경계 안(또는 중심 100 m 안)이면 거리 문구 대신 「시장 안입니다」. 게이트 안내는 하지 않는다.
- 거리·방위는 실제 좌표(등거리 근사)로, 순수 함수 `marketView.ts` 에 두고 테스트.
- 검증: `npx tsc -b`, `npx vitest run src/pages/place`. geolocation 모킹으로 거부·성공·시간 초과 세 경로, 화면 안/밖 분기. 회귀 주입: 밖 판정 제거 → 빨간불.

## 완료 조건(공통)
- 단위마다 컴파일 + 지정 테스트 통과 줄. 커밋은 세션이 단위 경로만 `git add`. 네 단위 뒤 CDP 4조합(망원·광명·남대문·IN 없는 시장 한 곳) 캡처, main 머지·배포는 사용자 확인 뒤.

## 음식 품목 검색·메뉴·영문 (`p7-plan.md` §7, 2026-10-16 승인)
순서: WU-19(백엔드) → WU-20(백엔드, 같은 파일을 고치므로 19 뒤) → WU-21(FE, 17·18·19·20 뒤).

## WU-19 음식 사전 + 관련 업종 검색 + TourAPI 메뉴 (place, Kotlin)
- 사전: `place/feature/src/main/resources/market/dishes.csv` (`dish,category_sub,dish_en`) 100개 안팎 — 떡볶이·순대·튀김·어묵·김밥·만두 → 「김밥/만두/분식」, 칼국수·국수·잔치국수 → 「국수/칼국수」, 빈대떡·전·파전 → 「전/부침개」, 족발·보쌈 → 「족발/보쌈」, 회·초밥 → 「횟집」/「일식 회/초밥」, 떡·한과·약과 → 「떡/한과」, 냉면 → 「냉면/밀면」, 치킨·통닭 → 「치킨」, 빵·도넛 → 「빵/도넛」, 커피 → 「카페」 … `category_sub` 값은 운영 `market_store_search.category_sub` 에 실제 있는 이름만(검색 표의 distinct 207종과 대조하는 테스트). `dish_en` 은 문체부·국립국어원 지침식 로마자(tteokbokki, gimbap, mandu, bindaetteok …).
- 로더 `MarketDishDictionary`(application, 기동 시 한 번 읽음) + 공개 `GET /api/v1/place/markets/dishes` → `[{dish, categorySub, dishEn}]`(캐시 헤더 1일).
- `/api/v1/place/markets/search`: 질의가 사전의 `dish` 또는 `dish_en`(대소문자 무시)과 일치하면 `category_sub = 해당 업종` 행도 후보에 넣고 **순위 4(이름 0 > 품목 1 > 메뉴 2 > 업종 3 > 관련 업종 4)**. `StoreSummary` 에 `matchedBy: NAME|ITEMS|MENU|CATEGORY|RELATED_CATEGORY` 와 `relatedCategory: String?`(관련 업종일 때 업종 이름). 이름·품목·메뉴·업종 일치는 지금 그대로.
- TourAPI 메뉴 붙이기: Flyway `V44__add_market_store_tour_menu.sql` — `market_store` 에 파생 열 `tour_content_id`, `tour_first_menu`, `tour_treat_menu`, `tour_matched_at`. 서비스 `MarketTourMenuService.attach(marketId)`: 시장 중심(경계 중심, 없으면 시장 점) 반경 300 m 의 `attractions`(content_type_id='39', lang='ko') 중 **이름 정규화 일치(공백 제거·소문자·NFKC) + 50 m 안**인 가게에 붙인다. 후보가 둘이면 가까운 쪽, 같은 거리면 안 붙임. 원천 열은 건드리지 않는다. 붙인 뒤 그 시장의 검색 표 다시 계산 — `market_store_search.menu_names` 에 착한가격 메뉴 뒤에 TourAPI 대표·취급 메뉴를 이어 붙인다(구분 ` · `).
- 내부 `POST /internal/markets/tour-menus`(전체 시장 순회, 요약 `{markets, matched}` 반환) + `POST /internal/markets/{id}/tour-menus`. 적재 잡(`place/ingest/src/market_stores.py`)은 마지막에 전체 호출 한 번(실패는 경고, 잡은 성공).
- 공개 응답 `GET /markets/{contentId}`: 가게에 `tourMenu: {firstMenu, treatMenu, attraction: {id, lang}} | null`. 시장에 `restaurants[]` — 중심 150 m 안(경계가 있으면 경계 안) TourAPI 음식점 중 **가게에 안 붙은 것**: `{attraction:{id,lang}, title, firstMenu, treatMenu, latitude, longitude}`. `attribution` 에 TourAPI 가 하나라도 쓰이면 「한국관광공사 TourAPI · 공공누리」 줄.
- `docs/architecture/data-sources.md` TourAPI 행에 「시장 가게 메뉴 매칭」 용도 한 줄.
- 테스트: 사전 ↔ 운영 업종명 대조(픽스처 207종), 관련 업종 순위·`matchedBy`, 매칭(이름 일치·50 m·둘이면 가까운 쪽·같은 거리면 없음), 검색 표 `menu_names` 이어 붙임, 응답 `restaurants` 에 매칭된 것 제외. 회귀 주입: 50 m 조건 제거 → 빨간불.
- 검증: `./gradlew --no-daemon :place:feature:test --tests '*Market*'`, pytest(`place/ingest` 에서 `python3 -m pytest tests -q`).

## WU-20 영문 (place, Kotlin — WU-19 뒤)
- 업종 번역표 `place/feature/src/main/resources/market/categories-en.csv` (`category_sub,en`) 207종 전부 + 대·중분류 표. 빠진 값은 기동 시 경고 로그, 응답은 null.
- 가게 이름 로마자: `KoreanRomanizer`(application 유틸, 국어의 로마자 표기법 — 자모 분해·음운 규칙은 기본 규칙(연음·비음화·유음화·구개음화·경음화 미표기)까지, 테스트 20건: 순희네빈대떡 → Sunhuine Bindaetteok, 광장시장 → Gwangjang Sijang …). 숫자·영문·기호는 그대로.
- 응답: 가게에 `nameEn`(수동 영문이 있으면 그것, 없으면 로마자), `categoryEn`, `itemsEn`(품목 분류어 번역표 — 온누리 품목 distinct 를 뽑아 번역, 없으면 null), `tourMenu` 에 영문판(82) 같은 contentId 가 있으면 `firstMenuEn`·`treatMenuEn`. 검색 응답 `StoreSummary` 도 같은 열. `restaurants[]` 는 `lang` 이 en 이면 영문판 행 우선.
- 검색: 영문 질의(ASCII 만)는 `dish_en`·업종 영문·로마자 이름(`market_store_search` 에 `name_roman` 열 추가, V45)에서 찾는다.
- 테스트: 로마자 20건, 번역표 207종 빠짐 없음, 영문 질의 `tteokbokki` → 관련 업종 분식. 검증 명령은 WU-19 와 같다.

## WU-21 화면 (portal-fe — 17·18·19·20 뒤)
- 시장 섹션·`/markets`: 결과 행에 `matchedBy` 표시(「관련 업종 · 분식」은 흐리게, 뒤 순위), 가게 행에 메뉴·가격(착한가격 메뉴·가격 + TourAPI 대표·취급 메뉴, 출처 표시), 시장 섹션 검색은 `/markets/dishes` 사전을 한 번 받아 같은 규칙으로 관련 업종을 낸다. 섹션 아래 「관광공사 소개 음식점」 목록(`restaurants[]`, 관광지 상세 링크).
- 영문 화면: `nameEn · 한글`, `categoryEn`, 메뉴 영문(있을 때), 영문 검색어.
- 검증: `npx tsc -b`, vitest, CDP 4조합(광장·남대문 국문·영문).

## 운영 안정화 (2026-10-17 승인)
## WU-22 공개 조회용 좁은 가게 읽기 (place)
- `MarketQueryPort.findStoresForDisplay(marketId)`: 원천 JSON 두 열(onnuri_raw·sangga_raw)을 읽지 않는 Querydsl 투영 + 존재 여부 불리언. 도메인 require 를 위해 `MarketStore.RAW_OMITTED` 자리표시. 공개 상세(`MarketService.find`)와 메뉴 붙이기(`MarketTourMenuService.attach`)만 사용, 쓰기 경로는 `findStores` 유지.
- 근거: 남대문 3,929행·원천 JSON 16.7MB 가 요청마다 올라와 content(1Gi) OOM 3회. 검증: `*Market*` 테스트 + 회귀 주입(raw 다시 읽기).
## (k8s) `MALLOC_ARENA_MAX=2` — `k8s/overlays/oci-arm/patches/java-tool-options.yaml`, 모든 JVM 파드. 배포 뒤 content 바닥 메모리(재시작 4분 뒤 878Mi)와 하루 OOM 0 을 확인.

---

# 바탕 지도 (사용자 결정 2026-10-17: ③ 우리가 소유하는 바탕을 미리 렌더)
네이버·카카오·구글 지도 이미지는 저장·재배포가 약관으로 금지라 제외. OSM 데이터(ODbL) + OpenFreeMap 스타일을 **우리가 렌더해 저장**한다. 네이버·카카오·구글은 딥링크.

## WU-23 시장 바탕 이미지 렌더·저장 (CI 잡)
- 저장소: OCI 오브젝트 스토리지 버킷 `msa-market-basemap`(ap-chuncheon-1, 루트 구획, **공개 읽기 ObjectRead**, 2026-10-17 생성). 쓰기는 PAR(쓰기 전용, **만료 2027-10-17**) — GitHub Actions 시크릿 `MARKET_BASEMAP_PAR`. 만료되면 업로드가 404 로 죽으니 그 전에 콘솔에서 재발급해 시크릿을 바꾼다.
- 객체 이름 `markets/{contentId}/{light|dark}.png`(2026-10-17 개정: 줌이 시장마다 달라 이름에서 z18 을 뺐다. 옛 `z18-*.png` 는 버킷에 남아 있을 뿐 FE 가 읽지 않는다), 공개 URL `https://objectstorage.ap-chuncheon-1.oraclecloud.com/n/axyooxbyk5yv/b/msa-market-basemap/o/markets/{contentId}/z18-light.png`. 마지막에 `markets/index.json`.
- 이미지: **1536×1152 px, Web Mercator 줌은 시장 범위(IN 가게 ∪ 경계, 15% 여유)가 들어가는 가장 가까운 줌(18→17→16), 중심 = 그 범위의 가운데, 가게도 경계도 없으면 market 점에 줌 18**(2026-10-17 개정 — 줌 18 고정 364×272 m 프레임이 남대문 IN 범위 342×322 m 보다 작았다). light = OpenFreeMap positron, dark = fiord. 컨트롤·로고 숨김, 출처는 굽지 않고 FE 가 표기. 라벨은 OSM `name`(한글 + 라틴 병기) — 영문 전용 한 벌은 후속.
- 실행: `.github/workflows/market-basemaps.yml` 매주 일 20:00 UTC + dispatch(일부 contentId·테마), matrix light/dark, 러너 ubuntu-24.04 의 Chrome + MapLibre GL JS + CDP(`scripts/market-basemaps/render.mjs`, 의존성 ws 하나). 실패율 5% 넘으면 잡 실패(올린 건 유지).
- 검증: 남대문·광장·망원·서문 PNG 크기 1536×1152, FE 모서리 계산과 같은 규칙(WU-24 테스트).

## WU-24 시장 섹션 바탕 적용 (portal-fe)
- `MarketCanvas` 가 규약 URL 의 이미지를 SVG 맨 아래 `<image>` 로 깔고(FE 가 같은 규칙으로 네 모서리 위경도를 계산해 기존 투영으로 배치), 로드 전·실패 시에는 지금 그대로. 메타 API 는 두지 않는다(YAGNI). 확대·이동은 이미지와 오버레이가 같은 viewBox 변환을 탄다. 우리 골목 선은 바탕이 있으면 그리지 않고 **특화 골목 이름 띠·게이트·핀·내 위치**만 올린다.
- 프리렌더·검색엔진용 정적 그림도 같은 이미지. 다크 테마는 이미지에 어두운 필터 대신 다크 스타일 한 벌을 더 렌더할지 WU-23 에서 결정.
- 검증: CDP 4조합(남대문·광장·망원), 핀이 바탕의 건물 위에 놓이는지 알려진 가게로 확인.

## WU-25 바탕 이미지 프록시 + meta.json 기준 배치 (2026-10-17 승인, 「동시에」)
- 문제: 브라우저가 OCI 버킷을 직접 부르면 OCI 요청 한도(월 5만 무료)를 페이지뷰가 바로 넘기고, FE 가 「지금 응답의 중심」으로 모서리를 계산해 경계가 바뀌면 다음 렌더까지 핀과 바탕이 어긋난다. OCI 버킷은 CORS 를 못 켜 meta.json 을 직접 못 읽는다.
- CI: 시장마다 `markets/{contentId}/meta.json` { contentId, centre:{latitude,longitude}, zoom:18, width:1536, height:1152, bounds:{north,south,east,west}, renderedAt, styleVersion, themes:["light","dark"] } 를 PNG 와 함께 올린다(테마 잡마다 같은 값으로 덮어써도 됨). `Content-Type: application/json`, `Cache-Control: public, max-age=3600`. PNG 는 `Cache-Control: public, max-age=86400`.
- portal-fe nginx: `location /basemaps/` → 버킷 `…/b/msa-market-basemap/o/` 로 proxy_pass(resolver 는 기존 패턴), `proxy_cache`(zone basemaps 200m, valid 200 1d · 404 5m), 응답에 `Cache-Control` 유지, 그 밖의 헤더 최소화. 같은 출처가 되어 CORS 불필요하고 클라우드플레어가 캐시한다.
- NetworkPolicy: portal-fe 파드가 외부 443 으로 나갈 수 있게 — `k8s/base/network-policy/11-allow-egress-https-public.yaml` 의 패턴(공인 IP 만, 사설 대역 except)으로 portal-fe 만 허용. 대상 호스트를 IP 로 고정하지 않는다(오브젝트 스토리지 IP 는 바뀐다).
- FE: `/basemaps/markets/{contentId}/meta.json` 을 먼저 받아(react-query, staleTime 1시간) 그 centre·zoom·width·height 로 모서리를 계산하고 `/basemaps/markets/{contentId}/{theme}.png` 를 깐다. meta 가 404 면 바탕 없음(지금 SVG). 응답의 중심은 더 이상 쓰지 않는다.
- 검증: nginx 설정은 `nginx -t`(docker 로 가능하면), kustomize build, FE tsc·vitest(meta 기준 배치·404 폴백·테마 교체), 배포 뒤 `curl -I https://place.1989v.com/basemaps/markets/132180/meta.json`(200, cache 헤더)과 운영 CDP.

## WU-26 네이버 지도 토글 레이어 (portal-fe, 키는 사용자가 발급)
- 시장 섹션에 「네이버 지도로 보기」 토글. 켜면 같은 자리에 네이버 Dynamic Map(JS v3, `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<id>&language=<ko|en>`)을 띄우고 우리 핀(묶음·수·색)·내 위치·경계선을 `naver.maps` 오버레이로 올린다. 끄면 우리 지도로 돌아온다.
- 키는 `portal-fe/src/seo/copy.mjs` 의 `NAVER_MAP_KEY_ID`(빈 값 = 토글 숨김, ADSENSE_CLIENT 와 같은 패턴). SDK 는 토글을 켤 때만 로드(기본 페이지엔 외부 스크립트 0).
- 약관: 로고·출처 유지, 이미지 캐시·캡처 금지, 서비스 URL 등록. `/privacy` 제3자 스크립트 목록에 네이버 지도 한 줄.
- 검증: tsc·vitest(키 없으면 토글 없음, 켜면 SDK 스크립트 한 번만 삽입, 핀 수 일치), 키가 들어오면 CDP 로 남대문 비교 캡처.

## WU-27 네이버 지도를 기본 바탕으로 (portal-fe — WU-25 FE·WU-26 컴포넌트 뒤)
- `NAVER_MAP_KEY_ID` 가 있으면 시장 섹션의 기본 지도가 `MarketNaverMap`. SDK 로드 실패·키 없음·프리렌더(window 없음)에서는 지금 SVG 지도(③ 바탕 포함)로 자동 폴백. 「우리 지도로 보기」 토글로 수동 전환도 둔다.
- 네이버 지도 위에서도 같은 동작: 묶음 핀(네이버 줌에 따라 화면 거리 묶음 재계산), 핀 탭 → 같은 시트, 검색 결과 → `panTo`+줌 19 로 그 핀, 내 위치 → 네이버 지도 마커 + 같은 문구, 경계선, 특화 골목 이름 띠(있을 때). 축척·북쪽 표시는 네이버 것.
- 영문 페이지는 `language=en`. 네이버 로고·출처는 가리지 않고, 우리 출처 줄은 바탕이 네이버일 때 숨긴다(③ 폴백일 때만).
- 검증: 키 없이는 기존 테스트 전부 그대로(폴백), 키 있을 때 SDK 한 번 로드·핀 수 일치·검색 이동·내 위치 마커 테스트(naver.maps 모킹), 키 발급 뒤 CDP 로 남대문·광장·망원 국문/영문.

## 지도 개편 (`p7-plan.md` §10 — 엔진은 네이버, 2026-10-17 밤 사용자 결정. 키 반영 `1b82427dc`)
## WU-29 네이버 바탕 위 오버레이 모델 하나 (portal-fe)
- 엔진 순서: 네이버 Dynamic Map 기본(`NAVER_MAP_KEY_ID`), **구글 Maps JS 는 네이버 SDK 로드·인증 실패 시 폴백**(기존 `pages/place/googleMaps.ts` 로더 재사용, `clickableIcons: false`), SVG 지도는 둘 다 실패했을 때와 「우리 지도로 보기」 토글. MapLibre 는 범위 밖.
- **오버레이 모델 하나**: 순수 함수 모듈(`marketOverlay.ts`)이 시장 응답 + 줌 + 화면 범위 + 선택 상태(구역·가게·검색) 를 받아 그릴 것을 돌려준다 — ① 시장 폴리곤(경계 fill 12% · stroke 1.5px; 경계 없는 시장은 IN 가게 convex hull 파생, 이때 파생 경계가 IN 판정에 되먹이는 순환을 끊는다) ② 구역 폴리곤·색(필지 묶음별, 선택 구역 강조) ③ 골목선(`paths` → 바탕 도로보다 가는 강조선, 구역 색; 이름 라벨은 z ≥ 18 에서 선 중점에 HTML 마커 하나, 같은 이름은 가장 긴 선에만) ④ 마커 단계(z ≤ 16: 시장 이름 + 총수 마커 1개 / 17~18: 필지 묶음 숫자 원(지금 규칙 24px) / ≥ 19: 개별 마커 + 가게 이름, **화면 안 것만**) ⑤ 내 위치. 묶음·색·단계 판단을 어댑터 안에 두지 않는다.
- 네이버 어댑터(`MarketNaverMap`): 경계 `Polyline` → `Polygon` 채움으로 교체, 구역 폴리곤·골목 `Polyline`(또는 `Data` 레이어 + `setStyle`/`overrideStyle`), HTML `Marker`, 피처 click → 구역 칩·시트와 같은 선택 상태. 바탕 라벨은 끄지 않는다. 다크 테마는 Map Style Editor 스타일 id 가 생기면 그때(범위 밖).
- 구글 어댑터(`MarketGoogleMap`, 새 파일): 같은 모델을 `google.maps.Polygon`·`Polyline`·`Marker`(SVG 아이콘, Map ID 불필요) 로. 네이버가 실패한 세션에서만 로드.
- 검증: 순수 함수 단위 테스트(줌 단계 전환 · 구역 색 · hull · 화면 안 필터 · 라벨 중복 제거), 어댑터는 `naver.maps`·`google.maps` 모킹으로 오버레이 수·채움 스타일·폴백 전환, tsc · 해당 vitest 파일만. 배포 뒤 CDP: 남대문 132180 · 석곡 132055 · 무주 132297 을 국문/영문 × 데스크톱/모바일에서 z16/17/19 캡처(폴리곤 채움 보임 · 골목 강조선 · 마커 단계 · 핀 탭 → 시트 · 검색 → 이동).
- 범위 밖(별도 승인): 전용 화면(WU-30) · 목록 통합(WU-31) · 정적 PNG 파이프라인 처분(결정 ③) · 입구 적재와 입구→가게 경로.
- **완료(2026-10-17 밤)**: Codex 구현 `69ce8751e` + 수정 `775a08b35`(우리 SVG 지도 CSS 가 네이버 오버레이 svg 에 새어 검은 상자 · 화면 안 150곳 초과 시 줌 19 에서도 묶음 유지). tsc 0건, vitest 6파일 76건. 운영 확인은 `verifications/p7-production.md` 「10-17 밤 — WU-29 배포 확인」. 구글 폴백은 운영에서 SDK 차단·인증 실패 콜백 두 경로 모두 구글 지도(마커 82)로 넘어가는 것을 실측.

## 개편 2차 (2026-10-17 밤 사용자 승인 「다 진행 해」 — WU-30 → 31 → 32 → 28 순, Codex 한 번에 하나)
## WU-30 시장 지도 전용 화면 + 목록 하나 (portal-fe)
- 라우트 `/attractions/:id/market`, `/en/attractions/:id/market`(+ `/place/` 접두 별칭은 두지 않는다). `App.tsx` 의 `placeRoute` 로 place 호스트에서만. 새 페이지 `pages/place/MarketMapPage.tsx`(lazy chunk). 관광지 응답(`fetchAttraction`)으로 이름·언어 대체 id 를, 시장 응답(`fetchMarket`)으로 지도·가게를 받는다. 시장 응답이 없으면 상세 페이지로 `Navigate replace`.
- 화면: **지도가 뷰포트 전체**(헤더 아래부터, `100dvh` 기준, safe-area). 상단 바 한 줄 — 뒤로(상세로, `attractionPath`), 시장 이름, 가게 검색 입력(기존 `?marketQuery=` 를 읽고 쓴다), 「시장 밖도 보기」 토글. 그 아래 구역 칩 가로 스크롤(기존 정렬 규칙: 「전체 구역」 + 상위 8 + 「다른 길 N개」). 지도는 `MarketMap`(네이버 → 구글 → SVG 그대로) + `MarketLocate` 를 지도 위 떠 있는 버튼으로.
- **모바일(<1024)**: 하단 시트 한 장이 목록이다. 3단 스냅 — peek 30% · half 55% · full 85%(지도를 끝까지 덮지 않는다). 드래그·손잡이 탭으로 전환, 핀 탭 시 half 로. `MarketClusterSheet` 는 쓰지 않는다(시트가 곧 목록). **데스크톱(≥1024)**: 좌측 패널 400px 고정 + 지도 나머지. 둘 다 같은 목록 컴포넌트.
- **목록 하나 `MarketList.tsx`**: 행 = 「지도 영역 안 ∩ 검색어 ∩ 구역」. 라이브 지도 어댑터에 `onViewportChange({ bounds, zoom })` 콜백을 더해(네이버·구글 둘 다, `idle` 때) 지도가 움직이면 목록이 따라온다. 머리말 「현 지도에서 N곳」. 50행씩 「더 보기」. 핀 탭 → 그 필지 가게들이 맨 위로 오고 강조(목록이 바뀌는 것이 아니라 정렬·강조). 검색 일치는 일치 순위 → 이름순, 좌표 없는 가게는 끝에 「지도 위치 없음」. 행 모양은 한 가지(이름 · 배지 · 주소 · 메뉴 접기 `MarketMenuDetails`) — 기존 `place-market-shops` 행 규칙과 같되 한 컴포넌트. 행 클릭(좌표 있음) → `focusStoreId` 로 지도 이동(기존 동작).
- 링크 갱신: `AttractionActionBar` 의 「시장 지도」 점프와 상세 액션 줄 버튼은 새 라우트로 이동(상세의 `#market` 절은 WU-31 까지 남는다). `MarketSearchPage.detailHref` 도 새 라우트 + `?marketQuery=`. 착한가격·출처 줄은 시트/패널 머리에.
- SEO: `copy.mjs` 에 `marketMapPath(lang, id)`·`marketMapMeta(lang, attraction, market)`(제목 「{시장} 가게 지도 | …」, 설명에 가게 수·구역 수), `useSeo` 로 canonical·hreflang(영문 대체 id 있을 때만). `prerender-seo.mjs` `placeDetailSitemapEntries` 옆에 **시장 지도 항목**: `fetchMarketContentIds()`(가게 좌표 있는 시장)에 해당하는 관광지만, 상세 항목과 같은 lastmod·대체 짝 규칙, priority 0.6. HTML 프리렌더는 상세와 같이 하지 않는다.
- 디자인: `DESIGN.md` 토큰만, `docs/design/k-heritage.html` 을 먼저 읽는다(브랜드 면). 시트는 `--kh-radius-asym`·표면 토큰, 손잡이 44px 터치 영역. 다크 테마 둘 다.
- 검증: tsc(`tsconfig.app.json`) + 해당 vitest 파일만 — 새 `MarketMapPage.test.tsx`(라우트 렌더 · 시장 응답 없으면 상세로 · 검색어 왕복 · 구역 칩 → 목록 필터 · `onViewportChange` → 「현 지도에서 N곳」 · 핀 선택 → 정렬·강조 · 좌표 없는 가게 끝 · 50행 더 보기 · 시트 스냅 상태 전환), `MarketNaverMap`·`MarketGoogleMap` 테스트에 `onViewportChange` 호출, `AttractionActionBar`·`MarketSearchPage` 링크 테스트 갱신, `prerender-seo` 의 sitemap 항목 테스트(있는 패턴대로). 배포 뒤 CDP: 남대문 390/1024/1280 에서 지도 높이·시트 3단·목록 행 수·데스크톱 패널 400px·검색 → 이동, DOM 노드 수(상세 17k 대비).
- 범위 밖: 상세 페이지의 절 교체·옛 패널/시트 삭제(WU-31), PNG(WU-32), 검색엔진(WU-28).
- **완료(2026-10-17 밤)**: Codex 구현 `31c641888` + 수정 `dfd2afee1`(전용 화면 범용 button 규칙이 네이버 핀에 상자를 씌움 → 상단 바·칩·목록으로 한정 / 모바일 탭바 몫 `--kh-shell-bottom` 을 화면 높이에서 빼 문서 스크롤 0 / 토글을 줌 컨트롤 반대편으로 / apex `…/market` 리다이렉트 + nginx 계약 검사 94건). tsc 0건, vitest 10파일 193건. 운영(`index-4OJ6MOpM.js`): 모바일 시트 199/365/564px(full 에서도 지도 99px), 데스크톱·태블릿 좌측 400px, 목록 50행 + 더 보기, 핀 탭 → half + 「선택한 필지」 먼저, `?marketQuery=` 왕복, DOM 720~800 노드. 기록은 `verifications/p7-production.md` 「WU-30 배포 확인」.

## WU-31 상세 절 → 요약 카드, 옛 목록 제거 (portal-fe — WU-30 뒤)
- 상세 페이지 `#market` 절을 요약 카드로: 시장 이름 · 유형/점포수 facts · 착한가격 요약 · 구역 칩 3개 · **상호작용 없는 네이버 지도 16:9**(`MarketNaverMap` 에 `interactive={false}` — draggable/scrollWheel/pinchZoom/keyboard 끔, 줌 16, 폴리곤 + 시장 마커만, 클릭 → 전용 화면) · 「지도 전체 보기」 버튼. 관광공사 소개 음식점·스튜어드 신청은 카드 아래 그대로.
- 제거: `AttractionMarket.tsx` 의 패널·검색 패널·`MarketClusterSheet`·관련 CSS, `AttractionMarket.test.tsx` 의 해당 테스트(전용 화면 테스트가 대신한다). 상세 DOM 에서 목록 16.8k 노드가 빠지는 것을 CDP 로 확인.
- `#market` 해시·`?marketQuery=` 는 전용 화면으로 리다이렉트(검색어 유지).
- **완료(2026-10-17 밤)**: Codex 구현 + 수정 `b987e4094`(카드 링크를 라우터 `Link`/`navigate` 로, 미리보기 실패 시 지도만 숨김, 핀 리셋 규칙을 `.place-market` 조상 없이도 먹게). tsc 0건, vitest 10파일 193건. 운영(`index-BaEzC6oe.js`): 상세 DOM **18,534 → 1,613**(시장 절 150), 모바일 1,301; 카드에 facts·구역 링크 3·미리보기 지도(1166×656, 줌 컨트롤 없음, 마커 1 「남대문시장 · 2314」)·「지도 전체 보기」 2; 옛 검색 입력·패널·시트 0; `?marketQuery=떡볶이` → `/market?marketQuery=…`(검색창에 채워짐), `#market` → `/market`; 전용 화면 핀 배경 투명·테두리 0. 기록 `verifications/p7-production.md` 「WU-31 배포 확인」.

## WU-32 OSM 바탕 PNG 파이프라인 제거 (전 레이어 — WU-31 뒤)
- 삭제: `.github/workflows/market-basemaps.yml`, `scripts/market-basemaps/`, nginx `/basemaps/` 프록시 블록과 `proxy_cache_path basemaps`, `k8s/base/network-policy/23-allow-portal-fe-egress-https-public.yaml`(다른 사용처 없음 확인 뒤), FE `fetchMarketBasemapMeta`·`useMarketBasemapMeta`·`MarketCanvas` 의 `<image>` 분기·OpenFreeMap 출처 줄·관련 테스트, `data-sources.md` 의 바탕 항목, 시크릿 `MARKET_BASEMAP_PAR`(사용자), 버킷 `msa-market-basemap`(사용자 콘솔). OSM 지오메트리(`market_boundary`·`market_path`·`market_osm_raw`·수집 잡·`attribution`)는 **남긴다**.
- SVG 지도(`MarketCanvas`) 자체는 이번에 남긴다(두 엔진 실패 폴백). 제거 여부는 WU-32 뒤 별도.
- 검증: nginx `-t`(docker), kustomize build, tsc·해당 vitest, 배포 뒤 `curl -I /basemaps/markets/132180/meta.json` → 404, 시장 지도 정상.
- **완료(2026-10-17 밤)**: `2d476f12c`(21 files, +26/−789). tsc 0건, vitest 9파일 129건, `grep basemap|openfreemap|openmaptiles` 0건, nginx 계약 검사 94건, `kubectl kustomize oci-arm` 정상(삭제한 NetworkPolicy 0회). 운영(`index-W5oJ9JjS.js`): `/basemaps/markets/132180/meta.json` 은 프록시 대신 **SPA 셸(200 text/html)** 로 떨어진다(nginx 의 location 이 없으니 404 가 아니라 폴백 — 계약의 「404」는 이 뜻으로 읽는다), 상세 카드·리다이렉트·전용 화면 핀 모두 그대로. 남은 수동 작업: 시크릿 `MARKET_BASEMAP_PAR`, 버킷 `msa-market-basemap`.

## WU-28 가게 검색을 검색엔진으로 (search + portal-fe — `p7-plan.md` §9.4, ADR-0111, 승인됨)
- **28a 완료(2026-10-18 새벽)** `6b885df75`: 색인 `market-stores`(alias) · 배치 `marketStoreApiReindexJob`(CronJob 21:40 UTC, 실패율 5% 상한) · `GET /api/v1/search/market-stores` · 게이트웨이 정확 경로 라우트 · ADR-0111. 검증: domain 3 · app 5 · batch 65(기존 재색인 포함) 실패 0, kustomize 정상. 운영: 수동 재색인 21,387건 / 0·124 시장 실패 / 2m16s, alias 교체, `떡볶이·떡복이·순대 국밥·tteokbokki` 전부 200 적중(`verifications/p7-production.md` 「WU-28a 배포 확인」).
- **28b 완료** `575804b08`: 전용 화면 검색 → 300ms 디바운스 → API → 실패·빈 응답이면 기존 브라우저 매칭 폴백(훅 `useMarketStoreSearch`). `/markets` 는 첫 안이 시장마다 전체 응답을 다시 받는 구조라 옛 API 에 두었다. tsc 0 · vitest 6파일 70건.
- **28c 완료** `518efcf27`: 색인에 표시 필드(주소·건물·층·호·착한가격·출처·소속·지역·유형·관광지 id ko/en, 전부 `index:false`) + API 응답 확장 + `/markets` 를 검색 한 번으로(실패 시 옛 API 폴백, 시장 상세 호출 0회 단언) + FE 가 API 의 `matchedBy` 배열을 받도록. 검증: app 8 · batch 70 실패 0, tsc 0, vitest 5파일 68건. 운영(`index-C8dKICFB.js`): 재색인 alias `market-stores-20261017-1519`, `/markets?q=떡볶이` 가 검색 API 1회(시장 상세 0회)로 117행, 전용 화면 「떡복이」가 폴백 0곳 → 엔진 17곳, 「순대 국밥」 17곳(`verifications/p7-production.md` 「WU-28b·28c 배포 확인」).
- 판정 세트(§9.4): 음식 10 × 변형 3 × 시장 2, 정답 0 제외 33문항 — Recall@10 **0.33 → 0.76**(오타 0.00→0.63 · 띄어쓰기 1.00→0.92 · 로마자 0.00→0.73). 못 잡는 것(음절 오타 `칼국쑤`·`호덕`, 사전 밖 로마자 `hotteok`)과 띄어쓰기 하락(단일 음절 토큰 과매칭)은 다음 조정 후보(`verifications/p7-production.md` 「판정 세트」).
- **WU-28a 승인 계약**: [ADR-0111](../../adr/ADR-0111-market-store-search-index.md) — 별도 `market-stores` alias, 단일 한영 문서, nori 사용자 사전 없음, dishes.csv는 place `/api/v1/place/markets/dishes` API 한 벌만 사용.
- API는 `GET /api/v1/search/market-stores?q&contentId&lang&page&size`. `contentId` 있으면 기본 size 200/시장 필터, 없으면 기본 20/시장 집계. 응답 items는 storeId/contentId/matchedBy/score, markets는 contentId/marketName/count.
- 배치는 content-ids → 시장 ko/en API 병합, zoneId/pathId 포함, 좌표 없는 가게도 유지. 5% 초과 실패는 별칭 교체 전 실패, 정확히 5% 허용. 매일 21:40 UTC CronJob, 기존 보관 정책.
- WU-28a: search API/색인/배치 + 게이트웨이 정확 경로 + CronJob + 검증/ADR. place/FE/관광지·통합 색인/빌드·lock 변경 없음. nameRoman 원천 부재와 categoryEn 단일 레벨 제한을 기록.
- 후속: FE 300ms 디바운스·storeId 강조·실패/빈 응답 시 기존 브라우저 매칭 폴백, 운영 30문항 Recall@10 및 지도 확인.

## 가게 유형 필터 + 남대문 경계 (2026-10-18 새벽 사용자 요청 — 「길 필터는 의미 없다, 가게 유형 필터가 더 유용하다, 남대문 폴리곤도 제대로」)
## WU-33a 남대문 경계 — 운영 데이터 (수집 코드 그대로 수동 1회, 완료)
- 원인: OSM 에 남대문시장 경계(`way/78503350`, `amenity=marketplace`, 382×247m)가 **있는데 수집 잡이 거기까지 간 적이 없다**. `market_osm_raw` 247곳은 10-15·10-16 수동 실행 두 번이 market_id 1→249 순서로 4시간 마감(`DeadlineExceeded`)까지 간 것이고, 좌표 있는 시장 581곳(남대문 738 포함)은 미수집. 그래서 FE 가 IN 가게 볼록 껍질을 그렸다(숭례문까지 늘어난 삼각형).
- 조치(10-18 01:02, 로컬에서 `ssh msa-oci` 터널로 `content:8097` 내부 API): `market_osm.fetch_overpass → prepare → PUT /internal/markets/738/osm → POST …/rejudge` — Job 과 같은 두 호출. 경계 OSM 17꼭짓점, 골목 21(이름 17: 남대문시장길·2가길·2길·4길·6길·8길 + 한양도성 3코스 한 토막). 재판정 3,929곳 전부 BOUNDARY 기준 → **IN 1,781 · OUT 1,097 · 좌표 없음 1,047**(전: IN 1,271 · OUT 1,611). 드라이런에서 현재 IN 1,267곳 중 1,237곳이 새 경계 안(30곳 OUT), OUT 544곳이 IN 으로.
- 함정: `fetchedAt` 은 실행한 쪽 `datetime.now()` 라 로컬(KST)로 적혔다 — 28일 창에서 9시간은 무시된다.

## WU-33b 수집 순서 — 미수집·큰 시장 먼저 (place/ingest, 직접 구현)
- `run()` 이 대상 시장의 상태를 먼저 한 바퀴 읽어 `(contentId, osmFetchedAt, 가게 수)` 만 남기고, **한 번도 수집 안 한 시장 먼저(가게 수 많은 순) → 수집한 지 오래된 순**으로 50곳씩 배치한다. 28일 안에 수집한 것은 그대로 건너뛴다. 배치 처리에서 상태는 다시 읽는다(전체 상태를 메모리에 들고 있지 않는다 — 남대문 한 곳이 3MB).
- 이유: 마감 4시간에 ~120곳이라, id 순서 + 28일 갱신이면 앞 ~480곳만 돌고 뒤는 영원히 못 닿는다(두 번 돌고 1~249).
- 테스트: 순서(미수집·큰 시장 먼저, 오래된 순, 최근 것 건너뜀) 추가, 오케스트레이션 테스트의 read 수 조정. 배포 뒤 수동 Job 1회로 다음 ~120곳을 큰 시장부터 수집하고 이후는 주간 잡.
- **완료(2026-10-18 새벽)** `4ba40e105`: 새 순서 단언을 옛 코드에 대면 6 failed / 27 passed, 바꾼 뒤 33 passed. 배포 뒤 수동 Job `market-osm-manual-1018`(이미지 `4ba40e1`) 계획 줄 `ingested 828 · due 580 · neverFetched 580 · skippedRecent 248 · unreadable 0` — 첫 배치는 미수집 중 가게 수 상위 50곳. 4시간 마감 안에 ~120곳이 들어오고 나머지는 주간 잡(일 20:20Z)이 이어 간다.
- **첫 배치 결과(02:52 KST)**: 50곳 Overpass 실패 0(한 곳 ≈45초), 쓰기까지 ≈50분. 가게 수 상위 50 중 47곳이 들어왔고(서문시장·아리랑거리·조명의거리·의정부 제일시장·상남시장·국제시장·광장시장·평화시장·인현시장…) 경계 출처는 OSM 30 · DERIVED 2 · 없음 29(전체 OSM 76→103). **큰 시장 대부분은 원래 가게가 전부 OUT 이라**(서문시장 2,631 전부 OUT, 아리랑거리 2,607) 파생 경계도 못 만들었고, OSM 경계가 들어온 곳은 재판정으로 처음 IN 이 생겼다 — 광장시장 212 · 평화시장 200 · 인현시장 24. 단 의정부 제일시장은 OSM 폴리곤이 건물 한 채(≈60m)라 2,291곳이 주변 500m 에 있어도 IN 0 — **건물형 OSM 폴리곤에 엄격 포함 판정을 그대로 쓰면 시장이 비어 보인다**(후속: 작은 폴리곤 완충 또는 반경 판정 병행).

## WU-33c 구역(길) 필터 → 가게 유형 필터 + 핀 크기 (portal-fe, Codex)
- 제거: 전용 화면의 구역 칩·「다른 길 N개」, 요약 카드의 구역 링크 3개, 오버레이의 구역 hull 폴리곤(`zonePolygons`)과 구역별 색, `marketZones`·구역 필터 경로(`visibleMarketStores` 의 zone ids 인자). 관리 화면(MarketManagePage)의 구역 이름 관리·구역 배정·API 타입 `MarketZone` 은 그대로.
- 추가 `pages/place/marketStoreType.ts`: `(categoryMajor, categoryMid)` → 유형 9종 **고정 표**(아래), 값은 trim 뒤 비교(원천에 `비알코올 `·`장례식장 `·`법무관련 ` 처럼 뒤 공백이 있다). 표 밖 값은 `etc`. `marketStoreType(store)`, `marketStoreTypeCounts(stores)`.
- 칩: 「전체」 + 가게 수 > 0 인 유형(많은 순, `etc` 는 항상 마지막), 칩 앞에 유형 색점. 선택은 URL `?type=<key>`(카드 링크가 그대로 들어온다). 목록·지도·검색 교집합은 구역 때와 같은 자리에서 유형으로.
- 핀: 색 = 유형 색(묶음은 다수 유형, 전부 OUT 이면 muted). 크기 = 가게 수 3단계 **1~9 → 20px · 10~99 → 26px · 100+ → 32px**, 글자 `--ko-text-xs`/`sm`. 개별 핀(12px + 이름)과 탭 영역 2.75rem 은 그대로. 골목선·골목 이름은 중립색 `--ko-text-muted` 한 가지.
- 카드: 「골목·건물·층」 → 「가게 유형」(en `Shop types`), 상위 3유형 링크 `…/market?type=<key>` 텍스트 `유형 (N)`.
- SVG 폴백 `MarketCanvas`: `color` 는 (가게) → 색, `pathColor` 제거(골목 중립색).
- 유형 표 (키 / 국문 / 영문 / 토큰 / 대분류: 중분류):
  - `food` 음식점 / Restaurants / `--market-zone-1` / 음식: 한식·중식·일식·서양식·동남아시아·기타 외국·구내식당·뷔페·(빈 값)
  - `snack` 분식·간식 / Snacks / `--market-zone-2` / 음식: 기타 간이
  - `cafe` 카페·주점 / Cafés & bars / `--market-zone-3` / 음식: 비알코올·주점
  - `grocery` 식료품 / Groceries / `--market-zone-4` / 소매: 식료품 소매·음료 소매·담배 소매
  - `fashion` 의류·신발 / Clothing & shoes / `--market-zone-5` / 소매: 섬유·의복·신발 소매
  - `goods` 잡화·귀금속·안경 / Accessories & jewelry / `--market-zone-6` / 소매: 시계·귀금속 소매·안경·정밀기기 소매·장식품 소매·오락용품 소매·기타 상품 소매·중고 상품 소매·애완동물·용품 소매·식물 소매
  - `living` 생활용품·가전 / Household & electronics / `--market-zone-7` / 소매: 종합 소매·기타 생활용품 소매·가구 소매·철물·건설자재 소매·가전·통신 소매·자동차 부품 소매·모터사이클 소매·연료 소매·(빈 값)
  - `health` 건강·미용 / Health & beauty / `--market-zone-8` / 소매: 의약·화장품 소매 + 보건의료 전부 + 수리·개인: 이용·미용·욕탕·신체관리
  - `etc` 기타·서비스 / Services & other / `--market-zone-9` / 나머지 전부(수리·개인 나머지, 시설관리·임대, 부동산, 교육, 과학·기술, 예술·스포츠, 숙박, 대분류 빈 값)
- 근거 분포(운영 `market_store`, 좌표 있는 행): 남대문 의류 1,077 · 빈 값 463 · 한식 157 · 안경 136 · 종합 소매 124 · 카페 84 · 생활용품 76 · 식료품 68 · 분식 60 · 의약·화장품 54 · 시계·귀금속 44 · 장식품 44. 전국 중분류 75종·대분류 10종.
- 검증: `npx tsc --noEmit -p tsconfig.app.json` 0건, 바뀐 테스트 파일만 vitest(MarketMapPage·AttractionMarket·marketOverlay·marketView·MarketCanvas·MarketMap). 배포 뒤 남대문 모바일 캡처(칩·핀 색·크기, `?type=fashion` 진입, 카드 링크).
- **완료(2026-10-18 새벽)** Codex 구현 + 수정 `ccafb5333`(범위 밖 `MarketLocate.test` 의 옛 `pathColor` prop 제거, 유형 표 테스트 파일 작성, SVG 폴백의 「주변」 가게 색 규칙 복원). tsc 0건, vitest 10파일 140건; 유형 표 테스트는 회귀 주입(주점을 카페에서 빼기)으로 3건 빨간불 확인. 운영(`index-DQM-VKPV.js`, 모바일 390×844): 칩 「전체」+9유형 — 의류·신발 606 · 생활용품·가전 380 · 잡화·귀금속·안경 219 · 음식점 82 · 식료품 58 · 건강·미용 57 · 카페·주점 40 · 분식·간식 29 · 기타·서비스 1,357(좌표 없는 1,047곳이 대부분 업종 빈 값이라 여기로 모인다); 줌 17 핀 51개 = 20px 16 · 26px 31 · 32px 4, 색은 유형 토큰 9종; 「의류·신발」 탭 → URL `?type=fashion`, 핀 32개 전부 유형 5 색, 머리말 「현 지도에서 606곳」; `?type=grocery` 직접 진입 → 칩 눌림·핀 17·「58곳」; 상세 카드 「가게 유형」 링크 3개(`?type=fashion|living|goods`), 구역 nav 0. 기록 `verifications/p7-production.md` 「WU-33」.

## 시장 지도 반응·번호·InfoWindow (2026-10-18 오전 사용자 요청 — 「목록은 지도 높이로」「마커 반응이 없다」「검색창 글자가 분해된다」「숫자는 2곳 이상 묶인 핀에만」「검색·클릭·최대 확대 때 글자에 번호」「네이버 InfoWindow → 상세는 우측 슬라이드」)
## 수정 3건 (portal-fe, 직접 구현, 완료 `873b74db5`)
- **마우스 핀 클릭 무반응**: 운영 CDP 진단 — 핀 중심의 최상위 요소가 네이버 SDK 의 이벤트 레이어(div)라 `mousedown/click` 이 핀 버튼에 닿지 않았다(터치는 Chrome 의 터치 보정으로 버튼에 닿아 모바일만 동작). 구글 어댑터처럼 SDK `marker click` 리스너를 같이 걸고, SDK 가 핀을 찾는 HtmlIcon 상자를 `size 44 · anchor 중앙` 으로 버튼과 같은 자리에 둔다(CSS translate 제거). 한 동작은 한 경로만 받으므로 중복 호출 없음.
- **검색창 한글 분해**: 검색창이 URL 파라미터에 묶인 제어 입력 + react-router v7 의 트랜지션 내비게이션 → 입력 이벤트 직후 React 가 옛 값("")을 되쓰고 조합이 끊겼다(운영 재현 「남대문」→ "ㄴ나남남ㄷ대댐대무문문"). 화면은 경로마다 다시 마운트되므로 `defaultValue` 비제어 입력으로.
- **데스크톱 목록 높이**: 모바일 시트 snap 높이 규칙(`[data-snap=half] .market-map-list 55%`)이 데스크톱 `100%` 규칙보다 구체적이어서 핀을 누르면 목록이 55% 로 줄었다. snap 높이는 `max-width: 1023px` 안으로.
- 회귀 테스트: 제어 입력 되쓰기 감시(옛 코드 `['', 'ㄴ']` 빨간불), SDK marker click → `onSelect` 같은 키 + 아이콘 상자 단언(옛 코드 빨간불). 운영 확인은 `verifications/p7-production.md`.

## WU-34 핀 숫자·목록 번호·InfoWindow·상세 패널 (portal-fe, 직접 구현)
- **34a 핀 숫자·번호**: 묶음 핀은 **가게 2곳 이상일 때만** 수를 쓴다(1곳 핀은 색점). 「번호」는 데이터에 점포 번호가 없으므로(남대문 3,929곳 호수 0, 온누리 원천 필드 주소·시장명·점포명·취급품목) **목록 순번**이다 — 검색 중이면 보이는 결과(「더 보기」 전 50곳)에 1부터, 핀·행을 눌러 선택했으면 선택한 필지 가게에 1부터. 번호가 있는 1곳 핀은 점 안에 번호, 최대 확대의 개별 핀은 이름 라벨 앞에 번호(`3 · 남산상회`). 목록 행에도 같은 번호 배지. 선택 핀의 테두리는 `--ko-accent-primary` 4px(기존 accent-text 3px 는 어두운 핀에서 안 보였다). 번호 계산은 페이지가 `marketListStores` 로 한 번 하고 목록·지도에 같은 Map 을 준다(목록의 페이지 상태 `limit` 을 페이지로 올린다).
- **34b 네이버 InfoWindow**(SDK 포함 기능, 추가 과금 없음 — 지도 로드 건수에만 포함): 핀 클릭(마우스·터치)·목록의 「지도에서 보기」 포커스 때 핀 위치에 InfoWindow — 가게 최대 3곳(이름·유형·주소 한 줄·「상세보기」), 더 있으면 「외 N곳 · 목록 보기」(모바일 시트를 half 로). 지도 빈 곳 클릭·× 로 닫힘, 선택 해제 때도 닫힘. 위치 기준으로 연다(핀이 다시 그려져도 남는다). 핀 클릭은 더 이상 시트를 half 로 올리지 않는다(InfoWindow 가 가려진다) — 검색창 포커스는 그대로 half. 미리보기(비대화형)·구글·SVG 폴백에는 없다. 내용은 textContent 로만 넣는다(상인이 쓴 이름).
- **34c 상세 패널**: InfoWindow 의 「상세보기」와 목록 행의 「상세보기」가 `MarketStoreDetail` 을 연다 — 지도 오른쪽에서 슬라이드(`min(24rem, 100%)`, 모바일은 전체 폭, `prefers-reduced-motion` 이면 애니메이션 없음). 내용: 번호·이름, 유형(색점)·분류 경로, 배지(출처·착한가격·시장 밖·위치 미확인), 주소·건물·층·호, 기준점 핀의 상대 위치, 착한가격 메뉴 전부, TourAPI 메뉴(`MarketMenuDetails`), 「지도에서 보기」·「닫기」(Esc). URL 상태는 두지 않는다(후속 후보: `?store=` 딥링크·뒤로가기).
- 검증: tsc 0건, 바뀐 테스트 파일만 vitest(marketOverlay·MarketNaverMap·MarketMapPage·MarketCanvas·MarketMap). 배포 뒤 운영 CDP — 1곳 핀 숫자 0, 검색 후 라벨 번호, 마우스 클릭 → InfoWindow DOM(`.place-market-naver-info`) 과 상세 패널, 모바일 터치 같은 흐름.
- **완료(2026-10-18 오전)** `2a904e6d9` + 보완 `8ffce8b7d`(정보 창을 목록 순서·번호 배지로 다시 채움, 지도 위로 넘치면 panBy, 행 2열, 패널 focus `preventScroll`, 무대 `z-index: 0`) + `1e7c0fb76`(핀 클릭 직후 panBy 의 bounds_changed 가 페이지보다 먼저 다시 그려 방금 연 창을 닫던 레이스 — 선택 해제를 「있다가 없어질 때」만 보도록; 옛 코드에 대면 빨간불). vitest 8파일 98건(보완 뒤 Naver·Page 34건), tsc 0. 운영(`index-Dra6JgdP.js`, `prod-wu34.mjs`·`prod-wu34b.mjs`): 줌 17 핀 51 = 2곳 이상 묶음 49 · 빈 점 2 · 「1」 0. 9곳 핀 클릭 → 정보 창 「1 남대문대가 · 2 남문교자 · 3 대원집」 = 목록 1~3, 「외 6곳 · 목록 보기」, 창 288×300 무대 안(위로 넘친 만큼 지도가 내려감). 검색 「남대문」 → 2번 행 「지도에서 보기」 → 줌 19 + 정보 창 1행 「2 남대문신발」. 모바일 터치 → 정보 창 → 상세 패널 x 6 · 384px(밀림 0), 줌 컨트롤 안 보임. 남대문은 줌 19 에도 한 화면 790곳이라 묶음(95핀)이고 번호 라벨은 줌 20+ 에서 나온다. 후속: 모바일 패널 폭 100%(6px 지도 조각), `?store=` 딥링크·뒤로가기.

## 시장 검색 지도·로드 시간·목록 높이 (2026-10-18 오후 사용자 요청 — 「장소 검색 위 시장 검색 버튼이 폭 100% 라 어색하다, 시장을 검색하면 그 시장 지도를 같이」「경주 중앙시장 지도가 느리다」「왼쪽 목록이 아직 짧다」「경주 마커 위치」)
- **로드 시간**: 운영 CDP(1440×900, 캐시 끔) — 문서 1.1s, 시장 응답 `/api/v1/place/markets/990539` **TTFB 5.4s**(268KB), 네이버 SDK 는 응답 뒤에야 받기 시작해 첫 핀 7.8s. curl 5회 5.8~6.3s, 가게 수가 3분의 1인 성동시장도 5.8s → 시장 크기와 무관. 운영 DB 에서 서비스의 질의를 하나씩 재면 가게 0.8s · TourAPI 메뉴 붙이기 0.7s · 원천 시각 0.7s(기준 `SELECT 1` 0.64s) · **시장 안 음식점 5.97s**. attractions 에 위경도 인덱스가 없어 `source='TOURAPI'` 2.4만 행(EXPLAIN rows 23,669, filtered 0.06%)을 넓은 행째 읽었다 → `V46__attraction_restaurant_bbox_index.sql` `(content_type_id, lang, source, latitude, longitude)`. 스키마 통합 테스트(MySQL 컨테이너) 18/18, 「now at version v46」.
- **목록 높이**: 패널은 지도 높이(779px)인데 안의 `ul` 이 관광지 상세용 `.place-market-shops { max-height: 28rem }` 에 걸려 448px 에서 잘리고 따로 스크롤했다(17곳 중 3곳만 보임). `.market-list-rows { max-height: none }` 과 특이도가 같아 운영 번들의 CSS 청크 순서에서 졌다 → `.market-map-list .market-list-rows`.
- **시장 검색 지도**: `/markets` 검색 결과 옆(데스크톱 오른쪽 열 sticky, 모바일 결과 위)에 `MarketSearchMap` — 첫 시장 결과(없으면 첫 가게의 시장)를 띄우고, 결과 링크의 평범한 클릭은 그 시장(가게면 그 가게에 맞춤)으로 바꾼다. 새 탭·수정 키 클릭, 이미 띄운 결과를 다시 누르기, 지도 키 없음은 링크 그대로 전체 지도로. 지도 머리 「지도 크게 보기」, 정보 창 「상세보기」는 `?store=<id>` 로 전체 지도에 가서 그 가게 상세를 연다(MarketMapPage 가 초깃값만 읽는다 — 뒤로가기 연동은 아직). 장소 탐색 머리띠의 「시장 가게 찾기」는 글자 폭만.
- **경주 마커**: 코드가 아니라 원천 좌표 단위 문제. 중앙시장(market 668)은 시장 안(IN) 193곳이 **좌표 2개**(190곳이 한 점 35.84395,129.20674 = 금성로 295 건물, 3곳이 다른 건물) — 상가정보 좌표는 점포가 아니라 건물 단위다. 온누리 가맹점 199곳은 좌표가 없다(UNKNOWN, 지도 밖·목록만). 경계 폴리곤(OSM way 477075259)과 바탕 지도는 맞는다. 성동시장(179)은 IN 122곳이 53점, 한 점 최대 59곳.
- 검증: tsc 0, eslint(바뀐 파일) 0, vitest MarketSearchPage 16 · MarketMapPage 23 · AttractionMarket; 회귀 주입(클릭 가로채기 제거, `?store=` 초깃값 제거) → 각 1건 빨간불.
- **「우리 지도로 보기」 제거**(같은 날 사용자 요청): 지도 전환 버튼과 그 선택을 기억하던 `localStorage` 키를 없앤다. SVG 지도는 네이버·구글이 둘 다 실패할 때의 대체로만 남는다(전환 버튼이 하던 「실패 뒤 다시 시도」도 사라진다 — 새로고침). 「내 위치」 버튼은 비워진 오른쪽 위로. 개인정보처리방침의 「우리 지도로 전환할 수 있음」 문구도 뺀다. **OSM 은 제거하지 않는다** — 운영에서 시장 경계 150곳(OSM)·골목선 21,695개(451개 시장)·가게 안/밖 판정 138,436건(`judged_by=BOUNDARY`)이 OSM 에서 오고, 네이버 지도 위 시장 영역·골목선도 이 데이터라 출처 표기(ODbL)도 유지한다.
- **장소 검색에서 시장 바로 보기**(같은 날 사용자 요청 「장소 검색 목록 위 시장 검색 버튼은 없애고, 시장을 검색하고 볼 수 있게」): 머리띠의 「시장 가게 찾기」 버튼을 없앤다(`/markets` 화면은 주소·프리렌더로 남는다). 장소 검색은 이미 시장을 찾는다 — 운영 `경주 중앙시장` → 1위 경주 중앙시장(34447), `남대문시장` → 1위 남대문시장(34550). 결과를 누르면 열리는 패널(데스크톱 열·모바일 시트)에 `MarketPanelPreview` — 시장 목록(`content-ids`)에 있는 관광지면 지도 미리보기(비대화형, 누르면 시장 지도)와 「시장 지도 보기 · 가게 N곳」(시장 밖 제외), 시장이 아니면 시장 응답을 부르지 않는다. 검증: tsc 0, eslint(바뀐 파일) 0, vitest MarketPanelPreview 2 + PlacePage·prerenderPlace 9파일 211; 회귀 주입(시장 판정 항상 참) → 1건 빨간불.
- **정정 — 장소 검색은 시장을 찾지 못하고 있었다**: 위 「이미 시장을 찾는다」는 분류 없이 부른 API 결과였다. 운영 화면의 실제 요청은 `keyword=경주+중앙시장&sidoCode=11&category=nature,history,culture,leisure,festival` — 시장(TourAPI `shopping`)은 목록 분류에서 일부러 빠져 있고(ADR-0071 §5, 쇼핑은 지도 토글 전용) 기본 지역 서울이 걸려 결과 1위가 「홍익문화공원」이었다(운영 CDP). 쇼핑을 목록에 넣으면 그 결정을 뒤집으므로 대신 목록 위 `PlaceMarketMatches` — 검색어로 `/api/v1/place/markets/search` 를 지역과 무관하게 불러 시장 이름이 맞는 시장(최대 5)을 「시장 N곳」 줄로 띄우고 시장 지도로 보낸다(운영 API: `경주 중앙시장` 1 · `중앙시장` 10 · `경주` 2 · `남대문` 2 · `경복궁` 0). 검증: `tsc -b --force` exit 0(빌드와 같은 명령 — 앞 커밋은 `tsc -p .` 만 보고 테스트 파일 TS2352 로 images 빌드를 깼다, `3f2f67d24` 로 수정), eslint exit 0, vitest 10파일 213; 회귀 주입(시장 0곳으로) → 1건 빨간불.
