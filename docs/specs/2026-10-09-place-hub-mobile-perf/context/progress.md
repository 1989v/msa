# 진행 상태

- 현재 그룹: 5 (회귀 주입·배포·전후 비교)
- 완료: TG3 성능 소작업 — 메인 재실행 04:24 KST: vitest src/pages/place src/seo 22 files / 353 passed, tsc exit 0, AttractionPageRendererTest 73/0. 골든 10개 diff 는 <main> 래퍼로만 설명됨. CLS 추가 대책 없음(0.047 은 TG2 의 필터 한 줄로 사라졌을 것으로 추정, 배포 후 측정으로 판정)
- 완료: TG2 모바일 두 변형 + 필터 압축 — 메인 재실행: vitest src/pages/place 11 files / 235 passed, tsc exit 0. 폴드·지도 높이는 TG5 CDP 에서 판정
- 완료: TG1 사진 주소 https — 메인 재실행 2026-10-09 00:45 KST
  - vitest 33 files / 389 passed, tsc exit 0
  - AttractionSeoTextTest 6/0, AttractionPageRendererTest 70/0, AttractionJsonLdParityTest 31/0, SecureImageParityTest 10/0
- TG4.1 Lighthouse before 15회 완료 → `docs/research/2026-10-07-tourism-growth/evidence/stage2/lh/before/`
- 남은 열린 질문(구현자): AttractionLinks 외부 링크 썸네일은 적용 목록 밖, FavoritesPage·ServiceShowcase 렌더 단언 없음
