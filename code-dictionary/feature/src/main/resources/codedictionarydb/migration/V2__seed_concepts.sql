-- ===== BASICS (기초) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('variable', '변수', 'BASICS', 'BEGINNER', '데이터를 저장하는 메모리 공간의 이름'),
('function', '함수', 'BASICS', 'BEGINNER', '특정 작업을 수행하는 코드 블록'),
('class', '클래스', 'BASICS', 'BEGINNER', '객체를 생성하기 위한 설계도'),
('interface', '인터페이스', 'BASICS', 'BEGINNER', '구현 없이 메서드 시그니처만 정의하는 계약'),
('inheritance', '상속', 'BASICS', 'BEGINNER', '부모 클래스의 속성과 메서드를 자식 클래스가 물려받는 것'),
('polymorphism', '다형성', 'BASICS', 'INTERMEDIATE', '같은 인터페이스로 다른 구현을 호출하는 것'),
('encapsulation', '캡슐화', 'BASICS', 'BEGINNER', '데이터와 메서드를 하나로 묶고 외부 접근을 제한하는 것'),
('abstraction', '추상화', 'BASICS', 'INTERMEDIATE', '복잡한 시스템에서 핵심만 추출하여 단순화하는 것'),
('generic', '제네릭', 'BASICS', 'INTERMEDIATE', '타입을 파라미터로 받아 재사용 가능한 코드를 작성하는 기법'),
('exception-handling', '예외 처리', 'BASICS', 'BEGINNER', '런타임 오류를 감지하고 처리하는 메커니즘'),
('lambda', '람다', 'BASICS', 'INTERMEDIATE', '이름 없는 익명 함수를 간결하게 표현하는 문법'),
('closure', '클로저', 'BASICS', 'INTERMEDIATE', '외부 스코프 변수를 캡처하여 참조하는 함수'),
('recursion', '재귀', 'BASICS', 'INTERMEDIATE', '함수가 자기 자신을 호출하는 기법'),
('enum', '열거형', 'BASICS', 'BEGINNER', '관련된 상수를 그룹화하는 타입'),
('annotation', '어노테이션', 'BASICS', 'INTERMEDIATE', '코드에 메타데이터를 부여하는 표기법'),
('reflection', '리플렉션', 'BASICS', 'ADVANCED', '런타임에 클래스/메서드/필드 정보를 조회하고 조작하는 기능'),
('serialization', '직렬화', 'BASICS', 'INTERMEDIATE', '객체를 바이트 스트림이나 문자열로 변환하는 과정'),
('immutability', '불변성', 'BASICS', 'INTERMEDIATE', '생성 후 상태를 변경할 수 없는 객체의 특성'),
('null-safety', '널 안전성', 'BASICS', 'INTERMEDIATE', '널 참조로 인한 오류를 컴파일 타임에 방지하는 기능'),
('type-inference', '타입 추론', 'BASICS', 'BEGINNER', '컴파일러가 표현식으로부터 타입을 자동으로 결정하는 기능');

-- BASICS 동의어
INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'variable'), 'var'),
((SELECT id FROM concept WHERE concept_id = 'function'), 'method'),
((SELECT id FROM concept WHERE concept_id = 'function'), '메서드'),
((SELECT id FROM concept WHERE concept_id = 'class'), '클래스'),
((SELECT id FROM concept WHERE concept_id = 'interface'), 'interface'),
((SELECT id FROM concept WHERE concept_id = 'inheritance'), 'extends'),
((SELECT id FROM concept WHERE concept_id = 'inheritance'), '상속'),
((SELECT id FROM concept WHERE concept_id = 'polymorphism'), 'overriding'),
((SELECT id FROM concept WHERE concept_id = 'polymorphism'), 'overloading'),
((SELECT id FROM concept WHERE concept_id = 'generic'), 'generics'),
((SELECT id FROM concept WHERE concept_id = 'generic'), '제네릭스'),
((SELECT id FROM concept WHERE concept_id = 'lambda'), 'lambda expression'),
((SELECT id FROM concept WHERE concept_id = 'lambda'), '익명 함수'),
((SELECT id FROM concept WHERE concept_id = 'reflection'), 'reflect'),
((SELECT id FROM concept WHERE concept_id = 'serialization'), 'deserialization'),
((SELECT id FROM concept WHERE concept_id = 'serialization'), '역직렬화'),
((SELECT id FROM concept WHERE concept_id = 'immutability'), 'immutable'),
((SELECT id FROM concept WHERE concept_id = 'immutability'), 'val'),
((SELECT id FROM concept WHERE concept_id = 'null-safety'), 'nullable'),
((SELECT id FROM concept WHERE concept_id = 'null-safety'), 'non-null');

-- ===== DATA_STRUCTURE (자료구조) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('array', '배열', 'DATA_STRUCTURE', 'BEGINNER', '같은 타입의 원소를 연속 메모리에 저장하는 고정 크기 자료구조'),
('linked-list', '연결 리스트', 'DATA_STRUCTURE', 'BEGINNER', '노드가 데이터와 다음 노드 포인터를 가지는 선형 자료구조'),
('stack', '스택', 'DATA_STRUCTURE', 'BEGINNER', 'LIFO(후입선출) 방식의 자료구조'),
('queue', '큐', 'DATA_STRUCTURE', 'BEGINNER', 'FIFO(선입선출) 방식의 자료구조'),
('hash-map', '해시맵', 'DATA_STRUCTURE', 'INTERMEDIATE', '키-값 쌍을 해시 함수로 저장하여 O(1) 조회를 제공하는 자료구조'),
('tree', '트리', 'DATA_STRUCTURE', 'INTERMEDIATE', '계층적 부모-자식 관계를 가지는 비선형 자료구조'),
('binary-tree', '이진 트리', 'DATA_STRUCTURE', 'INTERMEDIATE', '각 노드가 최대 2개의 자식을 가지는 트리'),
('bst', '이진 탐색 트리', 'DATA_STRUCTURE', 'INTERMEDIATE', '왼쪽 자식 < 부모 < 오른쪽 자식 규칙을 따르는 이진 트리'),
('heap', '힙', 'DATA_STRUCTURE', 'INTERMEDIATE', '최대/최소값을 O(1)에 접근 가능한 완전 이진 트리 기반 자료구조'),
('graph', '그래프', 'DATA_STRUCTURE', 'INTERMEDIATE', '노드(정점)와 간선으로 이루어진 비선형 자료구조'),
('trie', '트라이', 'DATA_STRUCTURE', 'ADVANCED', '문자열 검색에 특화된 트리 기반 자료구조'),
('b-tree', 'B-트리', 'DATA_STRUCTURE', 'ADVANCED', '디스크 기반 DB 인덱스에 사용되는 자기 균형 탐색 트리'),
('bloom-filter', '블룸 필터', 'DATA_STRUCTURE', 'ADVANCED', '집합 멤버십을 확률적으로 판단하는 공간 효율적 자료구조'),
('skip-list', '스킵 리스트', 'DATA_STRUCTURE', 'ADVANCED', '다층 연결 리스트로 O(log n) 탐색을 제공하는 자료구조');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'HashMap'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'hash table'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), '해시 테이블'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'dictionary'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'Map'),
((SELECT id FROM concept WHERE concept_id = 'bst'), 'binary search tree'),
((SELECT id FROM concept WHERE concept_id = 'bst'), 'BST'),
((SELECT id FROM concept WHERE concept_id = 'graph'), 'vertex'),
((SELECT id FROM concept WHERE concept_id = 'graph'), 'edge'),
((SELECT id FROM concept WHERE concept_id = 'trie'), 'prefix tree'),
((SELECT id FROM concept WHERE concept_id = 'bloom-filter'), 'Bloom filter');

-- ===== ALGORITHM (알고리즘) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('sorting', '정렬', 'ALGORITHM', 'BEGINNER', '원소를 특정 기준에 따라 순서대로 나열하는 알고리즘'),
('binary-search', '이진 탐색', 'ALGORITHM', 'BEGINNER', '정렬된 배열에서 반씩 나누어 O(log n)으로 탐색하는 알고리즘'),
('bfs', '너비 우선 탐색', 'ALGORITHM', 'INTERMEDIATE', '그래프에서 인접 노드를 먼저 방문하는 탐색 알고리즘'),
('dfs', '깊이 우선 탐색', 'ALGORITHM', 'INTERMEDIATE', '그래프에서 깊이 방향으로 먼저 탐색하는 알고리즘'),
('dynamic-programming', '동적 프로그래밍', 'ALGORITHM', 'INTERMEDIATE', '부분 문제의 결과를 캐싱하여 중복 계산을 피하는 최적화 기법'),
('greedy', '탐욕 알고리즘', 'ALGORITHM', 'INTERMEDIATE', '매 순간 최적의 선택을 하는 알고리즘 설계 기법'),
('divide-and-conquer', '분할 정복', 'ALGORITHM', 'INTERMEDIATE', '문제를 작은 부분으로 나누어 해결한 뒤 합치는 기법'),
('backtracking', '백트래킹', 'ALGORITHM', 'INTERMEDIATE', '해를 찾다가 막히면 되돌아가서 다른 경로를 탐색하는 기법'),
('topological-sort', '위상 정렬', 'ALGORITHM', 'ADVANCED', 'DAG에서 의존성 순서대로 노드를 정렬하는 알고리즘'),
('consistent-hashing', '일관 해싱', 'ALGORITHM', 'ADVANCED', '노드 추가/제거 시 최소한의 키만 재배치하는 해싱 기법');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'bfs'), 'BFS'),
((SELECT id FROM concept WHERE concept_id = 'bfs'), 'breadth first search'),
((SELECT id FROM concept WHERE concept_id = 'dfs'), 'DFS'),
((SELECT id FROM concept WHERE concept_id = 'dfs'), 'depth first search'),
((SELECT id FROM concept WHERE concept_id = 'dynamic-programming'), 'DP'),
((SELECT id FROM concept WHERE concept_id = 'dynamic-programming'), '다이나믹 프로그래밍'),
((SELECT id FROM concept WHERE concept_id = 'dynamic-programming'), 'memoization'),
((SELECT id FROM concept WHERE concept_id = 'consistent-hashing'), 'consistent hash');

-- ===== DESIGN_PATTERN (디자인 패턴) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('singleton-pattern', '싱글톤 패턴', 'DESIGN_PATTERN', 'BEGINNER', '인스턴스가 하나만 생성되도록 보장하는 패턴'),
('factory-pattern', '팩토리 패턴', 'DESIGN_PATTERN', 'BEGINNER', '객체 생성 로직을 별도 팩토리에 위임하는 패턴'),
('abstract-factory', '추상 팩토리', 'DESIGN_PATTERN', 'INTERMEDIATE', '관련 객체군을 생성하는 인터페이스를 제공하는 패턴'),
('builder-pattern', '빌더 패턴', 'DESIGN_PATTERN', 'BEGINNER', '복잡한 객체를 단계적으로 생성하는 패턴'),
('strategy-pattern', '전략 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '알고리즘을 캡슐화하여 런타임에 교체 가능하게 하는 패턴'),
('observer-pattern', '옵저버 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '상태 변경을 구독자에게 자동 알리는 패턴'),
('decorator-pattern', '데코레이터 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '객체에 동적으로 기능을 추가하는 패턴'),
('adapter-pattern', '어댑터 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '호환되지 않는 인터페이스를 변환하여 함께 작동하게 하는 패턴'),
('proxy-pattern', '프록시 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '다른 객체에 대한 접근을 제어하는 대리 객체 패턴'),
('template-method', '템플릿 메서드', 'DESIGN_PATTERN', 'INTERMEDIATE', '알고리즘 골격을 정의하고 세부 단계를 하위 클래스에 위임하는 패턴'),
('command-pattern', '커맨드 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '요청을 객체로 캡슐화하여 실행/취소/큐잉을 가능하게 하는 패턴'),
('chain-of-responsibility', '책임 연쇄', 'DESIGN_PATTERN', 'ADVANCED', '요청을 처리할 수 있는 핸들러 체인을 순회하는 패턴'),
('mediator-pattern', '중재자 패턴', 'DESIGN_PATTERN', 'ADVANCED', '객체 간 직접 통신 대신 중재자를 통해 소통하는 패턴'),
('specification-pattern', '스펙 패턴', 'DESIGN_PATTERN', 'ADVANCED', '비즈니스 규칙을 재사용 가능한 객체로 캡슐화하는 패턴');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'singleton-pattern'), 'singleton'),
((SELECT id FROM concept WHERE concept_id = 'singleton-pattern'), '싱글턴'),
((SELECT id FROM concept WHERE concept_id = 'factory-pattern'), 'factory method'),
((SELECT id FROM concept WHERE concept_id = 'factory-pattern'), '팩토리 메서드'),
((SELECT id FROM concept WHERE concept_id = 'builder-pattern'), 'builder'),
((SELECT id FROM concept WHERE concept_id = 'builder-pattern'), '빌더'),
((SELECT id FROM concept WHERE concept_id = 'strategy-pattern'), 'strategy'),
((SELECT id FROM concept WHERE concept_id = 'observer-pattern'), 'pub-sub'),
((SELECT id FROM concept WHERE concept_id = 'observer-pattern'), 'publish-subscribe'),
((SELECT id FROM concept WHERE concept_id = 'adapter-pattern'), 'adapter'),
((SELECT id FROM concept WHERE concept_id = 'adapter-pattern'), 'wrapper'),
((SELECT id FROM concept WHERE concept_id = 'proxy-pattern'), 'proxy'),
((SELECT id FROM concept WHERE concept_id = 'proxy-pattern'), 'AOP'),
((SELECT id FROM concept WHERE concept_id = 'proxy-pattern'), 'aspect oriented programming');

-- ===== CONCURRENCY (동시성) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('thread', '스레드', 'CONCURRENCY', 'BEGINNER', '프로세스 내에서 독립적으로 실행되는 작업 단위'),
('mutex', '뮤텍스', 'CONCURRENCY', 'INTERMEDIATE', '상호 배제를 보장하는 동기화 기법'),
('semaphore', '세마포어', 'CONCURRENCY', 'INTERMEDIATE', '동시 접근 가능한 스레드 수를 제한하는 동기화 기법'),
('deadlock', '데드락', 'CONCURRENCY', 'INTERMEDIATE', '둘 이상의 프로세스가 서로의 자원을 기다리며 영원히 블록되는 상태'),
('race-condition', '레이스 컨디션', 'CONCURRENCY', 'INTERMEDIATE', '여러 스레드가 공유 자원에 동시 접근하여 결과가 비결정적이 되는 상황'),
('thread-pool', '스레드 풀', 'CONCURRENCY', 'INTERMEDIATE', '미리 생성된 스레드를 재사용하여 작업을 처리하는 기법'),
('atomic-operation', '원자 연산', 'CONCURRENCY', 'INTERMEDIATE', '중간에 인터럽트 되지 않는 단일 연산'),
('coroutine', '코루틴', 'CONCURRENCY', 'INTERMEDIATE', '비선점적 멀티태스킹을 위한 경량 동시성 단위'),
('async-await', 'async/await', 'CONCURRENCY', 'INTERMEDIATE', '비동기 작업을 동기 코드처럼 작성하는 패턴'),
('distributed-lock', '분산락', 'CONCURRENCY', 'ADVANCED', '분산 환경에서 공유 자원에 대한 동시 접근을 제어하는 잠금 메커니즘'),
('optimistic-lock', '낙관적 락', 'CONCURRENCY', 'INTERMEDIATE', '충돌이 적다는 가정 하에 버전 비교로 동시성을 제어하는 기법'),
('pessimistic-lock', '비관적 락', 'CONCURRENCY', 'INTERMEDIATE', '충돌을 예방하기 위해 자원에 미리 잠금을 거는 기법'),
('compare-and-swap', 'CAS', 'CONCURRENCY', 'ADVANCED', '메모리 값을 원자적으로 비교하고 교체하는 락-프리 동시성 기법'),
('reactive-streams', '리액티브 스트림', 'CONCURRENCY', 'ADVANCED', '비동기 데이터 스트림의 논블로킹 백프레셔 처리 표준');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'mutex'), 'mutual exclusion'),
((SELECT id FROM concept WHERE concept_id = 'mutex'), '상호 배제'),
((SELECT id FROM concept WHERE concept_id = 'semaphore'), 'semaphore'),
((SELECT id FROM concept WHERE concept_id = 'deadlock'), 'dead lock'),
((SELECT id FROM concept WHERE concept_id = 'deadlock'), '교착 상태'),
((SELECT id FROM concept WHERE concept_id = 'coroutine'), 'coroutines'),
((SELECT id FROM concept WHERE concept_id = 'coroutine'), 'suspend function'),
((SELECT id FROM concept WHERE concept_id = 'distributed-lock'), 'distributed lock'),
((SELECT id FROM concept WHERE concept_id = 'distributed-lock'), 'redis lock'),
((SELECT id FROM concept WHERE concept_id = 'distributed-lock'), 'redisson lock'),
((SELECT id FROM concept WHERE concept_id = 'optimistic-lock'), 'optimistic locking'),
((SELECT id FROM concept WHERE concept_id = 'optimistic-lock'), '@Version'),
((SELECT id FROM concept WHERE concept_id = 'pessimistic-lock'), 'pessimistic locking'),
((SELECT id FROM concept WHERE concept_id = 'pessimistic-lock'), 'SELECT FOR UPDATE'),
((SELECT id FROM concept WHERE concept_id = 'compare-and-swap'), 'compare and swap'),
((SELECT id FROM concept WHERE concept_id = 'compare-and-swap'), 'AtomicReference'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'Reactor'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'WebFlux'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'Mono'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'Flux');

-- ===== DISTRIBUTED_SYSTEM (분산시스템) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('saga-pattern', '사가 패턴', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '분산 트랜잭션을 로컬 트랜잭션 체인으로 대체하고 보상 트랜잭션으로 롤백하는 패턴'),
('cqrs', 'CQRS', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '명령(쓰기)과 조회(읽기) 모델을 분리하는 아키텍처 패턴'),
('event-sourcing', '이벤트 소싱', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '상태 변경을 이벤트 시퀀스로 저장하여 상태를 재구축하는 패턴'),
('circuit-breaker', '서킷 브레이커', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '장애가 전파되지 않도록 호출을 차단하는 장애 격리 패턴'),
('fan-out', '팬아웃', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '하나의 메시지를 여러 수신자에게 동시 전달하는 메시징 패턴'),
('two-phase-commit', '2PC', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '분산 트랜잭션에서 모든 참여자의 동의 후 커밋하는 프로토콜'),
('eventual-consistency', '최종 일관성', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '즉각 일관성 대신 시간이 지나면 일관성이 보장되는 모델'),
('idempotency', '멱등성', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '같은 연산을 여러 번 수행해도 결과가 동일한 성질'),
('leader-election', '리더 선출', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '분산 시스템에서 하나의 노드를 조정자로 선출하는 알고리즘'),
('service-mesh', '서비스 메시', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '서비스 간 통신을 사이드카 프록시로 관리하는 인프라 레이어'),
('outbox-pattern', '아웃박스 패턴', 'DISTRIBUTED_SYSTEM', 'ADVANCED', 'DB 변경과 이벤트 발행의 원자성을 보장하는 패턴'),
('bulkhead-pattern', '벌크헤드 패턴', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '장애가 시스템 전체로 확산되지 않도록 자원을 격리하는 패턴'),
('retry-pattern', '재시도 패턴', 'DISTRIBUTED_SYSTEM', 'BEGINNER', '일시적 장애에 대해 자동으로 요청을 재시도하는 패턴'),
('backpressure', '백프레셔', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '소비자가 처리할 수 있는 속도로 생산자를 제어하는 흐름 제어 메커니즘');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), 'saga'),
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), '사가'),
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), 'choreography saga'),
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), 'orchestration saga'),
((SELECT id FROM concept WHERE concept_id = 'cqrs'), 'command query responsibility segregation'),
((SELECT id FROM concept WHERE concept_id = 'cqrs'), '커맨드 쿼리 분리'),
((SELECT id FROM concept WHERE concept_id = 'event-sourcing'), 'event store'),
((SELECT id FROM concept WHERE concept_id = 'circuit-breaker'), 'circuit breaker'),
((SELECT id FROM concept WHERE concept_id = 'circuit-breaker'), 'resilience4j'),
((SELECT id FROM concept WHERE concept_id = 'fan-out'), 'fan out'),
((SELECT id FROM concept WHERE concept_id = 'fan-out'), '팬 아웃'),
((SELECT id FROM concept WHERE concept_id = 'two-phase-commit'), 'two phase commit'),
((SELECT id FROM concept WHERE concept_id = 'two-phase-commit'), '2PC'),
((SELECT id FROM concept WHERE concept_id = 'idempotency'), 'idempotent'),
((SELECT id FROM concept WHERE concept_id = 'idempotency'), '멱등'),
((SELECT id FROM concept WHERE concept_id = 'outbox-pattern'), 'transactional outbox'),
((SELECT id FROM concept WHERE concept_id = 'backpressure'), 'back pressure');

-- ===== ARCHITECTURE (아키텍처) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('clean-architecture', '클린 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '의존성이 안쪽(도메인)으로만 향하도록 계층을 분리하는 아키텍처'),
('hexagonal-architecture', '헥사고날 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '포트와 어댑터로 외부 의존성을 격리하는 아키텍처'),
('ddd', '도메인 주도 설계', 'ARCHITECTURE', 'ADVANCED', '비즈니스 도메인을 중심으로 소프트웨어를 설계하는 방법론'),
('msa', '마이크로서비스', 'ARCHITECTURE', 'INTERMEDIATE', '서비스를 독립 배포 가능한 작은 단위로 분리하는 아키텍처'),
('monolith', '모놀리스', 'ARCHITECTURE', 'BEGINNER', '모든 기능이 하나의 배포 단위에 포함된 아키텍처'),
('port-adapter', '포트-어댑터', 'ARCHITECTURE', 'INTERMEDIATE', '비즈니스 로직과 외부 시스템 사이에 인터페이스(포트)와 구현(어댑터)을 두는 패턴'),
('aggregate', '애그리거트', 'ARCHITECTURE', 'ADVANCED', 'DDD에서 일관성 경계를 형성하는 엔티티와 값 객체의 군집'),
('bounded-context', '바운디드 컨텍스트', 'ARCHITECTURE', 'ADVANCED', 'DDD에서 특정 도메인 모델이 적용되는 명확한 경계'),
('layered-architecture', '레이어드 아키텍처', 'ARCHITECTURE', 'BEGINNER', '표현-비즈니스-데이터 접근 계층으로 분리하는 전통적 아키텍처'),
('event-driven-architecture', '이벤트 기반 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '이벤트 발행/구독으로 서비스 간 느슨한 결합을 구현하는 아키텍처'),
('soa', '서비스 지향 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '재사용 가능한 서비스 단위로 시스템을 구성하는 아키텍처'),
('value-object', '값 객체', 'ARCHITECTURE', 'INTERMEDIATE', '식별자 없이 속성 값으로만 동등성이 결정되는 불변 객체');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'clean-architecture'), 'Clean Architecture'),
((SELECT id FROM concept WHERE concept_id = 'clean-architecture'), 'Uncle Bob'),
((SELECT id FROM concept WHERE concept_id = 'hexagonal-architecture'), 'ports and adapters'),
((SELECT id FROM concept WHERE concept_id = 'hexagonal-architecture'), '포트와 어댑터'),
((SELECT id FROM concept WHERE concept_id = 'ddd'), 'Domain Driven Design'),
((SELECT id FROM concept WHERE concept_id = 'ddd'), 'DDD'),
((SELECT id FROM concept WHERE concept_id = 'msa'), 'microservice'),
((SELECT id FROM concept WHERE concept_id = 'msa'), 'MSA'),
((SELECT id FROM concept WHERE concept_id = 'msa'), '마이크로서비스 아키텍처'),
((SELECT id FROM concept WHERE concept_id = 'aggregate'), 'aggregate root'),
((SELECT id FROM concept WHERE concept_id = 'aggregate'), '애그리거트 루트'),
((SELECT id FROM concept WHERE concept_id = 'bounded-context'), 'BC'),
((SELECT id FROM concept WHERE concept_id = 'value-object'), 'VO'),
((SELECT id FROM concept WHERE concept_id = 'event-driven-architecture'), 'EDA');

-- ===== INFRASTRUCTURE (인프라/DevOps) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('container', '컨테이너', 'INFRASTRUCTURE', 'BEGINNER', '애플리케이션과 의존성을 격리된 환경으로 패키징하는 기술'),
('docker', '도커', 'INFRASTRUCTURE', 'BEGINNER', '컨테이너 기반 애플리케이션 패키징/실행 플랫폼'),
('kubernetes', '쿠버네티스', 'INFRASTRUCTURE', 'INTERMEDIATE', '컨테이너 오케스트레이션 플랫폼'),
('ci-cd', 'CI/CD', 'INFRASTRUCTURE', 'BEGINNER', '지속적 통합(CI)과 지속적 배포(CD) 파이프라인'),
('service-discovery', '서비스 디스커버리', 'INFRASTRUCTURE', 'INTERMEDIATE', '서비스 인스턴스의 위치를 동적으로 탐색하는 메커니즘'),
('api-gateway', 'API 게이트웨이', 'INFRASTRUCTURE', 'INTERMEDIATE', '클라이언트 요청을 적절한 서비스로 라우팅하는 단일 진입점'),
('load-balancer', '로드 밸런서', 'INFRASTRUCTURE', 'BEGINNER', '트래픽을 여러 서버에 분산하는 장치/소프트웨어'),
('reverse-proxy', '리버스 프록시', 'INFRASTRUCTURE', 'INTERMEDIATE', '클라이언트 요청을 대신 받아 백엔드 서버로 전달하는 서버'),
('auto-scaler', '오토 스케일러', 'INFRASTRUCTURE', 'INTERMEDIATE', '부하에 따라 자동으로 인스턴스 수를 조절하는 메커니즘'),
('infrastructure-as-code', 'IaC', 'INFRASTRUCTURE', 'INTERMEDIATE', '인프라를 코드로 정의하고 버전 관리하는 방식'),
('blue-green-deployment', '블루-그린 배포', 'INFRASTRUCTURE', 'INTERMEDIATE', '두 환경을 번갈아 사용하여 무중단 배포하는 전략'),
('canary-deployment', '카나리 배포', 'INFRASTRUCTURE', 'INTERMEDIATE', '일부 트래픽만 새 버전으로 보내어 점진적으로 배포하는 전략'),
('health-check', '헬스 체크', 'INFRASTRUCTURE', 'BEGINNER', '서비스 정상 동작 여부를 주기적으로 확인하는 메커니즘');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'docker'), 'Docker'),
((SELECT id FROM concept WHERE concept_id = 'docker'), 'docker-compose'),
((SELECT id FROM concept WHERE concept_id = 'docker'), 'Dockerfile'),
((SELECT id FROM concept WHERE concept_id = 'kubernetes'), 'k8s'),
((SELECT id FROM concept WHERE concept_id = 'kubernetes'), 'K8s'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'continuous integration'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'continuous deployment'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'GitHub Actions'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'Jenkins'),
((SELECT id FROM concept WHERE concept_id = 'service-discovery'), 'Eureka'),
((SELECT id FROM concept WHERE concept_id = 'service-discovery'), 'Consul'),
((SELECT id FROM concept WHERE concept_id = 'api-gateway'), 'Spring Cloud Gateway'),
((SELECT id FROM concept WHERE concept_id = 'api-gateway'), 'gateway'),
((SELECT id FROM concept WHERE concept_id = 'load-balancer'), 'LB'),
((SELECT id FROM concept WHERE concept_id = 'load-balancer'), 'round robin'),
((SELECT id FROM concept WHERE concept_id = 'infrastructure-as-code'), 'Terraform'),
((SELECT id FROM concept WHERE concept_id = 'infrastructure-as-code'), 'Infrastructure as Code');

-- ===== DATA (데이터) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('inverse-index', '역인덱싱', 'DATA', 'INTERMEDIATE', '단어→문서 매핑으로 전문 검색을 가능하게 하는 인덱스 구조'),
('sharding', '샤딩', 'DATA', 'ADVANCED', '데이터를 여러 DB 인스턴스에 수평 분할하여 저장하는 기법'),
('replication', '레플리케이션', 'DATA', 'INTERMEDIATE', '데이터를 복제하여 가용성과 읽기 성능을 높이는 기법'),
('cap-theorem', 'CAP 정리', 'DATA', 'ADVANCED', '분산 시스템에서 일관성/가용성/분할내성 중 2개만 보장 가능하다는 정리'),
('acid', 'ACID', 'DATA', 'INTERMEDIATE', '트랜잭션의 원자성/일관성/격리성/지속성 보장'),
('base', 'BASE', 'DATA', 'ADVANCED', 'NoSQL에서의 Basically Available, Soft state, Eventually consistent 모델'),
('connection-pool', '커넥션 풀', 'DATA', 'INTERMEDIATE', 'DB 연결을 미리 생성해두고 재사용하는 기법'),
('orm', 'ORM', 'DATA', 'BEGINNER', '객체와 관계형 DB 테이블을 매핑하는 기술'),
('n-plus-one', 'N+1 문제', 'DATA', 'INTERMEDIATE', 'ORM에서 연관 엔티티 조회 시 쿼리가 N+1번 실행되는 성능 문제'),
('bulk-indexing', '벌크 인덱싱', 'DATA', 'INTERMEDIATE', '대량 데이터를 한 번에 색인하는 기법'),
('alias-swap', '별칭 스왑', 'DATA', 'INTERMEDIATE', 'ES에서 새 인덱스를 미리 빌드하고 별칭을 전환하여 무중단 재색인하는 기법'),
('caching', '캐싱', 'DATA', 'BEGINNER', '자주 사용하는 데이터를 빠른 저장소에 임시 보관하는 기법'),
('write-ahead-log', 'WAL', 'DATA', 'ADVANCED', '변경 사항을 먼저 로그에 기록한 뒤 실제 데이터를 변경하는 복구 기법');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'inverse-index'), 'inverted index'),
((SELECT id FROM concept WHERE concept_id = 'inverse-index'), '역색인'),
((SELECT id FROM concept WHERE concept_id = 'sharding'), 'shard'),
((SELECT id FROM concept WHERE concept_id = 'sharding'), '샤드'),
((SELECT id FROM concept WHERE concept_id = 'sharding'), 'horizontal partitioning'),
((SELECT id FROM concept WHERE concept_id = 'replication'), 'replica'),
((SELECT id FROM concept WHERE concept_id = 'replication'), 'master-slave'),
((SELECT id FROM concept WHERE concept_id = 'replication'), '복제'),
((SELECT id FROM concept WHERE concept_id = 'acid'), 'atomicity'),
((SELECT id FROM concept WHERE concept_id = 'acid'), 'transaction'),
((SELECT id FROM concept WHERE concept_id = 'acid'), '트랜잭션'),
((SELECT id FROM concept WHERE concept_id = 'orm'), 'JPA'),
((SELECT id FROM concept WHERE concept_id = 'orm'), 'Hibernate'),
((SELECT id FROM concept WHERE concept_id = 'orm'), 'object relational mapping'),
((SELECT id FROM concept WHERE concept_id = 'n-plus-one'), 'N+1 query'),
((SELECT id FROM concept WHERE concept_id = 'n-plus-one'), 'lazy loading'),
((SELECT id FROM concept WHERE concept_id = 'n-plus-one'), 'fetch join'),
((SELECT id FROM concept WHERE concept_id = 'caching'), 'cache'),
((SELECT id FROM concept WHERE concept_id = 'caching'), 'Redis'),
((SELECT id FROM concept WHERE concept_id = 'caching'), 'Memcached'),
((SELECT id FROM concept WHERE concept_id = 'write-ahead-log'), 'write ahead log'),
((SELECT id FROM concept WHERE concept_id = 'write-ahead-log'), 'redo log');

-- ===== SECURITY (보안) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('xss', 'XSS', 'SECURITY', 'INTERMEDIATE', '웹 페이지에 악성 스크립트를 삽입하는 공격'),
('csrf', 'CSRF', 'SECURITY', 'INTERMEDIATE', '인증된 사용자의 브라우저를 이용하여 의도하지 않은 요청을 보내는 공격'),
('sql-injection', 'SQL 인젝션', 'SECURITY', 'BEGINNER', '악의적인 SQL을 입력값에 삽입하여 DB를 조작하는 공격'),
('oauth', 'OAuth', 'SECURITY', 'INTERMEDIATE', '제3자 앱에 제한된 접근 권한을 부여하는 인가 프레임워크'),
('jwt', 'JWT', 'SECURITY', 'INTERMEDIATE', '자체 검증 가능한 JSON 기반 토큰으로 상태 없는 인증을 구현하는 표준'),
('cors', 'CORS', 'SECURITY', 'BEGINNER', '다른 출처의 리소스 접근을 제어하는 브라우저 보안 정책'),
('hashing', '해싱', 'SECURITY', 'INTERMEDIATE', '데이터를 고정 길이 해시값으로 변환하는 단방향 함수'),
('encryption', '암호화', 'SECURITY', 'INTERMEDIATE', '데이터를 키를 사용하여 읽을 수 없는 형태로 변환하는 기법'),
('rate-limiting', '레이트 리미팅', 'SECURITY', 'INTERMEDIATE', '일정 시간 내 요청 수를 제한하여 서비스를 보호하는 기법'),
('rbac', 'RBAC', 'SECURITY', 'INTERMEDIATE', '역할 기반으로 리소스 접근 권한을 제어하는 모델');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'xss'), 'cross site scripting'),
((SELECT id FROM concept WHERE concept_id = 'csrf'), 'cross site request forgery'),
((SELECT id FROM concept WHERE concept_id = 'sql-injection'), 'SQL injection'),
((SELECT id FROM concept WHERE concept_id = 'sql-injection'), 'prepared statement'),
((SELECT id FROM concept WHERE concept_id = 'oauth'), 'OAuth2'),
((SELECT id FROM concept WHERE concept_id = 'oauth'), 'OAuth 2.0'),
((SELECT id FROM concept WHERE concept_id = 'jwt'), 'JSON Web Token'),
((SELECT id FROM concept WHERE concept_id = 'jwt'), 'access token'),
((SELECT id FROM concept WHERE concept_id = 'jwt'), 'refresh token'),
((SELECT id FROM concept WHERE concept_id = 'cors'), 'cross origin resource sharing'),
((SELECT id FROM concept WHERE concept_id = 'hashing'), 'bcrypt'),
((SELECT id FROM concept WHERE concept_id = 'hashing'), 'SHA-256'),
((SELECT id FROM concept WHERE concept_id = 'encryption'), 'AES'),
((SELECT id FROM concept WHERE concept_id = 'encryption'), 'RSA'),
((SELECT id FROM concept WHERE concept_id = 'rate-limiting'), 'rate limit'),
((SELECT id FROM concept WHERE concept_id = 'rate-limiting'), 'throttling'),
((SELECT id FROM concept WHERE concept_id = 'rbac'), 'role based access control');

-- ===== NETWORK (네트워크) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('tcp', 'TCP', 'NETWORK', 'BEGINNER', '신뢰성 있는 연결 기반 전송 프로토콜'),
('udp', 'UDP', 'NETWORK', 'BEGINNER', '비연결형 경량 전송 프로토콜'),
('http', 'HTTP', 'NETWORK', 'BEGINNER', '웹에서 리소스를 전송하는 애플리케이션 계층 프로토콜'),
('grpc', 'gRPC', 'NETWORK', 'INTERMEDIATE', 'Protocol Buffers 기반의 고성능 RPC 프레임워크'),
('websocket', 'WebSocket', 'NETWORK', 'INTERMEDIATE', '서버-클라이언트 간 양방향 실시간 통신 프로토콜'),
('rest', 'REST', 'NETWORK', 'BEGINNER', 'HTTP 기반의 리소스 중심 API 설계 아키텍처 스타일'),
('graphql', 'GraphQL', 'NETWORK', 'INTERMEDIATE', '클라이언트가 필요한 데이터 구조를 직접 지정하는 쿼리 언어'),
('dns', 'DNS', 'NETWORK', 'BEGINNER', '도메인 이름을 IP 주소로 변환하는 시스템'),
('ssl-tls', 'SSL/TLS', 'NETWORK', 'INTERMEDIATE', '네트워크 통신을 암호화하는 보안 프로토콜'),
('sse', 'SSE', 'NETWORK', 'INTERMEDIATE', '서버에서 클라이언트로 단방향 실시간 데이터를 전송하는 기술');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'http'), 'HTTPS'),
((SELECT id FROM concept WHERE concept_id = 'http'), 'HTTP/2'),
((SELECT id FROM concept WHERE concept_id = 'http'), 'HTTP/3'),
((SELECT id FROM concept WHERE concept_id = 'grpc'), 'protobuf'),
((SELECT id FROM concept WHERE concept_id = 'grpc'), 'Protocol Buffers'),
((SELECT id FROM concept WHERE concept_id = 'rest'), 'RESTful'),
((SELECT id FROM concept WHERE concept_id = 'rest'), 'REST API'),
((SELECT id FROM concept WHERE concept_id = 'ssl-tls'), 'SSL'),
((SELECT id FROM concept WHERE concept_id = 'ssl-tls'), 'TLS'),
((SELECT id FROM concept WHERE concept_id = 'ssl-tls'), 'HTTPS'),
((SELECT id FROM concept WHERE concept_id = 'sse'), 'Server-Sent Events'),
((SELECT id FROM concept WHERE concept_id = 'sse'), 'EventSource');

-- ===== TESTING (테스팅) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('unit-test', '단위 테스트', 'TESTING', 'BEGINNER', '개별 함수/클래스를 격리하여 검증하는 테스트'),
('integration-test', '통합 테스트', 'TESTING', 'INTERMEDIATE', '여러 컴포넌트가 함께 작동하는지 검증하는 테스트'),
('e2e-test', 'E2E 테스트', 'TESTING', 'INTERMEDIATE', '사용자 시나리오 전체를 시뮬레이션하는 테스트'),
('mock', '목', 'TESTING', 'BEGINNER', '실제 객체를 모방하여 동작을 검증하는 테스트 더블'),
('stub', '스텁', 'TESTING', 'INTERMEDIATE', '미리 준비된 응답을 반환하는 테스트 더블'),
('tdd', 'TDD', 'TESTING', 'INTERMEDIATE', '테스트를 먼저 작성하고 구현하는 개발 방법론'),
('bdd', 'BDD', 'TESTING', 'INTERMEDIATE', '행동 명세를 기반으로 테스트를 작성하는 개발 방법론'),
('fixture', '픽스처', 'TESTING', 'INTERMEDIATE', '테스트에 필요한 사전 조건/데이터를 준비하는 것'),
('test-coverage', '테스트 커버리지', 'TESTING', 'BEGINNER', '코드 중 테스트로 검증된 비율');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'unit-test'), 'unit testing'),
((SELECT id FROM concept WHERE concept_id = 'mock'), 'mocking'),
((SELECT id FROM concept WHERE concept_id = 'mock'), 'MockK'),
((SELECT id FROM concept WHERE concept_id = 'mock'), 'Mockito'),
((SELECT id FROM concept WHERE concept_id = 'tdd'), 'test driven development'),
((SELECT id FROM concept WHERE concept_id = 'tdd'), '테스트 주도 개발'),
((SELECT id FROM concept WHERE concept_id = 'bdd'), 'behavior driven development'),
((SELECT id FROM concept WHERE concept_id = 'bdd'), 'BehaviorSpec'),
((SELECT id FROM concept WHERE concept_id = 'bdd'), 'given-when-then');

-- ===== LANGUAGE_FEATURE (언어 특성) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('extension-function', '확장 함수', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '기존 클래스에 새 함수를 추가하는 Kotlin 기능'),
('data-class', '데이터 클래스', 'LANGUAGE_FEATURE', 'BEGINNER', '데이터 보관 목적으로 equals/hashCode/toString을 자동 생성하는 클래스'),
('sealed-class', '봉인 클래스', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '상속 가능한 타입을 제한하여 when 절 완전성을 보장하는 클래스'),
('companion-object', '동반 객체', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '클래스에 속하는 정적 메서드/필드 역할의 싱글톤 객체'),
('delegation', '위임', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '인터페이스 구현을 다른 객체에 위임하는 패턴 (by 키워드)'),
('scope-function', '스코프 함수', 'LANGUAGE_FEATURE', 'BEGINNER', 'let, run, with, apply, also 등 객체 컨텍스트에서 코드를 실행하는 함수'),
('dsl', 'DSL', 'LANGUAGE_FEATURE', 'ADVANCED', '특정 도메인에 특화된 미니 언어를 코드 내에서 구축하는 기법'),
('type-alias', '타입 별칭', 'LANGUAGE_FEATURE', 'BEGINNER', '기존 타입에 새 이름을 부여하여 가독성을 높이는 기능');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'extension-function'), 'extension'),
((SELECT id FROM concept WHERE concept_id = 'data-class'), 'data class'),
((SELECT id FROM concept WHERE concept_id = 'sealed-class'), 'sealed class'),
((SELECT id FROM concept WHERE concept_id = 'sealed-class'), 'sealed interface'),
((SELECT id FROM concept WHERE concept_id = 'companion-object'), 'companion object'),
((SELECT id FROM concept WHERE concept_id = 'companion-object'), 'static'),
((SELECT id FROM concept WHERE concept_id = 'scope-function'), 'let'),
((SELECT id FROM concept WHERE concept_id = 'scope-function'), 'apply'),
((SELECT id FROM concept WHERE concept_id = 'scope-function'), 'also'),
((SELECT id FROM concept WHERE concept_id = 'dsl'), 'domain specific language'),
((SELECT id FROM concept WHERE concept_id = 'dsl'), 'type-safe builder');
