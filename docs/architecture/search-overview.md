# 검색 아키텍처 (포인터)

- 원본은 개념 온톨로지 `code-dictionary/feature/src/main/resources/ontology/search.yaml` 다. 검색 파이프라인의 단계 · 흐름(`flows_to`)과 이 서비스의 적용 상태(`applied`)가 거기 있고, 이 파일은 위치만 가리킨다(ADR-0108).
- 공개 URL 은 https://1989v.com/tech/search 다. `DrillExportSpec` 이 온톨로지에서 `portal-fe/src/content/drill/search.json` 을 내보내고, 페이지와 프리렌더가 그것을 그린다.
- 검색 ADR·`search/`·`k8s/base/search*/`·`scripts/search-eval/` 를 바꾸면 온톨로지의 해당 개념 `applied` 를 같은 커밋에서 고치고 다시 내보낸다. 드리프트 테스트(`portal-fe/src/content/__tests__/searchArchitecture.drift.test.ts`)는 `facts[].key` 12값(사용자 사전 줄 수 · 동의어 줄 수 · 하이브리드 켜짐 · 융합 방식 · RRF rank_constant · 모델 ref · 차원/m/ef_construction · 관광/상업 가중치 · 클릭 부스트 켜짐)을 코드와 대조하고, 내보내기는 그려지는 개념의 적용 상태 · 코드 심볼 존재를 잡는다. 서술(`summary`)은 사람이 고친다.
