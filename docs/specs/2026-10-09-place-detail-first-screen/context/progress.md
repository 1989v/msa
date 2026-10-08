# 진행 상태

- 현재 그룹: 3 (FE 규칙 원본과 골든)
- 완료: TG1 요금 규칙·파서 v3 + TG2 색인 필드·읽기 경로 — 한 커밋(TG1 단독은 :search:batch 컴파일 불가)
  - 메인 재실행 2026-10-09 01:09 KST: AttractionFeeTest 11/0, AttractionAttributeParserTest 17/0, PlaceApiClientTest 22/0, AttractionApiReindexTaskletTest 33/0, AttractionsIndexMappingTest 11/0, SearchAttractionServiceTest 47/0, AttractionSearchDocumentTest 6/0, AttractionReindexCaptureTest 15/0, verifySearchIndexContract 통과, portal-fe tsc exit 0
- 푸시 제약: 파서 v3 를 담은 푸시는 06:30 KST 재색인에서 파서 v2 반영 확인·deploy-check 기록 뒤에만
- 리뷰 판단 남음: source·copyrightDivCd 매핑을 index:false 로 둘지(지금은 keyword 색인됨)
