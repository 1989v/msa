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
- `place/ingest/src/market_osm.py`: Overpass 조회(시장마다 한 요청), `market_osm_raw` 전체 보존, 경계·골목 선 초안 upsert(MANUAL 행 불변), 없으면 DERIVED 둘레. 실패율 상한. 끝나면 시장별 재판정 호출.
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
