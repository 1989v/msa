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
- GitHub Actions 주 1회(수동 dispatch 포함): 헤드리스 크롬 + MapLibre GL JS + OpenFreeMap positron 계열 스타일(우리 토큰 색으로 바꾼 스타일 JSON 을 레포에 둠)으로 시장마다 **경계(없으면 가게 범위 + 100 m) 를 덮는 줌 18 이미지**(가로세로 ≤ 2048 px, 필요하면 2×2 분할) 를 그린다. 라벨 언어 ko / en 두 벌.
- 저장: OCI Object Storage 버킷(공개 읽기, 백업 PAR 와 별개) `markets/{marketId}/z18-{ko|en}.png` + `meta.json`(이미지의 위경도 범위·줌·렌더 시각·스타일 버전). 828곳 × 2 × ~400KB ≈ 700MB.
- 출처: OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors 를 이미지 모서리와 화면에.
- 공개 API: `GET /markets/{contentId}` 응답에 `basemap: {url, bounds, zoom, lang, renderedAt} | null`(메타는 place DB `market_basemap` 테이블, CI 잡이 내부 API 로 등록).
- 검증: 남대문·광장·망원·서문 이미지 생성, 좌표 → 픽셀 변환 오차 ≤ 2 px(알려진 점으로 검사), 영문 라벨.

## WU-24 시장 섹션 바탕 적용 (portal-fe)
- `MarketCanvas` 가 `basemap` 이 있으면 SVG 뒤에 `<image>` 로 깔고(Web Mercator 로 핀 좌표와 같은 변환), 없으면 지금 그대로. 확대·이동은 이미지와 오버레이가 같은 viewBox 변환을 탄다. 우리 골목 선은 바탕이 있으면 그리지 않고 **특화 골목 이름 띠·게이트·핀·내 위치**만 올린다.
- 프리렌더·검색엔진용 정적 그림도 같은 이미지. 다크 테마는 이미지에 어두운 필터 대신 다크 스타일 한 벌을 더 렌더할지 WU-23 에서 결정.
- 검증: CDP 4조합(남대문·광장·망원), 핀이 바탕의 건물 위에 놓이는지 알려진 가게로 확인.
