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
| P1-4~9 | ⏳ 다음 | §3 |

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
4. **P1-4 search:app 사전** — `query_vectors` 인덱스 + 포트/어댑터 + `/internal/query-vectors/*` + Redis 미스
5. **P1-5 질의 분기** — `QueryNormalizer` + hybrid 분기 + 파이프라인 + 메트릭
6. **P1-6~9** — 테스트 · NP 확인 · 첫 채움 · 문서

**P1 에서 반드시 같이 잴 것**: 차원 512 vs 1024 의 nDCG 차이(§8.11 이 남긴 유일한 미결).

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
