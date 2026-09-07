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

## P0 — 차원·규칙 비교 (`python -m embed.bakeoff`)

**한 번 인코딩해 MRL 로 잘라서** 차원을 비교한다 — 차원마다 다시 돌리지 않는다(4B 는 native 2560).

```bash
# 인코딩하며 잰다 — **--save-vectors 를 꼭 준다**
python -m embed.bakeoff --model arctic-ko --lang ko --dims 512,1024 --rules full \
  --judgments docs/specs/2026-09-05-unified-search/judgments.yml \
  --corpus <scratchpad>/p0/pool/corpus_ko.json --device mps \
  --save-vectors <scratchpad>/p0/vectors --out dims.md

# 저장본으로 다시 잰다 — 모델을 안 부르므로 초 단위다
python -m embed.bakeoff --score-saved <dir>/vec_ko_arctic-ko_full.npz <dir>/qvec_ko_arctic-ko.npz \
  --judgments docs/specs/2026-09-05-unified-search/judgments.yml --lang ko --dims 256,512,1024
```

**`--save-vectors` 는 선택이 아니라 기본이다.** 이 파이프라인에서 비싼 것은 인코딩 하나뿐이고
(4B·4.5만 건 = 3시간), 평가 단계에서 죽으면 그게 통째로 날아간다 — 2026-09-07 에 실제로 그랬다.
저장해 두면 차원·k 를 바꿔 가며 재는 것이 초 단위가 되고, 그 파일은 **첫 채움에도 그대로 쓴다**.

차원은 k-NN 메모리를 절반으로 줄이는 지렛대다(§8.4: 60k 문서가 512차원 244MB / 1024차원 478MB).
둘 다 한도 안에 들어가므로 **nDCG 차이로만** 정한다.

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

## P1 — 통로 (`tunnel.sh`)

`/internal/**` 은 게이트웨이가 라우팅하지 않아 인터넷에서 닿지 않는다. port-forward 로 들어간다.
포트가 이미 물려 있으면 **거절한다** — 옛 통로로 재고 "확인했다"고 말하는 사고를 막는다.

```bash
tools/embed/tunnel.sh              # place :8096 + search :8083, Ctrl-C 로 닫는다
NS=commerce tools/embed/tunnel.sh place
```

## P1 — 문서 벡터 하루 루틴 (`python -m embed.docs`)

pending → 원문 → 텍스트 조합 → 해시 비교 → **같으면 touch, 다르면 임베딩** → bulk(500).
`attractions.updated_at` 은 전화·이미지만 바뀌어도 올라가므로 pending 의 대부분은 실제로 그대로다 —
**모델은 임베딩할 것이 실제로 있을 때 처음 로드된다.** touch 만 있는 날은 모델을 읽지 않는다.

```bash
python -m embed.docs run --model qwen3-4b --internal http://localhost:8096 --device mps
python -m embed.docs run --model qwen3-4b --internal http://localhost:8096 --dry-run   # 한 배치 판정만
python -m embed.docs status --model qwen3-4b --internal http://localhost:8096
```

pending 이 2,000건을 넘으면(첫 채움) id 별 조회 대신 풀스캔으로 원문을 받는다 — 5만 건을 하나씩 부르면 5만 요청이다.
같은 배치가 두 번 오면 **멈춘다**: 서버가 반영하지 않았거나 원문이 없는 id 라, 그대로 두면 무한히 돈다.

## P1 — 질의 사전 (`python -m embed.queries`)

질의는 서버에서 임베딩하지 않는다. 사전에 없으면 벡터 레그를 끄고 BM25 로만 답한다.
**정규화는 서버가 한다** — 규칙이 두 곳에 있으면 `_id` 가 어긋나 사전이 통째로 미적중이 된다.

```bash
python -m embed.queries seed   --model qwen3-4b --internal http://localhost:8083 \
                               --intents docs/specs/2026-09-05-unified-search/intents.yml
python -m embed.queries misses --model qwen3-4b --internal http://localhost:8083 --device mps
python -m embed.queries status --model qwen3-4b --internal http://localhost:8083
```

`misses` 는 카운트 내림차순으로 받아 임베딩하고 **넣은 것만** 지운다 — 많이 물어본 질의부터 사전이 된다.
`/internal/query-vectors/**` 는 **P1-4 에서 만든다**. 붙기 전까지 `seed`·`misses` 는 404 다(계약은 스펙에 고정).

## P1 — 첫 채움 (`python -m embed.push`)

노트북은 클러스터에 닿지 않는다(자격증명을 Colab 에 두지 않는다). parquet 만 내고, 미는 것은 로컬이다.

```bash
python -m embed.push --file vectors.parquet --internal http://localhost:8096 --dry-run  # 검사만
python -m embed.push --file vectors.parquet --internal http://localhost:8096 --skip 12  # 끊긴 뒤 이어서
```

보내기 전에 도구가 먼저 검사한다(해시·차원·정규화·중복 id·단일 스탬프) — 업서트는 요청 단위 all-or-nothing 이라
500건 중 한 건이 틀리면 나머지 499건도 거부된다.

## 서버와 같아야 하는 두 가지

`text_hash`(sha256) 와 벡터 표현(float32 little-endian 의 base64)은 서버와 **바이트 단위로 같아야** 한다.
어긋나면 운이 좋으면 400 이고, 운이 나쁘면 엔디안이 뒤집힌 벡터가 조용히 들어가 검색 품질만 무너진다.
그래서 두 테스트의 기준값은 파이썬이 아니라 **JVM 이 만든 것**이다(`ByteBuffer.LITTLE_ENDIAN` + `Base64`,
`MessageDigest("SHA-256")` — 서버가 쓰는 그 클래스들). 만든 방법은 각 테스트 파일 맨 위에 적혀 있다.

계약 원본: `docs/specs/2026-09-05-unified-search/embedding-entities.md` §2.5 · §3.4 · §5.
