# 통합 검색 + 임베딩 하이브리드 — 작업 플랜

- 작성: 2026-09-05 (v1 오전 · **v2 오후** — 사이드카를 버리고 **서버 상주 모델 0** 으로 다시 씀)
- 결정 문서: `docs/adr/ADR-0090-unified-search-hybrid-embedding.md` — **P0 에서 작성한다. §2 가 그 초안이다.**
- 선행 결정: ADR-0051 트랙 C(벡터는 별도 ADR) · ADR-0055(OpenSearch 3.3.0, raw 클라이언트) · ADR-0065 §7(임베딩은
  로컬 모델·ETL 타임으로 확정, 쿼리 인코더는 free-tier 마진 재계산 후 — OQ-5) · ADR-0058(배치는 CronJob, 새 상주 파드는
  사유를 적는다) · ADR-0025(검색 P99 300ms)
- 실측 시점: 2026-09-05 — 노드·인덱스·플러그인·API 응답은 **운영 클러스터**, 모델 벤치는 **로컬 arm64 Docker 1코어**(§8)

**한 줄**: 서비스 전체를 한 검색창에서 찾게 한다. OpenSearch 의 BM25 위에 벡터 레그를 `hybrid` 질의로 얹되, **임베딩 계산은
전부 서버 밖(로컬 PC · Colab GPU)에서 한다.** 문서 벡터는 DB 에 업서트하고, 질의 벡터는 미리 벡터화한 **질의 사전**에서 꺼내며,
사전에 없는 질의는 BM25 로 답하고 로그로 남겨 다음 배치가 채운다. 서버에는 모델이 상주하지 않는다. 먼저 관광지에서 효과를
재고(P1), 그 다음 통합 인덱스와 화면을 올린다(P2).

> **v1 → v2 에서 바뀐 것**: v1 은 Python 사이드카(`search-embed`)가 질의를 실시간 인코딩하는 구조였고 그래서 모델이 300M 급으로
> 묶였다. v2 는 질의 벡터도 사전으로 대므로 파드가 0 개 늘고 **모델 크기 제약이 사라진다**(Qwen3-4B·8B 도 후보). 대신 제약이
> **미등록 질의 적중률**로 옮겨간다. 판단 근거는 §2.2.

---

## 0. 결론 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| 임베딩 계산 위치 | **서버 밖** — 로컬 M4 Pro(MPS) 또는 Colab T4. 서버에 모델·추론 파드 없음 | §2.2 — 노드는 CPU 84% 로 추론 여력이 없고, 회사 밖 무료 티어엔 GPU 도 API 탈출구도 없다 |
| 문서 벡터 저장 | **SSOT 서비스의 DB 표**(place `attraction_embedding`, P2 는 code-dictionary 호스트 `content_embedding`). OpenSearch 는 재색인 때 그 표를 읽어 채우는 읽기 모델 | §2.4 — "OpenSearch 직접 쓰기 금지" 원칙 유지. 이어받기 트릭 불필요 |
| 질의 벡터 | **질의 사전** — 의도 문구 수기 + 자동완성 어휘(지역·분류·유사어) + 실제 질의 로그를 미리 벡터화. 런타임은 정규화 후 조회. 미적중 → BM25 + 미스 로그 | §2.5 |
| 모델 | **P0 Colab bake-off 로 결정** — 후보 Qwen3-Embedding-8B(8bit)·4B·arctic-embed-l-v2.0-ko·harrier-oss-v1-0.6b·embeddinggemma-300m. 차원은 MRL 로 512 또는 1024 로 자른다 | §2.3 — 서버 비용이 0 이라 크기가 아니라 **판정 세트 nDCG 와 k-NN 메모리**로 고른다 |
| 벡터 검색 | OpenSearch `knn_vector`(lucene HNSW) + `hybrid` 질의 + RRF 파이프라인. 플러그인은 이미 설치돼 있다 | §1.1 · §2.5 |
| 통합 인덱스 | 별도 `unified` 인덱스, 문서 계약 1개 + `type` 필드 | §2.4 |
| 순서 | P0 측정·ADR → P1 관광지 하이브리드(플래그 기본 off) → P2 통합 인덱스·API·`/search` 화면 → P3 평가·자동화·승격 | §3 |
| 무료 티어 | **파드 +0.** 남는 비용은 OpenSearch 의 벡터 메모리와 PVC 만 | §2.6 |

---

## 1. 지금 어떤 상태인가 (2026-09-05 실측)

### 1.1 검색 자산

- `search` 서비스: `:app`(8083) · `:consumer`(벌크 색인 워커) · `:batch`(CronJob 4종: `search-reindex` · `attraction-reindex` ·
  `region-reindex` · `search-eval-daily`) · `:domain`. 클라이언트는 `opensearch-java 3.8.0` — jar 안에 `HybridQuery` ·
  `KnnQuery` 빌더가 있다(확인).
- OpenSearch **3.3.0 단일 노드**(Lucene 10.3.1, heap 512m, 컨테이너 요청 1Gi / 한도 1536Mi, PVC 3Gi).
  `_cat/plugins` 실측: `opensearch-knn` · `opensearch-neural-search` · `opensearch-ml` · `opensearch-ltr` ·
  `opensearch-search-relevance` · `query-insights` 가 **전부 들어 있다**. 플러그인 설치 작업은 없다.
  단 `plugins.ml_commons.only_run_on_ml_node=true`, `allow_registering_model_via_url=false`(기본값), 등록 모델 0건.
- 인덱스(`_cat/aliases` · `_cat/indices`):

| alias | 문서 수 | 크기 | 비고 |
|---|---|---|---|
| `attractions` | 59,735 | 60MB | 매일 KST 04:30 전체 재색인(alias swap, 세대 2 보관). nori + 수기 유사어 10줄 + 자모 + 분류 가중치 |
| `regions` | 572 | 59KB | 자동완성 상단 3슬롯 |
| `products` | 24 | 23KB | 학습용 샘플 |
| `poi` | 0 | — | place 동기 색인, 비어 있음 |
| (개념) | **없음** | — | code-dictionary 의 개념 인덱스가 운영에 없다. `GET /api/v1/search?q=kafka` 가 **500 INTERNAL_ERROR** (§1.2) |

### 1.2 도메인별 "검색" 현황

| 타입 | SSOT / 규모 (운영 DB `information_schema`) | 지금 찾는 방법 | 화면 |
|---|---|---|---|
| 관광지 `attraction` | place `attractions` 60,573행 (ko 45k · en 15k), 개요 보유 ~3.7k | search `/api/search/attractions` — BM25 + 지리 + 자동완성 | place.1989v.com |
| 지역 `region` | place `regions` 572 | 자동완성 상단 슬롯 | place |
| 상품 `product` | product `products` 24 | search `/api/search` — function_score + MAB + A/B | `/shop` |
| 개념 `concept` | code-dictionary `concept` 162 (유사어 195) | `/api/v1/search` → OpenSearch — **운영에서 500** | `/tech` |
| 블로그 글 `blog_post` | `blog_post` 6 | 없음 (카테고리·저자 목록만) | blog.1989v.com |
| 게임 `game` | `game` 73 (PUBLISHED 만 카탈로그) | 없음 (태그·장르·정렬만). 비밀 게임은 카탈로그 밖 (ADR-0089) | game.1989v.com |
| 혜택 `deal_offer` | `deal_offer` 9 | `/api/v1/deal/search` DB 질의 | deal.1989v.com |
| 서비스 `service` | `display_service` 8 | 없음 | apex 런처 |
| 주유소 (ranking) | 스냅샷 원장 | 없음 | rank.1989v.com — P3 후보 |
| 이력서 | DB | **색인 금지** (ADR-0064) | — |

읽히는 것: **코퍼스의 99% 가 관광지**다. 통합 검색의 품질은 곧 관광지 검색의 품질이고, 나머지 타입은 규모가 작아
정확 매칭이 대부분이다. 관광지에서 벡터 레그가 효과를 못 내면 통합 인덱스에 얹어도 의미가 없다 — P1 을 관광지에서
먼저 재는 이유다.

### 1.3 측정된 품질 문제와 지금까지의 대응 (`docs/plans/2026-08-19-k-tour-search-handoff.md` §4·§5)

`궁궐`→경복궁 없음(문자열 불일치), `한옥`→식당 상위, `경복`→상호가 본체를 밀어냄. 분류 가중치·이름 접두·자모·**수기
유사어 10줄**로 막았고 `scripts/attractions-search-check.py` 6케이스가 지킨다. `궁궐`→경복궁은 사전 한 줄
(`궁궐, 고궁, 왕궁 => …, 경복궁, 창덕궁, …`) 덕이다 — 사람이 한 줄씩 넣어야 하고 줄이 없는 의미 질의는 여전히
못 찾는다. 벡터 레그가 겨냥하는 것은 **사전에 없는 의미 질의** — `바다가 보이는 곳`, `아이와 갈만한 곳`,
`조용한 사찰`, 영문 질의로 국문 문서(§8.1 정성 표).

질의 로그: query-insights 가 `top_queries-*` 를 매일 쌓지만(일 340~850건) 지연 상위만 남겨 **1,000건을 파싱해도
키워드 질의가 0건**(전부 `match_all` + 필터 브라우즈)이다. 관광지 검색은 impression/click 도 발행하지 않는다.
**질의 사전을 채울 로그가 지금은 없다** — P1 의 미스 로그가 그 첫 로그다. 판정 세트는 수동으로 시작한다(§4).

### 1.4 노드 예산 (운영 `kubectl top node` · `describe node`)

| 항목 | 값 |
|---|---|
| CPU | 4코어 (Ampere A1, aarch64) — 사용 **3.39코어 (84%)**, requests 2.78코어 (69%) |
| 메모리 | 24Gi — 사용 12.9Gi (53%), requests 10.5Gi (43%), limits 20.7Gi (86%), OS available 10.5GB |

메모리는 남고 **CPU 가 빠듯하다**. 그래서 서버에서는 추론을 하지 않는다. 남는 서버 비용은 OpenSearch 의 k-NN 질의(수 ms)와
벡터 메모리뿐이다.

---

## 2. 결정 (ADR-0090 초안)

### 2.1 구조

```
  ┌─ 로컬 PC (M4 Pro) / Colab T4 ── tools/embed ──────────────────────────────────────┐
  │  문서: place API 풀스캔 → 임베딩 텍스트(결정적 규칙) → 모델 → attraction_embedding 업서트  │
  │  질의: 의도 문구 + 자동완성 어휘 + 미스 로그 → 모델(query 지시문) → query_vectors 업서트    │
  │  push 는 ssh 터널 + port-forward (게이트웨이는 쓰기를 막는다)                             │
  └────────────┬──────────────────────────────────────────────┬───────────────────────┘
               ▼ PUT /internal/attractions/embeddings/bulk       ▼ PUT /internal/query-vectors/bulk
          place (MySQL SSOT)                                search:app ──▶ OpenSearch `query_vectors`
               │ GET /internal/attractions/embeddings/lookup       ▲ GET by id (+ Caffeine)
               ▼                                                   │
          search:batch (KST 04:30 재색인) ──▶ OpenSearch `attractions` (embedding 필드 포함, alias swap)
                                                                   │
  사용자 ─/api/search/*─▶ gateway ─▶ search:app ── 정규화 → 사전 조회 ─┤ 적중: hybrid[ function_score(BM25), knn ]
                                                                   └ 미적중: BM25 + Redis 미스 로그 → 다음 배치
```

- **서버에 모델이 없다.** search:app 은 벡터를 만들지 않고 찾는다. 사전 미적중은 실패가 아니라 BM25 경로다.
- **문서 벡터의 원본은 SSOT 서비스의 DB** 다. OpenSearch 인덱스는 매일 새로 지어지므로 벡터가 OpenSearch 에만 있으면 사라진다.
- **질의 사전은 search 소유의 OpenSearch 인덱스**(`query_vectors`). 파생 데이터가 아니라 search 의 자기 데이터라 search:app 이
  쓴다. 미스 카운트는 Redis(휘발 허용).
- **모델·차원은 문서와 질의가 같아야 한다.** 둘 다 `model` 을 싣고, 앱은 인덱스의 모델과 사전의 모델이 다르면 벡터 레그를 끈다.

### 2.2 왜 이 모양인가

| 옵션 | 내용 | 판정 |
|---|---|---|
| A. OpenSearch 안에서 — ml-commons 로컬 모델 + neural-search | 코드가 가장 적다 | ✗ 모델·네이티브를 런타임에 내려받고(default-deny egress), 검색 엔진 파드에 모델이 묶이고, 결국 CPU 추론이다 |
| B. Python 사이드카 실시간 인코딩 (v1) | ADR-0046 `recommendation-ann` 과 같은 모양 | ✗ 파드 +1 은 감당되지만 **CPU 추론이 모델을 300M 급으로 묶는다.** 4B 급은 x86 4 vCPU 전용 노드에서도 질의 1건 200~300ms 급이라 P99 300ms 예산 밖 |
| C. JVM 내장 ONNX | 파드 안 늘림 | ✗ 두 JVM 에 모델, 질의 스레드와 CPU 경쟁. 크기 제약은 B 와 같다 |
| **D. 서버 밖 임베딩 + 질의 사전** ★ | 문서는 오프라인, 질의는 사전, 미적중은 BM25 | ✓ **파드 +0, 모델 크기 제약 0.** 대가는 적중률과 하루 지연, 로컬 배치 의존 |
| E. 정적 임베딩(Model2Vec 류)을 JVM 에 | 토큰 표 평균이라 서버에서 µs | △ 품질 한 단 아래. 큰 모델과 공간이 달라 D 의 폴백으로 못 섞는다. P0 에서 "계산 0 기준선"으로만 잰다 |
| F. 브라우저에서 질의 인코딩 (transformers.js) | 서버 0 | ✗ 방문자마다 100MB+ 다운로드. 모바일 1순위 사이트에 맞지 않는다 |

D 를 고른 결정적 이유: 이 사이트의 질의는 **다양성이 작고 반복된다**(관광지 이름·지역·의도 문구). 사전이 며칠 안에 대부분을
덮을 것으로 기대하고, 그 기대는 P1 첫 주 적중률로 검증한다(§4). 기대가 틀리면 B 로 돌아갈 수 있다 — 인덱스 설계는 같다.

### 2.3 모델 — 서버 비용이 0 이라 기준이 바뀐다

계산이 전부 GPU 에서 일어나므로 "CPU 에서 몇 ms" 는 의미가 없다. 남는 기준은 **판정 세트 nDCG@10**, **k-NN 메모리(차원)**,
**라이선스** 셋이다.

| 후보 | 파라미터 / 차원 | 근거 (2026-09-05 조회) | 라이선스 | 비고 |
|---|---|---|---|---|
| Qwen3-Embedding-8B (8bit) | 8B / 4096 (MRL 32~) | 다국어 MTEB v2 70.58 | Apache-2.0 | Colab T4 에 8bit 로 올라간다. 차원은 MRL 로 1024 이하로 |
| Qwen3-Embedding-4B (fp16) | 4B / 2560 (MRL) | 69.45 · 한국어 IR 81.4 | Apache-2.0 | T4 에 fp16 그대로 |
| arctic-embed-l-v2.0-ko | 568M / 1024 | 한국어 IR **82.1**(1위권) | Apache-2.0 | 한국어 특화. 영어는 arctic-l-v2 원본 수준 |
| harrier-oss-v1-0.6b | 0.6B / 1024 | 69.0 (소형 1위) | MIT | 질의에 한 문장 지시문. 한국어 IR 미측정 |
| embeddinggemma-300m | 308M / 768 (MRL 128) | 61.2 · 한국어 IR 78.2 | Gemma 약관 | 작은 쪽 기준선 |

- **제외**: jina v5 계열(CC BY-NC — 광고 사이트에 부적합), KURE-v2(다중 벡터 — `knn_vector` 불가, 리랭커 자리), e5-small(같은
  차원의 granite-97m-r2 가 10점 위라 기준선 자리도 잃음).
- **차원이 곧 서버 비용이다.** 6만 문서 + 사전 ~8만 항목 기준: 512차원 ≈ 290MB, 1024차원 ≈ 570MB (float32, HNSW 그래프 별도),
  세대 2 보관 시 ×2. MRL 지원 모델은 512 로 잘라 P0 에서 1024 대비 nDCG 차이를 본다.
- 정성 실측(§8.1)이 말하는 것: 코사인이 .75~.88 에 몰리므로 **순위 융합(RRF)**, 그리고 벡터도 분류 편향(`한옥`→식당)은 못 고치므로
  **분류 가중치는 두 레그에 그대로**.
- 라이선스: 채택 모델의 출처·라이선스를 `docs/architecture/data-sources.md` 에 한 줄로 남긴다.

### 2.4 색인·저장 설계

**문서 벡터 — place `attraction_embedding`** (Flyway, 번호는 작성 시점에 `ls` 로 확인 — 다른 세션이 V11 을 쓰고 있다). **엔티티·포트·API 상세는
`docs/specs/2026-09-05-unified-search/embedding-entities.md`** — 아래는 요지다:

```sql
CREATE TABLE attraction_embedding (
  attraction_id BIGINT      NOT NULL,
  model         VARCHAR(80) NOT NULL,   -- 예: Qwen/Qwen3-Embedding-4B@rev:mrl512
  dim           SMALLINT    NOT NULL,
  text_hash     CHAR(64)    NOT NULL,   -- sha256(model + "\n" + embeddingText)
  vector        BLOB        NOT NULL,   -- float32 little-endian, dim*4 바이트
  embedded_at   DATETIME    NOT NULL,
  PRIMARY KEY (attraction_id, model)
);
```

- 임베딩 텍스트는 **오프라인 도구 한 곳**에서만 만든다(서버는 만들지 않으므로 이중 구현이 없다):
  `title · titleLocal · 분류 한국어명 · address · overview(앞 1,000자)`, 512 토큰 절단, 제목이 앞.
- **신선도**: `attractions.updated_at > attraction_embedding.embedded_at` 이면 stale. `GET /internal/attractions/embeddings/pending?model=`
  가 (없거나 stale 인) id 목록을 주고, 도구가 텍스트 해시로 확정한다 — 해시가 같으면 벡터 없이 `embedded_at` 만 갱신(touch). 매일 바뀌는 개요 2,000건
  안팎이 하루치 일이다. `embedding_text` 원문도 함께 저장한다(원문 보존 규칙).
- 재색인(`AttractionApiReindexTasklet`)은 페이지마다 `POST /internal/attractions/embeddings/lookup {ids, model}` 로 벡터를 받아
  `embedding` · `embeddingModel` · `embeddingHash` 를 채운다. 없는 문서는 필드 없이 색인된다(BM25 만). stale 벡터는 그대로 싣고
  개수만 로그·메트릭으로 남긴다.
- 매핑(`attractions-index.json`, SSOT):

```json
"settings": { "index": { "knn": true } },
"embedding":      { "type": "knn_vector", "dimension": 512, "space_type": "cosinesimil",
                    "method": { "name": "hnsw", "engine": "lucene", "parameters": { "m": 16, "ef_construction": 128 } } },
"embeddingHash":  { "type": "keyword", "index": false },
"embeddingModel": { "type": "keyword" }
```

  `dimension` 은 P0 이 정한 값으로 고정한다. 모델·차원을 바꾸면 전량 재임베딩(오프라인이라 분 단위) + 전체 재색인 + alias swap.
- 읽기 클래스 `AttractionSearchDocument` 는 세 필드를 읽지 않는다 → 루트 `build.gradle.kts` `searchReadOmitted` 에 이유를 적어
  `verifySearchIndexContract` 를 통과시킨다. 질의 응답은 `_source.excludes=[embedding]`.

**질의 사전 — search 소유 OpenSearch 인덱스 `query_vectors`**:

| 필드 | 타입 | 비고 |
|---|---|---|
| `_id` | = 정규화 질의 | NFKC · trim · 공백 축약 · 라틴 소문자 · 끝 문장부호 제거 |
| `query` | keyword | 원문(표시용) |
| `model` | keyword | 문서와 같아야 한다 |
| `vector` | `index: false` float 배열 | `_source` 에만. k-NN 대상이 아니다(조회용) |
| `source` | keyword | `intent` · `vocab` · `title` · `log` |
| `updatedAt` | date | |

- 인덱스는 search:app 이 기동 시 idempotent 로 만든다(계약 JSON 은 `search/app/src/main/resources/opensearch/query-vectors-index.json`).
- 시드 층: ① **의도 문구 수기 100~300**(`바다가 보이는 곳`, `아이와 갈만한 곳`, `야경`, `벚꽃` … — 판정 세트 30개가 첫 시드)
  ② 자동완성 어휘(지역 572 ko/en, 분류명, 유사어 좌변) ③ 관광지·글·게임 제목(선택 — BM25 가 이미 찾는 것이라 이득이 작다, §7)
  ④ **미스 로그**(운영이 만든다).
- **미스 로그**: search:app 이 Redis ZSET `search:qmiss:{model}` 에 정규화 질의를 ZINCRBY. `GET /internal/query-vectors/misses?limit=`
  로 도구가 가져가고, 업서트 후 `DELETE` 로 지운다. Redis 가 비어도 잃는 건 하루치 미스뿐이다.
- 도구는 로컬 캐시(`~/.cache/1989v-embed/{model}/`, text_hash → vector)를 두어 같은 문장을 두 번 계산하지 않고, Redis·OpenSearch 가
  비었을 때 다시 밀어 넣을 수 있게 한다.

**P2 — `unified` 인덱스**(alias `unified`, 계약 `unified-index.json`)와 **code-dictionary 호스트 `content_embedding`**:

| 필드 | 타입 | 채우는 규칙 |
|---|---|---|
| `id` | keyword | `{type}:{sourceId}` |
| `type` | keyword | `attraction · region · product · concept · blog_post · game · deal_offer · service` — wishlist 의 대상 타입과 이름을 맞춘다 |
| `sourceId`, `slug` | keyword | **URL 은 굽지 않는다** — FE 가 `portal-fe/src/shell/serviceHref.ts` 로 호스트를 조립한다 |
| `lang` | keyword | ko / en |
| `title` (+`.en`, `.keyword`), `titleJamo` | text | attractions 와 같은 분석기·자모 |
| `summary`, `body` | text (nori / `.en`) | 글은 마크다운→평문(코드 펜스 · `<svg>` · HTML 제거) |
| `category`, `tags` | keyword | |
| `popularity` | float | 타입별 log1p 정규화 |
| `publishedAt` | date | 글·게임 |
| `location` | geo_point | 관광지만 |
| `thumbnailUrl` | keyword (index=false) | |
| `embedding`, `embeddingHash`, `embeddingModel` | 위와 동일 | 관광지는 `attraction_embedding`, 나머지는 `content_embedding(type, source_id, model, …)` 에서 lookup |

원천은 전부 공개 API 풀스캔(`PlaceApiClient` 패턴). 이력서는 넣지 않고(ADR-0064), 비밀 게임은 카탈로그에 없어 구조적으로 빠진다(ADR-0089).
`content_embedding` 은 code-dictionary 호스트가 게임(`game_db`)까지 포함해 자기 표로 소유한다 — 호스트 앱이 두 스키마를 다 갖고 있어
서비스 간 DB 공유가 아니다.

### 2.5 질의 설계

- **하이브리드는 키워드가 있고 관련도 정렬이고 사전에 적중했을 때만.** 거리순·필터 브라우즈·미적중은 지금 그대로다.
- 정규화 → `query_vectors` GET by id(Caffeine 캐시 앞단, TTL 10분) → 적중이면 하위 질의 둘: ① 기존 `multi_match`/`bool` 을
  `function_score`(분류 가중치)로 감싼 것 ② `knn { embedding, vector, k: 100, filter: lang·category }`. **두 레그에 같은 분류
  가중치.** 안 먹으면 앱 후처리 — P0-4 가 정한다.
- 융합: search pipeline `hybrid-rrf`(`score-ranker-processor`, `rank_constant=60`) 기본. `normalization-processor`(min_max +
  arithmetic_mean, weights) 를 변형으로. 파이프라인 JSON 은 search:app 리소스, 기동 시 idempotent PUT.
- 미적중: BM25 그대로 + Redis ZINCRBY(비동기, 실패 무시) + 메트릭 `search.qvec.miss`. 적중은 `search.qvec.hit`. **적중률이 이 설계의
  건강 지표다.**
- **자동완성(suggest)은 벡터를 쓰지 않는다.** 조합 중간 상태(`경보`)는 의미가 없고, 자동완성에서 고른 항목은 그대로 사전 항목이라
  본 검색에서 적중한다.
- 설명: `hybrid_score_explanation` 응답 프로세서는 `/api/v1/search/debug` 에서만.
- 지연 예산: 검색 P99 300ms. 사전 조회 1~2ms + knn 수 ms. 인코딩 비용 0.

### 2.6 무료 티어 계정

| 항목 | 추가분 | 근거 |
|---|---|---|
| 파드 | **0** | 서버에 모델·추론 없음 |
| OpenSearch 메모리 | 벡터(문서 6만 + 사전 ~8만) 512차원 ≈ 290MB / 1024차원 ≈ 570MB, HNSW +15%, 세대 2 → 최대 ~1.3GB 페이지캐시 | 한도 1536Mi → **2.5Gi** 상향 예정. heap 512m 유지(lucene 엔진). P0-3 실측 후 확정 |
| PVC | 3Gi 중 ~130MB 사용 → 벡터 포함 세대 2 시 ~1.6GB | 여유 있으나 **5Gi 확장 여부**를 P0 에서 판단(스토리지클래스 확장 지원 확인) |
| CPU | knn 질의 수 ms, 사전 GET 1~2ms | 추론 0 |
| 로컬 | 첫 채움 6만 건 — M4 Pro MPS 또는 Colab T4 에서 분~수십 분(모델 크기에 따라). 일일 증분 2천 건은 분 단위 | 사람이 돌리는 배치. §5 리스크 |

ADR-0065 가 미뤄 둔 **OQ-5(쿼리 타임 인코딩)는 "하지 않는다" 로 닫는다** — `docs/specs/2026-08-11-k-tour-search/open-questions.yml` 갱신은 P1-9.

### 2.7 하지 않는 것

- 서버 상주 임베딩 모델(사이드카·JVM 내장·ml-commons). 적중률 가정이 깨지면 그때 v1 사이드카로 되돌린다 — 인덱스 설계는 같다.
- 본문 청킹(nested 벡터) — 글이 6건이다. 글이 50건을 넘거나 긴 본문 리콜 문제가 측정되면 P3.
- 크로스인코더 리랭커 · LTR — ADR-0051 트랙 B 의 몫. KURE-v2 같은 다중 벡터 모델은 이 자리의 후보다.
- Kafka 증분 색인 — 새벽 재색인 + 온디맨드로 시작. "다음날 반영" 이 문제로 측정되면 P3.
- 자동완성 벡터화, 이력서 · 비밀 게임 색인, `/search` 결과 페이지 색인(noindex).

---

## 3. 단계

동작 변화는 **플래그 뒤에** 두고 배포한다. 이미지가 새로 구워지는 모듈을 적는다 — `images.yml` 테스트 게이트가 한 모듈 실패로
그 커밋의 **모든** 이미지를 막는다. 여러 세션이 워킹트리를 공유하므로 `git add` 는 경로로 좁힌다.

### P0 — 측정과 결정 (1~2일)

| # | 할 일 | 산출물 / 증거 |
|---|---|---|
| P0-1 | ADR-0090 작성(Proposed) — §2 를 옮긴다. 번호는 `ls docs/adr \| sort \| tail` 로 재확인 | `docs/adr/ADR-0090-unified-search-hybrid-embedding.md` |
| P0-2 | **판정 세트 v0** — 핸드오프 4쿼리 + 의도 질의 26개, 사람이 상위 5를 판정해 파일로. 이것이 사전의 첫 시드이기도 하다 | `docs/specs/2026-09-05-unified-search/judgments.yml` |
| P0-3 | **Colab bake-off** — 관광지 6만 건을 공개 API 로 받아 §2.3 후보 5개로 문서·판정 질의를 임베딩, nDCG@10 표 + 차원 512 vs 1024 비교 + "타이틀만 / 타이틀+분류+주소+개요" 임베딩 텍스트 비교. 노트북은 레포에 둔다(공개 데이터만) | `tools/embed/notebooks/bakeoff.ipynb` + 결과 표를 이 문서 §8.3 에 |
| P0-4 | **k-NN 스크래치 인덱스** — 선택 차원으로 14만 건(문서+사전) 정규화 난수 벡터를 넣고 `_nodes/stats/indices/segments` · 컨테이너 RSS · knn 지연 · PVC 사용량을 잰다. 끝나면 삭제 | OpenSearch 한도(2.5Gi?)·PVC(5Gi?) 결정 |
| P0-5 | **hybrid 스파이크**(같은 인덱스) — `hybrid[function_score(bool), function_score(knn)]` + `hybrid-rrf` 가 3.3.0 에서 먹는지, `knn.filter` · `from/size` · `sort: [_score, idSort]` · `explain` | 안 되는 것은 앱 후처리로 확정해 ADR 에 |
| P0-6 | 모델·차원 확정 + `data-sources.md` 라이선스 행 | ADR Accepted |

이미지 영향: 없음.

### P1 — 관광지 하이브리드, 서버 상주 모델 0 (플래그 기본 off)

| # | 할 일 | 파일 |
|---|---|---|
| P1-1 | **place** — Flyway `attraction_embedding`(§2.4) + JPA 엔티티 · 리포지토리 · `AttractionEmbeddingPort` · UseCase 3(`upsertEmbeddings`, `pendingEmbeddings`, `lookupEmbeddings`) + `AttractionEmbeddingInternalController` (`/internal/attractions/embeddings/{pending,bulk,lookup,status}` — 기존 `/internal/attractions/links` 패턴) + 도메인 테스트 | `place/app/src/main/resources/db/migration/V1x__attraction_embedding.sql`, `place/app/.../attraction/` |
| P1-2 | **tools/embed** (Python, 레포에 두되 배포하지 않는다) — `pyproject.toml`, `embed_text.py`(결정적 임베딩 텍스트 규칙 + sha256), `models.py`(모델 id·리비전·차원·MRL·query 지시문 한 곳), `docs.py`(pending → 임베딩 → bulk), `queries.py`(시드 파일 + misses → 임베딩 → bulk), `push.py`, `tunnel.sh`(`ssh -L` + 원격 `k3s kubectl port-forward svc/place 8096` · `svc/search 8083`), 로컬 캐시. 백엔드는 sentence-transformers(MPS/CUDA). pytest: 텍스트 규칙 고정값 · 해시 · 벡터 정규화 · 차원 검사 | `tools/embed/` |
| P1-3 | **search:batch** — `PlaceApiClient.lookupEmbeddings(ids, model)` + `AttractionApiReindexTasklet` 에 필드 채움 + stale 카운트 로그 + `attractions-index.json` §2.4 + `AttractionIndexDocument` 3필드 + `searchReadOmitted["attractions"]` 3줄 | `search/batch/…`, `build.gradle.kts` |
| P1-4 | **search:app 사전** — `query-vectors-index.json` + 기동 시 생성 + `QueryVectorPort`(GET by id + Caffeine) / `QueryVectorWritePort` + `QueryVectorInternalController` (`PUT /internal/query-vectors/bulk`, `GET /internal/query-vectors/misses`, `DELETE …/misses`, `GET …/status`) + `QueryMissPort`(Redis ZSET) | `search/app/…/application/queryvector/`, `infrastructure/opensearch/QueryVectorAdapter.kt`, `infrastructure/redis/QueryMissRedisAdapter.kt` |
| P1-5 | **search:app 질의** — 정규화 함수(도메인, 테스트) + `AttractionSearchAdapter.buildRequest` hybrid 분기(적중 시) + 파이프라인 보장 + `_source.excludes` + debug explain + 메트릭(hit/miss/stale). 설정 `search.attraction-hybrid.{enabled=false, k=100, fusion=rrf, model=…}` | `search/domain/.../QueryNormalizer.kt`, `search/app/…/AttractionSearchAdapter.kt` |
| P1-6 | 테스트(Kotest BehaviorSpec + MockK) — 적중이면 hybrid, 미적중이면 BM25 + 미스 기록, 모델 불일치면 BM25(어댑터가 만든 `SearchRequest` 를 본다); 배치는 lookup 결과가 있는 문서만 필드가 채워지는지 | `search/app/src/test`, `search/batch/src/test`, `place/app/src/test` |
| P1-7 | NetworkPolicy — search-batch → place 는 이미 `allow-search-batch-to-place`. 새 경로 없음(도구는 port-forward). 확인만 | — |
| P1-8 | 첫 채움 — 로컬에서 `tools/embed docs --model … --all` → push, `tools/embed queries --seed judgments.yml,intents.yml,vocab` → push. 소요·건수 기록 | 핸드오프 |
| P1-9 | 문서 — `search/CLAUDE.md`(사전·플래그·계약 표 21→24), `place/CLAUDE.md`(embedding 표·internal 엔드포인트·"도구가 밀어 넣는다"), `tools/embed/README.md`(하루 루틴 3줄), `data-sources.md`, k-tour OQ-5 close, 핸드오프 갱신 | |

**검증 — 이 순서로, 값을 남긴다**

1. 게이트가 무는지: 매핑에서 `embeddingHash` 를 잠깐 지워 `./gradlew verifySearchIndexContract` **빨간불** → 복구.
2. `./gradlew :place:domain:test :place:app:build :search:domain:test :search:app:build :search:batch:build` + `pytest tools/embed`.
3. 배포 후 `GET /internal/attractions/embeddings/status` (port-forward) 가 0건에서 첫 채움 뒤 6만 건으로.
4. 다음 새벽 재색인 로그에 "embedding 채움 N건 / stale M건" — N 이 status 와 같은지. `_cat/indices` 의 크기 증가가 §2.6 추정 안인지.
5. `search.attraction-hybrid.enabled=true` → `scripts/attractions-search-check.py` **6/6 유지** + 판정 세트로 BM25 vs hybrid 상위 5
   전/후 표 + nDCG@10 → 핸드오프에 나란히. **적중률**(`search.qvec.hit / (hit+miss)`)을 첫 주 매일 적는다.
6. 지연: `/api/search/attractions` P99 전/후(`http_server_requests`).
7. 폴백: `query_vectors` 인덱스를 잠깐 비워도 검색 200 + 미스 카운터 증가. Redis 를 비워도 검색 정상.
8. 롤백: 플래그 off = 이전 동작. 표·인덱스는 남아도 무해.

이미지 영향: `place`, `search`, `search-batch`. 주의 — `images.yml` 은 `search/domain/*` 변경을 `search` 이미지에만 매핑한다.
P1 은 batch 코드도 바뀌므로 함께 구워지지만, 이후 도메인만 고칠 때는 `gh workflow run images.yml -f services="search-batch"`.

### P2 — 통합 인덱스 + API + 화면

| # | 할 일 | 파일 |
|---|---|---|
| P2-1 | `unified-index.json` + `UnifiedIndexDocument`(batch) / `UnifiedSearchDocument`(app) + 게이트 맵 | `search/batch/src/main/resources/opensearch/unified-index.json`, `build.gradle.kts` |
| P2-2 | **code-dictionary 호스트** — Flyway `content_embedding(type, source_id, model, dim, text_hash, vector, embedded_at)` + `/internal/content/embeddings/{pending,bulk,lookup,status}` (타입별 pending 은 각 폴드 모듈의 `updated_at` 로) | `code-dictionary/app/…` |
| P2-3 | tools/embed — `docs.py --source blog_post|game|concept|deal_offer|service` (공개 API + 상세) + 평문 변환(코드 펜스 · svg 제거, 테스트) | `tools/embed/` |
| P2-4 | 원천 클라이언트(`BlogApiClient` · `GameApiClient` · `ConceptApiClient` · `DealApiClient` · `DisplayServiceApiClient`) + `UnifiedReindexTasklet`(관광지 벡터는 place lookup, 나머지는 content lookup) + CronJob `unified-reindex` KST 04:45 + NP 확인(`04-allow-backend-to-backend` · `12-…egress-internal` 이 덮는지 실제 호출로) | `search/batch/…`, `k8s/base/search-batch/cronjob-unified-reindex.yaml` |
| P2-5 | 앱 — `application/unified/{usecase,port,service}` + `UnifiedSearchAdapter`(hybrid, 타입 facet, 타입 가중치 `search.unified-ranking.type-weights`) + `GET /api/search/unified?q&type&lang&page&size`, `GET /api/search/unified/suggest`(어휘만). 게이트웨이 변경 없음(`/api/search/**` 는 이미 search) | `search/app/…` |
| P2-6 | FE — `/search?q=` 페이지(모든 호스트, 호스트 기본 타입 필터), GNB 검색 버튼 전 페이지, `serviceHref.ts` 링크, noindex + sitemap 제외, `copy.mjs` SearchAction → `/search?q={search_term_string}`. DESIGN.md 토큰 · 모바일 1순위 · CDP 4조합 | `portal-fe/src/pages/search/`, `components/GNB.tsx`, `App.tsx`, `seo/copy.mjs` |
| P2-7 | `/tech` 검색(운영 500) — 통합 API `type=concept` 로 갈아탄다. code-dictionary 의 OpenSearch 색인 경로는 **보고 후** 정리 | `portal-fe/src/api/searchApi.ts` |
| P2-8 | 노출·클릭 로깅 — `search.impression.logged` / `search.click.logged` 를 unified 에도(`surface` 필드). 판정 세트 확장 재료 | `search/app`, `docs/architecture/kafka-convention.md` |
| P2-9 | **비슷한 관광지** — 문서 벡터만으로 되는 첫 부수 기능. 관광지 상세에 `knn` top-5(같은 lang, 다른 id). 질의 인코딩 불필요 | `search/app`, `portal-fe/src/pages/place/AttractionPage.tsx` |
| P2-10 | 어드민 카드 — place·content `embeddings/status`(모델 · 건수 · stale · 마지막 채움 시각) + 사전 `status`(항목 수 · 적중률 · 미스 상위 20) | `admin-fe` |

**검증**: 타입별 대표 질의가 그 타입을 1위로(`scripts/unified-search-check.py`, 기대값은 P0-2 판정), 관광지 케이스 유지, CDP 4조합 값 +
크롭 스크린샷, `/search` noindex, sitemap 에 `/search` 없음, 첫 채움 소요, 어드민 카드의 stale 0.

이미지 영향: `code-dictionary`, `search`, `search-batch`, `portal-fe`, `admin-fe`.

### P3 — 평가 · 자동화 · 승격 (조건부)

- `search-eval-daily` 를 unified/attractions 로 확장(`OsRankingExecutor` 는 지금 `products` 고정). 판정 세트 30→100, nDCG@10 ClickHouse 적재.
- 사전 배치 자동화 — 로컬 PC 의 launchd/cron 으로 `tools/embed` 하루 1회. 마지막 실행 시각이 어드민에 있으니 멈추면 보인다.
  로컬 의존이 문제가 되면 그때 Colab 스케줄 또는 GPU 를 가진 다른 기계로.
- 모델 승격 — 같은 노트북으로 재측정, 전량 재임베딩(오프라인) + 전체 재색인 + alias swap. `model` 필드가 섞임을 막는다.
- 적중률이 기대(첫 달 80%) 를 크게 못 미치면 v1 사이드카(300M 급 실시간 인코딩)를 **미적중 전용 폴백**으로 되살리는 안을 검토한다 — 단
  공간이 달라 같은 필드에 못 넣으므로 문서 벡터도 그 모델로 다시 만들어야 한다. 그래서 첫 모델 선택에서 "작아도 되는가" 를 같이 본다(§7).
- 유사어 사전 축소, Kafka 증분, 글 본문 청킹, 주유소 타입 — 각각 조건이 측정됐을 때.

---

## 4. 게이트 — 무엇을 근거로 "됐다"고 말하나

| 게이트 | 근거가 되는 값 | 단계 |
|---|---|---|
| 모델·차원 | Colab bake-off nDCG@10 표(후보 5 × 차원 2 × 텍스트 규칙 2) | P0 |
| 서버 여력 | 스크래치 인덱스 RSS · PVC · knn 지연(P0-4) | P0 |
| 계약 | `verifySearchIndexContract` 빨간불 → 초록불 | P1 |
| 채움 | `embeddings/status` 건수 = 재색인 로그의 채움 건수, stale 추이 | P1 |
| 회귀 | `attractions-search-check.py` 6/6 (hybrid on) | P1 |
| 효과 | 판정 세트 BM25 vs hybrid 상위 5 전/후 표 + nDCG@10 | P1 · P2 |
| **적중률** | `search.qvec.hit / (hit+miss)` 일별 — 첫 주 추이, 첫 달 80% 를 기대치로 | P1 ~ |
| 지연 | `/api/search/attractions` P99 전/후 ≤ 300ms | P1 |
| 폴백 | 사전 인덱스 비움 · Redis 비움에도 검색 200 | P1 |
| 화면 | CDP 4조합 값 + 크롭 스크린샷, noindex | P2 |

검사가 스스로 만든 근거는 근거가 아니다 — 기대값은 P0-2 에서 사람이 적고, 검사는 사용자와 같은 공개 API 를 부른다.

---

## 5. 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| **적중률이 낮아 벡터 레그가 거의 안 돈다** | 시드 3층 + 미스 로그 일일 반영. 첫 달 지표로 판정, 실패 시 P3 의 폴백 안 |
| **로컬 배치가 멈추면 조용히 멈춘다** | 어드민 status 카드(마지막 채움 시각·stale·미스 적체). P3 에서 launchd 자동화 |
| 새 문서·새 질의는 다음날 | 개요 수집도 같은 리듬. 감수 |
| 문서 모델 ≠ 사전 모델 | `model` 필드 대조, 다르면 벡터 레그 off + 메트릭 |
| OpenSearch 메모리·PVC 상승 | P0-4 실측 → 한도 2.5Gi · PVC 5Gi. 차원 512 로 반감 가능 |
| hybrid 하위 `function_score(knn)` 미지원 | P0-5 → 앱 후처리 |
| 임베딩 텍스트 규칙이 도구 안에만 있어 서버가 검증 못 함 | 규칙 변경 = `text_hash` 전부 불일치 = 전량 pending. 그게 곧 검증이다. 규칙은 `embed_text.py` 한 파일 + 고정값 테스트 |
| 도구가 잘못된 차원·모델로 push | `bulk` 가 `dim`·`model` 을 검사해 거부(place·search 양쪽) |
| 판정 세트 편향(사람 30질의) | P2-8 로깅 + 미스 로그가 실제 분포를 준다. ADR-0050 식 spot-check |
| 공유 워킹트리 · CI 경로 매핑 | `git add` 경로 좁히기. `search/domain/*` 은 `search` 이미지만 굽는다 |
| 첫 채움을 Colab 에서 할 때 클러스터 도달 불가 | 노트북은 parquet 만 내고 push 는 로컬에서(`tools/embed push --file`) |

---

## 6. 파일 지도

| 무엇 | 어디 |
|---|---|
| 오프라인 도구 | `tools/embed/` (신규, 배포 안 함) — `embed_text.py` · `models.py` · `docs.py` · `queries.py` · `push.py` · `tunnel.sh` · `notebooks/bakeoff.ipynb` |
| 문서 벡터 표 | place `V1x__attraction_embedding.sql` · `place/app/…/attraction/{persistence,application,presentation}` (`/internal/attractions/embeddings/*`) |
| 콘텐츠 벡터 표 (P2) | code-dictionary `content_embedding` · `/internal/content/embeddings/*` |
| 질의 사전 | `search/app/src/main/resources/opensearch/query-vectors-index.json` · `search/app/…/application/queryvector/` · `infrastructure/opensearch/QueryVectorAdapter.kt` · `infrastructure/redis/QueryMissRedisAdapter.kt` · `/internal/query-vectors/*` |
| 매핑 SSOT | `search/batch/src/main/resources/opensearch/{attractions,unified}-index.json` |
| 계약 게이트 | 루트 `build.gradle.kts` — `searchReadOmitted` / `verifySearchIndexContract` |
| 정규화 | `search/domain/…/QueryNormalizer.kt` (`Jamo` 옆) |
| 재색인 | `search/batch/…/AttractionApiReindexTasklet.kt`, `UnifiedReindexTasklet.kt`(신규), `PlaceApiClient.lookupEmbeddings` |
| 질의 | `search/app/…/infrastructure/opensearch/AttractionSearchAdapter.kt`, `UnifiedSearchAdapter.kt`(신규), `hybrid-pipeline.json`(신규) |
| 배포 | `k8s/base/search-batch/cronjob-unified-reindex.yaml`(P2). 신규 파드·NP·CI 매핑 **없음** |
| 화면 | `portal-fe/src/pages/search/`, `components/GNB.tsx`, `App.tsx`, `seo/copy.mjs`, `pages/place/AttractionPage.tsx`(비슷한 곳), `admin-fe`(status 카드) |
| 회귀·판정 | `scripts/attractions-search-check.py`, `scripts/unified-search-check.py`(신규), `docs/specs/2026-09-05-unified-search/judgments.yml`(신규), `intents.yml`(신규) |
| 엔티티 설계 | `docs/specs/2026-09-05-unified-search/embedding-entities.md` — DDL · 도메인 · 포트 · 내부 API · 불변식 · 도구 계약 |

---

## 7. 미결 — 사용자 결정

1. **모델·차원**: P0-3 표를 보고. 후보에 "작아도 되는가"(P3 폴백 호환)를 같이 볼지.
2. **사전 시드에 제목 6만 건을 넣을지**: BM25 가 이미 찾는 것이라 이득이 작고 사전이 6만 항목 커진다. 추천은 의도 문구 + 어휘 + 로그만.
3. **첫 채움을 어디서**: M4 Pro MPS 로 충분하면 Colab 없이. 8B 8bit 이면 Colab.
4. `/tech` 검색(지금 500)을 통합 API 로 갈아탈지.
5. OpenSearch 한도 2.5Gi · PVC 5Gi 상향 승인(P0-4 수치 뒤).
6. 로컬 배치 자동화(launchd) 시점 — P1 부터인지 P3 부터인지.

---

## 8. 부록 — 실측 원본

### 8.1 로컬 벤치 (2026-09-05, 1코어 arm64) — 서버 인코딩을 버린 근거의 일부

`docker run --rm --platform linux/arm64 --cpus 1 -m 2g python:3.11-slim`, onnxruntime 1.29.0 (aarch64),
`Xenova/multilingual-e5-{small,base}` 의 `onnx/model_quantized.onnx`, 질의 20개 단건, 문서 128건(96토큰) batch 16 max_len 256,
mean pooling + L2 정규화. M 시리즈 코어라 Ampere A1 은 이보다 느리다(배수 미측정).

| 모델 (int8 ONNX) | 파일 | 차원 | 질의 p50 / p95 | 문서 처리량 | max RSS |
|---|---|---|---|---|---|
| multilingual-e5-small | 118MB | 384 | 2.4 / 3.1 ms | 52 건/s | 586Mi |
| multilingual-e5-small (2 thread) | 118MB | 384 | 1.5 / 2.1 ms | 46 건/s | 570Mi |
| multilingual-e5-base | 279MB | 768 | 6.9 / 8.5 ms | 18 건/s | 854Mi |

파라미터 비례 **추정**: 4B int8 은 질의 ~85ms(M4) · ~250ms(Ampere), 8B ~170 · ~500ms. 이 수치가 "서버에서 큰 모델을 실시간으로
돌리지 않는다" 의 근거고, v2 는 그 문제를 인코딩 위치를 옮겨 피한다.

정성 결과 — 후보 10건(관광지 8 + 상점·식당 2) 안에서 코사인 순위, e5-small:

| 질의 | 상위 | 읽히는 것 |
|---|---|---|
| `궁궐` | 창덕궁 .843 · **경복궁 .829** · 한복남 경복궁점 .812 | 사전 없이 궁이 위. 상점과 차이가 작다 → 분류 가중치 유지 |
| `한옥` | 한옥 생고기(food) .874 · 북촌한옥마을 .860 | 벡터만으로는 BM25 와 같은 실패 → hybrid + 분류 가중치 |
| `바다가 보이는 곳` | 해운대해수욕장 .825 | 사전에 없는 의미 질의가 맞는다 |
| `아이와 갈만한 곳` | 롯데월드 .838 | 〃 |
| `palace in seoul` | Gyeongbokgung Palace(en) .886 | 언어 교차 |
| `조용한 사찰` | 불국사 .809 | 〃 |
| `한복 대여` | 한복남 경복궁점 .882 | 상점이 정답인 질의는 상점이 위 |

코사인이 0.75~0.88 에 몰린다 → 점수 임계값이 아니라 순위 융합.

벤치 스크립트(P0 정적 임베딩 기준선을 잴 때 재사용):

```python
import os, time, json, resource
import numpy as np
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer
import onnxruntime as ort

REPO = os.environ.get("REPO", "Xenova/multilingual-e5-small")
FILE = os.environ.get("ONNX_FILE", "onnx/model_quantized.onnx")
THREADS = int(os.environ.get("THREADS", "1"))

tok = Tokenizer.from_file(hf_hub_download(REPO, "tokenizer.json"))
model_path = hf_hub_download(REPO, FILE)
so = ort.SessionOptions(); so.intra_op_num_threads = THREADS; so.inter_op_num_threads = 1
sess = ort.InferenceSession(model_path, so, providers=["CPUExecutionProvider"])
in_names = {i.name for i in sess.get_inputs()}

def embed(texts, max_len):
    tok.enable_padding(); tok.enable_truncation(max_length=max_len)
    enc = tok.encode_batch(texts)
    ids = np.array([e.ids for e in enc], dtype=np.int64)
    mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
    feed = {"input_ids": ids, "attention_mask": mask}
    if "token_type_ids" in in_names: feed["token_type_ids"] = np.zeros_like(ids)
    out = sess.run(None, feed)[0]
    m = mask[..., None].astype(np.float32)
    pooled = (out * m).sum(1) / np.maximum(m.sum(1), 1e-9)
    return pooled / np.linalg.norm(pooled, axis=1, keepdims=True)

embed(["query: warmup"], 32)
queries = ["궁궐", "한옥", "바다가 보이는 곳", "아이와 갈만한 곳", "palace in seoul", "경복", "해수욕장",
           "조용한 사찰", "야경 명소", "전통시장 먹거리", "kafka idempotent consumer", "스네이크 게임",
           "서울 근교 드라이브", "벚꽃 축제", "온천", "미술관", "캠핑장", "케이블카", "등산 코스", "야시장"]
lat = []
for q in queries:
    t = time.perf_counter(); embed(["query: " + q], 64); lat.append((time.perf_counter() - t) * 1000)
lat.sort()
passage = ("경복궁은 조선 왕조의 법궁으로 1395년 태조 이성계가 창건하였다. 서울 종로구 사직로에 위치하며 "
           "근정전, 경회루, 향원정 등 아름다운 전각과 정원이 있어 사계절 내내 많은 관광객이 찾는다. "
           "수문장 교대의식과 한복 체험이 인기이며 인근에 국립민속박물관과 북촌한옥마을이 있다.")
passages = ["passage: " + passage + f" ({i})" for i in range(128)]
t = time.perf_counter()
for i in range(0, len(passages), 16): embed(passages[i:i + 16], 256)
tput = len(passages) / (time.perf_counter() - t)
print(json.dumps({
    "repo": REPO, "threads": THREADS, "model_mb": round(os.path.getsize(model_path) / 1e6, 1),
    "query_ms_p50": round(lat[len(lat) // 2], 1), "query_ms_p95": round(lat[int(len(lat) * 0.95) - 1], 1),
    "passage_docs_per_s": round(tput, 1),
    "max_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024),
}, ensure_ascii=False))
```

### 8.2 노드 · 클러스터 (2026-09-05)

- `kubectl top node`: cpu 3387m (84%), memory 12935Mi (53%). requests cpu 2780m / memory 10534Mi, limits memory 20682Mi.
  호스트 `free -m`: total 23974, used 13403, available 10570.
- OpenSearch 3.3.0 (Lucene 10.3.1), heap 512m, 컨테이너 1Gi/1536Mi, PVC 3Gi, `discovery.type=single-node`, security 플러그인 off.
- `_cat/aliases`: `attractions → attractions_20260904193104`(59,735) · `products → products_20260809050605`(24) ·
  `regions → regions_20260811050338`(572). 개념 인덱스 alias 없음.
- ml-commons: `only_run_on_ml_node=true`, `allow_registering_model_via_url=false`, `_plugins/_ml/models/_search` 0건.
- query-insights `top_queries-2026.09.04` 1,000건 파싱 → `multi_match` / `match_bool_prefix` 0건(전부 브라우즈).
- 운영 응답: `GET /api/v1/search?q=kafka` → `500 INTERNAL_ERROR`. `GET /api/search/attractions?keyword=궁궐&lang=ko` →
  190건, 상위 창경궁 · 경복궁 · 덕수궁 · 경희궁 · 경희궁 흥화문(유사어 줄 효과).
- 선례: `place/app/…/AttractionLinkInternalController.kt`(`/internal/attractions/links/{pending,bulk}` — 수집기가 밀어 넣는 모양) ·
  `k8s/base/recommendation-ann/`(v1 사이드카 선례, 이제 안 씀) · `place/ingest/Dockerfile`.

### 8.3 모델 후보 조사 (2026-09-05 조회, 공개 리더보드·모델 카드)

| 모델 | 공개 | 파라미터 / 차원 | 다국어 MTEB v2 | 한국어 검색 IR | 라이선스 |
|---|---|---|---|---|---|
| harrier-oss-v1-27b | 2026-03-30 | 27B / 5376 | 74.3 | — | MIT |
| Qwen3-Embedding-8B | 2025-06 | 8B / 4096 MRL | 70.58 | — | Apache-2.0 |
| Qwen3-Embedding-4B | 2025-06 | 4B / 2560 MRL | 69.45 | 81.4 | Apache-2.0 |
| harrier-oss-v1-0.6b | 2026-03-30 | 0.6B / 1024 | 69.0 | — | MIT |
| harrier-oss-v1-270m | 2026-03-30 | 270M / 640 | 66.5 | — | MIT |
| Qwen3-Embedding-0.6B | 2025-06 | 0.6B / 1024 | 64.34 | 75.9 | Apache-2.0 |
| multilingual-e5-large-instruct | 2024 | 560M / 1024 | 63.22 | 77.3 | MIT |
| embeddinggemma-300m | 2025-09-04 | 308M / 768 MRL | 61.15 | 78.2 | Gemma 약관 |
| bge-m3 | 2024 | 568M / 1024 | 59.56 | 79.3 | MIT |
| snowflake-arctic-embed-l-v2.0-ko | 2025 | 568M / 1024 | — | **82.1** | Apache-2.0 |
| PIXIE-Rune-v1.0 | 2025 | 0.5B / 1024 | — | 81.6 | Apache-2.0 |
| KURE-v1 | 2024-12 | 568M / 1024 | — | 80.8 | MIT |
| granite-embedding-97m-multilingual-r2 | 2026-04-29 | 97M / 384 | 검색 60.3 | — | Apache-2.0 |
| jina-embeddings-v5-text-{small,nano} | 2026-02-18 | 677M·239M | 67.7 · 65.5 | 80.3 · — | **CC BY-NC** (제외) |
| KURE-v2 | 2026-09-01 | 154M / 128×토큰 | — | 0.816 nDCG | Apache-2.0 (**다중 벡터**, 제외) |

출처: codesota MTEB 표(2026-05-17) · HF 모델 카드(`microsoft/harrier-oss-v1-*`, `Qwen/Qwen3-Embedding-*`, `google/embeddinggemma-300m`,
`dragonkue/snowflake-arctic-embed-l-v2.0-ko`, `telepix/PIXIE-Rune-v1.0`, `ibm-granite/granite-embedding-97m-multilingual-r2`, `nlpai-lab/KURE-v2`,
`jinaai/jina-embeddings-v5-text-*`) · `github.com/OnAnd0n/ko-embedding-leaderboard`(v2, IR 전용 nDCG@5·10) · MTEB 결과 저장소 커밋(2026-09-04 기준).
6~9월 신작 중 소형 다국어 텍스트 임베딩은 없었다(Giga-Embeddings 는 러시아어 중심, Nano-Em1 은 영어 전용).
