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
| 배포 ② | 이미지 | portal-fe 7141846 · search·search-batch 091d9a8(수동 dispatch — 실패한 5705225 빌드의 search 변경을 다음 push 가 안 잡음) |
| 배포 ② | 재색인 | 256초 · 64,967건 · 행사 기간 1,159 · S>E 0 · 날짜 없음 0 · 종료/날짜 없음 771 후보 제외 · 벡터 59,682/64,967(새 행은 임베딩 잡 대기) · 코스 구성 0(반복정보 보강 대기) |
| 배포 ② | 행사 필터 API | ONGOING 96 + UPCOMING 198 = NOT_ENDED 294 · WEEKEND 117 · stay 3,590 · course 1,000 · eventStart/eventEnd 응답 |
| 배포 ② | 서버 렌더 | 행사 61735 「… 행사 정보 — 일정 · 장소」 Event · 진행 중 · noindex(개요 없음) · 숙박 12835 LodgingBusiness · 코스 61687 TouristTrip · 기존 114·en 21 그대로 · 출처 절 전부 |
| 배포 ② | 정적 sitemap | 행사 1,159 중 sitemap 0 · 양성 대조 관광지(12·76) 13,445 |
| 배포 ② | CDP 4조합(세로·가로 × 라이트·다크) | 상태 칩 3개 1줄 · 행사 기간 줄 30 · 가로 스크롤 없음 · 상태 문구 대비 9.63/6.08 · 해운대 근처 숙소 6 · 근처 행사 6 · 편의시설에 숙박 없음 · 스크린샷 verifications/cdp-deploy2/ |
| 배포 ② 남은 것 | 보강 대기 | 새 행 개요·이용정보(매일 잡) · 옮겨 온 숙박 4건 intro 재수집 · 코스 제목 「코스 여행코스」 중복 · 행사 칩에서 속성 칩 숨기기 → TG13 |
| TG13 | vitest 2파일 · tsc(app 273 files) · search:app Parity 29 · Renderer 57 · Service 4 · Controller 5 · verifyArchitecture | 23 passed · exit 0 · 0 실패 · BUILD SUCCESSFUL |
| TG13 | 회귀 주입 6종(코스 제목 접미 · 행사일 때 속성 조건·facets·칩 줄) | 전부 빨간불 · doc_map --check exit 1 은 HEAD 에서도 같은 기존 드리프트 |
| 배포 ③ | 이미지·롤아웃 | search·portal-fe c943faf · rolled out |
| 배포 ③ | 행사 sitemap 계약 | place 200 · application/xml · Cache-Control public, max-age=300, must-revalidate · apex·blog·resume 404 · 인덱스에 등재 |
| 배포 ③ | 양성 대조(개요 보강 수동 856초 → 재색인) | 행사 개요 국 896 · 영 227 · sitemap urls 514 = DB 기대값 514 · 진행 중 행사 robots 없음(61735 noindex 해제) · 종료 33일 61969 noindex, follow · sitemap 0 |
| TG13 배포 | search·portal-fe b0020c3 | 코스 61687 제목 「… 여행 코스 — 코스 구성 · 거리 · 소요 시간」 (중복 제거 확인) |
| 12.A+B | pytest 6파일 · check_sample_fields --self-test · Gradle(place·search batch·app 대상) + verifySearchIndexContract·verifyArchitecture·verifyDataSourcePoolKeys · vitest 3 · tsc(app) · kustomize | 30 passed · exit 0 · 289 tests 0 실패 · BUILD SUCCESSFUL · 47 passed · exit 0 · schedule 40 17 * * * |
| 12.A+B | 회귀 주입 16종 + 의료관광 제외(EX0508xx) | 전부 빨간불 · 운영 호출 101콜(정밀도 표본) |
| 12.A+B 운영 | 배포 cff5116 · V25 · 첫 수집(--wellness) · 재색인 | 무장애 목록 9,630 → 붙음 9,623 · 상세 899 · 실패 0 · 호출 900 · 웰니스 국 168/170 · 영 92/92 · 패싯 국 휠체어 265 · 엘리베이터 88 · 장애인 화장실 782 · 웰니스 168 · 경복궁 SSR barrier-free 절·출처 줄 |
| 12.C | pytest 4파일 · place domain·feature(통합 포함) · ContentContextLoadSpec --rerun · 게이트 · vitest 2 · tsc(app) | 30 passed · 6·4·5·7·8 tests 0 실패 · BUILD SUCCESSFUL · 12 passed · exit 0 |
| 12.C 운영 | 배포 361870c · V26 · 백필 --from=2025-09 | 258초 · 호출 52 · 시군구 293,425 · 시도 18,675행 · API 11110 200(12개월, latestDate 2026-09-02) · 레디스 키 생성 |
| 12.D | pytest 6파일 · check_sample_fields · place domain·feature(통합) · ContentContextLoadSpec --rerun · 게이트 · vitest 3 · tsc(app) · kustomize | 69 passed · exit 0 · 8·8·5·8·4·5·8 tests 0 실패 · BUILD SUCCESSFUL · 44 passed · exit 0 · 단기 25 8,20 / 중기 25 21 (UTC) |
| 12.D | 회귀 주입 13종 + 광역시 소속 군 규칙 | 전부 빨간불 · 격자 243 · 변환식 기상청 표 274행 중 270 일치 |
| 12.D 운영 | 배포 45d187f · V27(flyway 27 success) · 단기 1회(17:00 발표) · 중기 1회(06:00 발표) | 단기 호출 243 · 격자 243/243 · 중기 호출 173 · 캐시 갱신 시군구 267 · API 11110 200 11일치 · 테이블 243/173/267 |
| 12.C·12.D CDP 4조합 | 경복궁 상세 날씨 절 · 종로구 허브 방문 추이 | 날씨 11일·출처 기상청·가로 넘침 없음 · 방문 추이 12개월 막대·출처 빅데이터 · 스크린샷 verifications/cdp-phase2/ (방문 추이 막대 수는 선택자 결함으로 스크린샷으로 판정) |
| 12.E | pytest 5파일 · check_sample_fields · Gradle(place·search batch·app·content 대상) + 게이트 · vitest 2 · tsc(app) | 50 passed · exit 0 · 196 tests 0 실패 · BUILD SUCCESSFUL · 38 passed · exit 0 |
| 12.E | 매칭 실측(종로·제주·해운대 376) · 정밀도 · CODE12 | 정확 75.5% · 정규화 포함 81.4% · 포함 단계는 저장만(정밀도 90~95%) · 광주·전남 0건 |
| 12.F | pytest 4파일 · check_sample_fields · Gradle(place domain·feature·search batch·app·content 대상) + 게이트 · vitest 2 · tsc(app) | 34 passed · exit 0 · 216 tests 0 실패 · BUILD SUCCESSFUL · 41 passed · exit 0 |
| 12.F | 노출 규칙(우리 행으로 이어진 대상만, 분류 무관) | 출발 176 중 160(91%) 노출 · 앞 6곳 828건 = 관광지 659 · 음식 114 · 숙박 55 |
| 12.E 운영 | 배포 8bc6111 · V28 · 첫 수집 · 재색인 | 123초 · 호출 269 · 받은 시군구 222 · 관광지 7,481 · 정확 5,910 · 정규화 451(노출 85%) · 포함 255(저장만) · 경복궁 30일 · 0건 시군구 47(광주·전남 27 + 구가 있는 시 등 20 — 원천이 구 단위 코드로 주는지 확인 필요) |
| 12.G | pytest 9파일 · check_sample_fields · place domain·feature(통합) · ContentContextLoadSpec · 게이트 · vitest 2 · tsc(app) | 102 passed · exit 0 · 4·8·11·8·5·4·8 tests 0 실패 · BUILD SUCCESSFUL · 46 passed · exit 0 |
| 12.G | 측정소 매핑 실측(672곳 · 관광지 48,725) · 사고 기록 | 관광지→최근접 중앙값 2.2km · 20km 초과 1.7% · 구현 중 로컬 kubectl 이 회사 EKS(prod-common)에 시크릿 읽기 요청 1건(출력 없음) — 이후 OCI 접근은 ssh msa-oci 로만 |
| 12.F 운영 | 배포 055aa4d · V29 · --base-ym=202608 · 재색인 | 234초 · 호출 269 · 받은 시군구 256 · 해운대 함께 간 곳 6 · SSR related 절 · 0건 13 = 구가 있는 시(수원·성남·안양·부천·안산·고양·용인·화성·청주·천안·포항·창원·전주) — 원천이 구 단위 코드로만 준다. 광주·전남(12)은 연관에선 정상 |
| 0건 시군구 조사 | 원천 직접 호출(202608, 41110/41111/41113) + DB 대조 | **손실 없음 — 코드 변경 안 함.** place 시군구 목록은 시(41110)와 구(41111…)를 둘 다 가지므로 구 단위 행은 이미 들어와 있다(연관 41111 13 · 41591 34 등). 0건은 원천이 그 층위를 안 쓰는 쪽 코드다. 두 원천이 층위가 다르다: 연관은 화성을 구(41591…)로, 혼잡은 시(41590, 78행 · EXACT 48)로 준다 — 「시 → 구 치환」을 넣으면 혼잡 화성 78행을 잃으므로 두 층위를 다 묻는 지금 방식을 유지한다(비용: 하루 13콜 남짓). 광주·전남 혼잡 0건은 원천 미제공 |
| 12.G 운영 | 배포 65d15d3 (content · portal-fe rollout · CronJob 이미지) · 측정소 잡 수동 1회 · 매시 잡 1회차 | 매시: `호출 1 · 측정소 672 · 적재 672 · 측정 시각 2026-10-02 23:00 666곳(6곳 None)` · 측정소: `호출 1 · 측정소 672 · 탈락 0 · 시군구 268 · 후보 1594(중앙값 6 · 최대 21) · 캐시 갱신 시군구 268` · 대조(23:00): 명장동 29/8 · 용호동 22/2 · 우동 27/9 — 공개 API·화면과 원천 `getMsrstnAcctoRltmMesureDnsty` 일치 · 해운대(id 6) 상세 CDP: 「우동 측정소 · 1.7km · PM10 좋음 27 · PM2.5 좋음 9 · 출처 에어코리아 · 10월 2일 23:00」 번들 index-D1zMNMG5 · 하루 24콜은 회차 누적으로 내일 확인 |
