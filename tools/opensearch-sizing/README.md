# opensearch-sizing

[OpenSearch 클러스터 사이징 프롬프트](https://blog.1989v.com/posts/opensearch-cluster-sizing-prompt)의
「입력 데이터」 블록을 클러스터에서 뽑아 만든다. 인덱스 · alias · 노드 · AZ 이름은 가린다.

```bash
# 피크 시간대에 돌린다. 표본 간격 60초 × 6개(5분)가 기본
python3 collect.py --url https://host:9200 --user admin:pass -o input.md

# AWS 관리형 + IAM 인증
pip install botocore
python3 collect.py --url https://search-xxx.ap-northeast-2.es.amazonaws.com --sigv4 ap-northeast-2 -o input.md

# 피크 동안 큐 최대값을 더 촘촘히
python3 collect.py --url … --interval 30 --samples 21     # 10분
```

출력의 `<채울 것>` 은 클러스터가 모르는 값이다 — 목표 SLO · 인스턴스 타입 · 클라이언트 RPS · 쿼리 DSL · CloudWatch 지표.
채우지 않고 넣으면 프롬프트가 「추가로 필요한 데이터」로 되묻는다.

## 무엇을 뽑나

| 절 | 원천 | 계산 |
|---|---|---|
| 클러스터 | `/` · `_nodes/os,jvm,process` · `_nodes/stats` | 노드별 역할 · vCPU · RAM · heap · 디스크, awareness · 스레드 풀 설정 |
| 인덱스 | `_cat/indices?expand_wildcards=all` · `_cat/shards` | pri/rep · docs · deleted · 크기 · primary 샤드 크기 범위 |
| 구분 | `_cat/aliases` | alias 가 가리키면 서빙. 같은 계열이면 suffix 를 서빙 것과 비교해 새 세대 / 이전 세대 (스크립트 추정) |
| 샤드 배치 | `_cat/shards` | 노드 × 인덱스 primary/replica 수, 미할당 수 |
| 검색 통계 델타 | `_nodes/stats` 표본 N개 | 샤드 쿼리/초 · 쿼리 ms/건 · fetch · 큐 최대 · rejected 증가 · old GC 증가 · CPU |

샤드 쿼리/초는 **샤드 단위**다. 클라이언트 요청 1건이 대상 샤드 수만큼 센다.

## 가리는 것과 남기는 것

| 대상 | 처리 |
|---|---|
| 인덱스 계열명 · alias | `idx-a` … 같은 이름은 같은 토큰. alias 가 계열명과 같으면 같은 토큰 |
| 날짜 · 타임스탬프 suffix | 남긴다 — 어느 인덱스가 같은 계열의 사본인지가 분석 입력이다 |
| 노드 · AZ | `node-1` · `az-1` |
| 클러스터 이름 · UUID · IP · 호스트 | 출력하지 않는다 |
| `.` 으로 시작하는 인덱스 | 남긴다 — 엔진 · 플러그인 이름이다 |

출력 전에 클러스터에서 받은 원래 이름이 하나라도 남았는지 검사하고, 남았으면 출력하지 않고 종료 코드 1 로 끝난다.
원래 이름 ↔ 토큰 대응표는 `--map` 파일(기본 `sizing-mask-map.json`)에만 쓴다 — 답을 원래 이름으로 읽을 때 쓰고 공유하지 않는다.

쿼리 DSL 은 스크립트가 다루지 않는다. 필드명 · 값에 조직 정보가 섞이므로 붙여 넣기 전에 사람이 가린다.

## 요구 사항

Python 3.9+ 표준 라이브러리. `--sigv4` 만 botocore 가 필요하다. Elasticsearch 7.x 이상 · OpenSearch 1.x 이상의 `_cat` · `_nodes` API 를 쓴다.
