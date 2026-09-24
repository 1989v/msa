# CS 기초 — 커버리지 체크리스트

원천:
- 레포 운영 행 — 지난 라운드 cs-fundamentals.yaml 의 50 개 개념 (id 유지)
- 레포 코드 — `career/coding-test/kotlin-template.kt`(유니온 파인드 · 분할 거듭제곱 · 최대공약수), 온톨로지 그래프 · 순환 탐지, BFS 길찾기, 이진 탐색, 결정적 난수, A/B 버킷 해시
- `study/docs/9-redis-deep-dive/` 99-concept-catalog §A · §J(HyperLogLog · Bloom · Cuckoo · Count-Min · TopK · 스킵 리스트 · radix 트리 · listpack)
- 분야 표준 — CLRS 「Introduction to Algorithms」 2~34장 목차, Sedgewick 「Algorithms」 1~6장, CS:APP 2장(정수 · 부동 소수점 표현) · 6장(지역성), 코딩 테스트 표준 기법(투 포인터 · 슬라이딩 윈도 · 누적 합 · 단조 스택)

배치 합계: placed 148 / excluded 7. 행 순서는 온톨로지 계층(복잡도 → 순차 저장 → 키 조회 → 확률적 요약 → 계층 → 그래프 → 경로 · 연결성 → 탐색 · 정렬 → 문자열 → 설계 기법 → 수 · 비트 → 용어 사전)을 따른다.

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| cs-fundamentals | CS 기초 (DOMAIN) | 운영 행 | placed |
| cs-complexity-analysis | 복잡도 분석 (STAGE) | 운영 행 | placed |
| cs-asymptotic-analysis | 점근 분석 (MECHANISM) | 분야 표준(CLRS 목차) 3장 | placed |
| cs-amortized-analysis | 분할 상환 분석 (MECHANISM) | 운영 행 | placed |
| cs-master-theorem | 마스터 정리 (MECHANISM) | 분야 표준(CLRS 목차) 4장 | placed |
| cs-time-complexity | 시간 복잡도 (METRIC) | 운영 행 | placed |
| cs-space-complexity | 공간 복잡도 (METRIC) | 운영 행 | placed |
| cs-sequential-storage | 순차 데이터 저장 (STAGE) | 운영 행 | placed |
| array | 배열 (MECHANISM) | 운영 행 | placed |
| cs-dynamic-array | 동적 배열 (MECHANISM) | 운영 행 (array 동의어에서 분리) · 분야 표준(CLRS 목차) 17장 | placed |
| linked-list | 연결 리스트 (MECHANISM) | 운영 행 | placed |
| cs-doubly-linked-list | 이중 연결 리스트 (MECHANISM) | 분야 표준(CLRS 목차) 10장 | placed |
| stack | 스택 (MECHANISM) | 운영 행 | placed |
| cs-monotonic-stack | 단조 스택 (MECHANISM) | 분야 표준(코딩 테스트 표준 기법) | placed |
| queue | 큐 (MECHANISM) | 운영 행 | placed |
| cs-deque | 덱 (MECHANISM) | 운영 행 (queue 동의어에서 분리) · 분야 표준(CLRS 목차) | placed |
| cs-priority-queue | 우선순위 큐 (MECHANISM) | 운영 행 (heap 동의어에서 분리) · 분야 표준(CLRS 목차) 6장 | placed |
| cs-circular-buffer | 원형 버퍼 (MECHANISM) | 분야 표준 · 레포 SSE 최근 시세 버퍼 | placed |
| cs-key-lookup | 키 조회 구조 설계 (STAGE) | 운영 행 | placed |
| hash-map | 해시맵 (MECHANISM) | 운영 행 | placed |
| cs-separate-chaining | 체이닝 (MECHANISM) | 분야 표준(CLRS 목차) 11장 | placed |
| cs-open-addressing | 개방 주소법 (MECHANISM) | 분야 표준(CLRS 목차) 11장 | placed |
| cs-rehashing | 재해싱 (MECHANISM) | 분야 표준(CLRS 목차) 11장 · study/9 04 §7 | placed |
| skip-list | 스킵 리스트 (MECHANISM) | 운영 행 | placed |
| lru-cache | LRU 캐시 (MECHANISM) | study/9 05 §3 (eviction) · 분야 표준(LeetCode 146 · 면접 표준) | placed |
| cs-hash-collision | 해시 충돌 (PROBLEM) | 운영 행 | placed |
| cs-load-factor | 적재율 (METRIC) | 운영 행 | placed |
| consistent-hashing | 일관된 해싱 | 분야 표준 | excluded — owned by distributed (consistent-hashing) |
| cs-concurrent-collections | 동시 컬렉션(ConcurrentHashMap · 락 없는 큐) | 분야 표준 | excluded — owned by concurrency |
| cs-crypto-hash | 암호 해시 함수(SHA-256) | 분야 표준 | excluded — owned by security (hashing) |
| cs-probabilistic-sketching | 확률적 요약 (STAGE) | 분야 표준(확률적 자료 구조) · study/9 99 §J | placed |
| bloom-filter | 블룸 필터 (MECHANISM) | 운영 행 · study/9 99 §J (RedisBloom) · study/19 (LSM 필터) | placed |
| cs-cuckoo-filter | 쿠쿠 필터 (MECHANISM) | study/9 99 갭 17 (Cuckoo) | placed |
| hyperloglog | HyperLogLog (MECHANISM) | study/9 02 §8 · 99 §A · 분야 표준(CLRS 목차) | placed |
| count-min-sketch | Count-Min Sketch (MECHANISM) | study/9 99 갭 17 (RedisBloom Count-Min · TopK) | placed |
| cs-reservoir-sampling | 저수지 샘플링 (MECHANISM) | 분야 표준(Sedgewick 「Algorithms」) · Redis 근사 LRU 표본 | placed |
| cs-minhash | MinHash (MECHANISM) | 분야 표준(「Mining of Massive Datasets」 3장) | placed |
| cs-false-positive | 거짓 양성 (PROBLEM) | 운영 행 | placed |
| cs-estimation-error | 추정 오차 (METRIC) | 분야 표준(확률적 자료 구조) | placed |
| cs-hierarchy-modeling | 계층 구조 표현 (STAGE) | 운영 행 | placed |
| tree | 트리 (MECHANISM) | 운영 행 | placed |
| binary-tree | 이진 트리 (MECHANISM) | 운영 행 | placed |
| cs-tree-traversal | 트리 순회 (MECHANISM) | 분야 표준(CLRS 목차) 12장 | placed |
| bst | 이진 탐색 트리 (MECHANISM) | 운영 행 | placed |
| cs-balanced-bst | 균형 탐색 트리 (MECHANISM) | 운영 행 | placed |
| cs-avl-tree | AVL 트리 (MECHANISM) | 운영 행 (cs-balanced-bst 동의어에서 분리) · 분야 표준(CLRS 목차) | placed |
| cs-red-black-tree | 레드-블랙 트리 (MECHANISM) | 운영 행 (cs-balanced-bst 동의어에서 분리) · 분야 표준(CLRS 목차) 13장 | placed |
| heap | 힙 (MECHANISM) | 운영 행 | placed |
| trie | 트라이 (MECHANISM) | 운영 행 | placed |
| cs-radix-tree | radix 트리 (MECHANISM) | study/9 99 §A (Stream radix tree) · 분야 표준(CLRS 목차) | placed |
| cs-segment-tree | 세그먼트 트리 (MECHANISM) | 분야 표준(경쟁 프로그래밍 표준 목차) | placed |
| cs-fenwick-tree | 펜윅 트리 (MECHANISM) | 분야 표준(경쟁 프로그래밍 표준 목차) | placed |
| b-tree | B-트리 · B+트리 | 분야 표준(CLRS 목차) 18장 | excluded — owned by data (b-tree 가 cs-balanced-bst 와 ALTERNATIVE_TO) |
| cs-lsm-tree | LSM 트리 | 분야 표준 | excluded — owned by data (data-lsm-tree) |
| cs-geohash | 지오해시 · 공간 분할 | 분야 표준 | excluded — owned by search (srch-geohash) |
| cs-tree-skew | 트리 편향 (PROBLEM) | 운영 행 | placed |
| cs-graph-modeling | 그래프 모델링 (STAGE) | 운영 행 | placed |
| graph | 그래프 (MECHANISM) | 운영 행 | placed |
| bfs | 너비 우선 탐색 (MECHANISM) | 운영 행 | placed |
| dfs | 깊이 우선 탐색 (MECHANISM) | 운영 행 | placed |
| topological-sort | 위상 정렬 (MECHANISM) | 운영 행 | placed |
| cs-dependency-cycle | 순환 의존 (PROBLEM) | 운영 행 | placed |
| cs-stack-overflow | 스택 오버플로 (PROBLEM) | 운영 행 | placed |
| recursion | 재귀 | 분야 표준 | excluded — owned by language (recursion 을 USES) |
| cs-path-and-connectivity | 경로 · 연결성 (STAGE) | 분야 표준(CLRS 목차) 22~26장 | placed |
| cs-shortest-path | 최단 경로 (MECHANISM) | 분야 표준(CLRS 목차) 24장 | placed |
| dijkstra | 다익스트라 (MECHANISM) | 분야 표준(CLRS 목차) 24장 | placed |
| bellman-ford | 벨만-포드 (MECHANISM) | 분야 표준(CLRS 목차) 24장 | placed |
| floyd-warshall | 플로이드-워셜 (MECHANISM) | 분야 표준(CLRS 목차) 25장 | placed |
| cs-a-star | A* 탐색 (MECHANISM) | 분야 표준(AI 탐색 · 게임 길찾기) | placed |
| cs-minimum-spanning-tree | 최소 신장 트리 (MECHANISM) | 분야 표준(CLRS 목차) 23장 | placed |
| kruskal | 크루스칼 (MECHANISM) | 분야 표준(CLRS 목차) 23장 | placed |
| prim | 프림 (MECHANISM) | 분야 표준(CLRS 목차) 23장 | placed |
| union-find | 유니온 파인드 (MECHANISM) | 분야 표준(CLRS 목차) 19장 · 레포 career/coding-test | placed |
| cs-strongly-connected-components | 강한 연결 요소 (MECHANISM) | 분야 표준(CLRS 목차) 22장 | placed |
| cs-max-flow | 최대 유량 (MECHANISM) | 분야 표준(CLRS 목차) 26장 | placed |
| cs-negative-cycle | 음수 순환 (PROBLEM) | 분야 표준(CLRS 목차) 24장 | placed |
| cs-search-and-sort | 탐색과 정렬 (STAGE) | 운영 행 | placed |
| sorting | 정렬 (MECHANISM) | 운영 행 | placed |
| cs-merge-sort | 병합 정렬 (MECHANISM) | 운영 행 (sorting 동의어에서 분리) · 분야 표준(CLRS 목차) 2장 | placed |
| cs-quick-sort | 퀵 정렬 (MECHANISM) | 운영 행 (sorting 동의어에서 분리) · 분야 표준(CLRS 목차) 7장 | placed |
| cs-heap-sort | 힙 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 6장 | placed |
| cs-insertion-sort | 삽입 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 2장 | placed |
| cs-selection-sort | 선택 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 2장 | placed |
| cs-bubble-sort | 버블 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 2장 | placed |
| cs-counting-sort | 계수 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 8장 | placed |
| cs-radix-sort | 기수 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 8장 | placed |
| cs-bucket-sort | 버킷 정렬 (MECHANISM) | 분야 표준(CLRS 목차) 8장 | placed |
| cs-timsort | 팀 정렬 (MECHANISM) | 분야 표준(JDK 정렬 구현) | placed |
| cs-external-sort | 외부 정렬 (MECHANISM) | 분야 표준(CLRS 목차) · study/4 09 (Using filesort) | placed |
| cs-quickselect | 퀵셀렉트 (MECHANISM) | 분야 표준(CLRS 목차) 9장 | placed |
| cs-linear-search | 순차 탐색 (MECHANISM) | 분야 표준(CLRS 목차) 2장 | placed |
| binary-search | 이진 탐색 (MECHANISM) | 운영 행 | placed |
| cs-parametric-search | 파라메트릭 서치 (MECHANISM) | 운영 행 (binary-search 동의어에서 분리) | placed |
| cs-quicksort-degeneration | 퀵 정렬 최악 퇴화 (PROBLEM) | 분야 표준(CLRS 목차) 7장 | placed |
| cs-string-processing | 문자열 처리 (STAGE) | 분야 표준(CLRS 목차) 32장 · 분야 표준(Sedgewick 「Algorithms」) 5장 | placed |
| cs-kmp | KMP (MECHANISM) | 분야 표준(CLRS 목차) 32장 | placed |
| cs-rabin-karp | 라빈-카프 (MECHANISM) | 분야 표준(CLRS 목차) 32장 | placed |
| cs-boyer-moore | 보이어-무어 (MECHANISM) | 분야 표준(Sedgewick 「Algorithms」) 5.3 | placed |
| cs-aho-corasick | 아호-코라식 (MECHANISM) | 분야 표준(문자열 알고리즘) | placed |
| cs-edit-distance | 편집 거리 (MECHANISM) | 분야 표준(DP 표준 문제) | placed |
| cs-lcs | 최장 공통 부분 수열 (MECHANISM) | 분야 표준(CLRS 목차) 15장 | placed |
| cs-suffix-array | 접미사 배열 (MECHANISM) | 분야 표준(Sedgewick 「Algorithms」) 6장 | placed |
| cs-algorithm-design | 알고리즘 설계 기법 (STAGE) | 운영 행 | placed |
| divide-and-conquer | 분할 정복 (MECHANISM) | 운영 행 | placed |
| dynamic-programming | 동적 계획법 (MECHANISM) | 운영 행 | placed |
| cs-memoization | 메모이제이션 (MECHANISM) | 운영 행 | placed |
| cs-tabulation | 타뷸레이션 (MECHANISM) | 분야 표준(CLRS 목차) 15장 | placed |
| cs-knapsack | 배낭 문제 (MECHANISM) | 분야 표준(CLRS 목차) 16장 | placed |
| cs-lis | 최장 증가 부분 수열 (MECHANISM) | 분야 표준(DP 표준 문제) | placed |
| cs-bitmask-dp | 비트마스크 DP (MECHANISM) | 분야 표준(DP 표준 문제) | placed |
| greedy | 탐욕 알고리즘 (MECHANISM) | 운영 행 | placed |
| cs-huffman-coding | 허프만 부호화 (MECHANISM) | 분야 표준(CLRS 목차) 16장 | placed |
| backtracking | 백트래킹 (MECHANISM) | 운영 행 | placed |
| cs-pruning | 가지치기 (MECHANISM) | 운영 행 | placed |
| cs-branch-and-bound | 분기 한정 (MECHANISM) | 운영 행 (cs-pruning 동의어에서 분리) | placed |
| cs-two-pointers | 투 포인터 (MECHANISM) | 분야 표준(코딩 테스트 표준 기법) | placed |
| cs-sliding-window | 슬라이딩 윈도 (MECHANISM) | 분야 표준(코딩 테스트 표준 기법) | placed |
| cs-prefix-sum | 누적 합 (MECHANISM) | 분야 표준(코딩 테스트 표준 기법) | placed |
| cs-randomized-algorithm | 무작위화 알고리즘 (MECHANISM) | 분야 표준(CLRS 목차) 5장 | placed |
| cs-prng | 의사 난수 생성기 (MECHANISM) | 분야 표준 · 레포 game/sim Mulberry32 | placed |
| cs-fisher-yates-shuffle | 피셔-예이츠 셔플 (MECHANISM) | 분야 표준(CLRS 목차) 5장 · 레포 PartyScoringService | placed |
| cs-combinatorial-explosion | 조합 폭발 (PROBLEM) | 운영 행 | placed |
| cs-numeric-bit | 수 · 비트 연산 (STAGE) | 분야 표준(CS:APP 2장 · CLRS 31장) | placed |
| cs-bit-manipulation | 비트 조작 (MECHANISM) | 분야 표준(「Hacker's Delight」) | placed |
| cs-bitset | 비트셋 (MECHANISM) | 분야 표준 · study/9 02 §7 (Bitmap) | placed |
| cs-fast-exponentiation | 분할 거듭제곱 (MECHANISM) | 분야 표준(CLRS 목차) 31장 · 레포 career/coding-test | placed |
| cs-euclidean-gcd | 유클리드 호제법 (MECHANISM) | 분야 표준(CLRS 목차) 31장 · 레포 career/coding-test | placed |
| cs-modular-arithmetic | 모듈러 연산 (MECHANISM) | 분야 표준(CLRS 목차) 31장 | placed |
| cs-sieve-of-eratosthenes | 에라토스테네스의 체 (MECHANISM) | 분야 표준(정수론 기초) | placed |
| cs-fixed-point-arithmetic | 고정 소수점 정수 표현 (MECHANISM) | 분야 표준 · 레포 spend_micros | placed |
| cs-integer-overflow | 정수 넘침 (PROBLEM) | 분야 표준(CS:APP 2장) · 레포 (lo + hi) ushr 1 | placed |
| cs-floating-point-error | 부동 소수점 오차 (PROBLEM) | 분야 표준(CS:APP 2장) | placed |
| cs-glossary | CS 기초 용어 사전 (TERM) | 운영 행 | placed |
| cs-glossary-complexity | 복잡도 · 계산 이론 용어 (TERM) | 구조 노드 | placed |
| cs-big-o-notation | 빅오 표기법 (TERM) | 운영 행 | placed |
| cs-big-omega-theta | 빅오메가 · 빅세타 (TERM) | 분야 표준(CLRS 목차) 3장 | placed |
| cs-case-analysis | 최선 · 평균 · 최악 (TERM) | 분야 표준(CLRS 목차) 2장 | placed |
| cs-recurrence-relation | 점화식 (TERM) | 분야 표준(CLRS 목차) 4장 | placed |
| cs-p-vs-np | P · NP · NP-완전 (TERM) | 분야 표준(CLRS 목차) 34장 | placed |
| cs-comparison-sort-lower-bound | 비교 정렬 하한 (TERM) | 분야 표준(CLRS 목차) 8장 | placed |
| cs-locality-of-reference | 참조 지역성 (TERM) | 분야 표준(CS:APP 6장) | placed |
| cs-glossary-structure | 자료 구조 용어 (TERM) | 구조 노드 | placed |
| cs-hash-function | 해시 함수 (TERM) | 운영 행 | placed |
| cs-dag | DAG (TERM) | 운영 행 | placed |
| cs-adjacency-list | 인접 리스트 (TERM) | 운영 행 (graph 동의어에서 분리) · 분야 표준(CLRS 목차) 22장 | placed |
| cs-adjacency-matrix | 인접 행렬 (TERM) | 분야 표준(CLRS 목차) 22장 | placed |
| cs-stable-sort | 안정 정렬 (TERM) | 운영 행 | placed |
| cs-in-place | 제자리 알고리즘 (TERM) | 분야 표준(CLRS 목차) 2장 | placed |
| cs-twos-complement | 2의 보수 (TERM) | 분야 표준(CS:APP 2장) | placed |
| cs-ieee-754 | IEEE 754 부동 소수점 (TERM) | 분야 표준(CS:APP 2장) | placed |
| cs-glossary-design | 설계 기법 용어 (TERM) | 구조 노드 | placed |
| cs-optimal-substructure | 최적 부분 구조 (TERM) | 운영 행 | placed |
| cs-overlapping-subproblems | 중복 부분 문제 (TERM) | 운영 행 | placed |
| cs-greedy-choice-property | 탐욕 선택 속성 (TERM) | 분야 표준(CLRS 목차) 16장 | placed |
