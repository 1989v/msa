<!-- source: search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt -->
# 검색 아키텍처 — 관광지 검색과 통합 검색

관광지 검색과 통합 검색의 구조·흐름·지금 쓰는 기법을 한 장에 모은다.

문서 갱신일(KST): 2026-10-08

## 1. 전체 구조

```mermaid
%% caption: 검색 요청이 브라우저에서 검색 서비스까지 가는 길
flowchart LR
  A[브라우저] -->|검색 요청| B[gateway]
  B -->|전달| C[search:app]
```
