# 진행 상태

- 현재 그룹: 5 (RSS)
- 완료: TG4 hreflang 표시 + TG3 의 3.8 — 메인 재실행 04:58 KST: vitest 4 files / 115 passed, tsc exit 0, AttractionHreflangParityTest 3/0, AttractionPageRendererTest 104/0. 렌더 골든 12장 불변(스위치 꺼짐). Kotlin 쪽 빨강은 TG8 회귀 주입에서 확인
- TG5 메모: prerender indexDoc 에 contentUpdatedAt 투영 한 줄 필요
- 완료: TG3 백엔드 — 메인 재실행: AlternateLanguagePairerTest 16/0(오라클 30쌍 일치·오연결 0), ContentTypeLangTest 2/0, SamePlaceGrouperTest 4/0, RegionAggregatorTest 10/0, PlaceApiClientTest 24/0, AttractionApiReindexTaskletTest 39/0, AttractionsIndexMappingTest 12/0, AttractionSearchDocumentTest 7/0, SearchAttractionServiceTest 50/0, AttractionReindexCaptureTest 16/0, verifySearchIndexContract 통과
- 완료: TG2 내부 조회 — 메인 재실행: AttractionContentUpdatedServiceTest 5/0, AttractionContentUpdatedInternalControllerTest 5/0, AttractionRepositoryAdapterTest 5/0, PlaceSchemaIntegrationSpec 15/0(skipped 0), verifyLayerDependencies 통과
- TG7 메모: place/CLAUDE.md 내부 API 표에 GET /internal/attractions/content-updated 한 줄. KDoc 안 `/internal/attractions/**` 는 중첩 주석으로 읽혀 컴파일이 깨진다
- 완료: TG1 본문 변경 시각 — 메인 재실행 2026-10-09 01:12 KST: AttractionContentHashTest 9/0, AttractionSyncFromTest 18/0, AttractionTest 10/0, AttractionOverviewProbeTest 5/0, AttractionTitleTest 3/0, AttractionJpaEntityTest 2/0, AttractionRepositoryAdapterTest 4/0, AttractionDtoRoundTripTest 2/0, PlaceSchemaIntegrationSpec 14/0(skipped 0, V34 적용)
- V34: origin/main(37b7b9099) 에 없음. 푸시 직전 fetch 후 재확인
- TG7 메모: place/CLAUDE.md bulk 절에 서버 계산값 두 열 한 줄
