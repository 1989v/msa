# Task Breakdown: place 관광지 서버 렌더 + 인리치먼트·속성 패싯

## Overview
Total Task Groups: 10

표준: 레이어 `docs/conventions/package-structure.md`(ADR-0083) · 테스트 `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK) ·
로깅 `docs/conventions/logging.md` · 외부 데이터 `docs/architecture/data-sources.md` §0 · FE `DESIGN.md` 토큰, `docs/standards/fe-visual-verification.md`.
★ 검사는 대상 코드를 되돌려 빨간불을 본 뒤에만 체크한다. 테스트 번호(T#)는 `planning/test-quality.md`.

### Task Group 1: 속성 파서 · 지역 집계기 (search:domain)
**Dependencies:** None
**Phase:** P1-enrichment
**Required Skills:** Kotlin, 순수 도메인
- [x] 1.0 Complete 파서·집계기
  - [x] 1.1 운영 원문 픽스처 추출(국·영, 속성별 대표 표기 · 조건부 휴무 · 원문 없음) → `search/domain/src/test/resources/attributes/`
  - [x] 1.2 Write tests: `AttractionAttributeParserTest`(T6 · 8개 안팎), `ClosedTodayTest`(T9 · KST 경계 2개), `RegionAggregatorTest`(T10 · 6개)
  - [x] 1.3 `AttractionAttributes`(정기휴무 · 주차 · `petPolicy` · 카드 · 유모차 대여 · 입장 무료, 각 `UNKNOWN` 명시) + `attributeParserVersion`
  - [x] 1.4 `petAcmpyType` 원문 값 전부 → `petPolicy` 대응 표(운영에서 distinct 추출해 표로 기록 `implementation/pet-policy-map.md`)
  - [x] 1.5 `RegionAggregator`: 5자리 시군구 축 · 언어별 · 유형 N · 유형·분류 M(M ≤ N) · 같은 유형·분류 가까운 곳 5(자기 제외)
  - [x] 1.6 Verify: `./gradlew :search:domain:test --tests '*AttractionAttributeParserTest' --tests '*ClosedTodayTest' --tests '*RegionAggregatorTest'`
**Acceptance Criteria:** 조건부 휴무·원문 없음이 `UNKNOWN` · 다른 시도 같은 3자리 코드가 섞이지 않음 · M ≤ N · 회귀 주입 빨간불 기록

### Task Group 2: 재색인 확장 (search:batch)
**Dependencies:** Task Group 1
**Phase:** P1-enrichment
**Required Skills:** Spring Batch, OpenSearch 매핑
- [ ] 2.0 Complete 재색인 확장
  - [ ] 2.1 Write tests: `AttractionApiReindexTaskletTest` 확장(T11 · bulk 캡처로 속성·지역 값, 파서 버전, 코드 없는 문서) · 매핑 단언(T21)
  - [ ] 2.2 1차 훑기(가벼운 투영) → 집계, 2차 훑기에서 색인 — 기존 합류(sidoNames · links · embeddings) 유지
  - [ ] 2.3 시군구 이름 조회(SIGUNGU 이름표, sidoNames 와 같은 방식)
  - [ ] 2.4 매핑: 필터 대상 keyword, 표시용 `index:false`/색인 안 하는 객체 · 쓰기·읽기 문서 클래스 · `searchIndexContracts`·`searchReadOmitted`
  - [ ] 2.5 Verify: `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' && ./gradlew verifyArchitecture`
  - [ ] 2.6 배포 뒤: 재색인 1회 · 색인 크기 전후 기록 · 표본 문서에 속성·지역 필드 존재 확인
**Acceptance Criteria:** 계약 게이트 통과 · bulk 문서에 새 값 · 재색인 1800초 안 · 색인 크기 기록

### Task Group 3: 서버 렌더 (search:app)
**Dependencies:** Task Group 2
**Phase:** P2-ssr
**Required Skills:** Spring MVC, HTML 렌더, 캐시
- [ ] 3.0 Complete 서버 렌더
  - [ ] 3.1 Write tests: `AttractionPageRendererTest`(T1) · `AttractionPageControllerTest`(T3) · `AttractionShellProviderTest`(T4) · `AttractionPageServiceTest`(T5) · `AttractionJsonLdParityTest`(T2)
  - [ ] 3.2 vitest 픽스처 생성기: `copy.mjs` 실제 함수로 `touristAttractionJsonLd`·breadcrumb 골든 JSON 생성(해석됨/UNKNOWN) → search 테스트 리소스, CI 에서 재생성 + `git diff --exit-code`
  - [ ] 3.3 UseCase 인터페이스 `RenderAttractionPageUseCase` + 포트(`AttractionPageRenderPort`, 셸 포트) + 어댑터 — 블로그 패턴 복사(셸 받기 시간 초과 1초 · 실패 백오프 30초 · 마지막 정상본 · 헬스 표시기)
  - [ ] 3.4 컨트롤러 `GET /internal/render/attractions/{id}` · `/internal/render/en/attractions/{id}`, id `\d{1,12}`, `X-Render: ssr`, `no-cache, must-revalidate`
  - [ ] 3.5 본문: 프리렌더 `renderAttractionDetail` 과 같은 구조 + 속성 배지 · 지역 안 위치 · 같은 분류 가까운 곳 · (있으면) 비슷한 곳 · 허브 링크. 이스케이프 순서, `<`, 치환 문자열 비해석
  - [ ] 3.6 Verify: `./gradlew :search:app:test --tests '*AttractionPage*' --tests '*AttractionShellProviderTest' --tests '*AttractionJsonLdParityTest' && ./gradlew verifyArchitecture`
**Acceptance Criteria:** T1~T5 초록 · 패리티 픽스처 CI 재생성 · 회귀 주입(이스케이프 제거 · data-seo-multi 제거) 빨간불

### Task Group 4: 배선 · 운영 전환 (portal-fe nginx · k8s)
**Dependencies:** Task Group 3 (search 이미지가 운영에 뜬 뒤)
**Phase:** P2-ssr
**Required Skills:** nginx, Kubernetes NetworkPolicy
- [ ] 4.0 Complete 배선
  - [ ] 4.1 nginx: 관광지 숫자 id location 분리 · `proxy_pass` 변수 upstream(요청 시 해석) · 연결 0.5초/읽기 3초 · Cookie/Authorization 제거 · 5xx/시간 초과만 셸로 · 404 통과 · 숫자 아닌 id 404 · 기존 주석 정정
  - [ ] 4.2 NetworkPolicy 두 파일(search←portal-fe, portal-fe←search), `kgd.io/host-of` 없음
  - [ ] 4.3 Verify(로컬): `kubectl kustomize k8s/overlays/oci-arm >/dev/null && ./gradlew verifyArchitecture` + nginx 설정 문법(`docker run --rm -v … nginx -t`)
  - [ ] 4.4 Verify(운영, T19): 프리렌더 밖 표본 id Googlebot UA → `X-Render: ssr` + 제목·개요 · 없는 id 404 · `rt.1989v.com/internal/render/...` 404 ↔ 클러스터 안 200 · search 재기동 중 셸 200 · `/regions/*` 프리렌더 유지
**Acceptance Criteria:** T19 전 항목 운영 증거

### Task Group 5: 속성 패싯 API (search:app)
**Dependencies:** Task Group 2
**Phase:** P3-facets
**Required Skills:** OpenSearch 질의·집계
- [ ] 5.0 Complete 패싯 API
  - [ ] 5.1 **먼저** 현재 커밋에서 기존 요청 JSON 스냅샷 저장(T8 기준)
  - [ ] 5.2 Write tests: `AttractionSearchAdapterFacetTest`(T8 · 6개)
  - [ ] 5.3 필터 파라미터(긍정 값만) · 본 질의 모든 레그에 필터 · 병렬 집계 요청(속성별 자기 제외 필터, 하이브리드면 질의어 제외) · 포트 반환형에 속성 패싯 건수 · 이름 `attributeFacets`
  - [ ] 5.4 Verify: `./gradlew :search:app:test --tests '*AttractionSearchAdapterFacetTest' --tests '*AttractionSearchAdapterTest'`
  - [ ] 5.5 배포 뒤 T22: API 건수 = 같은 필터 `_count`
**Acceptance Criteria:** 파라미터 없는 요청 바이트 동일 · T22 일치

### Task Group 6: 화면 (portal-fe)
**Dependencies:** Task Group 5
**Phase:** P3-facets
**Required Skills:** React, vitest, CDP
- [ ] 6.0 Complete 화면
  - [ ] 6.1 Write tests: `PlacePage` 속성 칩(T17) · `AttractionPage` 새 섹션·순서·중복 제거·영문 문구
  - [ ] 6.2 검색 화면 속성 칩 한 줄 가로 스크롤 · 건수 · 흐림(자리 유지) · 「정보가 있는 곳만 거릅니다」 · 필터 변경 시 누적 초기화
  - [ ] 6.3 상세: 방문 정보 배지 · 지역 안 위치 · 같은 분류 가까운 곳(`SAME_CATEGORY_NEARBY`) · 비슷한 곳(`SIMILAR_ELSEWHERE`) · 「많이 클릭한 곳」(표본 기준) · JSON-LD 속성 필드(`copy.mjs`, 서버와 같은 규칙)
  - [ ] 6.4 Verify: `cd portal-fe && npx vitest run src/pages/place src/seo && npx tsc --noEmit -p .`
  - [ ] 6.5 T20 모바일 세로·가로 CDP 실측(start·측정·stop 한 명령)
**Acceptance Criteria:** vitest 초록 · 칩 위치 불변 CDP 측정 · 크롭 스크린샷 확인

### Task Group 7: 비슷한 곳 (place V22 · tools/embed · 재색인)
**Dependencies:** Task Group 2
**Phase:** P4-similar
**Required Skills:** Flyway, Python, numpy
- [ ] 7.0 Complete 비슷한 곳
  - [ ] 7.1 Write tests: place 적재·조회 API + 스키마(T13) · tools/embed 유사 계산 pytest(T12) · 재색인 합류(비활성 제외 · model_ref 불일치 제외)
  - [ ] 7.2 place `V22__create_attraction_similar.sql` + `/internal/attractions/similar/bulk`·`/lookup`
  - [ ] 7.3 tools/embed: 같은 언어·다른 시도·같은 유형 상위 5 계산 · 적재 명령
  - [ ] 7.4 재색인 조회 합류
  - [ ] 7.5 Verify: `./gradlew :place:feature:test --tests '*AttractionSimilar*' --tests '*PlaceSchemaIntegrationSpec' && ./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' && (cd tools/embed && python -m pytest -q tests -k similar)`
  - [ ] 7.6 배포 뒤: 적재 → 재색인 → T23 품질 표본 50건 기록
**Acceptance Criteria:** 문서에 유사 목록 · 품질 기록

### Task Group 8: 클릭 신호 (analytics V007 · 재색인 · 순위)
**Dependencies:** Task Group 2
**Phase:** P5-clicks
**Required Skills:** ClickHouse, Spring Batch, 평가
- [ ] 8.0 Complete 클릭 신호
  - [ ] 8.1 Write tests: 집계 SQL(T14) · clickBoost(T15) · 재색인 ClickHouse 합류 실패 시 진행
  - [ ] 8.2 analytics `V007` — 고유 클릭 방문자 상태 컬럼(`uniqState`, `anonymous` 제외), `ADD COLUMN IF NOT EXISTS`, 하루 한 행 불변식 주석 · 집계기 수정
  - [ ] 8.3 search-batch ClickHouse 접속 설정(properties + CronJob env·Secret) · 14일 `uniqMerge` 조회 · `uniqueClickers14d`·`clickBoost` · 적재 수 로그
  - [ ] 8.4 키워드 레그 점수 함수에 `clickBoost` (스위치 기본 꺼짐) · `AttractionDocument` 주석 정정
  - [ ] 8.5 평가 스크립트: 스위치 on/off 짝 비교 · 판정 수치(T16) · 회귀 주입
  - [ ] 8.6 Verify: `./gradlew :analytics:app:test --tests '*AttractionPopularity*' && ./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' && ./gradlew :search:app:test --tests '*ClickBoost*'`
  - [ ] 8.7 배포 뒤: 14일 재집계 → 재색인 → 적재 수 로그 확인 → T16 실행 결과 기록(켤지 판단은 결과로)
**Acceptance Criteria:** 기존 행 보존 · 적재 수 > 0 · T16 기록

### Task Group 9: 프리렌더 제거
**Dependencies:** Task Group 4 (운영 확인 완료)
**Phase:** P6-cleanup
**Required Skills:** Node 스크립트, nginx
- [ ] 9.0 Complete 제거
  - [ ] 9.1 `prerender-seo.mjs` 관광지 상세 프리렌더·`PLACE_DETAIL_CAP` 제거, 지역 유지 · 관련 vitest 정리
  - [ ] 9.2 Verify: `cd portal-fe && npx vitest run src/seo && node scripts/prerender-seo.mjs --dry-run 2>/dev/null | tail -3`
  - [ ] 9.3 배포 뒤: 이미지 크기 전후 · 관광지 상세 여전히 `X-Render: ssr` · `/regions/*` 프리렌더 유지
**Acceptance Criteria:** 이미지 감소 기록 · T19 재통과

### Task Group 10: 문서 · 사전
**Dependencies:** Task Group 4, 8
**Phase:** P6-cleanup
**Required Skills:** 문서
- [ ] 10.0 Complete 문서
  - [ ] 10.1 ADR-0103 상태 → 채택 · ADR-0062 상태 줄(§8 대체) · ADR-0072 §6 · ADR-0095 §6 소비자 · 네트워크 정책 09 주석 · `package-structure.md` · `search/CLAUDE.md` · `place/CLAUDE.md`(syncFrom 보존 설명 정정)
  - [ ] 10.2 `/hns:glossary` 로 속성 패싯 · `petPolicy` · `clickBoost` · 서버 렌더 등재
  - [ ] 10.3 Verify: `./gradlew verifyArchitecture && python3 scripts/doc_scan.py 2>/dev/null | tail -3`
**Acceptance Criteria:** 문서 게이트 통과

## Execution Order
1. TG1 → TG2 (배포 ①)
2. TG3 → TG4 (배포 ② — AdSense 에 가장 급한 것)
3. TG5 → TG6 (배포 ③)
4. TG7 (배포 ④) · TG8 (배포 ⑤) — 서로 독립
5. TG9 (배포 ⑥) → TG10
