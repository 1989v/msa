# 통합 검색 — 이어받기 문서 (2026-09-06)

> 다른 세션이 **이 문서만 읽고** 이어받을 수 있게 쓴다. 컴팩션 직후에도 여기서 다시 시작한다.
> 결정은 `docs/adr/ADR-0090-unified-search-hybrid-embedding.md`, 설계는 `docs/plans/2026-09-05-unified-search-hybrid-embedding.md`(v2),
> 엔티티는 `docs/specs/2026-09-05-unified-search/embedding-entities.md`.

**한 줄**: P0(측정·결정) 끝. 모델은 **`snowflake-arctic-embed-l-v2.0-ko`** 로 확정됐고, 다음은 **P1 구현**(place 벡터 표 → 도구 → 재색인 → 사전 → hybrid).

---

## 1. 지금 어디까지

| 단계 | 상태 | 근거 |
|---|---|---|
| P0-1 ADR | ✅ Proposed → **Accepted 승격 필요**(모델이 정해졌으므로) | `docs/adr/ADR-0090-*.md` |
| P0-2 판정 세트 | ✅ 872건 전부(사람 113 + LLM 초안 759, `by:` 로 출처 기록) | `docs/specs/2026-09-05-unified-search/judgments.yml` |
| P0-3 모델 비교 | ✅ 5모델 × 전 코퍼스/후보재순위 | 플랜 §8.9 · §8.11 |
| P0-4 k-NN 메모리 | ✅ 로컬 Docker 실측 | 플랜 §8.4 |
| P0-5 hybrid 스파이크 | ✅ 8케이스 중 `sort` 타이브레이커만 불가 | 플랜 §8.5 |
| P0-6 모델 확정 | ✅ **arctic-ko** (ko 0.7404 / en 0.7773) | 플랜 §8.11 |
| — 차원 512 vs 1024 | ⏳ **미측정** — 메모리는 둘 다 되므로 nDCG 로만 결정. P1 첫 채움 때 | — |
| P1-1 place 벡터 표·API | ✅ **완료** (V12 · 도메인 10 + 서비스 12 테스트 · 게이트 통과) | `place/` |
| P1-2 도구 나머지 | ✅ **완료** (docs·queries·push·tunnel + 코덱/클라이언트, pytest 57) | `tools/embed/` |
| P1-3 재색인 벡터 적재 | ✅ **완료** (매핑·쓰기 클래스·lookup·tasklet, 테스트 21) | `search/batch/` |
| P1-4 질의 사전 | ✅ **완료** (도메인·인덱스·서비스·어댑터 2·내부 API, 테스트 95) | `search/app/`, `search/domain/` |
| P1-5 hybrid 분기 | ✅ **완료** (질의 조립·파이프라인·설정·메트릭, 테스트 71) | `search/app/` |
| P1-6~9 | ⏳ 다음 — **첫 채움이 남은 큰 것** | §3 |

## 2. 이 작업의 물리적 위치 — 먼저 읽을 것

> [!warning] 공유 워킹트리에서 작업하지 않는다
> `~/IdeaProjects/msa` 는 여러 세션이 동시에 쓴다. 2026-09-05 에 **스테이지만 한 새 파일이 다른 세션의 `pull --rebase` 로 사라졌고**,
> 커밋 전 컴파일 훅이 남의 미커밋 코드 때문에 내 문서 커밋을 막았다. 그래서 **별도 worktree** 에서 작업한다.
>
> ```bash
> git worktree add --detach <scratchpad>/msa-docs origin/main
> cd <scratchpad>/msa-docs      # 여기서 편집·커밋
> git push origin HEAD:main     # 공유 트리는 리베이스하지 않는다
> ```

| 무엇 | 어디 | 다시 만드는 비용 |
|---|---|---|
| 작업 worktree | `<scratchpad>/msa-docs` (origin/main 기준, detached) | 즉시 |
| Python 환경 | `<scratchpad>/p0venv` (`uv venv`, sentence-transformers·torch·pyarrow) | ~3분 |
| 코퍼스 캐시 | `<scratchpad>/p0/pool/corpus_{ko,en}.json` (ko 56MB · en 20MB) | ~1분 (공개 API 풀스캔) |
| **전 코퍼스 풀링** | `<scratchpad>/p0/pool/pool_{ko,en}_{e5-small,arctic-ko,harrier-270m}.json` | **~35분** (arctic ko 13분 + harrier ko 9분 + …) |
| **후보 재순위** | `<scratchpad>/p0/rerank/rerank_ko_*.json` (5모델) | **~20분** (8B 11분 + 4B 6분 + …) |
| 판정 페이지 | `~/Desktop/1989v-search-judge.html` (생성물, 레포에 없음) | 즉시 (`embed.review html`) |
| 모델 가중치 | `~/.cache/huggingface/hub/` (8B 는 14GB) | 다운로드 시간 |

`<scratchpad>` = `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/<세션id>/scratchpad`.
**세션이 바뀌면 스크래치패드도 바뀐다** — 위 산출물이 필요하면 새 세션에서 다시 만들거나, 이어받기 전에 복사해 둔다.

## 2-1. 커밋은 어디 있나 (temp 가 날아가도 살아남는 곳)

worktree 는 detached HEAD 라 그 디렉터리가 지워지면 커밋이 unreachable 이 되어 gc 대상이 된다.
그래서 **본 레포에 이름 붙은 브랜치로 고정해 뒀다**:

```bash
git -C ~/IdeaProjects/msa log --oneline main..unified-search-embedding   # 이 작업의 전 커밋
```

worktree 를 잃었으면 여기서 되살린다:
```bash
git worktree add --detach <새 경로> unified-search-embedding
```
**커밋을 새로 쌓았으면 브랜치를 다시 당겨 둔다** — 안 하면 새 커밋만 다시 매달린 상태가 된다:
```bash
git -C ~/IdeaProjects/msa branch -f unified-search-embedding "$(git -C <worktree> rev-parse HEAD)"
```

## 3. 다음에 할 일 — P1 (순서대로)

플랜 §3 의 P1-1~P1-9. 각 항목의 상세는 `embedding-entities.md`.

1. ~~P1-1 place 벡터 표~~ ✅ **완료 (2026-09-06)** — `V12__create_attraction_embedding.sql`, 도메인(`EmbeddingModelRef`·`AttractionEmbedding`·`EmbeddingText`),
   포트·서비스·JPA 어댑터, `/internal/attractions/embeddings/{pending,bulk,lookup,status}` + `DELETE`.
   테스트 22(도메인 10 · 서비스 12), `verifyLayerDependencies`·`verifyFlywayWiring` 통과. **아직 배포 안 됨**(푸시 대기)
2. ~~**P1-2 tools/embed 나머지**~~ ✅ **완료 (2026-09-06)** — `vectors.py`(float32 LE base64 코덱) · `client.py`(내부 API + 재시도 규칙) ·
   `docs.py`(pending → 해시 비교 → touch/임베딩 → bulk) · `queries.py`(시드·미적중) · `push.py`(parquet 첫 채움) · `tunnel.sh`(port-forward).
   **`queries.py` 가 부르는 `/internal/query-vectors/**` 는 P1-4 에서 만든다** — 그때까지 404 다(계약은 스펙 §3.4 에 고정).
3. ~~**P1-3 search:batch**~~ ✅ **완료 (2026-09-06)** — `attractions-index.json` 에 `knn: true` + `embedding`(knn_vector **d1024** · cosinesimil · lucene hnsw m16/ef128)
   ·`embeddingModel`·`embeddingHash`, 쓰기 클래스 3필드, `searchReadOmitted` 3줄, `PlaceApiClient.lookupEmbeddings`+`decodeVector`,
   재색인 tasklet 이 페이지마다 받아 싣고 적재율(`vectors n/총`)을 로그로 남긴다.
   **`search.embedding.model-ref` 가 비면 벡터를 안 싣는다** — 첫 채움 전 정상 상태이고, search:app 의 같은 설정과 한 글자도 달라선 안 된다.
4. ~~**P1-4 search:app 사전**~~ ✅ **완료 (2026-09-06)** — `QueryNormalizer`(고정값 검사로 잠금)·`QueryVector`·`VectorCodec`(도메인, batch/app 공용)·
   `QueryVectorPort`/`QueryMissPort`, `query-vectors-index.json`(dynamic strict), `QueryVectorService`(Caffeine, 미적중도 캐시 · 미스는 매 요청 기록),
   `QueryVectorAdapter`·`QueryMissRedisAdapter`, 기동 시 멱등 인덱스 생성, `/internal/query-vectors/{bulk,misses,status}`+`DELETE /misses`.
   **이제 `tools/embed` 의 `queries.py` 가 붙는다.** 설정 `search.query-vector.model-ref` 는 batch 의 것과 같아야 한다.
5. ~~**P1-5 질의 분기**~~ ✅ **완료 (2026-09-06)** — `SearchQuery.embedding` + `hybrid` 질의(두 레그, 필터 양쪽, `embeddingModel` 필터,
   `paginationDepth`) + `_source.excludes` + RRF 파이프라인 기동 시 생성 + `search.attraction.{hybrid,bm25}` 메트릭.
   **기본 꺼짐**(`search.attraction-hybrid.enabled=false`) — 사전과 문서 벡터가 다 찬 뒤에 켠다.
6. **P1-6~9 — 남은 것**
   - **첫 채움**(가장 큰 것): 터널 열기 → `push --file` 또는 `docs run` 으로 전 코퍼스 임베딩 → 재색인 → 사전 `seed`
   - ~~NetworkPolicy 확인~~ ✅ **바꿀 것 없다 (2026-09-06)** — `allow-search-batch-to-place` 가 이미 place 의
     `http` 포트를 열어 뒀고, 임베딩 조회는 같은 서비스·같은 포트다. 도구는 port-forward 라 NP 를 우회한다
   - 차원 **512 vs 1024** nDCG A/B (§8.11 이 남긴 유일한 미결) · 융합 방식 A/B (D5-1)
   - 켜는 순서: 벡터 적재율 확인 → `SEARCH_EMBEDDING_MODEL_REF` 설정 → 재색인 → 사전 seed → `hybrid.enabled=true`

**P1 에서 반드시 같이 잴 것**: 차원 512 vs 1024 의 nDCG 차이(§8.11 이 남긴 유일한 미결).

## 3-1. 모델 선정이 **재검토 중이다** (2026-09-06, 사용자 지적)

**ADR-0090 D5(arctic-ko 확정)를 다시 재고 있다.** 첫 채움 전이라 되돌리는 값이 0 이고, 첫 채움을 하고 나면
전량 재임베딩이 된다. 그래서 지금 정한다.

사용자가 짚은 두 가지가 둘 다 맞다:

1. **출처** — `dragonkue` 는 개인 계정이다(HF 페이지 확인). 베이스는 `Snowflake/snowflake-arctic-embed-l-v2.0`
   (Snowflake 공식), 라이선스 Apache-2.0, 월 다운로드 94,132. 무명은 아니지만 유지 주체가 개인이다.
2. **Qwen 배제 근거가 없었다** — Qwen 을 **전 코퍼스에서 재본 적이 없다.** 둘이 함께 나오는 유일한 표
   (후보 678건 재순위)에서는 `qwen3-4b` 0.7875 > `arctic-ko` 0.7404 로 Qwen 이 이겼다. 같은 1024차원 조건이다.
   전 코퍼스에서 안 잰 이유는 인코딩 시간뿐인데, **서버 밖 임베딩 설계에서 인코딩 시간은 서비스 지연과 무관하다**
   (첫 채움 1회 + 하루 2천 건 델타). v1(실시간 추론)의 기준을 v2 로 넘어와서도 그대로 쓴 것이 잘못이다.

**실측 처리량**(맥 MPS, 44,924건 환산): arctic-ko 57.8 docs/s → 13분 · qwen3-4b 1.93 → 6.5시간 · qwen3-8b 1.03 → 12시간.

### 다시 재는 후보 (전부 1024차원, 같은 판정 세트)

| 키 | 모델 | 왜 |
|---|---|---|
| `arctic-ko` | dragonkue/…-ko | 현재 선택, 대조군 (풀 파일 이미 있음) |
| `arctic-official` | Snowflake/snowflake-arctic-embed-l-v2.0 | 공식판 — 출처 우려가 사라진다. 한국어를 얼마나 잃는지가 관건 |
| `bge-m3` | BAAI/bge-m3 (MIT) | P0 후보 조사에서 **빠졌던** 기준선. 접두어 없음, MRL 미지원 |
| `qwen3-4b` | Qwen/Qwen3-Embedding-4B | 좁은 표에서 1위 |
| `qwen3-8b` | Qwen/Qwen3-Embedding-8B | 8B 가 4B 보다 낮았던 것(0.7635)이 표본 탓인지 확인 |

`qwen3-4b`·`qwen3-8b` 가중치는 HF 캐시에 이미 있다(7.5G · 14G). `bge-m3`·`arctic-official` 은 받아야 한다.

### ⚠️ 새 모델을 넣을 때 **반드시 먼저** 할 것 — 풀링(pooling)

**판정 세트는 그것을 만들 때 참여한 시스템에만 공정하다.** 지금 판정 세트는 BM25 ∪ {e5-small, harrier-270m, arctic-ko}
의 상위 후보로 만들어졌다. 새 모델이 **아무도 찾은 적 없는 좋은 문서**를 1위로 올리면 그 문서는 판정이 없어 0점으로
계산되고, 결과적으로 **새 모델일수록 불리하다.**

2026-09-06 에 실제로 이 함정에 빠졌다. 첫 채점에서 `bge-m3` 가 0.4811(BM25 0.6911보다 낮음)로 나왔는데,
상위 10 의 **57.5%만 판정돼 있었다.** 검색 결과 자체는 멀쩡했다 — 「궁궐」 상위 5가 경희궁·경복궁·창덕궁·덕수궁·창경궁으로
오히려 arctic-ko 보다 깔끔했다. 낮은 점수는 모델이 아니라 **채점 방식**이 만든 것이다.

| 모델 | 상위 10 판정 커버리지 | 미판정 신규 (질의,문서) 쌍 |
|---|---|---|
| arctic-ko · e5-small · harrier-270m | 100% | 0 (풀링에 참여했다) |
| arctic-official | 72.1% | 67 |
| bge-m3 | 57.5% | 102 |

**절차 (이 순서를 건너뛰지 않는다)**

1. `pool run` 으로 전 코퍼스 인코딩 (모델당 파일 하나가 떨어진다)
2. **`pool merge`** 로 새 모델들의 상위 후보를 `judgments.yml` 에 `vector_candidates` 로 합친다
3. 새로 들어온 후보를 판정한다 (LLM 초안 → `review html` 로 사람이 경계 사례 확인 → `review apply`)
4. **그다음에** `evaluate` — 이때의 숫자만 모델 간 비교에 쓴다
5. 커버리지를 함께 찍어 확인한다: 100% 가 아니면 2~3 을 덜 한 것이다

**커버리지를 보고하지 않은 모델 비교표는 믿지 않는다.**

### 차원 프로브도 같이 (8B 를 원래 차원으로 쓸 수 있나)

8B 의 강점이 4096차원에 있다면 그 차원을 감당할 수 있는지가 먼저다. **앞서 "4096은 한도를 넘는다"고 적은 것은
디스크 크기를 메모리 한도와 비교한 잘못된 계산이라 취소한다.** 실제로 §8.4 에서 1024차원일 때
디스크 store 는 1.77GB(문서 478MB + 사전 1,287MB)인데 컨테이너 메모리는 1.12GiB 였다 —
**데이터는 상주하지 않는다.** `engine: lucene` 이라 HNSW 가 세그먼트 파일에 있고 mmap 으로 읽히기 때문이다
(faiss·nmslib 이었다면 전용 오프힙 캐시라 상주가 맞다). 힙도 무관하다: 512차원 385MB, 1024차원 305MB 로 **줄었다**.

그래서 4096의 실제 위험은 OOM 이 아니라 ① 페이지 캐시에 안 들어가 생기는 지연 ② 병합 피크다
(1024 첫 시도가 `_forcemerge` 중 끊긴 것이 ②로 더 잘 설명된다). **둘 다 안 쟀다** → 프로브로 잰다:

```bash
PYTHON=<venv>/bin/python HEAP=512m MEM=1536m DIMS="1024 4096" tools/embed/probes/run_probe.sh
```

**프로브 도는 동안 MPS 작업을 겹치지 않는다** — 지난번 프로브 실패가 그 겹침에서 났다.

## 4. 막힌 것 · 사용자 대기

| 무엇 | 상태 |
|---|---|
| **푸시** | `gh` 활성 계정이 회사 것(`kwongd`)이라 pre-push 훅이 막는다. **커밋 12개가 worktree 에 대기.** 사용자가 `gh auth switch --user 1989v` 를 실행하면 푸시. 전역 switch 를 내가 하지 않는다(회사 세션 오염) |
| 검토 대상 79건 | 사용자가 **"초안 그대로 유지"** 로 결정(2026-09-06). `doubts.md` 의 규칙 R1~R10 은 전부 현행 유지 |
| 차원 | 미결. P1 에서 측정 |

## 5. 되풀이되면 안 되는 것 (이 작업에서 실제로 겪음)

- **수치만 보고 화면을 안 봤다** — 판정 페이지가 파일의 872건을 무시하고 `localStorage` 만 읽었는데, 파일 파싱으로 "872건"을 확인하고 넘어갔다. 헤드리스로 열어 DOM 을 세고 스크린샷을 보고서야 잡혔다.
- **fp16 NaN 이 정상처럼 위장했다** — harrier-270m 의 풀 파일이 형식·건수 모두 정상인데 모든 질의의 상위 10 이 같은 문서였다. `encode()` 에 유한성 검사를 넣었다.
- **프로브를 겹쳐 돌렸다** — 컨테이너 이름이 고정이라 백그라운드와 전면 실행이 서로를 지웠다. **한 번에 하나만.**
- **게이트웨이가 200 + 빈 바디를 준다** — `fetch_attractions` 에 재시도를 넣었다(`k8s/CLAUDE.md` 의 알려진 함정).

## 6. 재현 명령

```bash
S=<scratchpad>; PYV=$S/p0venv/bin/python; J=$S/msa-docs/docs/specs/2026-09-05-unified-search/judgments.yml
cd $S/msa-docs/tools/embed
$PYV -m pytest -q                                                   # 17 tests
$PYV -m embed.review stats --judgments $J                           # 판정 현황
$PYV -m embed.evaluate --judgments $J --pool $S/p0/pool --rerank $S/p0/rerank --lang ko --out /tmp/eval.md
$PYV -m embed.pool run --models arctic-ko --lang ko --judgments $J --out-dir $S/p0/pool --device mps   # 13분
HEAP=512m MEM=1536m DIMS=1024 probes/run_probe.sh                   # k-NN 메모리 (한 번에 하나만)
```
