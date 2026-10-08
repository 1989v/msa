# 검색 아키텍처 (포인터)

- 원본은 `portal-fe/src/content/search-architecture.md` 하나다. 구조·흐름 그림과 지금 쓰는 기법 표가 여기에만 있고, 이 파일은 위치만 가리킨다.
- 공개 URL 은 https://1989v.com/tech/search 다. 빌드 때 그림이 SVG 로 렌더되어 페이지와 프리렌더에 같이 실린다.
- 검색 ADR·`search/`·`k8s/base/search*/`·`scripts/search-eval/` 를 바꾸면 원본 문서를 같은 커밋에서 고친다. 드리프트 테스트(`portal-fe/src/content/__tests__/searchArchitecture.drift.test.ts`)는 9값(사용자 사전 줄 수 · 동의어 줄 수 · 하이브리드 켜짐 · 융합 방식 · RRF rank_constant · 모델 ref · 차원/m/ef_construction · 관광/상업 가중치 · clickBoost 켜짐)과 근거 파일 존재만 잡고, 그림과 나머지 행은 사람이 고친다.
