# 검색 시스템 — 커버리지 체크리스트

원천:
- 볼트 `1989v/claude/artifact/search-domain-map.md` 「검색 도메인 개념 지도」 본문 §1~§9 (부록 「1989v.com 구현」 앞까지, 인라인 SVG 도해의 글자 포함) — 표기 `지도 §N`
- `study/docs/19-search-engine/99-concept-catalog.md` §1 매트릭스 · §1-A 갭 23 영역 · §2 A~Q · §G · §H — 표기 `study/19 §X`
- 같은 폴더 심화 노트 01~46 (절 제목까지 훑음) — 표기 `#NN §절`
- 볼트 벡터 검색 아티팩트 셋 — `adding-vectors-to-search.md`(벡터 노트 A) · `embedding-search-under-constraints.md`(벡터 노트 E) · `in-cluster-embedding.md`(벡터 노트 I)
- 지난 라운드 search.yaml 108 개념(운영 행 포함) — 표기 `기존`
- 분야 표준 — Lucene 내부 구조 · 「Introduction to Information Retrieval」(Manning 외) 목차 · 「Relevant Search」 · 「AI-Powered Search」 · ANN/양자화 문헌(HNSW · IVF-PQ · DiskANN · RaBitQ · BBQ · OSQ) · 온라인 실험 표준(A/B 검정 · SRM · 순차 검정) — 표기 `분야 표준`
- 레포 구현 — `search/` · `code-dictionary/` 에서 grep 으로 확인한 코드 — 표기 `레포 구현`

행 순서는 온톨로지 CONTAINS 트리의 깊이 우선 순서다(개념 열의 들여쓰기 점이 깊이). 제외 행은 끝의 표에 모았다.

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| search-system | 검색 시스템 (DOMAIN) | 지도 서문 · 기존 | placed |
| search-ingest | · 검색 인제스트 (DOMAIN) | 지도 §1 · 기존 | placed |
| source-collection | · · 원천 수집 (STAGE) | 기존 · 벡터 노트 E §01 | placed |
| full-scan | · · · 풀스캔 (MECHANISM) | 기존 | placed |
| incremental-backfill | · · · 증분 · 백필 (MECHANISM) | 기존 · 벡터 노트 E §09 | placed |
| api-quota | · · · 호출 한도 (PROBLEM) | 기존 · 벡터 노트 E §09 | placed |
| normalization-derivation | · · 정규화 · 파생 (STAGE) | 기존 · 벡터 노트 E §05 | placed |
| raw-preservation | · · · 원본 보존 (MECHANISM) | 기존 · 벡터 노트 E §05 | placed |
| derived-column | · · · 파생 컬럼 (MECHANISM) | 기존 · 벡터 노트 E §05 | placed |
| taxonomy-tagging | · · · 분류 코드 · 태깅 (MECHANISM) | 기존 · 벡터 노트 E §05 | placed |
| srch-ingest-pipeline | · · · 인제스트 파이프라인 (MECHANISM) | study/19 §J · #13 | placed |
| srch-enrich-processor | · · · · 인리치 (색인 시 조회 결합) (MECHANISM) | study/19 §J | placed |
| srch-ingest-inference | · · · · 색인 시 자동 추론 (MECHANISM) | study/19 §J · §M · §Q · #29 | placed |
| srch-semantic-text-field | · · · · · 시맨틱 텍스트 필드 (MECHANISM) | study/19 §A · §G · §M · #27 · #28 | placed |
| document-embedding | · · 문서 임베딩 (STAGE) | 기존 · 지도 §1 · #08 · #46 | placed |
| embedding-text-rule | · · · 임베딩 텍스트 규칙 (MECHANISM) | 기존 · #46 §8.4 | placed |
| embedding-model | · · · 임베딩 모델 (MECHANISM) | 기존 · #08 · 벡터 노트 A · E §06 | placed |
| matryoshka-embedding | · · · · 마트료시카 임베딩 (MECHANISM) | 기존 · #08 · 벡터 노트 A 결정 06 | placed |
| srch-two-tower | · · · · 바이 인코더 (two-tower) (MECHANISM) | 지도 §4 · #10 · #46 §3 · 벡터 노트 E §10 | placed |
| model-stamp | · · · 모델 스탬프 (MECHANISM) | 기존 · #46 §8.2 | placed |
| offline-batch | · · · 오프라인 배치 (MECHANISM) | 기존 · 벡터 노트 A | placed |
| srch-embedding-model-selection | · · · 임베딩 모델 선정 (MECHANISM) | #46 §4 · 벡터 노트 A 결정 01 · E §06 | placed |
| srch-embedding-fine-tuning | · · · 임베딩 파인튜닝 (MECHANISM) | #46 §5 | placed |
| srch-contrastive-learning | · · · · 대조 학습 (MECHANISM) | 분야 표준 (#46 §5) | placed |
| srch-hard-negative-mining | · · · · 하드 네거티브 채굴 (MECHANISM) | #46 §5.2 | placed |
| srch-chunking | · · · 청킹 (MECHANISM) | study/19 §M (semantic_text 자동 청킹) · 분야 표준 | placed |
| srch-embedding-model-migration | · · · 모델 교체 · 벡터 공간 전환 (MECHANISM) | #08 §10 · #17 시나리오 9 · #46 §8 | placed |
| srch-vector-normalization | · · · 벡터 L2 정규화 (MECHANISM) | #08 §4 · 벡터 노트 E §09 | placed |
| srch-vector-dimension-choice | · · · 차원 선택 (MECHANISM) | 벡터 노트 A 결정 06 · #20 Q15 | placed |
| srch-pca-reduction | · · · PCA 차원 축소 (MECHANISM) | #08 §10-3 | placed |
| srch-vector-space-mismatch | · · · 벡터 공간 불일치 (PROBLEM) | #08 §12-1 · #46 §8.1 | placed |
| index-contract | · · 색인 계약 (STAGE) | 기존 · 지도 §2 | placed |
| index-mapping | · · · 매핑 · 필드 타입 (MECHANISM) | 기존 · 지도 §2 · #27 · #38 | placed |
| srch-text-vs-keyword | · · · · text · keyword 구분 (MECHANISM) | study/19 §A · #04 · #27 | placed |
| srch-multi-field | · · · · 멀티 필드 (MECHANISM) | study/19 §B · #04 | placed |
| srch-copy-to | · · · · copy_to 합성 필드 (MECHANISM) | study/19 §B · #38 | placed |
| srch-dynamic-mapping | · · · · 동적 매핑 · 동적 템플릿 (MECHANISM) | study/19 §B · #38 | placed |
| srch-runtime-field | · · · · 런타임 필드 (MECHANISM) | study/19 §B · #38 | placed |
| srch-object-modeling | · · · · 객체 표현 네 패턴 (MECHANISM) | study/19 §A · #38 | placed |
| srch-nested-field | · · · · · nested 필드 (MECHANISM) | study/19 §A · #07 · #38 | placed |
| srch-flattened-field | · · · · · flattened 필드 (MECHANISM) | study/19 §A · #27 | placed |
| srch-parent-child-join | · · · · · 부모-자식 조인 필드 (MECHANISM) | study/19 §A · §G · #07 | placed |
| srch-numeric-field-types | · · · · 숫자 타입 · scaled_float (MECHANISM) | study/19 §A · #38 | placed |
| srch-range-field | · · · · 범위 필드 (MECHANISM) | study/19 §A · #27 | placed |
| srch-geo-field | · · · · 지리 필드 (MECHANISM) | study/19 §A · #30 | placed |
| srch-rank-feature-field | · · · · 랭크 피처 필드 (MECHANISM) | study/19 §A · #27 | placed |
| srch-sparse-vector-field | · · · · 희소 벡터 필드 (MECHANISM) | study/19 §A · #27 | placed |
| srch-wildcard-field | · · · · 와일드카드 필드 (MECHANISM) | study/19 §A · #27 | placed |
| srch-match-only-text | · · · · 점수 없는 text (MECHANISM) | study/19 §A · #27 | placed |
| srch-token-count-field | · · · · 토큰 수 필드 (MECHANISM) | study/19 §A · #38 | placed |
| srch-field-storage-options | · · · · 필드 저장 옵션 (MECHANISM) | study/19 §B · #38 | placed |
| analyzer-tokenizer | · · · 분석기 · 토크나이저 (MECHANISM) | 기존 · 지도 §2 · #04 | placed |
| srch-char-filter | · · · · 문자 필터 (MECHANISM) | #04 §3 | placed |
| srch-tokenizer | · · · · 토크나이저 (MECHANISM) | #04 §4 | placed |
| srch-standard-tokenizer | · · · · · 표준 토크나이저 (MECHANISM) | #04 §4 | placed |
| srch-ngram-tokenizer | · · · · · n-gram 토크나이저 (MECHANISM) | 지도 §2 · #04 §4-3 · #36 | placed |
| srch-edge-ngram | · · · · · edge n-gram (MECHANISM) | #04 §4-3 · #36 | placed |
| srch-token-filter | · · · · 토큰 필터 (MECHANISM) | #04 §5 | placed |
| srch-lowercase-folding | · · · · · 소문자화 · ASCII 폴딩 (MECHANISM) | #04 §5 | placed |
| srch-stemming | · · · · · 어간 추출 (MECHANISM) | 지도 §1 · 분야 표준 | placed |
| srch-lemmatization | · · · · · 표제어 추출 (MECHANISM) | 분야 표준 | placed |
| srch-synonym-filter | · · · · · 동의어 필터 (MECHANISM) | 지도 §1 · #04 §5-3 · #05 §9 | placed |
| srch-synonym-graph | · · · · · · 동의어 그래프 (MECHANISM) | 분야 표준 · 레포 구현 | placed |
| srch-shingle | · · · · · 싱글 (단어 n-gram) (MECHANISM) | #36 · 분야 표준 | placed |
| srch-pos-filter | · · · · · 품사 필터 (MECHANISM) | #05 §7 | placed |
| srch-reading-form | · · · · · 한자 독음 변환 (MECHANISM) | #05 §8 | placed |
| analyzer-customization-layers | · · · · 형태소 분석기 커스텀 층 (MECHANISM) | 기존 | placed |
| lattice-viterbi | · · · · · 격자 · 비터비 · 비용 (MECHANISM) | 기존 | placed |
| viterbi-algorithm | · · · · · · 비터비 알고리즘 (MECHANISM) | 기존 | placed |
| user-dictionary | · · · · · 사용자 사전 (MECHANISM) | 기존 · #05 §6 | placed |
| decompound-mode | · · · · · 복합어 분해 모드 (MECHANISM) | 기존 · #05 §5 | placed |
| system-dictionary-entry | · · · · · 시스템 사전 항목 (MECHANISM) | 기존 | placed |
| mecab-ko-dic | · · · · · · mecab-ko-dic (TECHNOLOGY) | 기존 | placed |
| tokenizer-cost-retraining | · · · · · 분해 비용 재학습 (MECHANISM) | 기존 | placed |
| crf | · · · · · · CRF (MECHANISM) | 기존 | placed |
| sejong-corpus | · · · · · · 세종 말뭉치 (TECHNOLOGY) | 기존 | placed |
| srch-search-analyzer-split | · · · · 색인 · 질의 분석기 분리 (MECHANISM) | study/19 §B · #04 §7 · #36 §5 | placed |
| srch-keyword-normalizer | · · · · keyword 노멀라이저 (MECHANISM) | study/19 §B | placed |
| nori | · · · · nori (TECHNOLOGY) | 기존 · #05 | placed |
| inverse-index | · · · 역인덱싱 (MECHANISM) | 기존 · 지도 §2 · #03 | placed |
| srch-term-dictionary | · · · · 텀 사전 (MECHANISM) | 지도 §2 · #03 §3 | placed |
| srch-fst | · · · · · FST (유한 상태 변환기) (MECHANISM) | 지도 §2 · #03 §3-2 | placed |
| srch-postings-list | · · · · 포스팅 리스트 (MECHANISM) | 지도 §2 · #03 §3-3 | placed |
| srch-postings-compression | · · · · · 포스팅 압축 (차이값 · 블록 비트 패킹) (MECHANISM) | 지도 §2 · 분야 표준 | placed |
| srch-positions-offsets | · · · · · 위치 · 오프셋 · 페이로드 (MECHANISM) | #03 §3-3 | placed |
| srch-postings-intersection | · · · · · 포스팅 교집합 (MECHANISM) | #03 §8 · 분야 표준 | placed |
| vector-field | · · · 벡터 필드 (MECHANISM) | 기존 · 지도 §2 · §5 | placed |
| hnsw | · · · · HNSW (MECHANISM) | 기존 · 지도 §5 · #08 | placed |
| vector-quantization | · · · · · 벡터 양자화 (MECHANISM) | 기존 · 지도 §5 · study/19 §M · #41 §6 | placed |
| srch-scalar-quantization | · · · · · · 스칼라 양자화 (MECHANISM) | 지도 §5 · #41 §6 | placed |
| srch-int8-quantization | · · · · · · · int8 스칼라 양자화 (MECHANISM) | 지도 §5 · study/19 §M · #41 §6-3 | placed |
| srch-int4-quantization | · · · · · · · int4 양자화 (MECHANISM) | 지도 §5 · study/19 §M · #41 §6-4 | placed |
| srch-fp16-quantization | · · · · · · · fp16 반정밀도 (MECHANISM) | study/19 §Q · #41 §8 | placed |
| srch-binary-quantization | · · · · · · 이진 양자화 (1-bit) (MECHANISM) | 지도 §5 · study/19 §Q · 벡터 노트 E §10 · 레포 구현 | placed |
| srch-bbq | · · · · · · · BBQ (Better Binary Quantization) (MECHANISM) | 지도 §5 · study/19 §M · #41 §6-5 · 분야 표준 | placed |
| srch-rabitq | · · · · · · · RaBitQ (MECHANISM) | 분야 표준 | placed |
| srch-product-quantization | · · · · · · 곱 양자화 (PQ) (MECHANISM) | 지도 §5 · 벡터 노트 E §10 · 분야 표준 | placed |
| srch-ivf-pq | · · · · · · · IVF-PQ (MECHANISM) | 벡터 노트 E §10 · study/19 §Q | placed |
| srch-osq | · · · · · · OSQ (Optimized Scalar Quantization) (MECHANISM) | 분야 표준 | placed |
| rescore-oversample | · · · · · · 재채점 · 오버샘플 (MECHANISM) | 기존 · 지도 §5 · #41 §11-8 | placed |
| hnsw-parameters | · · · · · HNSW 파라미터 (MECHANISM) | 기존 · 지도 §5 · #08 §6 · #41 §4 | placed |
| srch-flat-index | · · · · 전수 탐색 (flat) (MECHANISM) | 지도 §5 · #41 | placed |
| srch-ivf | · · · · IVF (역파일 군집 색인) (MECHANISM) | 지도 §5 · study/19 §Q · 벡터 노트 E §10 | placed |
| srch-diskann | · · · · DiskANN (Vamana) (MECHANISM) | 분야 표준 | placed |
| srch-lsh | · · · · LSH (지역 민감 해싱) (MECHANISM) | 분야 표준 | placed |
| srch-disk-based-vectors | · · · · 디스크 기반 벡터 (MECHANISM) | study/19 §Q · #41 §8 | placed |
| srch-index-template | · · · 인덱스 템플릿 (MECHANISM) | study/19 §C · #37 | placed |
| srch-mapping-explosion | · · · 매핑 폭증 (PROBLEM) | #38 §10-2 · 분야 표준 | placed |
| srch-object-array-cross-match | · · · 객체 배열 교차 매칭 (PROBLEM) | #07 §6-1 · #38 | placed |
| srch-analyzer-mismatch | · · · 색인 · 질의 분석 불일치 (PROBLEM) | 지도 §2 · #04 §9-2 | placed |
| bulk-indexing | · · 벌크 인덱싱 (STAGE) | 기존 · #13 §2 | placed |
| index-rebuild | · · · 새 인덱스 생성 (MECHANISM) | 기존 · 지도 §9 | placed |
| alias-swap | · · · 별칭 스왑 (MECHANISM) | 기존 · 지도 §2 · §9 · #13 §4 | placed |
| reindex-count-gate | · · · 재색인 건수 게이트 (MECHANISM) | 기존 · 지도 §9 | placed |
| partial-index-live | · · · 덜 찬 색인 라이브 (PROBLEM) | 기존 | placed |
| srch-bulk-sizing | · · · 벌크 크기 조정 (MECHANISM) | #13 §2-2 | placed |
| srch-bulk-partial-failure | · · · 벌크 부분 실패 (PROBLEM) | #13 §9-2 | placed |
| srch-vector-indexing-cost | · · · 벡터 색인 비용 (PROBLEM) | #08 §6-4 · #41 §9-2 | placed |
| srch-indexing-throughput | · · · 색인 처리량 (METRIC) | #18 §5-2 · 분야 표준 | placed |
| srch-index-sync | · · 색인 동기화 (STAGE) | 지도 §9 · #14 | placed |
| srch-incremental-indexing | · · · 증분 색인 (MECHANISM) | 지도 §9 | placed |
| srch-change-capture-indexing | · · · 변경 이벤트 색인 (MECHANISM) | 지도 §9 · #14 §4 · §5 | placed |
| srch-external-versioning | · · · 외부 버전 · 순서 보장 (MECHANISM) | 지도 §9 · #03 §6-3 · #14 §7 | placed |
| srch-source-of-truth-rebuild | · · · 원천 기준 재구성 (MECHANISM) | #14 §9 | placed |
| srch-out-of-order-update | · · · 순서 뒤바뀐 갱신 (PROBLEM) | 지도 §9 · #14 §10-5 | placed |
| srch-index-lag | · · · 색인 지연 (METRIC) | #14 §8 | placed |
| srch-reindex-rto | · · · 재색인 RTO (METRIC) | #16 §8 | placed |
| search-index-internals | · 색인 내부 구조 (DOMAIN) | 지도 §2 · #02 · #03 | placed |
| srch-index-structures | · · 색인 자료구조 설계 (STAGE) | 지도 §2 | placed |
| srch-doc-values | · · · doc values (열 저장) (MECHANISM) | 지도 §2 · study/19 §B · #38 §6-1 | placed |
| srch-global-ordinals | · · · · 전역 서수 (MECHANISM) | study/19 §B · #38 §6-4 | placed |
| srch-fielddata | · · · fielddata (MECHANISM) | 지도 §2 | placed |
| srch-stored-fields | · · · stored fields · 원문 (MECHANISM) | 지도 §2 · study/19 §B | placed |
| srch-index-codec-compression | · · · · 코덱 · 압축 수준 (MECHANISM) | study/19 §C · #37 §5-2 | placed |
| srch-norms | · · · norms (길이 정규화 값) (MECHANISM) | study/19 §B · #38 §6-2 | placed |
| srch-term-vectors | · · · 텀 벡터 (MECHANISM) | study/19 §B | placed |
| srch-points-bkd | · · · BKD 트리 (points) (MECHANISM) | 분야 표준 | placed |
| srch-heap-pressure | · · · 힙 압박 (PROBLEM) | 지도 §2 · #16 · 분야 표준 | placed |
| srch-segment-lifecycle | · · 세그먼트 수명 관리 (STAGE) | 지도 §2 · #02 | placed |
| srch-segment | · · · 세그먼트 (불변 묶음) (MECHANISM) | 지도 §2 · #02 §3 | placed |
| srch-tombstone-delete | · · · · 삭제 표시 (live docs) (MECHANISM) | 지도 §2 · #02 | placed |
| srch-update-as-delete-add | · · · · 갱신 = 삭제 + 추가 (MECHANISM) | 지도 §2 · #03 §6-2 | placed |
| srch-indexing-buffer | · · · 인덱싱 버퍼 (MECHANISM) | #02 §3-2 | placed |
| srch-refresh | · · · 리프레시 (NRT 가시성) (MECHANISM) | 지도 §2 · study/19 §C · #02 §4 | placed |
| srch-translog | · · · 트랜스로그 (MECHANISM) | 지도 §2 · #02 §5 | placed |
| srch-flush-commit | · · · 플러시 · 커밋 (MECHANISM) | 지도 §2 · #02 §6 | placed |
| srch-segment-merge | · · · 세그먼트 병합 (MECHANISM) | 지도 §2 · #02 §7 | placed |
| srch-tiered-merge-policy | · · · · 계층 병합 정책 (MECHANISM) | #02 §7-2 | placed |
| srch-force-merge | · · · · 강제 병합 (MECHANISM) | study/19 §K · #02 §7-3 · #39 §6-5 | placed |
| srch-index-sorting | · · · 색인 정렬 (MECHANISM) | study/19 §C · #37 §5-3 | placed |
| srch-early-termination | · · · · 조기 종료 (MECHANISM) | study/19 §C · #37 · 분야 표준 | placed |
| srch-segment-explosion | · · · 세그먼트 과다 (PROBLEM) | 지도 §2 · #21 | placed |
| srch-merge-io-storm | · · · 병합 I/O 폭주 (PROBLEM) | #02 §7-4 | placed |
| srch-unrefreshed-read | · · · 방금 쓴 문서가 안 보임 (PROBLEM) | #02 §8-1 | placed |
| srch-acked-write-loss | · · · 확인된 쓰기 유실 (PROBLEM) | #02 §8-2 | placed |
| srch-segment-count | · · · 세그먼트 수 (METRIC) | #21 · 분야 표준 | placed |
| search-query | · 검색어 파이프라인 (DOMAIN) | 기존 · 지도 §3 · §6 | placed |
| query-understanding | · · 쿼리 언더스탠딩 (STAGE) | 기존 · 지도 §3 | placed |
| query-normalization | · · · 정규화 (MECHANISM) | 기존 · 지도 §3 | placed |
| srch-unicode-normalization | · · · · 유니코드 정규형 (MECHANISM) | 지도 §3 | placed |
| morphological-analysis | · · · 형태소 분석 (STAGE) | 기존 · #05 | placed |
| keyword-type-classification | · · · 키워드 유형 분류 (MECHANISM) | 기존 · 벡터 노트 E §03 | placed |
| intent-to-filter | · · · 의도 → 필터 승격 (MECHANISM) | 기존 · 지도 §3 · 벡터 노트 E §03 | placed |
| srch-spell-correction | · · · 오타 교정 (MECHANISM) | 지도 §3 · #07 §7-1 · 7-2 | placed |
| srch-edit-distance | · · · · 편집 거리 (MECHANISM) | 지도 §3 · study/19 §D | excluded — 같은 개념 cs-edit-distance 로 합쳤다 |
| srch-query-log-correction | · · · · 로그 기반 교정 (MECHANISM) | 지도 §3 | placed |
| srch-noisy-channel-model | · · · · 잡음 채널 모델 (MECHANISM) | 분야 표준 | placed |
| srch-keyboard-layout-correction | · · · · 한영 자판 전환 교정 (MECHANISM) | #36 §7-4 | placed |
| srch-query-intent-classification | · · · 의도 분류 (MECHANISM) | 지도 §3 | placed |
| srch-query-entity-recognition | · · · 엔티티 인식 (MECHANISM) | 지도 §3 | placed |
| srch-query-segmentation | · · · 질의 분절 (MECHANISM) | 분야 표준 | placed |
| srch-language-identification | · · · 언어 식별 (MECHANISM) | 분야 표준 · 벡터 노트 E §04 | placed |
| srch-query-expansion | · · · 질의 확장 (MECHANISM) | 지도 §3 | placed |
| srch-transliteration | · · · · 음차 · 로마자 변환 (MECHANISM) | 지도 §3 | placed |
| srch-cross-lingual-expansion | · · · · 교차 언어 확장 (MECHANISM) | 지도 §3 · 벡터 노트 E §04 | placed |
| srch-pseudo-relevance-feedback | · · · · 의사 적합성 피드백 (MECHANISM) | 분야 표준 | placed |
| srch-query-rewriting | · · · 질의 재작성 (MECHANISM) | 지도 §3 | placed |
| srch-llm-query-rewrite | · · · · LLM 질의 재작성 (MECHANISM) | 지도 §3 · 벡터 노트 E §10 | placed |
| srch-zero-result-recovery | · · · 0건 복구 (MECHANISM) | 지도 §3 · 벡터 노트 E §02 | placed |
| srch-policy-switch | · · · 랭킹 정책 스위치 (MECHANISM) | 지도 §3 | placed |
| srch-morpheme-fragment-noise | · · · 형태소 조각 오탐 (PROBLEM) | 벡터 노트 E 서문 · §03 | placed |
| srch-zero-result | · · · 0건 (PROBLEM) | 지도 §3 | placed |
| srch-zero-result-rate | · · · 0건율 (METRIC) | 지도 §8 · study/19 §H | placed |
| search-lexicon | · · 검색 사전 (STAGE) | 기존 | placed |
| synonym-dictionary | · · · 동의어 사전 (MECHANISM) | 기존 · #05 §9 | placed |
| stopword | · · · 스톱워드 (MECHANISM) | 기존 · 지도 §3 | placed |
| lexicon-from-source-codes | · · · 원천 코드표 유도 (MECHANISM) | 기존 · 벡터 노트 E §04 | placed |
| query-embedding | · · 쿼리 임베딩 (STAGE) | 기존 · #46 §7 | placed |
| live-encoding | · · · 라이브 인코딩 (MECHANISM) | 기존 · 벡터 노트 E · I | placed |
| query-vector-ledger | · · · 벡터 캐시 · 원장 (MECHANISM) | 기존 · 벡터 노트 E §01 | placed |
| srch-precomputed-query-dictionary | · · · 질의 벡터 사전 (MECHANISM) | 벡터 노트 A · I | placed |
| srch-query-instruction-prefix | · · · 질의 지시문 접두어 (MECHANISM) | 벡터 노트 I · #46 §4.4 | placed |
| srch-query-tower-placement | · · · 질의 타워 배치 (MECHANISM) | #46 §7.1 · 벡터 노트 I | placed |
| srch-embedding-sidecar | · · · · 임베딩 사이드카 (MECHANISM) | 벡터 노트 E §01 · #46 §7 | placed |
| sentence-transformers | · · · · · sentence-transformers (TECHNOLOGY) | 레포 구현 (search/embed) | placed |
| srch-inference-server | · · · · 추론 서버 (MECHANISM) | #46 §7.1 · #18 §4 | placed |
| srch-in-engine-inference | · · · · 엔진 내장 추론 (MECHANISM) | study/19 §Q (ML Commons) · #29 | placed |
| srch-external-embedding-api | · · · · 외부 임베딩 API (MECHANISM) | #18 §4-2 · #46 §7.1 | placed |
| srch-bm25-fallback | · · · BM25 폴백 (MECHANISM) | 벡터 노트 A · E §01 · 지도 §9 | placed |
| srch-encoder-outage | · · · 인코더 장애 (PROBLEM) | 벡터 노트 E §08 · #18 §12-6 | placed |
| srch-query-dsl | · · 질의 작성 (STAGE) | study/19 §D~§G · #07 | placed |
| srch-query-filter-context | · · · 질의 문맥 · 필터 문맥 (MECHANISM) | #07 §3 · study/19 §F | placed |
| srch-term-level-query | · · · 텀 수준 질의 (MECHANISM) | study/19 §D · #07 §4 | placed |
| srch-full-text-query | · · · 전문 질의 (MECHANISM) | study/19 §E · #07 §4-6 | placed |
| srch-multi-match-types | · · · · 다중 필드 매칭 방식 (MECHANISM) | study/19 §E · #07 §4-9 | placed |
| srch-phrase-query | · · · · 구문 질의 (MECHANISM) | study/19 §E · #07 §4-7 | placed |
| srch-proximity-query | · · · · 근접 · 구간 질의 (MECHANISM) | study/19 §E · §G (span · intervals) | placed |
| srch-query-string-syntax | · · · · 질의 문자열 구문 (MECHANISM) | study/19 §E | placed |
| srch-bool-query | · · · 불리언 조합 질의 (MECHANISM) | study/19 §F · #07 §5-1 | placed |
| srch-dis-max | · · · · 최대 점수 조합 (dis_max) (MECHANISM) | study/19 §F · #38 §8-3 | placed |
| srch-minimum-should-match | · · · · 최소 일치 수 (MECHANISM) | 분야 표준 · 레포 구현 | placed |
| srch-multi-term-query | · · · 다중 텀 질의 (MECHANISM) | study/19 §D · #07 §4-5 | placed |
| srch-fuzzy-query | · · · · 퍼지 질의 (MECHANISM) | study/19 §D | placed |
| srch-join-query | · · · 조인 질의 (MECHANISM) | study/19 §G · #07 §6 | placed |
| srch-terms-lookup | · · · 텀 조회 질의 (MECHANISM) | study/19 §D · #38 §8-2 | placed |
| srch-more-like-this | · · · 유사 문서 질의 (MECHANISM) | study/19 §G · #32 | placed |
| srch-percolation | · · · 역검색 (저장 질의 매칭) (MECHANISM) | study/19 §A · §G · #22 | placed |
| srch-geo-query | · · · 지리 질의 (MECHANISM) | study/19 §G · #30 | placed |
| srch-geo-distance-query | · · · · 반경 질의 (MECHANISM) | study/19 §G · #30 | placed |
| srch-geo-bounding-box | · · · · 박스 질의 (MECHANISM) | study/19 §G · #30 | placed |
| srch-geo-shape-query | · · · · 도형 질의 (MECHANISM) | study/19 §G · #30 | placed |
| srch-search-template | · · · 검색 템플릿 (MECHANISM) | study/19 §H · #39 §4 | placed |
| srch-expensive-query | · · · 비싼 질의 (PROBLEM) | study/19 §G (expensive queries) · #07 §12-3 | placed |
| candidate-generation | · · 후보 생성 (STAGE) | 기존 · 지도 §4 | placed |
| srch-boolean-retrieval | · · · 불리언 검색 (MECHANISM) | 지도 §4 | placed |
| srch-tf-idf | · · · TF-IDF (MECHANISM) | 지도 §4 · #06 §2 | placed |
| bm25 | · · · 스파스 · BM25 (MECHANISM) | 기존 · 지도 §4 · #06 | placed |
| srch-bm25-k1 | · · · · k1 (빈도 포화) (MECHANISM) | 지도 §4 · #06 §4 | placed |
| srch-bm25-b | · · · · b (길이 정규화) (MECHANISM) | 지도 §4 · #06 §5 | placed |
| srch-bm25f | · · · · BM25F (필드 가중) (MECHANISM) | 지도 §4 · study/19 §E · #38 §8-1 | placed |
| srch-learned-sparse | · · · 학습형 스파스 (MECHANISM) | 지도 §4 · study/19 §M · §Q · #28 · #29 | placed |
| srch-splade | · · · · SPLADE (MECHANISM) | 지도 §4 · 벡터 노트 E §10 | placed |
| srch-doc-expansion | · · · · 문서 확장 (MECHANISM) | 분야 표준 | placed |
| srch-two-phase-sparse | · · · · 2단계 희소 가속 (MECHANISM) | study/19 §Q · #29 | placed |
| ann-search | · · · 덴스 · ANN (MECHANISM) | 기존 · 지도 §4 · #08 | placed |
| srch-filtered-ann | · · · · 필터 결합 kNN (MECHANISM) | study/19 §M · #41 §3 | placed |
| srch-ann-pre-filter | · · · · · 사전 필터 (MECHANISM) | #41 §3 | placed |
| srch-ann-post-filter | · · · · · 사후 필터 (MECHANISM) | #41 §3 | placed |
| srch-late-interaction | · · · 늦은 상호작용 (ColBERT) (MECHANISM) | 지도 §4 | placed |
| srch-similarity-module | · · · 유사도 모델 교체 (MECHANISM) | study/19 §B · #06 §9 | placed |
| opensearch | · · · OpenSearch (TECHNOLOGY) | 기존 · #11 | placed |
| srch-post-filter-recall-loss | · · · 사후 필터 결과 부족 (PROBLEM) | #41 §3 · #08 §12-5 | placed |
| srch-ann-recall | · · · ANN 재현율 (METRIC) | #41 §4 · 분야 표준 | placed |
| rank-fusion | · · 융합 (STAGE) | 기존 · 지도 §7 · #09 | placed |
| rrf | · · · RRF (MECHANISM) | 기존 · 지도 §7 · #09 §3 | placed |
| srch-weighted-score-fusion | · · · 가중 점수합 (선형 융합) (MECHANISM) | 지도 §7 · #09 §2-2 | placed |
| srch-score-normalization | · · · · 점수 정규화 (MECHANISM) | study/19 §Q · #29 | placed |
| srch-conditional-leg-selection | · · · 조건부 레그 선택 (MECHANISM) | 지도 §7 · 벡터 노트 E §03 | placed |
| srch-learned-fusion | · · · 학습 융합 (MECHANISM) | 지도 §7 | placed |
| srch-fusion-depth | · · · 융합 깊이 (MECHANISM) | 벡터 노트 A (구현에서 걸린 것) | placed |
| srch-same-filter-both-legs | · · · 두 레그에 같은 필터 (MECHANISM) | 지도 §7 · #09 §11-2 | placed |
| srch-search-pipeline | · · · 검색 파이프라인 (MECHANISM) | study/19 §Q · #29 | placed |
| srch-score-scale-mismatch | · · · 점수 스케일 불일치 (PROBLEM) | 지도 §7 · #09 §2-2 | placed |
| srch-filter-leak | · · · 필터 누수 (PROBLEM) | 지도 §7 · #09 §11-2 | placed |
| srch-fusion-depth-truncation | · · · 융합 깊이 부족 (PROBLEM) | 벡터 노트 A | placed |
| srch-relevance-tuning | · · 점수 조정 (STAGE) | #06 §6 · #35 | placed |
| srch-function-score | · · · 점수 함수 결합 (MECHANISM) | study/19 §F · #06 §6 | placed |
| srch-decay-function | · · · · 감쇠 함수 (MECHANISM) | study/19 §F · #06 · #42 §6 | placed |
| srch-field-value-factor | · · · · 필드 값 인자 · modifier (MECHANISM) | study/19 §F · #35 | placed |
| srch-script-score | · · · · 스크립트 점수 (MECHANISM) | study/19 §F · #06 §11-4 | placed |
| srch-field-boosting | · · · 필드 가중 (MECHANISM) | 지도 §4 (BM25F 제목 ^3) · #06 | placed |
| srch-rank-feature-boost | · · · 랭크 피처 부스트 (MECHANISM) | study/19 §G · #32 | placed |
| srch-distance-feature-boost | · · · 거리 · 최신성 부스트 (MECHANISM) | study/19 §G · #32 | placed |
| srch-pinned-results | · · · 고정 노출 (MECHANISM) | study/19 §G · #32 | placed |
| srch-negative-boost | · · · 강등 (MECHANISM) | study/19 §F · #32 | placed |
| srch-constant-score | · · · 상수 점수 (MECHANISM) | study/19 §F · #32 | placed |
| srch-static-quality-signals | · · · 정적 품질 신호 (MECHANISM) | 지도 §1 · §6 | placed |
| srch-query-rules | · · · 질의 규칙 (MECHANISM) | study/19 §G (rule_query) · §H (Search Application) | placed |
| srch-raw-signal-domination | · · · 원시 신호 독주 (PROBLEM) | #35 §2 | placed |
| srch-zero-multiply | · · · 0 곱으로 점수 소멸 (PROBLEM) | #35 §4 | placed |
| post-ranking | · · 후처리 (STAGE) | 기존 · 지도 §6 | placed |
| srch-ranking-funnel | · · · 랭킹 퍼널 (캐스케이드) (MECHANISM) | 지도 §6 · #09 §6 · 벡터 노트 E §10 | placed |
| reranking | · · · 리랭킹 (MECHANISM) | 기존 · 지도 §6 · #10 | placed |
| learning-to-rank | · · · · Learning to Rank (MECHANISM) | 기존 · #10 §5 | placed |
| query-level-cross-validation | · · · · · 쿼리 단위 교차검증 (MECHANISM) | 기존 · study/19 §H | placed |
| srch-lambdamart | · · · · · LambdaMART (MECHANISM) | #10 §5-2 | placed |
| srch-feature-logging | · · · · · 피처 로깅 (MECHANISM) | 분야 표준 · #10 §5-3 | placed |
| srch-cross-encoder | · · · · 크로스 인코더 (MECHANISM) | 지도 §4 · #10 §4 · 벡터 노트 E §10 | placed |
| srch-llm-reranker | · · · · LLM 리랭커 (MECHANISM) | 벡터 노트 E §10 · 분야 표준 | placed |
| srch-query-rescore | · · · · 재채점 윈도우 (MECHANISM) | study/19 §H · #25 | placed |
| diversity-business-rules | · · · 다양성 · 비즈니스 규칙 (MECHANISM) | 기존 · 지도 §6 · #10 §8 | placed |
| srch-mmr | · · · · MMR (최대 한계 적합성) (MECHANISM) | study/19 §H (MMR 후처리) | placed |
| srch-field-collapsing | · · · · 필드 접기 (MECHANISM) | study/19 §H · #25 | placed |
| srch-result-dedup | · · · · 중복 제거 (MECHANISM) | 지도 §6 (중복 제거) | placed |
| srch-personalization | · · · 개인화 (MECHANISM) | 지도 §6 (문맥 피처) · 분야 표준 | placed |
| srch-train-serve-skew | · · · 학습-서빙 불일치 (PROBLEM) | 기존(랭킹 피처) · 분야 표준 | placed |
| srch-autocomplete | · · 자동완성 (STAGE) | 지도 §3 · #36 | placed |
| srch-search-as-you-type | · · · 입력 중 검색 필드 (MECHANISM) | study/19 §A · #36 | placed |
| srch-completion-suggester | · · · 완성 제안기 (MECHANISM) | study/19 §A · #07 §7-3 · #36 §6 | placed |
| srch-context-suggester | · · · · 문맥 제안 (MECHANISM) | #36 §6-5 | placed |
| srch-match-bool-prefix | · · · 마지막 토큰 접두 질의 (MECHANISM) | study/19 §E · 레포 구현 | placed |
| srch-prefix-term-enumeration | · · · 텀 사전 접두 열거 (MECHANISM) | study/19 §H · #36 §8 | placed |
| srch-popular-query-suggestion | · · · 인기 질의 제안 (MECHANISM) | 지도 §3 (인기 질의) | placed |
| srch-jamo-decomposition | · · · 자모 분리 (MECHANISM) | #36 §7-1 · 7-2 | placed |
| srch-chosung-search | · · · 초성 검색 (MECHANISM) | #36 §7-3 | placed |
| srch-ngram-index-bloat | · · · n-gram 색인 비대 (PROBLEM) | 지도 §2 · #36 §3-2 | placed |
| srch-aggregation | · · 집계 · 패싯 (STAGE) | study/19 §I · #07 §9 · #26 | placed |
| srch-bucket-aggregation | · · · 버킷 집계 (MECHANISM) | study/19 §I · #26 | placed |
| srch-composite-aggregation | · · · · 컴포지트 집계 (MECHANISM) | study/19 §I · #26 | placed |
| srch-significant-terms | · · · · 유의 텀 (MECHANISM) | study/19 §I · #26 | placed |
| srch-geo-grid-aggregation | · · · · 지리 격자 집계 (MECHANISM) | study/19 §I · #30 | placed |
| srch-metric-aggregation | · · · 지표 집계 (MECHANISM) | study/19 §I · #26 | placed |
| srch-cardinality-hll | · · · · 고유 수 근사 (HyperLogLog++) (MECHANISM) | study/19 §I · #26 | placed |
| srch-percentiles-tdigest | · · · · 백분위 근사 (TDigest · HDR) (MECHANISM) | study/19 §I · #26 | placed |
| srch-top-hits | · · · · 그룹별 상위 문서 (MECHANISM) | study/19 §I · #26 | placed |
| srch-pipeline-aggregation | · · · 파이프라인 집계 (MECHANISM) | study/19 §I · #26 | placed |
| srch-faceted-navigation | · · · 패싯 내비게이션 (MECHANISM) | 지도 §3 (필터 / facet) · 분야 표준 | placed |
| srch-terms-agg-inaccuracy | · · · 분산 terms 집계 오차 (PROBLEM) | #07 §12-8 · 분야 표준 | placed |
| srch-result-presentation | · · 결과 구성 (STAGE) | 지도 §1 (결과 · 하이라이팅) | placed |
| srch-highlighting | · · · 하이라이팅 (MECHANISM) | 지도 §1 · #07 §8 | placed |
| srch-rag | · · · RAG (검색 증강 생성) (MECHANISM) | study/19 §Q (Conversational Search / RAG) | placed |
| search-evaluation | · 검색 평가 (DOMAIN) | 기존 · 지도 §8 · #34 · #45 | placed |
| judgment-set-building | · · 판정 세트 구축 (STAGE) | 기존 · 지도 §8 | placed |
| pooling | · · · 풀링 (MECHANISM) | 기존 · 지도 §8 · #46 §6.1 | placed |
| judgment-coverage | · · · 커버리지 (METRIC) | 기존 · 벡터 노트 A 결정 02 | placed |
| click-weak-labels | · · · 클릭 약지도 라벨 (MECHANISM) | 기존 · study/19 §H (graded 5 등급) | placed |
| position-bias | · · · 위치 편향 (PROBLEM) | 기존 · 지도 §6 · §8 · study/19 §H | placed |
| srch-llm-judgment | · · · LLM 판정 초안 (MECHANISM) | 벡터 노트 A (판정 출처) | placed |
| srch-inter-annotator-agreement | · · · 판정 일관성 검사 (MECHANISM) | #46 §6.1.1 | placed |
| srch-pooling-bias | · · · 풀링 편향 (PROBLEM) | 지도 §8 · 벡터 노트 A 결정 02 · E §06 | placed |
| srch-small-query-set | · · · 질의 수 부족 (PROBLEM) | 벡터 노트 A 결정 03 · #46 §6.2 | placed |
| offline-evaluation | · · 오프라인 평가 (STAGE) | 기존 · 지도 §8 · #34 | placed |
| ndcg | · · · nDCG (METRIC) | 기존 · 지도 §8 · #34 §3-8 | placed |
| recall-precision | · · · 재현율 · 정밀도 (METRIC) | 기존 · #34 | placed |
| srch-precision-at-k | · · · Precision@k (METRIC) | #34 §3-1 | placed |
| srch-recall-at-k | · · · Recall@k (METRIC) | 지도 §8 · #34 §3-2 | placed |
| srch-f1-score | · · · F1 (METRIC) | #34 §3-3 | placed |
| srch-mrr | · · · MRR (METRIC) | 지도 §8 · #34 §3-4 | placed |
| srch-map | · · · MAP (METRIC) | 지도 §8 · #34 §3-5 | placed |
| srch-dcg | · · · DCG (METRIC) | #34 §3-6 | placed |
| srch-idcg | · · · IDCG (METRIC) | #34 §3-7 | placed |
| srch-err | · · · ERR (기대 역순위) (METRIC) | study/19 §H (_rank_eval ERR) · 분야 표준 | placed |
| srch-intra-list-diversity | · · · 목록 내 다양성 (METRIC) | study/19 §H (diversity-metric) | placed |
| srch-per-query-delta-analysis | · · · 질의별 델타 분석 (MECHANISM) | 벡터 노트 A 결정 05 | placed |
| srch-query-leakage | · · · 쿼리 누수 (PROBLEM) | study/19 §H (leakage) · #34 §6-6 | placed |
| srch-offline-online-gap | · · · 오프라인-온라인 괴리 (PROBLEM) | 지도 §8 | placed |
| srch-popularity-overfitting | · · · 인기 편향 과적합 (PROBLEM) | study/19 §H | placed |
| srch-diversity-collapse | · · · 다양성 붕괴 (PROBLEM) | study/19 §H | placed |
| online-evaluation | · · 온라인 평가 (STAGE) | 기존 · 지도 §8 · #45 | placed |
| interleaving | · · · 인터리빙 (MECHANISM) | 기존 · 지도 §8 | placed |
| team-draft-interleaving | · · · · 팀 드래프트 인터리빙 (MECHANISM) | 기존 · study/19 §H | placed |
| ab-test | · · · A/B 테스트 (MECHANISM) | 기존 · 지도 §8 | placed |
| impression-click-ledger | · · · 노출 · 클릭 원장 (MECHANISM) | 기존 · study/19 §G (event stream) | placed |
| propensity-logging | · · · 탐색 · 성향 로깅 (MECHANISM) | 기존 | placed |
| off-policy-evaluation | · · · 오프폴리시 평가 (MECHANISM) | 기존 · study/19 §H | placed |
| inverse-propensity-scoring | · · · · 성향 역수 가중 (MECHANISM) | 기존 · study/19 §G · §H | placed |
| srch-snips | · · · · · SNIPS (자기 정규화 IPS) (MECHANISM) | study/19 §H (estimator family) | placed |
| srch-doubly-robust | · · · · 이중 강건 추정 (MECHANISM) | study/19 §H (DR estimator) | placed |
| bandit-exploration | · · · 밴딧 · 탐색 (MECHANISM) | 기존 · #42 · #43 | placed |
| srch-thompson-sampling | · · · · Thompson Sampling (MECHANISM) | study/19 §G · #42 · #43 | placed |
| srch-epsilon-greedy | · · · · ε-greedy (MECHANISM) | study/19 §G · #43 | placed |
| srch-ucb1 | · · · · UCB1 (MECHANISM) | study/19 §G · #43 | placed |
| contextual-bandit | · · · · 컨텍스추얼 밴딧 (MECHANISM) | 기존 · #43 §6 | placed |
| srch-linucb | · · · · · LinUCB (MECHANISM) | study/19 §G · #43 §6 | placed |
| srch-neural-bandit | · · · · · 뉴럴 밴딧 (MECHANISM) | study/19 §G · #43 §7 | placed |
| srch-empirical-bayes-prior | · · · · 경험적 베이즈 사전 (MECHANISM) | study/19 §G · #42 §7 | placed |
| srch-temporal-decay | · · · · 시간 감쇠 (MECHANISM) | study/19 §G · #43 §11-3 | placed |
| srch-hybrid-bandit-score | · · · · 랭커 점수 × 밴딧 표본 결합 (MECHANISM) | study/19 §G · #43 §10 | placed |
| srch-impression-threshold | · · · · 노출 문턱 (MECHANISM) | study/19 §G · #43 §11-4 | placed |
| srch-sample-session-cache | · · · · 표본 세션 고정 (MECHANISM) | study/19 §G · #43 §11-5 | placed |
| srch-bandit-state-store | · · · · 팔 상태 저장 (MECHANISM) | study/19 §G (bandit-key-bucketing) | placed |
| srch-prior-only-degradation | · · · · 사전만으로 강등 (MECHANISM) | study/19 §G (graceful-degradation) | placed |
| srch-slate-bandit | · · · · 슬레이트 · 캐스케이드 밴딧 (MECHANISM) | study/19 §G (slate-cascade 후속) | placed |
| srch-north-star-guardrail | · · · 노스스타 · 가드레일 지표 (MECHANISM) | study/19 §H · #45 §5-2 | placed |
| srch-shadow-traffic | · · · 섀도 트래픽 (MECHANISM) | study/19 §H · #45 §9-2 | excluded — 같은 개념 infra-shadow-traffic 로 합쳤다 |
| srch-ramp-up | · · · 단계적 확대 (MECHANISM) | study/19 §H · #45 §9-4 | placed |
| srch-ab-sample-size | · · · 표본 크기 · 유의성 검정 (MECHANISM) | study/19 §H · #45 §9-3 | placed |
| srch-sequential-testing | · · · · 순차 검정 (MECHANISM) | study/19 §H (SPRT) | placed |
| srch-click-models | · · · 클릭 모델 (MECHANISM) | study/19 §H (click model) | placed |
| srch-position-based-model | · · · · 위치 기반 모델 (PBM) (MECHANISM) | study/19 §H (PBM) | placed |
| srch-cascade-model | · · · · 캐스케이드 모델 (MECHANISM) | study/19 §H (Cascade) | placed |
| srch-dbn-click-model | · · · · DBN 클릭 모델 (MECHANISM) | study/19 §H (DBN · UBM) | placed |
| srch-propensity-estimation | · · · 성향 추정 (MECHANISM) | study/19 §H · #45 §7-3 | placed |
| srch-random-exploration | · · · 무작위 탐색 트래픽 (MECHANISM) | study/19 §H · #45 §8 | placed |
| srch-ctr | · · · CTR (METRIC) | 지도 §8 · study/19 §H | excluded — 같은 개념 ctr 로 합쳤다 |
| srch-conversion-rate | · · · 전환율 (METRIC) | 지도 §8 · study/19 §H | placed |
| srch-requery-rate | · · · 재질의율 (METRIC) | 지도 §8 · study/19 §H | placed |
| srch-dwell-time | · · · 체류 시간 (METRIC) | study/19 §H (graded 등급 dwell) · 분야 표준 | placed |
| srch-abandonment-rate | · · · 이탈률 (METRIC) | study/19 §H (Bounce) | placed |
| srch-regret | · · · 후회 (regret) (METRIC) | study/19 §G (regret-bound) | placed |
| srch-exposure-bias | · · · 노출 편향 (PROBLEM) | study/19 §H · #45 §6-2 | placed |
| srch-feedback-loop | · · · 되먹임 고리 (PROBLEM) | study/19 §H · #45 §6-3 | placed |
| srch-peeking-problem | · · · 중간 엿보기 (PROBLEM) | study/19 §H (peeking bias) | placed |
| srch-sample-ratio-mismatch | · · · 표본 비율 불일치 (SRM) (PROBLEM) | 분야 표준 | placed |
| srch-ranking-flicker | · · · 순위 깜빡임 (PROBLEM) | study/19 §G (session-cache flicker) · #20 Q-M6 | placed |
| srch-relevance-debugging | · · 적합도 디버깅 (STAGE) | #05 §10 · #06 §7 | placed |
| srch-analyze-api | · · · 분석 결과 확인 (MECHANISM) | #04 §8 · #05 §10 | placed |
| srch-score-explain | · · · 점수 설명 (MECHANISM) | study/19 §H · #06 §7 | placed |
| srch-query-profiling | · · · 질의 프로파일링 (MECHANISM) | study/19 §H · §P · #39 §10 | placed |
| search-ops-monitoring | · · 운영 관측 (STAGE) | 기존 · 지도 §9 · #16 | placed |
| latency-percentile | · · · 지연 · P99 (METRIC) | 기존 | placed |
| fallback-rate | · · · 폴백률 (METRIC) | 기존 | placed |
| cache-hit-rate | · · · 캐시 적중률 (METRIC) | 기존 | placed |
| search-node-memory | · · · 검색 노드 메모리 (METRIC) | 기존 · 지도 §9 | placed |
| page-cache-eviction | · · · 페이지 캐시 밀림 (PROBLEM) | 기존 · 지도 §5 · §9 | placed |
| srch-vector-memory-footprint | · · · 벡터 상주량 (METRIC) | 지도 §5 (상주량 식) · #41 §9 | placed |
| srch-qps | · · · 처리량 (QPS) (METRIC) | #16 §5-2 · 분야 표준 | placed |
| srch-slow-log | · · · 슬로 로그 (MECHANISM) | study/19 §P · #16 §4 | placed |
| search-serving | · 검색 서빙 · 운영 (DOMAIN) | 지도 §9 · #12 | placed |
| srch-cluster-topology | · · 클러스터 구성 (STAGE) | #12 | placed |
| srch-node-roles | · · · 노드 역할 (MECHANISM) | #12 §2 | placed |
| srch-shard | · · · 샤드 (MECHANISM) | 지도 §9 · study/19 §C · #12 §3 | placed |
| srch-replica | · · · 레플리카 (MECHANISM) | 지도 §9 · study/19 §C · #12 §5 | placed |
| srch-shard-sizing | · · · 샤드 크기 산정 (MECHANISM) | #12 §4 | placed |
| srch-custom-routing | · · · 커스텀 라우팅 (MECHANISM) | 지도 §9 · #12 §8 · #38 §7-2 | placed |
| srch-shard-allocation | · · · 샤드 할당 · 인지 (MECHANISM) | study/19 §C · #12 §6 · §7 | placed |
| srch-shard-split-shrink | · · · 샤드 수 변경 (MECHANISM) | study/19 §K · #39 §6-4 | placed |
| srch-master-quorum | · · · 마스터 선출 · 쿼럼 (MECHANISM) | #12 §2-2 · #17 시나리오 2 | placed |
| srch-cross-cluster-search | · · · 교차 클러스터 검색 (MECHANISM) | study/19 §L · #31 | placed |
| srch-cross-cluster-replication | · · · 교차 클러스터 복제 (MECHANISM) | study/19 §L · #31 | placed |
| srch-oversharding | · · · 샤드 과다 (PROBLEM) | #12 §13-1 | placed |
| srch-hot-shard | · · · 핫 샤드 (PROBLEM) | #12 §13-5 | placed |
| srch-query-execution | · · 분산 질의 실행 (STAGE) | 지도 §9 | placed |
| srch-scatter-gather | · · · 스캐터-개더 (query then fetch) (MECHANISM) | 지도 §9 (라우팅) · 분야 표준 | placed |
| srch-dfs-query-then-fetch | · · · 전역 통계 보정 (DFS) (MECHANISM) | 분야 표준 | placed |
| srch-adaptive-replica-selection | · · · 적응형 레플리카 선택 (MECHANISM) | 분야 표준 | placed |
| srch-deep-paging | · · · 딥 페이징 (MECHANISM) | 지도 §9 · #07 §10 | placed |
| srch-from-size | · · · · 오프셋 페이징 (from + size) (MECHANISM) | 지도 §9 · #07 §10-1 · #37 §5-7 | placed |
| srch-search-after | · · · · 커서 페이징 (search_after) (MECHANISM) | 지도 §9 · study/19 §H · #24 | placed |
| srch-point-in-time | · · · · 시점 고정 (PIT) (MECHANISM) | study/19 §H · #24 | placed |
| srch-scroll | · · · · 스크롤 (MECHANISM) | 지도 §9 · study/19 §H | placed |
| srch-async-search | · · · 비동기 검색 (MECHANISM) | study/19 §H · §Q · #39 §5 | placed |
| srch-multi-search-batching | · · · 다중 검색 묶음 (MECHANISM) | study/19 §H · #39 §3-1 | placed |
| srch-search-timeout-partial | · · · 타임아웃 · 부분 결과 (MECHANISM) | 지도 §9 (지연 예산) · 분야 표준 | placed |
| srch-shard-local-idf-skew | · · · 샤드별 IDF 편차 (PROBLEM) | 분야 표준 | placed |
| srch-deep-paging-cost | · · · 딥 페이징 비용 (PROBLEM) | 지도 §9 | placed |
| srch-tail-latency | · · · 꼬리 지연 (PROBLEM) | 분야 표준 · 지도 §9 | placed |
| srch-search-caching | · · 캐시 계층 (STAGE) | 지도 §9 (캐시 계층) | placed |
| srch-os-page-cache | · · · OS 페이지 캐시 (mmap) (MECHANISM) | 지도 §9 | excluded — 같은 개념 data-page-cache 로 합쳤다 |
| srch-filter-cache | · · · 필터 캐시 (MECHANISM) | 지도 §9 · #07 §13-3 | placed |
| srch-request-cache | · · · 요청 결과 캐시 (MECHANISM) | 지도 §9 | placed |
| srch-latency-budgeting | · · 지연 예산 (STAGE) | 지도 §9 · 벡터 노트 E §07 | placed |
| srch-per-stage-latency-budget | · · · 단계별 지연 예산 (MECHANISM) | 지도 §9 · 벡터 노트 E §07 · #46 §7.2 | placed |
| srch-cluster-operations | · · 클러스터 운영 (STAGE) | #16 · #17 | placed |
| srch-cluster-health | · · · 클러스터 상태 색 (MECHANISM) | #12 §9 · #16 §2 · #39 §8 | placed |
| srch-disk-watermark | · · · 디스크 워터마크 (MECHANISM) | #12 §9-4 · #16 | placed |
| srch-hot-threads | · · · 핫 스레드 진단 (MECHANISM) | study/19 §P · #16 §3 | placed |
| srch-memory-circuit-breaker | · · · 메모리 서킷 브레이커 (MECHANISM) | 분야 표준 · study/19 템플릿 §7 | placed |
| srch-snapshot-restore | · · · 스냅숏 · 복구 (MECHANISM) | study/19 §K · #16 §7 | placed |
| srch-searchable-snapshot | · · · · 검색 가능 스냅숏 (MECHANISM) | study/19 §K · #31 §4 | placed |
| srch-index-lifecycle | · · · 인덱스 수명 관리 (MECHANISM) | study/19 §K · #13 §6 · §7 | placed |
| srch-rollover | · · · · 롤오버 (MECHANISM) | #13 §6-4 · #40 §4 | placed |
| srch-hot-warm-cold | · · · · 핫 · 웜 · 콜드 계층 (MECHANISM) | #13 §6-2 | placed |
| srch-time-series-indexing | · · · 시계열 색인 (MECHANISM) | study/19 §C · #40 | placed |
| srch-data-stream | · · · · 데이터 스트림 (MECHANISM) | study/19 §C · #40 §3 | placed |
| srch-downsampling | · · · · 다운샘플링 (MECHANISM) | study/19 §A · §C · #40 §6 | placed |
| srch-entity-transform | · · · · 엔티티 피벗 변환 (MECHANISM) | study/19 §K · #40 §7 | placed |
| srch-update-by-query | · · · 질의 기반 일괄 갱신 · 삭제 (MECHANISM) | study/19 §K · #39 §6 | placed |
| srch-task-management | · · · 장기 작업 관리 (MECHANISM) | study/19 §P · #39 §7 | placed |
| srch-disk-flood-stage | · · · 디스크 가득 (읽기 전용 전환) (PROBLEM) | #16 §9-4 · #17 시나리오 3 | placed |
| srch-thread-pool-rejection | · · · 스레드 풀 거부 (PROBLEM) | #17 시나리오 4 · #20 Q11 · 벡터 노트 A 결정 04 | placed |
| search-glossary | · 검색 용어 사전 (TERM) | 기존 | placed |
| srch-two-time-axes | · · 색인 타임 · 질의 타임 (TERM) | 지도 §1 | placed |
| srch-search-workload-types | · · 검색 · 조회 · 분석 워크로드 (TERM) | #01 §1 | placed |
| glossary-scoring | · · 점수 용어 (TERM) | #06 | placed |
| srch-relevance-score | · · · 관련도 점수 (_score) (TERM) | #01 §4 | placed |
| srch-term-frequency | · · · 텀 빈도 (TF) (TERM) | #06 §2 | placed |
| srch-inverse-document-frequency | · · · 역문서 빈도 (IDF) (TERM) | #06 §2-2 | placed |
| glossary-index | · · 색인 용어 (TERM) | #03 | placed |
| srch-doc-id | · · · 내부 문서 번호 (doc id) (TERM) | #03 §6 | placed |
| srch-near-real-time | · · · 준실시간 (NRT) (TERM) | study/19 §C · #02 | placed |
| srch-meta-fields | · · · 메타 필드 (TERM) | study/19 §A · #38 §7 | placed |
| glossary-morphology | · · 형태소 분석 용어 (TERM) | 기존 | placed |
| morpheme | · · · 형태소 (TERM) | 기존 | placed |
| surface-form | · · · 표층형 (TERM) | 기존 | placed |
| pos-tag | · · · 품사 태그 (TERM) | 기존 · #05 §7 | placed |
| lattice | · · · 격자 (TERM) | 기존 | placed |
| word-cost | · · · 단어 비용 (TERM) | 기존 | placed |
| connection-cost | · · · 연접 비용 (TERM) | 기존 | placed |
| context-id | · · · 문맥 ID (TERM) | 기존 | placed |
| glossary-vector | · · 벡터 검색 용어 (TERM) | 기존 | placed |
| srch-embedding-vector | · · · 임베딩 (TERM) | #08 §3 | placed |
| srch-vector-dimension | · · · 차원 (TERM) | #08 · 벡터 노트 A 결정 06 | placed |
| cosine-similarity | · · · 코사인 유사도 (TERM) | 기존 · 지도 §5 · #08 §4 | placed |
| srch-dot-product | · · · 내적 (TERM) | 지도 §5 · #08 §4 · #41 §5 | placed |
| srch-euclidean-distance | · · · 유클리드 거리 (L2) (TERM) | 지도 §5 · #08 §4 | placed |
| srch-hamming-distance | · · · 해밍 거리 (TERM) | 분야 표준 (이진 양자화) | placed |
| srch-codebook | · · · 코드북 (TERM) | 지도 §5 (PQ 코드북) | placed |
| glossary-learning | · · 학습 · 평가 용어 (TERM) | 기존 | placed |
| ltr-loss-families | · · · 랭킹 손실 세 갈래 (TERM) | 기존 · #10 §5-2 | placed |
| exploration-exploitation | · · · 탐색 · 활용 (TERM) | 기존 · #42 | placed |
| beta-bernoulli-conjugate | · · · 베타-베르누이 켤레 (TERM) | 기존 · study/19 §G | placed |
| srch-bayesian-update | · · · 베이즈 갱신 (TERM) | study/19 §G · #42 §3 | placed |
| srch-bandit-arm | · · · 팔 (arm) (TERM) | #43 §2 | placed |
| srch-propensity-score | · · · 성향 (노출 확률) (TERM) | study/19 §H · #45 §7 | placed |
| judgment-set | · · · 판정 세트 (TERM) | 기존 · #34 §2-3 | placed |
| graded-relevance | · · · 등급 척도 (TERM) | 기존 · 지도 §8 | placed |
| ranking-features | · · · 랭킹 피처 (TERM) | 기존 · 지도 §6 · #10 §5-3 | placed |
| srch-query-doc-features | · · · · 질의-문서 일치 피처 (TERM) | 지도 §6 | placed |
| srch-static-doc-features | · · · · 문서 정적 피처 (TERM) | 지도 §6 | placed |
| srch-behavioral-features | · · · · 행동 피처 (TERM) | 지도 §6 | placed |
| srch-contextual-features | · · · · 문맥 피처 (TERM) | 지도 §6 · study/19 §G (contextual-feature-eng) | placed |
| srch-eval-2x2 | · · · 평가 2×2 (단계 × 환경) (TERM) | study/19 §H (online-offline-axis) | placed |
| srch-geohash | · · 지오해시 (TERM) | study/19 §I · #30 | placed |

## 제외

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| srch-cdc | CDC (Debezium 변경 데이터 캡처) | #14 §5 | excluded — owned by distributed (outbox-pattern 곁). 검색 쪽 적용은 srch-change-capture-indexing 이 USES 로 잇는다 |
| srch-dual-write | 이중 쓰기 | #14 §2 | excluded — owned by distributed (dist-dual-write) |
| srch-idempotent-consumer | 멱등 소비자 | #14 §7 · 지도 §9 | excluded — owned by distributed (idempotency). 검색 쪽 적용은 srch-external-versioning |
| srch-split-brain | 스플릿 브레인 · 네트워크 분할 | #17 시나리오 5 | excluded — owned by distributed (dist-split-brain · dist-network-partition) |
| srch-rto-rpo | RTO · RPO 일반 | #16 §8 · #20 Q14 | excluded — owned by distributed (회복성). 검색 고유 값은 srch-reindex-rto |
| srch-golden-signals | 4 Golden Signals · Prometheus/Grafana | #16 §5 · §6 | excluded — owned by observability |
| srch-alerting-watcher | Watcher · Alerting · Notifications | study/19 §M · §Q | excluded — owned by observability |
| srch-os-observability | OpenSearch Observability(트레이스·메트릭 UI) | study/19 §Q | excluded — owned by observability |
| srch-anomaly-detection | Anomaly Detection ML · RCF · Categorization ML | study/19 §M · §Q | excluded — owned by observability (검색이 아닌 이상 탐지) |
| srch-security-analytics | Security Analytics (SIEM) | study/19 §Q | excluded — owned by security |
| srch-auth-realms | 인증 realm · API key · 서비스 계정 | study/19 §L | excluded — owned by security |
| srch-index-rbac | 인덱스 · 클러스터 권한 RBAC | study/19 §L | excluded — owned by security (rbac) |
| srch-dls-fls | 문서 · 필드 수준 보안 (DLS/FLS) | study/19 §L | excluded — owned by security |
| srch-audit-tls | 감사 로그 · TLS/mTLS · 저장 암호화 | study/19 §L | excluded — owned by security |
| srch-pii-redact | Redact · Fingerprint 프로세서 (PII 마스킹) | study/19 §J | excluded — owned by security |
| srch-on-failure-dlq | 인제스트 on_failure → DLQ | study/19 §J | excluded — owned by distributed (dist-dead-letter-queue) |
| srch-compressed-oops | 힙 32GB 경계 (압축 포인터) | #12 §13-3 | excluded — owned by runtime |
| srch-k8s-operator | ECK · OpenSearch Operator · PDB | #16 §10 | excluded — owned by infrastructure |
| srch-node-capacity | 노드 requests · limits 합산 | 벡터 노트 I | excluded — owned by infrastructure |
| srch-engine-probe | 같은 이미지 엔진 프로브 | 벡터 노트 A 체크리스트 06 | excluded — owned by testing (testcontainers · integration-test) |
| srch-silent-green | 재는 게 없는 초록불 · 값이 안 변한 수정 | 지도 §8 · 벡터 노트 E §08 | excluded — owned by testing (test-false-green) |
| srch-default-off-launch | 기본 꺼진 채 배포 | 벡터 노트 A 체크리스트 07 | excluded — owned by infrastructure (점진 배포) |
| srch-cold-start | 콜드 스타트 (신상품 클릭 0) | study/19 §G · #42 §7 · #20 Q-M5 | excluded — owned by recommendation. 검색 쪽 대응은 srch-empirical-bayes-prior · srch-exposure-bias |
| srch-fatigue-saturation | 사용자 피로 · 포화 모델 | study/19 §H 후속 | excluded — owned by recommendation |
| srch-gmv-aov | GMV · AOV | study/19 §H (online-metrics-catalog) | excluded — owned by commerce-order |
| srch-retention | 리텐션 | study/19 §H (online-metrics-catalog) | excluded — 제품 지표라 검색 개념이 아니다(가드레일로 쓸 뿐) |
| srch-ad-blending | 광고 구분 · 혼합 노출 | 지도 §6 (정책 규칙) | excluded — owned by ads |
| srch-gin-index | PostgreSQL GIN · 해시 인덱스 비교 | #03 §5 | excluded — owned by data (RDB 인덱스). 역색인과의 대비는 inverse-index ALTERNATIVE_TO b-tree |
| srch-constant-keyword | constant_keyword 필드 | study/19 §A | excluded — 벤더 한정 필드 타입이라 개념이 아니다(개념은 index-mapping) |
| srch-date-nanos | date · date_nanos 필드 | study/19 §A | excluded — 벤더 한정 필드 타입(정밀도 설정값) |
| srch-ip-version-field | ip · version 필드 | study/19 §A | excluded — 벤더 한정 필드 타입 |
| srch-boolean-binary-field | boolean · binary 필드 | study/19 §A | excluded — 벤더 한정 필드 타입 |
| srch-field-alias | 필드 별칭 (alias field) | study/19 §A | excluded — 벤더 한정 매핑 설정값 |
| srch-ignore-malformed | ignore_above · ignore_malformed · null_value | study/19 §B · #38 §5 | excluded — 벤더 한정 매핑 파라미터 |
| srch-subobjects | subobjects: false | study/19 §B · #38 §4-4 | excluded — 벤더 한정 매핑 파라미터 |
| srch-dsl-lifecycle | Data Stream Lifecycle (DSL) | study/19 §C · §K · #40 §5 | excluded — 벤더 한정 설정(개념은 srch-index-lifecycle) |
| srch-rollups | Rollups (폐기) | study/19 §K | excluded — 폐기된 기능(후속 개념 srch-downsampling) |
| srch-reindex-api | _reindex API | study/19 §K · #13 §5 | excluded — 벤더 API 이름(개념은 index-rebuild) |
| srch-count-api | _count | study/19 §H | excluded — 벤더 API 이름이라 개념이 아니다 |
| srch-field-caps | _field_caps | study/19 §H · #39 §3-3 | excluded — 벤더 API 이름(필드 메타 조회) |
| srch-search-shards | _search_shards | study/19 §H · #39 §3-4 | excluded — 벤더 API 이름(개념은 srch-scatter-gather) |
| srch-validate-api | _validate/query | study/19 §H · #39 §3-5 | excluded — 벤더 API 이름 |
| srch-cat-apis | _cat · _nodes/stats · _cluster/stats | study/19 §P · #39 §9 | excluded — 벤더 운영 API(개념은 srch-cluster-health) |
| srch-rank-eval-api | _rank_eval | study/19 §H · #34 §7 | excluded — 벤더 API(개념은 offline-evaluation) |
| srch-retrievers-api | Retrievers API | study/19 §H · #23 | excluded — 벤더 API(개념은 rrf · srch-weighted-score-fusion · srch-query-rescore) |
| srch-hybrid-query-dsl | OpenSearch hybrid 질의 타입 | study/19 §Q · #29 | excluded — 벤더 질의 타입(개념은 rank-fusion) |
| srch-vector-tile | _mvt 벡터 타일 | study/19 §H · #30 §5 | excluded — 벤더 API(지도 응답 포맷) |
| srch-search-application | Search Application API | study/19 §H | excluded — 벤더 API(개념은 srch-query-rules · srch-search-template) |
| srch-behavioral-analytics | Behavioral Analytics | study/19 §H | excluded — 벤더 기능(개념은 impression-click-ledger) |
| srch-inference-api | Inference API | study/19 §M · #28 | excluded — 벤더 API(개념은 srch-ingest-inference) |
| srch-elser-model | ELSER | study/19 §M · #28 | excluded — 벤더 모델 이름(개념은 srch-learned-sparse) |
| srch-e5-model | E5 multilingual | study/19 §M · #28 | excluded — 특정 모델 이름(개념은 embedding-model) |
| srch-knn-engines | k-NN 엔진 faiss · nmslib · lucene | study/19 §Q · #41 §7 | excluded — 벤더 엔진 이름(알고리즘 hnsw · srch-ivf · srch-product-quantization 이 개념) |
| srch-text-expansion | text_expansion 질의 (폐기) | study/19 §G | excluded — 폐기된 벤더 질의 |
| srch-wrapper-query | wrapper 질의 | study/19 §G | excluded — 벤더 질의 포장 형식이라 개념이 아니다 |
| srch-script-query | script 질의 | study/19 §G | excluded — 벤더 스크립트 질의(개념은 srch-script-score · srch-expensive-query) |
| srch-painless | Painless · 저장 스크립트 · 스크립트 컨텍스트 | study/19 §O | excluded — 벤더 스크립트 언어 |
| srch-ingest-processors | 인제스트 프로세서 40여 종 · simulate API | study/19 §J | excluded — 벤더 프로세서 목록(개념은 srch-ingest-pipeline) |
| srch-remote-cluster-mode | 원격 클러스터 sniff · proxy 모드 | study/19 §L · #31 | excluded — 벤더 연결 설정값 |
| srch-esql | ES-QL (Elasticsearch Query Language) | study/19 §N · #33 | excluded — 벤더 질의 언어(분석용 문법) |
| srch-eql | EQL | study/19 §N · #33 | excluded — 벤더 질의 언어(보안 이벤트 시퀀스) |
| srch-sql-api | SQL API · JDBC | study/19 §N · #33 | excluded — 벤더 질의 언어 |
| srch-ppl | PPL | study/19 §N · §Q · #33 | excluded — 벤더 질의 언어 |
| srch-es-vs-opensearch | ES vs OpenSearch 라이선스 · 분기 | #11 · #01 §3 | excluded — 제품 선택 이력이라 개념이 아니다 |
| srch-korean-analyzer-products | seunjeon · open-korean-text 등 분석기 비교 | #05 §3 | excluded — 레포에 없는 제품 이름(개념은 lattice-viterbi · srch-ngram-tokenizer) |
| srch-bandit-event-stream | 밴딧 이벤트 토픽 3종 | study/19 §G · #44 | excluded — 구현 세부(개념은 impression-click-ledger) |
| srch-ab-vs-bandit | A/B 대 밴딧 선택 | study/19 §G | excluded — 관계라 노드가 아니다(bandit-exploration ALTERNATIVE_TO ab-test) |
| srch-decay-vs-thompson | gauss 감쇠 대 Thompson 비교 | #42 §6 · #43 §9 | excluded — 비교(관계)라 노드가 아니다 |
| srch-ts-non-bernoulli | 가우시안 · 로그정규 보상 TS | study/19 §G 후속 | excluded — srch-thompson-sampling 의 보상 분포 변형이라 별도 개념이 아니다 |
| srch-hit-rate-breakeven | 사전 적중률 손익분기 | 벡터 노트 I | excluded — 판단 계산이라 개념이 아니다(srch-precomputed-query-dictionary 대 live-encoding 의 근거) |
| srch-source-exclude-gotcha | 벡터를 _source 에서 빼면 색인이 커짐 | 벡터 노트 A | excluded — 벤더 구현 함정이라 개념이 아니다 |
| srch-hybrid-sort-reject | 하이브리드 질의 정렬 거부 | 벡터 노트 A | excluded — 벤더 구현 함정이라 개념이 아니다 |
| srch-code-length-depth | 코드 길이로 깊이 유도 금지 | 벡터 노트 E §05 | excluded — 수집 구현 함정(개념은 raw-preservation) |
