# Progress — place 서버 렌더 + 인리치먼트

- 작업 위치: 워크트리 `<scratchpad>/wt2` (detached, origin/main 기준). 공유 트리는 건드리지 않는다.
- 커밋: `git commit -- <경로>` 로 경로만. 푸시는 `gh auth switch --user 1989v` → push → `kwongd` 복귀를 한 명령 안에서.
- 현재: TG2 (재색인 확장)
- 완료: 스펙·ADR·tasks (75ee25fa) · TG1 파서·집계기 (테스트 23 · 회귀 주입 3)
- 다음: TG2 → 배포 ①
- TG1 인계: 파서 입력 `AttractionAttributeSource(restDate, parking, useFee, petAcmpyType, intro: Map)` — introRaw JSON 파싱은 batch. `RegionAggregator.aggregate(List<RegionProjection>)` → id 키 `RegionPlacement`. 「오늘 정기휴무 아님」 필터에는 closure 상태 keyword 가 필요.

## 실측 원문 (implementation/attr-raw-values.json, 국·영 각 2,000건 표본)
- petAcmpyType(ko): `전구역 동반가능` 404 · `일부구역 동반가능` 25 — 「불가」 표기 없음 → petPolicy 는 ALLOWED · PARTIAL · UNKNOWN.
- en: 반려동물·카드·유모차 원천 없음(UNKNOWN). 주차 93% · 휴무 59%.
- restDate distinct ko 276 · en 173, parking ko 88 · en 58, useFee ko 46 · en 38.

## 함정
- 시군구 축은 ldongRegnCd + ldongSignguCd (5자리).
- 새 문서 필드는 매핑·쓰기·읽기 셋 + 계약 게이트. 표시용 객체는 색인 안 함.
