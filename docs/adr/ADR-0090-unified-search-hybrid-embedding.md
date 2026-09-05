# ADR-0090 통합 검색 하이브리드 — 임베딩은 서버 밖에서, 질의는 사전으로

## Status
Proposed (2026-09-05) — P0 실측(모델·차원 bake-off, k-NN 메모리, hybrid 스파이크) 뒤 Accepted 로 승격

**Related**: ADR-0051 트랙 C(벡터는 별도 ADR — 이 문서가 그것) · ADR-0055(OpenSearch 3.3.0, raw 클라이언트) · ADR-0065 §7·OQ-5(임베딩은
ETL 타임, 쿼리 인코더는 마진 재계산 후 — 여기서 "하지 않는다"로 닫는다) · ADR-0058(새 상주 파드는 사유를 적는다 — 여기서는 파드 0) ·
ADR-0025(검색 P99 300ms) · ADR-0083(레이어 표준) · ADR-0089(비밀 게임은 색인 밖)

## Context

### 무엇을 못 찾나 — 2026-09-05 운영 `/api/search/attractions` 상위 3 실측

| 질의 | BM25 상위 3 | 무엇이 맞았나 |
|---|---|---|
| `바다가 보이는 곳` | 연화도선착장 · 마라도가는여객선 · 폭포가있는캠핑장 | 뜻이 아니라 조사·어절 조각 |
| `아이와 갈만한 곳` | 와글아이 · 아이와즈 · 유앤아이센터 | 상호 속 `아이` |
| `비 오는 날 갈만한 곳` | 비응항 · 파크하비오 워터킹덤 · 생각하는 정원 | `비` 한 글자 |
| `야경 명소` | 달빛야경누리길 · **가야경** 오토캠핑장 · 횟집**명소**거리 | 부분 문자열 |
| `kids friendly place` (en) | Waple Wood Artwork **Place** · Twelve Scenic **Places** · Santokki Park | `place` |
| `궁궐` | 창경궁 · 경복궁 · 덕수궁 | **수기 유사어 한 줄** 덕(없으면 0건, 핸드오프 §4) |

관광지 6만 건 코퍼스에서 BM25 + nori 는 이름을 아는 질의는 잘 찾고 **의도를 말하는 질의**는 못 찾는다. 유사어 사전은 사람이 한 줄씩
넣어야 하고, 지금 10줄이다. 벡터 레그는 `바다가 보이는 곳`→해수욕장, `조용한 사찰`→불국사 같은 질의를 사전 없이 잡는다(로컬 정성
실측, 플랜 §8.1). 다만 벡터도 분류 편향(`한옥`→식당)은 못 고친다 — 분류 가중치는 남는다.

### 제약

- **노드**: OCI Ampere A1 4코어, CPU 사용 84%(2026-09-05 `kubectl top node`), GPU 없음, 무료 티어. 남는 CPU 로 실시간 임베딩 추론을 하면
  모델이 300M 급으로 묶인다(arm64 1코어 실측: e5-small 118M 질의 2.4ms·문서 52건/s, e5-base 278M 6.9ms·18건/s; 4B 는 파라미터 비례로 질의 200ms 대,
  P99 300ms 예산 소진).
- **플러그인은 이미 있다**: 운영 OpenSearch 3.3.0 풀 배포판에 `opensearch-knn`·`neural-search`·`ml` 이 설치돼 있다. ml-commons 로 모델을 안에서
  돌리는 길은 런타임 다운로드(default-deny egress)·검색 엔진 파드와의 결합 때문에 쓰지 않는다.
- **질의 로그가 없다**: query-insights `top_queries-*` 는 지연 상위만 남겨 키워드 질의가 0건이고, 관광지 검색은 impression/click 을 발행하지 않는다.
- **코퍼스의 99% 가 관광지**다. 통합 검색 품질은 관광지 검색 품질이다.
- 개념 검색(`/tech`, `GET /api/v1/search`)은 운영에서 500 이다(개념 인덱스 부재) — 통합 검색이 이 자리를 대신할 수 있다.

## Decision

**D1. 임베딩 계산은 서버 밖에서 한다.** 문서 벡터는 로컬 PC(M4 Pro) 또는 Colab GPU 가 계산하고, 서버에는 임베딩 모델·추론 파드가
없다(파드 +0). 계산 위치를 옮기면 모델 크기 제약이 사라져 4B·8B 급도 후보가 된다.

**D2. 문서 벡터의 원본은 SSOT 서비스의 DB 표다.** place `attraction_embedding`(P1), code-dictionary 호스트 `content_embedding`(P2).
OpenSearch 인덱스는 매일 재구축되므로 재색인이 `lookup` 으로 채우는 사본이다. 행마다 `model_ref = hf_id@rev7#d{dim}` 스탬프를 박아 벡터
공간이 섞이지 않게 하고, 모델에 넣은 `embedding_text` 원문을 보존하며, 멱등은 텍스트 해시 비교로 한다. 상세는
`docs/specs/2026-09-05-unified-search/embedding-entities.md`.

**D3. 질의 벡터는 사전에서 꺼낸다.** search 소유 OpenSearch 인덱스 `query_vectors`(`_id = model_ref|정규화 질의`, `vector` 는 `index:false` —
**검색 대상이 아니다**)에 의도 문구·자동완성 어휘·실제 질의 로그를 미리 벡터화해 둔다. 런타임은 정규화 후 GET by id. 미적중은 BM25 로
답하고 Redis ZSET 에 미스를 기록해 다음 배치가 채운다. 정규화 함수는 서버 한 곳(`QueryNormalizer`)이고 도구는 원문만 보낸다.

**D4. 검색 질의.** 키워드가 있고 관련도 정렬이고 사전에 적중했을 때만 `hybrid[ function_score(BM25), knn ]` + RRF 파이프라인. 분류 가중치는
두 레그에 같이 건다. 자동완성은 벡터를 쓰지 않는다. 인덱스 문서의 `embeddingModel` 과 설정의 `model-ref` 가 다르면 벡터 레그를 끈다.
`_source` 에서 `embedding` 은 뺀다.

**D5. 모델·차원은 P0 bake-off 로 정한다.** 서버 비용이 0 이라 기준은 판정 세트 nDCG@10 · 차원(k-NN 메모리) · 라이선스다. 후보:
Qwen3-Embedding-8B(8bit) · 4B · snowflake-arctic-embed-l-v2.0-ko · harrier-oss-v1-0.6b · embeddinggemma-300m. 제외: jina v5(CC BY-NC) ·
KURE-v2(다중 벡터) · multilingual-e5-small(같은 차원의 granite-97m-r2 가 10점 위). MRL 지원 모델은 512 로 잘라 1024 와 비교한다.

**D6. 통합 인덱스 `unified`.** 문서 계약 하나에 `type` 필드(attraction · region · product · concept · blog_post · game · deal_offer · service).
URL 은 굽지 않고 FE 가 `serviceHref.ts` 로 조립한다. 이력서(ADR-0064)와 비밀 게임(ADR-0089)은 넣지 않는다. 원천은 공개 API 풀스캔.

**D7. 건강 지표는 사전 적중률이다.** `search.qvec.hit/(hit+miss)` 를 첫날부터 일별로 찍고 첫 달 80% 를 기대치로 둔다. 크게 못 미치면
실시간 인코딩 사이드카(300M 급)를 **미적중 전용 폴백**으로 되살리는 안을 검토한다 — 단 벡터 공간이 같아야 하므로 문서 벡터도 그 모델이어야
하고, 그래서 D5 에서 "작아도 되는가"를 같이 본다.

## Alternatives Considered

| 옵션 | 판정 |
|---|---|
| OpenSearch 안에서(ml-commons 로컬 모델 + neural-search) | ✗ 모델·네이티브를 런타임에 내려받고(default-deny egress) 검색 엔진 파드에 모델이 묶인다. 결국 CPU 추론 |
| Python 사이드카 실시간 인코딩(플랜 v1) | ✗ 파드 +1 은 감당되지만 CPU 추론이 모델을 300M 급으로 묶는다. 4B 급은 4 vCPU 전용 노드에서도 질의 1건 200~300ms 대 |
| JVM 내장 ONNX | ✗ 두 JVM 에 모델, 질의 스레드와 CPU 경쟁. 크기 제약은 위와 같다 |
| **서버 밖 임베딩 + 질의 사전** | ✓ 파드 +0, 크기 제약 0. 대가는 적중률·하루 지연·로컬 배치 의존 |
| 정적 임베딩(Model2Vec 류)을 JVM 에 | △ 서버에서 µs 이지만 품질 한 단 아래, 큰 모델과 공간이 달라 폴백으로 못 섞는다. P0 기준선으로만 |
| 브라우저에서 질의 인코딩 | ✗ 방문자마다 100MB+ 다운로드. 모바일 1순위 사이트에 맞지 않는다 |
| 문서는 큰 모델, 질의는 작은 모델 | ✗ 벡터 공간이 다르다. 같은 모델이어야 한다 |

## Consequences

### Positive
- 무료 티어 예산을 파드 하나도 쓰지 않고 벡터 레그를 얹는다. 남는 서버 비용은 k-NN 메모리(6만 문서 + 사전 ~8만 × 차원 × 4B)와 수 ms 의 knn 질의다.
- 모델을 GPU 급으로 고를 수 있다. 모델 교체는 오프라인 재임베딩(분 단위) + alias swap.
- 문서 벡터만으로 "비슷한 관광지"·"관련 글"이 즉시 열린다(질의 인코딩 불필요).
- 벡터 원본이 DB 에 있어 OpenSearch 재구축·PVC 유실에 강하다. `embedding_text` 가 남아 디버깅과 규칙 변경 diff 가 가능하다.

### Negative / Risk
- **적중률이 곧 품질이다.** 사전이 못 덮은 질의는 오늘과 같다. 첫 주 지표로 판정하고 시드 3층(의도 문구·어휘·로그)으로 키운다.
- 새 문서·새 질의는 다음날 반영. 로컬 배치가 멈추면 조용히 멈춘다 → 어드민에 마지막 채움 시각·stale·미스 적체를 띄운다.
- OpenSearch 메모리·PVC 상승 → P0 실측 뒤 한도 2.5Gi·PVC 5Gi 판단. 차원 512 로 반감 가능.
- 판정 세트가 사람 30질의라 편향 → P2 의 노출·클릭 로깅과 미스 로그가 실제 분포를 준다.
- hybrid 하위 `function_score(knn)`·`sort` 타이브레이커가 3.3.0 에서 안 먹을 수 있다 → P0 스파이크, 대안은 앱 후처리.

### Migration
P0 측정·결정 → P1 관광지 하이브리드(플래그 기본 off, place 표·내부 API·`tools/embed`·사전·hybrid 분기) → P2 `unified` 인덱스·API·`/search` 화면·
`/tech` 대체·비슷한 관광지 → P3 평가 확장·배치 자동화·모델 승격. 단계별 태스크·게이트는 플랜 §3·§4. 롤백은 플래그 off(표·인덱스는 남아도 무해).

## References
- 플랜: `docs/plans/2026-09-05-unified-search-hybrid-embedding.md` (v2)
- 엔티티 설계: `docs/specs/2026-09-05-unified-search/embedding-entities.md`
- 판정 세트·의도 시드: `docs/specs/2026-09-05-unified-search/{judgments.yml,intents.yml}`
- 도구·노트북: `tools/embed/` (`notebooks/bakeoff.ipynb`, `probes/`)
- 선행 실측: `docs/plans/2026-08-19-k-tour-search-handoff.md` §4·§5, ADR-0050 §Alternatives "Vector 우선"
- 이론: `study/docs/19-search-engine/{08-vector-search-hnsw,09-hybrid-search-rrf,29-os-search-pipeline-neural}.md`
