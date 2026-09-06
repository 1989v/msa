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

## P0 — 판정 풀링 (`python -m embed.pool`)

BM25 후보만 판정하면 벡터가 새로 찾은 문서가 "판정 없음"으로 빠진다. 후보 모델의 벡터 상위 10 중 BM25 후보에 없던 문서를
`judgments.yml` 의 `vector_candidates` 로 덧붙여 사람이 한 번에 판정하게 한다. grade 는 만들지 않는다.

```bash
python -m embed.pool run   --models e5-small,harrier-270m,arctic-ko --lang ko --judgments docs/specs/2026-09-05-unified-search/judgments.yml --out-dir /tmp/pool --device mps
python -m embed.pool merge --judgments docs/specs/2026-09-05-unified-search/judgments.yml --pools '/tmp/pool/pool_*.json' --out docs/specs/2026-09-05-unified-search/judgments.yml
```

## P0 — 판정 시트 (`python -m embed.review`)

후보 550건을 YAML 로 훑으면 어느 것이 어디서 왔는지 안 보인다. 질의별로 한 표에 모으고, 같은 문서를 BM25 와 벡터가 둘 다 찾았으면
출처를 합쳐 보여준다. 빠르게 하려면 **3 과 0 만** 써도 nDCG 는 나온다.

```bash
python -m embed.review stats --judgments docs/specs/2026-09-05-unified-search/judgments.yml
python -m embed.review sheet --judgments docs/specs/.../judgments.yml --out /tmp/review.md --queries core --only-ungraded
```

## P0 — 판정 페이지 (브라우저)

마크다운 시트 대신 클릭으로 매기고 싶으면 HTML 을 낸다. 후보마다 **어느 모델이 몇 위로 봤는지**(`q8#3` = qwen3-8b 3위)가 붙어 판정에 참고가 된다.
진행은 `localStorage` 에 저장돼 새로고침해도 남고, 「내보내기」로 `grades.json` 을 받아 되먹인다.

```bash
python -m embed.review html --judgments docs/specs/.../judgments.yml --rerank /tmp/p0/rerank --out ~/Desktop/judge.html
open ~/Desktop/judge.html          # 고치기 → 내보내기 → grades.json 저장
python -m embed.review apply --judgments docs/specs/.../judgments.yml --grades ~/Downloads/grades.json \
                             --by human --out docs/specs/.../judgments.yml
```

**파일의 판정이 바탕, 페이지에서 고친 것이 덮개다.** `localStorage` 만 읽으면 파일에 이미 있는 판정이 안 보인다(2026-09-05에 그랬다).
내보내기는 **고친 것만** 낸다 — 되먹일 때 사람이 손댄 것만 `by: human` 이 된다. 필터 넷: 전체 · 미판정 · **검토 대상**(LLM 초안이면서 경계 등급이고 모델이 상위 5 에 올린 것 = 등급이 바뀌면 nDCG 가 바뀌는 것) · **고친 것**.
각 행에 출처 태그(사람/초안/내가)가 붙고, 고친 행은 배경으로 표시된다. **되돌리기**는 두 가지 — 같은 등급 버튼을 한 번 더 누르면 그 한 건이,
질의 헤더의 「이 질의 되돌리기」는 그 질의에서 고친 것 전부가 파일 판정으로 돌아간다(고친 게 있을 때만 버튼이 나온다).

HTML 은 생성물이라 레포에 두지 않는다(데이터 인라인 157KB). 생성 스크립트만 남긴다.

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
