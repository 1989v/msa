# 테스트 전략

원칙: 검사는 **대상이 내놓은 값**을 본다. 기대값을 손으로 복사하지 않는다. ★ 검사는 대상 코드를 되돌려 빨간불을 본 뒤에만 켰다고 기록한다.
Testcontainers OpenSearch 의존성은 더하지 않는다 — 요청 빌더는 직렬화한 요청 JSON 으로, 실제 색인 동작은 배포 뒤 읽기 전용 질의로 확인한다.

| # | 시나리오 | 층 · 파일 | 판정 근거 | ★ |
|---|---|---|---|---|
| T1 | 셸 메타 교체 · root 본문 · 치환 문자열 `$1` 무해 · 이스케이프 순서(`&lt;script&gt;` 원문이 태그가 되지 않음) · JSON-LD `<` | unit `AttractionPageRendererTest` | 렌더러 출력 HTML 파싱 | ★ |
| T2 | **서버·클라이언트 JSON-LD 동일** — 속성 필드는 해석됨/UNKNOWN 두 경우 | vitest 가 `copy.mjs` 실제 함수로 골든 픽스처(JSON) 생성 → Kotlin `AttractionJsonLdParityTest` 가 같은 입력으로 렌더한 JSON-LD 와 구조 비교. **CI 가 vitest 로 픽스처를 다시 만들고 `git diff --exit-code` 로 막는다**(옛 사본 비교 방지) | 양쪽 실제 함수 출력 | ★ |
| T3 | 메타 규칙: 개요 없음 → noindex · 경로/문서 언어 불일치 → 문서 언어 canonical · 404 가 요청 id 를 쓰지 않음 · id 형식 위반 → 404 | unit 렌더러 + `AttractionPageControllerTest`(MockMvc) | 응답 HTML·상태 | ★ |
| T4 | 셸 제공자: 5분 TTL · 실패 시 마지막 정상본(STALE) · 30초 백오프 · 2초 시간 초과 · 한 번도 없음 → 최소 HTML | integration `AttractionShellProviderTest`(로컬 HTTP 서버로 상태 조작) | 제공자 상태·반환 HTML | ★ |
| T5 | 서비스: 문서 조회 1회 · 없음/비활성 → 404 · 조회 실패 → 셸 200 + 경고 | unit `AttractionPageServiceTest`(MockK, 호출 횟수 verify) | 포트 호출 수·결과 | ★ |
| T6 | 파서 표 기반: 운영 원문으로 만든 픽스처(국·영) — 연중무휴 · 매주 요일 휴무 · 조건부 휴무 → UNKNOWN · 원문 없음 → UNKNOWN(부정 아님) · 주차 가능/불가 · 유모차 대여 · 카드 · 무료/유료 · 유형 12·28 무료 → UNKNOWN | unit `AttractionAttributeParserTest` | 파서 반환값 | ★ |
| T7 | 파서 정확도: 사람 라벨 200건(국·영, **라벨러는 파서 출력을 보지 않는다**, 속성별 긍정 라벨 최소 20건 — 모자라면 표본 추가)에 대한 속성별 정밀도·재현율 — 긍정 정밀도 95% 미만 속성은 필터 미개방 | 오프라인 측정 스크립트 + 결과 파일 `verifications/parser-accuracy.md` | 라벨 대비 파서 출력 | ★ |
| T8 | 속성 필터 요청: 긍정 값만 · AND · 텍스트·벡터 레그 모두 필터 포함 · 병렬 집계 요청의 속성별 자기 제외 필터 · 하이브리드면 질의어 제외 · **파라미터 없으면 기존 요청 JSON 과 바이트 동일 — 기준 스냅샷은 어댑터를 고치기 전 커밋에서 뜬다** | unit `AttractionSearchAdapterFacetTest`(직렬화한 요청 JSON 비교) | 어댑터가 만든 요청 | ★ |
| T9 | 「오늘 정기휴무 아님」 KST 요일 경계(일요일 23:59 / 월요일 00:00) | unit (시계 주입) | 생성된 필터 | |
| T10 | 지역 집계기: 두 번 훑기 결과 · 언어별 분리 · 페이지 경계 · 같은 분류 5곳 미만 · **5자리 시군구 축(다른 시도의 같은 3자리 코드가 섞이지 않음)** · 코드 없는 문서 제외 · 자기 제외 · **M ≤ N** | unit `RegionAggregatorTest` | 집계기 반환값 | ★ |
| T11 | **재색인 bulk 에 새 필드 값이 실린다**(속성·지역·유사·클릭) · 유사 목록 비활성 id 제외 · `model_ref` 불일치 제외 · 합류 실패 시 필드만 비고 진행 · `attributeParserVersion` 이 바뀌면 전량 재계산 · 읽기 문서가 중첩 필드를 역직렬화 | unit `AttractionApiReindexTaskletTest`(bulk 요청 캡처) | 캡처한 bulk 문서 | ★ |
| T12 | 유사 계산: 다른 시도·같은 언어·같은 유형 · 자기 제외 · 상위 5 | unit (tools/embed pytest) | 계산 결과 | |
| T13 | place V22 적재·조회 API · Flyway 스키마 검증 | integration (기존 PlaceSchemaIntegrationSpec 확장) | DB 스키마·API 응답 | |
| T14 | analytics V007: 기존 행 보존 · `anonymous` 제외 · 한 사람이 여러 날 클릭해도 14일 `uniqMerge` 가 1 · 하루 한 행 불변식 · 14일 재집계 뒤 값 존재 | unit(집계 SQL) + 배포 뒤 행 수 대조 | 집계 표 값 | |
| T15 | clickBoost: 최소 표본 경계(4/5) · 상한 · 스위치 꺼짐이면 순위 불변 · 키워드 레그에만 붙음 · 「많이 클릭한 곳」 표시 경계 · 14일 창 KST 날짜 경계 | unit | 계산값·요청 JSON | ★ |
| T16 | **짝지은 nDCG**: 같은 스냅샷에서 스위치 on/off 를 질의별로 짝지어 비교. 판정: 평균 차 < 0 이거나 0.05 넘게 나빠진 질의가 3개 이상이면 켜지 않음. 판정 없는 문서 비율이 20% 를 넘으면 판정 보류. 회귀 주입(계수 과대)으로 게이트가 막는지 확인 | 평가 스크립트 확장(`live-eval.py`) | 평가 출력 | ★ |
| T17 | 화면: 속성 칩·건수 · 선택 칩 0 이어도 활성 · 미선택 0 흐림(자리 유지) · 필터 변경 시 누적 초기화 · 상세 배지·새 섹션 순서 · 주변 관광지 중복 제거 · 기존 섹션이 그대로 렌더 · 영문 문구 | vitest `PlacePage`·`AttractionPage` | 렌더 결과 | |
| T18 | 계약 게이트 · 샤드 게이트 · 레이어 게이트 · 파드 토폴로지 게이트 | build gate (`verifyArchitecture`) | 게이트 출력 | ★ |
| T19 | 운영: 프리렌더 밖 표본 id 에 Googlebot UA → **`X-Render: ssr`** + 제목·개요 · 없는 id 는 nginx 를 거쳐 404 · search 재기동 중 셸 200 폴백 · `rt.1989v.com/internal/render/attractions/{id}` 는 404 이고 클러스터 안에서 같은 경로는 200(짝) · `/regions/*` 는 계속 프리렌더 | e2e (배포 뒤 curl, 캐시 우회) | 운영 응답 | ★ |

테스트 데이터: 운영 문서에서 뽑은 원문 픽스처를 `search/domain` 테스트 리소스에 두고, 문서 픽스처 빌더를 렌더·파서·재색인 테스트가 함께 쓴다.
| T20 | 모바일 세로·가로 CDP 실측: 속성 칩 한 줄 가로 스크롤 · 칩 누를 때 위치 불변 | e2e (CDP) | 측정값·크롭 스크린샷 | |
| T21 | 매핑: 표시용 필드 `index:false`·색인 안 하는 객체 단언 · 재색인 전후 색인 크기 기록 | unit(매핑 JSON 단언) + 운영 `_cat/indices` | 매핑·색인 크기 | |
| T22 | 배포 뒤 패싯 건수 = 같은 필터로 OpenSearch 에 직접 낸 `_count` | e2e (읽기 전용 질의) | 두 값 대조 | ★ |
| T23 | 유사 목록 품질: 표본 50건 유형·분류 일치율 + 사람 검토 | 오프라인 측정 → `verifications/similar-quality.md` | 계산 결과 | |
