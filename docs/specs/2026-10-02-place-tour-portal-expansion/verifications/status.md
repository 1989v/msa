| TG | 검증 | 결과 |
|---|---|---|
| TG1 | 표본 정제 게이트 (패턴 강화 후) | 현재 표본 exit 0 · 88자 base64 주입 exit 1 · 원복 exit 0 |
| TG2 | place:domain 3클래스 + place:feature 8클래스(통합 포함) + content 컴파일 + verifyArchitecture·verifySearchIndexContract | 57 tests · skip 0 · fail 0 · 통합 테스트가 실제 MySQL 에 V23 적용 |
| TG2 | 회귀 주입 11종(구현 에이전트) | 전부 빨간불 |
| TG3 | pytest 4파일(categorize·sync_tour_portal·backfill_pick·upsert_fields) + smoke_test + 픽스처 키 검사 | 24 passed · SMOKE OK · exit 0 |
| TG3 | 회귀 주입 12종(구현 에이전트, 임시 사본) | 전부 빨간불 |
| TG4 | kustomize 렌더: schedule `10 18 * * *` · deadline 540 · backoff 0 · timeZone 없음 · NP 28 불변 | 일치 · 540→900 주입 시 판정 exit 1 |
| TG4 | verifyArchitecture | exit 0 |
| TG4 4.6 | 기준선(ops-before.txt) | 59,682행 합계. 첫 실행이 파생 테이블+TEXT 로 MySQL liveness 실패 → 03:05 UTC 재시작 1회(약 1분). 범위 집계로 고쳐 재실행, ping 최대 1.08s, 재시작 없음 |
| TG5 | search:domain EventScheduleTest·CourseStopsParserTest·EventScheduleGoldenTest + verifyArchitecture | 18/0 · 7/0 · 1/0 · exit 0 |
| TG5 | 회귀 주입 11종 + 문구 변경 시 골든 해시 변화(구현 에이전트) | 전부 빨간불 · 7b72ff01 → 255e2221 |
| 배포 ① 첫 수집 | tour-portal-sync 1회차 | 코스 1,000 · 영문 숙박 207 적재. 행사 국·영 bulk 500(tel 123자 > varchar 100) · 국문 숙박 TourAPI SSL 시간 초과 → V24(fe952815) |
| V24 | PlaceSchemaIntegrationSpec(실제 MySQL v24) | 5/0 · V24 제거 시 Data too long for column 'tel' 로 1 실패 |
| TG6 | search batch·domain·app 14클래스 + verifyArchitecture·verifySearchIndexContract | 160 tests · 0 실패 · exit 0 |
| TG6 | 회귀 주입 8종 + 끝난 행사 placement 비우기 | 전부 빨간불 |
| TG7 | search:app '*Attraction*'·'*Unified*' + verifyArchitecture·verifySearchIndexContract | 205 tests · 0 실패 · exit 0 |
| TG7 | 회귀 주입 5종 + 통합 검색 NOT_ENDED 제거 · 바이트 동일 기준은 변경 전 HEAD 8162d149 에서 뜸 | 전부 빨간불 |
| TG8 | search:app AttractionPage·JsonLd·Render + verifyArchitecture·verifySearchIndexContract | Service 4 · Parity 15 · Renderer 57 · Controller 5 · 0 실패 |
| TG8 | portal-fe vitest 4파일 · tsc | 59 passed · exit 0 |
| TG8 | 회귀 주입 10종(구현 에이전트) | 전부 빨간불 |
| 배포 ① 4.8.1 | 새 이미지 확인 | content:fe95281 (V24 적용 로그) · place-ingest:eb4cda8 · 잡 로그에 「날짜 변환 실패」 문구 있음 |
| 배포 ① 4.8.2 | 유형·언어별 수신 − 제외 = 적재 | 행사 국 897=897 · 영 262=262 · 숙박 국 2,990−65=2,925 · 영 211−1−2−1=207 · 코스 1,068−68=1,000 |
| 배포 ① 4.8.3 | 옛 숙박 4건 | ko 2775576·1891566 → 32 (44/825·50/130), en 2948191·3112217 → 76 (28/155·51/720, fix_legacy_en_type --apply 갱신 2) · 유형 없는 행 0 |
| 배포 ① 4.8.4 | ops-before/after 필드 합계 | 보강 필드 8종 합계 동일 · 법정동 59,675→63,998 · 이미지 52,771→55,857 · 관광지(12) 4행이 원천 숙박 목록 기준 32 로 이동(보강 값 유지) |
| 배포 ① 4.8.5 | 수집 소요 | 41초(마감 540초) |
| 배포 ① 4.8.6 | Q4 날짜 이상값 | 날짜 변환 실패 0 · UNKNOWN 0% |
| 정정 | portal-fe `npx tsc --noEmit -p .` | **검사 파일 0개**(tsconfig.json 은 references 껍데기). TG8 에 적은 「tsc exit 0」은 근거가 아니었다. 이후 `-p tsconfig.app.json`(270개 파일) 으로 판정, tasks.md 명령 교체 |
| TG9 | vitest 9파일 · tsc -p tsconfig.app.json(270 files) · search:app AttractionPage·JsonLd + 게이트 | 173 passed · exit 0 · Parity 27 · Renderer 57 · Service 4 · Controller 5 · 0 실패 · BUILD SUCCESSFUL |
| TG9 | 회귀 주입 15종(구현 에이전트) | 전부 빨간불 |
| TG10 | vitest 5파일(AttractionPage·RegionPage·placeApi·PlacePage·prerenderPlace) · tsc -p tsconfig.app.json | 68 passed · exit 0 |
| TG10 | 회귀 주입 8종(구현 에이전트) | 전부 빨간불 · 10.6 CDP 는 배포 뒤 |
| 배포 ② 1차 | images 36963993854 | 실패 — code-dictionary OntologyFilesSpec(내 search-consumer 수정이 온톨로지 심볼 2개를 지움) → 참조 이동·revision 12·graph 재내보내기, 3 specs 0 실패 |
| TG11 | search:app EventSitemap 3클래스·AdapterEvent·PageRenderer + 게이트 | 4·4·2·42·57 · 0 실패 · BUILD SUCCESSFUL |
| TG11 | vitest prerenderPlace·eventSchedule · tsc(app) · check-nginx-events-sitemap.sh(nginx:1.27-alpine) | 26 passed · exit 0 · 18 checks PASSED |
| TG11 | 회귀 주입(Kotlin 7 · prerender 2 · nginx 7) | `=` 를 둔 채 순서만 바꾼 것 외 전부 빨간불(그건 nginx 정의상 회귀 아님 → T15 문구 정정) |
| CI | ci.yml 7141846 | success — 02:33 이후 실패 원인은 온톨로지 참조(a9ab03e5 로 해소) |
