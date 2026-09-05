# 통합 검색 + 임베딩 하이브리드 — 작업 플랜

- 작성: 2026-09-05
- 결정 문서: `docs/adr/ADR-0090-unified-search-hybrid-embedding.md` — **P0 에서 작성한다. §2 가 그 초안이다.**
- 선행 결정: ADR-0051 트랙 C(벡터는 별도 ADR) · ADR-0055(OpenSearch 3.3.0, raw 클라이언트) · ADR-0065 §7(임베딩은
  로컬 모델·ETL 타임으로 확정, 쿼리 인코더는 free-tier 마진 재계산 후 — OQ-5) · ADR-0046(Python 사이드카 선례) ·
  ADR-0058(배치는 CronJob, 새 상주 파드는 사유를 적는다) · ADR-0025(검색 P99 300ms)
- 실측 시점: 2026-09-05 — 노드·인덱스·플러그인·API 응답은 **운영 클러스터**, 모델 벤치는 **로컬 arm64 Docker 1코어**(§8)

**한 줄**: 서비스 전체를 한 검색창에서 찾게 한다. OpenSearch 의 BM25 위에 **로컬 임베딩 사이드카(multilingual-e5-small
int8)** 가 만든 벡터 레그를 `hybrid` 질의로 얹는다. 먼저 관광지에서 효과를 재고(P1), 그 다음 통합 인덱스와 화면을 올린다(P2).

---

## 0. 결론 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| 임베딩 실행 위치 | **Python 사이드카 `search-embed`** (FastAPI + onnxruntime). 모델은 CI 빌드 타임에 이미지로 굽는다 — 클러스터 egress 0 | §2.2 — OpenSearch 안(ml-commons)은 런타임 다운로드·메모리·단일 파드 결합이 걸리고, JVM 내장은 모델을 두 JVM 에 두 번 싣는다 |
| 모델 | **`intfloat/multilingual-e5-small` int8 ONNX, 384차원, MIT**. `e5-base` · `bge-m3` · `Qwen3-Embedding-0.6B` 는 승격 후보 | §2.3 — 1코어 arm64 실측: 질의 2.4ms · 문서 52건/s · RSS ≤586Mi |
| 벡터 저장·검색 | OpenSearch **`knn_vector`(lucene HNSW) + `hybrid` 질의 + RRF 파이프라인**. 플러그인은 이미 설치돼 있다 | §1.1 · §2.5 |
| 임베딩 시점 | **색인 타임(새벽 배치)** + 질의 타임(짧은 문장 1건, Redis 캐시). **자동완성은 벡터를 쓰지 않는다** | §2.4 · §2.5 |
| 재계산 회피 | 문서마다 `embeddingHash` — 재색인이 **이전 alias 에서 벡터를 이어받고** 바뀐 문서만 인코딩한다 | §2.4 — 매일 6만 건을 다시 계산하지 않는다 |
| 통합 인덱스 | 별도 `unified` 인덱스, 문서 계약 1개 + `type` 필드. 관광지·지역·상품·개념·글·게임·혜택·서비스 | §2.4 |
| 순서 | P0 측정·ADR → P1 사이드카 + 관광지 하이브리드(플래그 기본 off) → P2 통합 인덱스·API·화면 → P3 평가·증분·승격 | §3 |
| 무료 티어 | 상시 파드 +1(요청 512Mi / 한도 1Gi, CPU 한도 1코어), OpenSearch 한도 1.5→2Gi 여지. **병목은 메모리가 아니라 CPU(실측 84%)** | §1.4 · §2.6 |

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
| 블로그 글 `blog_post` | `blog_post` 6 | 없음 (카테고리·저자 목록만). blog CLAUDE.md: "글이 쌓이기 전 색인 파이프라인은 유지비만" | blog.1989v.com |
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
`조용한 사찰`, 영문 질의로 국문 문서(§2.3 정성 표).

질의 로그: query-insights 가 `top_queries-*` 를 매일 쌓지만(일 340~850건) 지연 상위만 남겨 **1,000건을 파싱해도
키워드 질의가 0건**(전부 `match_all` + 필터 브라우즈)이다. 관광지 검색은 impression/click 도 발행하지 않는다
(`application/attraction` 에 로깅 없음). 판정 세트를 로그에서 부트스트랩할 수 없고 P1 은 수동 판정으로 간다(§4).

### 1.4 노드 예산 (운영 `kubectl top node` · `describe node`)

| 항목 | 값 |
|---|---|
| CPU | 4코어 (Ampere A1, aarch64) — 사용 **3.39코어 (84%)**, requests 2.78코어 (69%) |
| 메모리 | 24Gi — 사용 12.9Gi (53%), requests 10.5Gi (43%), limits 20.7Gi (86%), OS available 10.5GB |

메모리는 남고 **CPU 가 빠듯하다**. 임베딩은 CPU 작업이므로 대량 계산은 새벽 배치에 1코어 한도로 묶고, 질의 타임은
짧은 문장 1건만 계산한다. `k8s/CLAUDE.md` 의 "동시 롤아웃 폭주" 는 그대로 위험이다 — 첫 채움 Job 을 롤아웃과 겹치지 않게 돌린다.

---

## 2. 결정 (ADR-0090 초안)

### 2.1 구조

```
          질의 타임                                         색인 타임 (CronJob, KST 04:30 →)
portal-fe ─/api/search/*─▶ gateway ─▶ search:app             search:batch  (reindex tasklet)
                                        │                       │ place · blog · game · concept · … API 풀스캔
                                        │ POST /embed           │ embeddingText → sha256
                                        │ (kind=query, ≤100ms)  │ 현재 alias 에서 mget → hash 같으면 벡터 이어받기
                                        ▼                       │ 새 문서만 POST /embed (kind=passage, batch 32)
                                   search-embed ◀───────────────┘
                                   FastAPI + onnxruntime         │ bulk → attractions_YYYY… / unified_YYYY…
                                   e5-small int8 (이미지 내장)     ▼
                                        │                     OpenSearch 3.3.0 ── alias swap
                                        ▼                     hybrid[ function_score(BM25) , knn(embedding) ]
                                   질의 벡터 캐시 (Redis 24h)       + search pipeline `hybrid-rrf`
```

- **앱이 주도한다.** search:app 이 질의 벡터를 받아 `knn` 하위 질의를 직접 만든다. OpenSearch 는 모델을 모른다.
- **사이드카가 죽으면 BM25 만으로 답한다**(폴백 카운터). 검색 경로가 사이드카에 하드 의존하지 않는다.
- 프리픽스(`query: ` / `passage: `)는 사이드카가 `kind` 로 붙인다 — **색인과 질의가 같은 함수를 타야 한다**
  (자모 때 배운 것: 한쪽만 바뀌면 조용히 아무것도 안 맞는다).

### 2.2 왜 이 모양인가

| 옵션 | 내용 | 판정 |
|---|---|---|
| A. OpenSearch 안에서 — ml-commons 로컬 모델 + neural-search + ingest `text_embedding` | 코드가 가장 적다. `neural` 질의가 알아서 인코딩 | ✗ 지금은 아니다. 모델·DJL 네이티브를 **런타임에 내려받는다**(default-deny egress, `allow_registering_model_via_url=false`), `only_run_on_ml_node` 를 꺼야 하고, 모델이 OpenSearch 파드(한도 1.5Gi, heap 512m) 안에서 돈다 — 검색 엔진과 모델의 장애·메모리가 한 파드에 묶인다. 노드가 늘면 재검토 |
| **B. Python 사이드카 + 앱 주도 hybrid** ★ | ADR-0046 `recommendation-ann` 과 같은 모양. 모델은 CI 빌드 타임에 이미지로 | ✓ egress 0, 파드 +1. 폴백·캐시·이어받기를 앱이 쥔다. 모델 교체가 JVM 재배포와 분리된다 |
| B′. 사이드카를 ml-commons remote connector 로 등록 | OpenSearch 가 사이드카를 부른다(ingest 파이프라인이 자동 인코딩) | ✗ 재색인마다 6만 건을 다시 인코딩(이어받기 불가), OpenSearch 파드에 egress NP 추가, 사이드카 실패 시 bulk 통째 실패 |
| C. JVM 내장 — onnxruntime-java + DJL tokenizers | 파드를 안 늘린다 | ✗ search:app · search:batch **두 JVM** 에 모델(+300~500Mi)·네이티브가 실리고 질의 스레드와 CPU 를 다툰다. 파드 수가 제약이 되면 재검토 |
| D. Ollama / llama.cpp 서버 | 범용 | ✗ RSS 가 크고 필요 이상의 일반성 |

### 2.3 모델

로컬 arm64 Linux, **1 CPU 한도** Docker(`--cpus 1`)에서 잰 값. M 시리즈 코어라 **Ampere A1 은 이보다 느리다** — 배수는
P0-2 에서 노드 실측으로 채운다.

| 모델 (int8 ONNX) | 파일 | 차원 | 질의 p50 / p95 | 문서 처리량 (96토큰, batch 16, len≤256) | max RSS |
|---|---|---|---|---|---|
| **multilingual-e5-small** (1 thread) | 118MB | 384 | **2.4 / 3.1 ms** | **52 건/s** | 586Mi |
| multilingual-e5-small (2 thread) | 118MB | 384 | 1.5 / 2.1 ms | 46 건/s | 570Mi |
| multilingual-e5-base (1 thread) | 279MB | 768 | 6.9 / 8.5 ms | 18 건/s | 854Mi |

같은 스크립트의 정성 결과 — 후보 10건(관광지 8 + 상점·식당 2) 안에서 코사인 순위:

| 질의 | e5-small 상위 | 읽히는 것 |
|---|---|---|
| `궁궐` | 창덕궁 .843 · **경복궁 .829** · 한복남 경복궁점 .812 | **사전 없이** 궁이 위로 온다. 다만 상점과 차이가 작다 → 분류 가중치는 그대로 둔다 |
| `한옥` | 한옥 생고기(food) .874 · 북촌한옥마을 .860 | 벡터만으로는 BM25 와 같은 실패(base 는 마을이 위). **hybrid + 분류 가중치**가 필요하다는 근거 |
| `바다가 보이는 곳` | 해운대해수욕장 .825 | 사전에 없는 의미 질의가 맞는다 |
| `아이와 갈만한 곳` | 롯데월드 .838 | 〃 |
| `palace in seoul` | Gyeongbokgung Palace(en) .886 | 언어 교차 |
| `조용한 사찰` | 불국사 .809 | 〃 |
| `한복 대여` | 한복남 경복궁점 .882 | 상점이 정답인 질의는 상점이 위 |

- 코사인이 0.75~0.88 에 몰린다 → 점수 임계값이 아니라 **순위 융합(RRF)** 을 쓴다.
- 선택: **e5-small 기본**. 질의 ~3ms · 문서 52건/s 면 6만 건 첫 채움이 1코어 ~20분(M 시리즈)이고 Ampere 가 3배
  느려도 새벽 1시간 안이다. base 는 처리량 1/3 · RSS 0.85Gi 로 첫 채움이 시간 단위가 된다 — P3 승격 후보.
- `Qwen/Qwen3-Embedding-0.6B`(로컬 HF 캐시에 이미 받아 둔 것) · `BAAI/bge-m3` 는 파라미터가 5배라 CPU 질의 100ms+ ·
  RSS 1.5Gi+ 로 **추정**된다 — 무료 티어에서는 보류. 한국어 미세조정 e5-small 변종이 HF 에 여럿 있으니 P0 후보에 넣어
  같은 스크립트로 잰다.
- 라이선스: e5 계열 MIT. `docs/architecture/data-sources.md` 에 모델 출처·라이선스 한 줄을 남긴다(출처표시 대장 원칙).

### 2.4 색인 설계

**P1 — `attractions` 에 벡터 필드 추가** (`search/batch/src/main/resources/opensearch/attractions-index.json` 이 SSOT):

```json
"settings": { "index": { "knn": true }, "analysis": { "...기존 그대로" } },
"mappings": { "properties": {
  "embedding":      { "type": "knn_vector", "dimension": 384, "space_type": "cosinesimil",
                      "method": { "name": "hnsw", "engine": "lucene",
                                  "parameters": { "m": 16, "ef_construction": 128 } } },
  "embeddingHash":  { "type": "keyword", "index": false },
  "embeddingModel": { "type": "keyword" }
} }
```

- 엔진은 **lucene** — 6만~100만 건에 충분하고 `knn.filter`(lang · category)를 효율적으로 건다. k-NN 네이티브 캐시를
  안 쓰므로 heap 512m 을 건드리지 않는다.
- 벡터 원본은 `_source` 에 남긴다(이어받기용). 질의 응답은 앱이 `_source.excludes=[embedding]` 로 뺀다.
- **임베딩 텍스트는 결정적 한 함수**: `title · titleLocal · 분류 한국어명(history→역사 …) · address · overview(앞 1,000자)`.
  e5 는 512 토큰에서 자른다 — 제목이 앞에 온다. 개요가 없는 5.6만 건도 이름·분류·주소만으로 의미가 잡힌다(§2.3 후보가 그 모양).
- `embeddingHash = sha256(model + "\n" + text)`. 재색인 tasklet 은 문서를 만들기 전에 **현재 alias 에서 id 로 mget** 해
  hash 가 같으면 벡터를 그대로 싣고, 다를 때만 사이드카를 부른다. 매일 바뀌는 건 개요 2,000건 안팎(ADR-0070) →
  일일 인코딩 수 분.
- `embeddingModel` 이 다른 문서가 섞이지 않는다: 모델을 바꾸면 전체 재색인 후 alias swap. 앱은 사이드카 `/info` 의
  모델명과 인덱스 문서의 값이 다르면 벡터 레그를 끈다(공간이 다른 벡터를 섞지 않는다).
- 읽기 클래스 `AttractionSearchDocument` 는 세 필드를 읽지 않는다 → 루트 `build.gradle.kts` `searchReadOmitted` 에
  이유를 적어 `verifySearchIndexContract` 를 통과시킨다(쓰기 클래스는 정확히 일치해야 한다).

**P2 — `unified` 인덱스** (alias `unified`, 실체 `unified_YYYYMMDDHHmmss`, 계약은 `unified-index.json`):

| 필드 | 타입 | 채우는 규칙 |
|---|---|---|
| `id` | keyword | `{type}:{sourceId}` |
| `type` | keyword | `attraction · region · product · concept · blog_post · game · deal_offer · service` — wishlist 의 대상 타입(`PRODUCT/GAME/ATTRACTION/BLOG_POST`)과 이름을 맞춘다 |
| `sourceId`, `slug` | keyword | 원천 식별자. **URL 은 굽지 않는다** — FE 가 `portal-fe/src/shell/serviceHref.ts` 로 호스트를 조립한다 |
| `lang` | keyword | ko / en (관광지만 en 문서가 따로 있다) |
| `title` (+`.en`, `.keyword`), `titleJamo` | text | attractions 와 같은 분석기·자모 |
| `summary`, `body` | text (nori / `.en`) | 글은 마크다운→평문(코드 펜스 · `<svg>` · HTML 제거), 게임은 description, 개념은 description |
| `category`, `tags` | keyword | 관광지 분류 / 글 categoryPath / 게임 genre·tags / 개념 category·level |
| `popularity` | float | 타입별 log1p 정규화 — 관광지 popularityScore, 게임 playCount, 글 viewCount, 나머지 0 |
| `publishedAt` | date | 글·게임 |
| `location` | geo_point | 관광지만 |
| `thumbnailUrl` | keyword (index=false) | |
| `embedding`, `embeddingHash`, `embeddingModel` | 위와 동일 | **관광지 벡터는 `attractions` alias 에서 id 로 이어받는다** — 두 번 계산하지 않는다 |

원천은 전부 **공개 API 풀스캔**(`PlaceApiClient` 패턴): place `/api/places/attractions` · `/api/places/regions/page`,
`/api/v1/blog/posts`(+`/posts/{slug}` 로 body), `/api/v1/games`(+`/{slug}` 로 description), `/api/v1/concepts`,
`/api/v1/deal/sections`, `/api/v1/display/services`, product API. 이력서는 넣지 않고(ADR-0064), 비밀 게임은 카탈로그에
없어 구조적으로 빠진다(ADR-0089).

### 2.5 질의 설계

- **하이브리드는 키워드가 있고 관련도 정렬일 때만.** 거리순 · 필터만 브라우즈(`match_all`)는 그대로 둔다.
- 하위 질의 둘: ① 기존 `multi_match`/`bool` 을 `function_score`(분류 가중치)로 감싼 것 ② `knn { embedding, vector,
  k: 100, filter: lang·category }`. 두 레그에 **같은 분류 가중치**를 건다 — 정규화가 레그별이라 레그 안 순위에만
  영향을 주고, 그것이 원하는 효과다(§2.3 `한옥`). 안 먹으면 앱 후처리(`pagination_depth` 안에서 재가중) — P0-4 가 정한다.
- 융합: search pipeline **`hybrid-rrf`**(`score-ranker-processor`, `rank_constant=60`) 기본. `normalization-processor`
  (`min_max` + `arithmetic_mean`, weights) 를 변형으로 두고 판정 세트로 고른다. 파이프라인 JSON 은 search:app 리소스에
  두고 기동 시 idempotent PUT — 질의 타임 산출물이라 app 이 소유한다.
- 설명: `hybrid_score_explanation` 응답 프로세서는 `/api/v1/search/debug` 경로에서만 켠다.
- 질의 벡터: `POST /embed {texts:[q], kind:"query"}` 타임아웃 100ms, 연속 실패 N회면 30초 건너뜀. Redis 캐시
  `search:embed:{model}:{sha1(정규화 q)}` 24h — search:app 은 밴딧 상태로 이미 Redis 를 쓴다.
- **자동완성(suggest)은 벡터를 쓰지 않는다.** 키 입력마다 인코딩하면 CPU 를 태우고 `경보` 같은 조합 중간 상태는 의미가
  없다. 접두 · 자모 · 지역 슬롯은 그대로.
- 지연 예산: 검색 P99 300ms(Tier 1). 인코딩 ≤10ms(Ampere 추정) + 6만 건 HNSW 는 수 ms. P1 에서 전/후 P99 를 남긴다.

### 2.6 무료 티어 계정

| 항목 | 추가분 | 근거 |
|---|---|---|
| `search-embed` 파드 | requests 512Mi / limits 1Gi, cpu requests 100m / **limits 1000m** | tier S. RSS 실측 ≤586Mi(다운로드 버퍼 포함, 런타임은 더 작다). CPU 한도로 새벽 배치가 한 코어를 넘지 못한다 |
| OpenSearch | 벡터 60k × 384 × 4B ≈ 92MB(+HNSW ~15%) × 인덱스 2종 × 세대 2 → 페이지캐시 ~0.4Gi | 한도 1536Mi → 2Gi 로 올릴 여지. heap 512m 유지. PVC 3Gi 안 |
| 배치 | 첫 채움 6만 건: 1코어 ~20분(M 시리즈) — Ampere 는 P0-2 실측. 이후 매일 수 분 | `attraction-reindex` 의 `activeDeadlineSeconds 1800` 은 첫 채움엔 부족 → 첫 채움은 별도 수동 Job(7200) |
| 질의 | 건당 ~3ms(M 시리즈), 캐시 적중 0 | 현재 트래픽(일 수백 건)에서 무시 가능 |
| 이미지 | 런타임 ≈ 400MB(slim + onnxruntime + tokenizers + 모델 118MB). **torch 는 빌더 스테이지에만** | OCIR 무료 10GB |

합계: 메모리 requests +0.5Gi(미요청 잔여 13.5Gi), CPU 는 새벽 1코어. ADR-0065 가 미뤄 둔 **OQ-5(쿼리 타임 인코딩)는
이 수치로 닫는다** — `docs/specs/2026-08-11-k-tour-search/open-questions.yml` 갱신은 P1-9.

### 2.7 하지 않는 것

- 본문 청킹(nested 벡터) — 글이 6건이다. 글이 50건을 넘거나 긴 본문 리콜 문제가 측정되면 P3.
- 크로스인코더 리랭커 · LTR — CPU. ADR-0051 트랙 B 의 몫.
- ml-commons 로컬 모델 — §2.2 A.
- Kafka 증분 색인 — 글·게임 변경이 드물다. 새벽 재색인 + 온디맨드 Job 으로 시작하고 "다음날 반영" 이 문제로 측정되면
  P3(`blog.post.published` 등 토픽 신설 + search-consumer upsert).
- 자동완성 벡터화, 이력서 · 비밀 게임 색인, 검색 결과 페이지 색인(`/search` 는 noindex).

---

## 3. 단계

동작 변화는 **플래그 뒤에** 두고 배포한다. 단계마다 이미지가 새로 구워지는 모듈을 적는다 — `images.yml` 테스트 게이트가
한 모듈 실패로 그 커밋의 **모든** 이미지를 막는다. 여러 세션이 워킹트리를 공유하므로 `git add` 는 경로로 좁힌다.

### P0 — 측정과 결정 (1~2일)

| # | 할 일 | 산출물 / 증거 |
|---|---|---|
| P0-1 | ADR-0090 작성(Proposed) — §2 를 옮긴다. 번호는 `ls docs/adr \| sort \| tail` 로 재확인(중복 사고 전례) | `docs/adr/ADR-0090-unified-search-hybrid-embedding.md` |
| P0-2 | **노드 실측** — §8.1 스크립트를 OCI 호스트에서 `python3 -m venv` + `taskset -c 0` 으로 1코어 실행(클러스터 밖, CPU 만 재면 된다). e5-small / e5-base / 한국어 변종 1개 | §2.3 표에 "Ampere 1코어" 열. 게이트: 질의 p95 < 30ms · 문서 ≥ 15건/s · RSS < 600Mi |
| P0-3 | **k-NN 스크래치 인덱스** — 6만 건 정규화 난수 벡터로 `attractions_knn_probe` 를 만들고 `_nodes/stats/indices/segments` · 컨테이너 RSS · knn 질의 지연을 잰다. 끝나면 삭제 | OpenSearch 512m/1536Mi 유지 가능 여부 → 한도 결정 |
| P0-4 | **hybrid 스파이크**(같은 인덱스) — `hybrid[function_score(bool), function_score(knn)]` + `hybrid-rrf` 파이프라인이 3.3.0 에서 먹는지, `knn.filter` · `from/size` · `sort: [_score, idSort]` 타이브레이커 · `explain` 동작 | 안 되는 것은 §2.5 의 앱 후처리로 확정해 ADR 에 적는다 |
| P0-5 | **판정 세트 v0** — 핸드오프 4쿼리 + 의미 질의 20개를 **사람이** 상위 5를 판정해 파일로. 검사의 근거가 검사 밖에 있어야 한다 | `docs/specs/2026-09-05-unified-search/judgments.yml` |

이미지 영향: 없음.

### P1 — 임베딩 사이드카 + 관광지 하이브리드 (플래그 기본 off)

| # | 할 일 | 파일 |
|---|---|---|
| P1-1 | `search/embed/` — FastAPI. `POST /embed {texts[≤64], kind: query\|passage}` → `{model, dim, vectors}`, `GET /info`, `GET /actuator/health/{readiness,liveness}`(recommendation-ann 과 같은 경로). **2단 Dockerfile**: 빌더가 HF 에서 ONNX int8 을 받고, 런타임엔 `onnxruntime` · `tokenizers` · `numpy` · `fastapi/uvicorn` 만. `EMBED_THREADS=1`. pytest: 프리픽스 · 차원 · 정규화(‖v‖≈1) · 64건 상한 · 512토큰 절단 | `search/embed/{app.py,pyproject.toml,Dockerfile,tests/}` |
| P1-2 | 배포 — `k8s/base/search-embed/{deployment,service,serviceaccount,kustomization}.yaml` + base `kustomization.yaml` 한 줄 + NP `19-allow-search-to-embed.yaml`(search · search-batch 파드 → 8000, `15-allow-recommendation-to-ann.yaml` 복제) + oci-arm `images:` 항목 · `resources-s-512mi` 타깃 · sync-wave 패치 | `k8s/base/…`, `k8s/overlays/oci-arm/kustomization.yaml` |
| P1-3 | CI — `images.yml` 세 곳: `ALL_DOCKER` 에 `search-embed`, 경로 규칙 `search/embed/*` 를 **`search/app/*` 규칙보다 위에**(place-ingest 와 같은 순서 함정), `DOCKER_CTX[search-embed]="search/embed"`. `scripts/image-import.sh` 로컬 로드 | `.github/workflows/images.yml`, `scripts/image-import.sh` |
| P1-4 | 매핑 — `attractions-index.json` §2.4 + `AttractionIndexDocument` 3필드 + `searchReadOmitted["attractions"]` 3줄(이유 포함) | `search/batch/src/main/resources/opensearch/attractions-index.json`, `build.gradle.kts` |
| P1-5 | 도메인 — `EmbeddingText.ofAttraction(doc)`(결정적 문자열) + `EmbeddingHash` — `Jamo` 옆, 순수 Kotlin, 테스트 | `search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/` |
| P1-6 | 배치 — `application/.../port/EmbeddingPort` + `infrastructure/client/EmbedHttpAdapter`(WebClient, batch 32, 30s, 재시도 3) + `AttractionApiReindexTasklet` 에 이어받기(mget) → 새 문서만 인코딩 → bulk. 설정 `--embed.enabled`(기본 false), `--embed.first-fill`(mget 생략) | `search/batch/…` |
| P1-7 | 앱 — `EmbeddingPort` + `EmbedHttpAdapter`(100ms, Redis 캐시, 건너뜀 창) + `AttractionSearchAdapter.buildRequest` hybrid 분기 + 파이프라인 보장 + `_source.excludes` + debug explain. 설정 `search.attraction-hybrid.{enabled=false, k=100, fusion=rrf}` | `search/app/…/infrastructure/opensearch/AttractionSearchAdapter.kt` 외 |
| P1-8 | 테스트(Kotest BehaviorSpec + MockK) — 벡터가 있으면 hybrid, 사이드카 실패면 BM25 요청이 나가는지(어댑터가 만든 `SearchRequest` 를 본다), 이어받기(해시 같으면 포트 호출 0회) | `search/app/src/test`, `search/batch/src/test` |
| P1-9 | 문서 — `search/CLAUDE.md`(모듈 표에 embed, 인덱스 계약 표 21→24 필드), `data-sources.md` 모델 행, k-tour open-questions OQ-5 close, 핸드오프 갱신 | |

**검증 — 이 순서로, 값을 남긴다**

1. 게이트가 실제로 무는지: 매핑에서 `embeddingHash` 를 잠깐 지워 `./gradlew verifySearchIndexContract` 가 **빨간불**인 것을 본 뒤 복구.
2. `./gradlew :search:domain:test :search:app:build :search:batch:build` + `pytest search/embed`.
3. 배포 후 `search-embed` readiness, `curl search-embed:8000/info` 의 모델명·차원.
4. 첫 채움: 수동 Job(`--embed.enabled=true --embed.first-fill=true`, deadline 7200) — 소요 · `kubectl top node` · 사이드카 RSS 를
   적는다. 다음 새벽 정규 실행에서 사이드카 호출 수가 개요 증분 수준인지(배치 로그 카운트).
5. `search.attraction-hybrid.enabled=true` 반영 → `scripts/attractions-search-check.py` **6/6 유지** + 판정 세트 v0 로
   BM25 vs hybrid 상위 5 전/후 표 + nDCG@10(스크립트) → 핸드오프에 나란히.
6. 지연: `/api/search/attractions` P99 전/후(프로메테우스 `http_server_requests`), 사이드카 폴백 카운터 0.
7. 롤백: 플래그 off = 이전 동작(매핑 필드가 남아도 무해). 사이드카를 지워도 검색은 깨지지 않는다.

이미지 영향: `search`, `search-batch`, **`search-embed`(신규)**. 주의 — `images.yml` 은 `search/domain/*` 변경을
`search` 이미지에만 매핑한다. 도메인만 고친 커밋은 `search-batch` 를 안 굽는다 → 배치 코드도 같은 커밋에서 바뀌므로
P1 은 괜찮지만, 이후 도메인만 고칠 때는 `gh workflow run images.yml -f services="search-batch"` 로 지정 재빌드.

### P2 — 통합 인덱스 + API + 화면

| # | 할 일 | 파일 |
|---|---|---|
| P2-1 | `unified-index.json` + `UnifiedIndexDocument`(batch) / `UnifiedSearchDocument`(app) + 게이트 맵 항목 | `search/batch/src/main/resources/opensearch/unified-index.json`, `build.gradle.kts` |
| P2-2 | 원천 클라이언트 — `BlogApiClient` · `GameApiClient` · `ConceptApiClient` · `DealApiClient` · `DisplayServiceApiClient`(전부 code-dictionary:8089), 기존 place/product 재사용. NP 가 덮는지(`04-allow-backend-to-backend` · `12-allow-backend-egress-internal`) **실제 호출로** 확인 | `search/batch/…/infrastructure/client/` |
| P2-3 | `UnifiedReindexTasklet` — 타입별 어댑터가 `UnifiedIndexDocument` 를 내고, 관광지 벡터는 `attractions` alias 에서 이어받기, 나머지는 사이드카. `EmbeddingText.ofUnified(type, …)`, 마크다운→평문 함수는 도메인(테스트: 코드 펜스 · svg 제거) | `search/batch/…/infrastructure/job/`, `search/domain` |
| P2-4 | CronJob `unified-reindex` KST 04:45(attraction 04:30 뒤) + 온디맨드 주석 + `part-of` 라벨 · `enabled` 플래그(2026-08-07 배치 교훈) | `k8s/base/search-batch/cronjob-unified-reindex.yaml` |
| P2-5 | 앱 — `application/unified/{usecase,port,service}` + `infrastructure/opensearch/UnifiedSearchAdapter`(hybrid, 타입 facet terms agg, 타입 가중치 `search.unified-ranking.type-weights` 기본 1.0 + 관광지 상점·식당 0.35) + `presentation/unified/controller` → `GET /api/search/unified?q&type&lang&page&size`, `GET /api/search/unified/suggest`(어휘만). **게이트웨이는 `/api/search/**` 가 이미 search 로 간다 — 변경 없음** | `search/app/…` |
| P2-6 | FE — `/search?q=` 페이지(모든 호스트, 호스트 기본 타입 필터: blog→`blog_post`, game→`game`, place→`attraction` …), GNB 검색 버튼을 전 페이지로, 결과 링크는 `serviceHref.ts`, `noindex` 메타 + sitemap 제외, `copy.mjs` WebSite SearchAction 을 `/search?q={search_term_string}` 으로. DESIGN.md 토큰 · 모바일 1순위 · CDP 4조합 | `portal-fe/src/pages/search/`, `components/GNB.tsx`, `App.tsx`, `seo/copy.mjs` |
| P2-7 | `/tech` 검색(운영 500) — 통합 API `type=concept` 로 갈아탄다. code-dictionary 의 OpenSearch 색인 경로는 **보고 후** 정리(보이스카우트 규칙: 발견→보고→승인) | `portal-fe/src/api/searchApi.ts` |
| P2-8 | 노출·클릭 로깅 — `search.impression.logged` / `search.click.logged` 를 unified 에도 발행(`surface` 필드). 판정 세트 부트스트랩의 재료. 토픽 표 갱신 | `search/app`, `docs/architecture/kafka-convention.md` |

**검증**: 타입별 대표 질의 1개씩이 그 타입을 1위로(`scripts/unified-search-check.py`, 기대값은 P0-5 판정에서),
관광지 케이스(`궁궐` · `한옥` …)가 통합에서도 유지, 화면은 CDP 4조합(기기 × 사이트 테마) 값 + 크롭 스크린샷,
`/search` 응답의 noindex 메타·헤더, sitemap 에 `/search` 없음, 첫 채움 소요 · 노드 top.

이미지 영향: `search`, `search-batch`, `portal-fe`.

### P3 — 평가 · 증분 · 승격 (조건부)

- `search-eval-daily` 를 unified/attractions 로 확장 — `OsRankingExecutor` 가 지금은 `products` 고정. 판정 세트
  30→100 질의, nDCG@10 을 ClickHouse 에 적재 → RRF vs min-max · 가중치를 수치로 결정.
- 모델 승격(e5-base / bge-m3 / Qwen3-0.6B) — P0 스크립트를 노드에서 다시 돌려 §2.6 게이트를 넘을 때만.
  `embeddingModel` + alias swap 이라 섞이지 않는다.
- 유사어 사전 축소 — 벡터 레그가 대체한 줄을 지워 보고 판정 세트로 확인.
- Kafka 증분(글 · 게임 발행 이벤트 → search-consumer upsert), 글 본문 청킹, 주유소 타입 — 각각 §2.7 의 조건이 측정됐을 때.

---

## 4. 게이트 — 무엇을 근거로 "됐다"고 말하나

| 게이트 | 근거가 되는 값 | 단계 |
|---|---|---|
| 노드 여력 | Ampere 1코어 질의 p95 · 문서/s · RSS(P0-2), 스크래치 인덱스 RSS(P0-3) | P0 |
| 계약 | `verifySearchIndexContract` 빨간불 → 초록불 | P1 |
| 회귀 | `attractions-search-check.py` 6/6 (hybrid on) | P1 |
| 효과 | 판정 세트 BM25 vs hybrid 상위 5 전/후 표 + nDCG@10 | P1 · P2 |
| 지연 | `/api/search/attractions` P99 전/후 ≤ 300ms | P1 |
| 비용 | 첫 채움 소요, 일일 사이드카 호출 수(증분 수준), 새벽 `kubectl top node` | P1 · P2 |
| 폴백 | 사이드카를 scale 0 으로 내려도 검색 200 + `search.embed.fallback_total` 증가 | P1 |
| 화면 | CDP 4조합 값 + 크롭 스크린샷, noindex | P2 |

검사가 스스로 만든 근거는 근거가 아니다 — 기대값은 P0-5 에서 사람이 적고, 검사는 사용자와 같은 공개 API 를 부른다.

---

## 5. 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| Ampere 처리량이 M 시리즈보다 크게 낮아 첫 채움이 시간 단위 | 1코어 한도 · 새벽 · 별도 Job. 필요하면 첫 채움 벡터를 로컬 arm64 에서 계산해 bulk 로 밀어 넣는다(ADR-0065 §7 이 정한 ETL 타임 방향) |
| hybrid 하위 `function_score(knn)` 가 안 먹거나 `sort`/`from` 의미가 다름 | P0-4 스파이크로 먼저 확인. 대안은 앱 후처리 |
| OpenSearch 메모리 상승(HNSW 페이지캐시) | P0-3 실측 → 한도 2Gi. heap 은 그대로 |
| 사이드카 장애가 **조용한** 품질 저하로 | 폴백 카운터 메트릭 + 알림. 검색은 죽지 않는다 |
| 판정 세트가 사람 20~30 질의라 편향 | P2-8 로깅으로 부트스트랩 재료를 쌓고 P3 에서 확장. 자기충족 위험은 ADR-0050 과 같은 spot-check |
| CI 경로 규칙 순서 | `search/embed/*` 를 `search/app/*` 위에. 배포 확인은 커밋이 아니라 **태그**로(`k8s/CLAUDE.md`) |
| 이미지 크기(OCIR 무료 10GB) | 런타임 이미지에 torch 금지, 모델 118MB 만 |
| 두 인덱스에 관광지 벡터 중복 | id 이어받기로 계산은 1회. 저장 ~0.4Gi 는 PVC 3Gi 안 |
| 글 본문의 svg · 코드가 벡터를 오염 | 평문 변환 함수 + 테스트(blog CLAUDE.md 의 svg 색인 오염 교훈) |
| 첫 채움 Job 이 롤아웃과 겹쳐 CoreDNS 가 굶는다 | Argo sync 가 조용한 시간에 수동 실행, `backoffLimit` 여유(attraction-reindex 주석과 같은 이유) |

---

## 6. 파일 지도

| 무엇 | 어디 |
|---|---|
| 사이드카 | `search/embed/` (신규) |
| 매핑 SSOT | `search/batch/src/main/resources/opensearch/{attractions,unified}-index.json` |
| 계약 게이트 | 루트 `build.gradle.kts` — `searchReadOmitted` / `verifySearchIndexContract` |
| 임베딩 텍스트 · 해시 | `search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/` (`Jamo` 옆) |
| 재색인 | `search/batch/…/infrastructure/job/AttractionApiReindexTasklet.kt`, `UnifiedReindexTasklet.kt`(신규) |
| 질의 | `search/app/…/infrastructure/opensearch/AttractionSearchAdapter.kt`, `UnifiedSearchAdapter.kt`(신규) |
| 파이프라인 | `search/app/src/main/resources/opensearch/hybrid-pipeline.json`(신규) |
| 배포 | `k8s/base/search-embed/`, `k8s/base/network-policy/19-allow-search-to-embed.yaml`, `k8s/base/search-batch/cronjob-unified-reindex.yaml`, `k8s/overlays/oci-arm/kustomization.yaml` |
| CI | `.github/workflows/images.yml` |
| 화면 | `portal-fe/src/pages/search/`, `components/GNB.tsx`, `App.tsx`, `seo/copy.mjs`, `shell/serviceHref.ts` |
| 회귀 | `scripts/attractions-search-check.py`, `scripts/unified-search-check.py`(신규) |
| 판정 세트 | `docs/specs/2026-09-05-unified-search/judgments.yml`(신규) |

---

## 7. 미결 — 사용자 결정

1. 기본 모델: e5-small(추천) vs e5-base — P0-2 Ampere 수치를 보고. 한국어 미세조정 변종을 후보에 넣을지.
2. P2 첫 타입 범위: 추천은 attraction · blog_post · game · concept + 값싼 region · deal_offer · service · product 전부.
3. `/tech` 검색(지금 500)을 통합 API 로 갈아탈지, code-dictionary 자체 인덱스를 살릴지.
4. `/search` 페이지를 모든 호스트에 둘지 apex 만 둘지(추천: 모든 호스트, 호스트 기본 타입 필터).
5. 예산 승인: 상시 파드 +1(512Mi / 1Gi) + OpenSearch 한도 +0.5Gi.

---

## 8. 부록 — 실측 원본

### 8.1 벤치 조건과 스크립트

`docker run --rm --platform linux/arm64 --cpus 1 -m 2g python:3.11-slim`, onnxruntime 1.29.0 (aarch64),
`Xenova/multilingual-e5-{small,base}` 의 `onnx/model_quantized.onnx`, 질의 20개 단건, 문서 128건(96토큰) batch 16
max_len 256, mean pooling + L2 정규화. **P0-2 는 이 스크립트를 그대로 노드에서 돌린다** (`pip install onnxruntime tokenizers
huggingface_hub numpy`).

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
    out = sess.run(None, feed)[0]                       # (B, L, H) last_hidden_state
    m = mask[..., None].astype(np.float32)
    pooled = (out * m).sum(1) / np.maximum(m.sum(1), 1e-9)   # mean pooling (e5)
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

정성 표(§2.3)는 같은 `embed` 로 후보 10건을 `passage:` 로, 질의를 `query:` 로 인코딩해 코사인 내림차순으로 얻었다.

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
- 선례: `k8s/base/recommendation-ann/`(FastAPI + onnxruntime + FAISS, 512Mi/1Gi, PVC 모델) ·
  `k8s/base/network-policy/15-allow-recommendation-to-ann.yaml` · `place/ingest/Dockerfile`(python:3.11-slim).
