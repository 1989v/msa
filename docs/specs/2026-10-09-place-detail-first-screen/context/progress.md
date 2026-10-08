# 진행 상태

- 현재 그룹: 6 (회귀 주입·문서·배포·운영 확인)
- 완료: TG5 FE 상세 화면 — 메인 재실행 04:51 KST: vitest src/pages/place src/seo 27 files / 437 passed. tsc 오류 2건은 같은 트리의 G1 TG2 작업 중 파일(selectPlaceLandings.test.ts)이라 D 와 무관
- 사용자 확인: FE 브레드크럼에 시도·시군구 링크 추가, 좁은 화면 사진이 개요 아래로, 60–64rem 세로 쌓기, 전화 링크 계측 없음
- 완료: TG3 FE 규칙 원본·골든 + TG4 SSR 렌더 한 커밋(TG3 단독은 JsonLdParity 빨강) — 메인 재실행 04:43 KST: AttractionSeoTextTest 14/0, AttractionPageRendererTest 99/0, AttractionJsonLdParityTest 40/0, VisitSummaryParityTest 37/0, PhoneParityTest 12/0, FooterLinksParityTest 2/0, SecureImageParityTest 10/0, vitest src/seo src/pages/place 25 files / 411 passed, tsc exit 0
- 스펙과 다르게 한 것(사용자 확인 목록): 전화 패턴 (?:\+82[- ]?0?|0)…(스펙 패턴은 +82-2-… 기대값을 못 냄), 이웃 제목·img alt 는 sourceText 대신 escapeHtml(h1 과 같은 표시명), 확인 상태 문구·공공누리 URL 은 구현자가 정함
- 완료: TG1 요금 규칙·파서 v3 + TG2 색인 필드·읽기 경로 — 한 커밋(TG1 단독은 :search:batch 컴파일 불가)
  - 메인 재실행 2026-10-09 01:09 KST: AttractionFeeTest 11/0, AttractionAttributeParserTest 17/0, PlaceApiClientTest 22/0, AttractionApiReindexTaskletTest 33/0, AttractionsIndexMappingTest 11/0, SearchAttractionServiceTest 47/0, AttractionSearchDocumentTest 6/0, AttractionReindexCaptureTest 15/0, verifySearchIndexContract 통과, portal-fe tsc exit 0
- 푸시 제약: 파서 v3 를 담은 푸시는 06:30 KST 재색인에서 파서 v2 반영 확인·deploy-check 기록 뒤에만
- 리뷰 판단 남음: source·copyrightDivCd 매핑을 index:false 로 둘지(지금은 keyword 색인됨)
