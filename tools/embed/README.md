# tools/embed — 서버 밖 임베딩 도구 (ADR-0090)

서버에는 임베딩 모델이 없다. 문서 벡터는 여기서(로컬 GPU · Colab) 만들어 SSOT DB 에 업서트하고, 질의 벡터는 사전으로 미리 만든다.
**임베딩 텍스트 규칙(`embed_text.py`)과 모델 스펙(`models.py`)의 유일한 구현**이 이 패키지다 — 서버는 텍스트를 만들지 않는다.

```bash
cd tools/embed
uv venv && uv pip install -e ".[test]"            # 규칙·해시·nDCG 테스트만 (모델 없음)
uv run pytest
uv pip install -e ".[model]"                        # 모델을 돌릴 때 (torch · sentence-transformers)
```

## P0 — bake-off (`notebooks/bakeoff.ipynb`)

Colab(T4) 에서 후보 모델 × 차원(512·1024) × 텍스트 규칙(full·title) 을 판정 세트 nDCG@10 으로 한 표에. 판정은 사람이
`docs/specs/2026-09-05-unified-search/judgments.yml` 의 `grade` 에 적는다 — 노트북은 정답을 만들지 않는다.
결과 표는 플랜 §8.3 옆에 붙이고, 고른 모델의 벡터는 parquet 으로 내려 `push --file`(P1) 이 올린다.

## P0 — 로컬 OpenSearch 프로브 (`probes/`)

운영 OpenSearch 를 건드리지 않고 같은 이미지(3.3.0, heap 512m, 한도 1536Mi)로 k-NN 메모리와 hybrid 질의 동작을 잰다.

```bash
HEAP=512m MEM=1536m DIMS="512 1024" probes/run_probe.sh   # 운영 한도. docker 기동 → knn_probe → hybrid_spike → 컨테이너 삭제(실패해도)
HEAP=1024m MEM=2560m DIMS=1024 probes/run_probe.sh        # 상향안
SKIP_KNN=1 probes/run_probe.sh                            # hybrid 스파이크만
```

컨테이너가 죽으면(OOM) 그 사실을 찍고 다음 조합으로 넘어간다 — 죽은 것 자체가 측정값이다. `knn_probe.py --exclude-source` 는 `_source` 에서 벡터를 뺀 매핑을 잰다
(결과: 3.4배 커진다 — 쓰지 않는다). 프로브는 **한 번에 하나만** 돌린다 — 컨테이너 이름이 고정이라 겹치면 서로 지운다. 결과는 플랜 §8.4·§8.5.

## P1 (예정) — `docs` · `queries` · `push` · `tunnel.sh`

하루 루틴: pending → 텍스트 조합 → 해시 비교(같으면 touch) → 모델 → bulk(500) → misses → 질의 임베딩 → bulk → status.
계약은 `docs/specs/2026-09-05-unified-search/embedding-entities.md` §5.
