# progress — 통합 검색 (갱신 2026-09-06)

> 이 스펙의 진행 상태. **경위·산출물 위치·막힌 것은 이어받기 문서가 원본**이다 →
> `docs/plans/2026-09-06-unified-search-handoff.md`. 여기서 중복하지 않는다.

## 현재 위치

**P0 완료 · P1-1(place 벡터 표·내부 API) 완료 → P1-2(도구 나머지) 다음.**

## 완료

- ADR-0090 **Accepted**(2026-09-06). 결정: 임베딩은 서버 밖, 질의는 사전, 파드 +0
- 판정 세트 872건 전부(사람 113 + LLM 초안 759, `by:` 로 출처 기록)
- 모델 5종 비교 → **`snowflake-arctic-embed-l-v2.0-ko` 확정**(ko nDCG@10 0.7404 · en 0.7773)
- k-NN 메모리·hybrid 질의 로컬 실측(플랜 §8.4·§8.5)
- **P1-1**: place `attraction_embedding` 표(V12) + 도메인·포트·서비스·어댑터 + `/internal/attractions/embeddings/*`
- 도구 `tools/embed`: 임베딩 텍스트 규칙·모델 스펙·풀링·재순위·판정 시트/페이지·nDCG 평가
- **P1-2**: 도구 나머지 — `vectors`(코덱) · `client`(내부 API) · `docs`(하루 루틴) · `queries`(사전) · `push`(첫 채움) · `tunnel.sh`.
  pytest 57 통과. 코덱·해시 기준값은 **JVM 이 만든 것**이고, 회귀 4종(엔디안·touch 판정·4xx 재시도·정규화 검사)을
  임시 사본에 주입해 각 테스트가 실제로 무는 것을 확인했다
- **P1-3**: `attractions-index.json` 에 `knn: true` + `embedding`(knn_vector d1024·cosinesimil·lucene hnsw)·`embeddingModel`·`embeddingHash`,
  쓰기 클래스 3필드, `searchReadOmitted` 3줄, `PlaceApiClient.lookupEmbeddings` + `decodeVector`,
  재색인 tasklet 이 페이지마다 벡터를 받아 싣고 적재율을 로그로 남긴다. `search.embedding.model-ref` 가 비면 벡터 없이 색인.
  search:batch 테스트 21 통과 · `verifySearchIndexContract` 통과. 게이트·검사 회귀 4종 확인

## 다음 단계

1. ~~ADR Accepted~~ ✅ · ~~P1-1 place~~ ✅ (V12 · 테스트 22 · 게이트 통과, 2026-09-06)
2. ~~P1-2 도구~~ ✅ · ~~P1-3 재색인~~ ✅ (2026-09-06) · **P1-4 부터** — 질의 사전 API · hybrid 분기 · 첫 채움
4. P1 중에 **차원 512 vs 1024** nDCG 차이 측정(§8.11 이 남긴 유일한 미결)

## 블로커

- **푸시**: `gh` 활성 계정이 회사 것이라 pre-push 훅이 막는다. 미푸시 커밋이 쌓여 있다(수는 `git log --oneline origin/main..HEAD` 로 확인).
  사용자가 `gh auth switch --user 1989v` 를 해야 한다 — 전역 switch 를 에이전트가 하지 않는다(회사 세션 오염)

## 결정된 것 (사용자)

- 이미지 임베딩은 하지 않는다
- 검토 대상 79건은 LLM 초안 그대로 유지(2026-09-06)
