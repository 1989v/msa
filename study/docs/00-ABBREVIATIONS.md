# Abbreviations — 약어 풀 스펠링 표

> study/ 문서에서 사용하는 약어의 풀 스펠링과 한글 풀이의 single source of truth.
> 새 문서를 작성하거나 기존 문서를 수정할 때 **첫 등장 시** 풀 스펠링을 괄호로 병기한다.

## 적용 규칙

- **첫 등장 시에만** 병기. 한 문서 안에서 두 번째부터는 약어만.
- 형식: `약어 (Full Spelling, 한글 풀이)` — 예: `SLA (Service Level Agreement, 서비스 수준 협약)`.
- 한글 풀이가 자명하지 않은 경우 (예: BM25, HNSW) 영문 풀 스펠링만 — 형식: `약어 (Full Spelling)`.
- **자명한 약어는 생략** — HTTP, URL, API, JSON, XML, HTML, CSS, SQL, ID, PC, CPU, RAM, OS (Operating System 의미일 때).
- **코드 블록 / 파일 경로 / URL 안의 약어는 절대 건드리지 않는다.**
- **표 헤더, 다이어그램 ASCII art 안의 약어도 가독성 해치므로 건드리지 않는다** — 본문 산문에서 첫 등장만.
- 적용 범위: `study/docs/**/*.md`. 그 외 (`docs/`, ADR, conventions) 는 해당 영역 컨벤션 따름.

## 매핑 표

### 운영 / 관측 (Operations & Observability)

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| SLA | Service Level Agreement, 서비스 수준 협약 |
| SLO | Service Level Objective, 서비스 수준 목표 |
| SLI | Service Level Indicator, 서비스 수준 지표 |
| P50 / P95 / P99 / P99.9 | Percentile, 백분위수 (P99 = 99th Percentile, 가장 느린 1%) |
| RTO | Recovery Time Objective, 복구 시간 목표 |
| RPO | Recovery Point Objective, 복구 지점 목표 |
| MTTR | Mean Time To Recovery, 평균 복구 시간 |
| MTBF | Mean Time Between Failures, 평균 고장 간격 |
| HA | High Availability, 고가용성 |
| DR | Disaster Recovery, 재해 복구 |
| AZ | Availability Zone, 가용 영역 |
| KPI | Key Performance Indicator, 핵심 성과 지표 |
| TPS | Transactions Per Second, 초당 트랜잭션 수 |
| QPS | Queries Per Second, 초당 쿼리 수 |
| RPS | Requests Per Second, 초당 요청 수 |
| OOM | Out Of Memory, 메모리 부족 |
| IO | Input/Output, 입출력 |
| ADR | Architecture Decision Record, 아키텍처 결정 기록 |
| IaC | Infrastructure as Code, 코드형 인프라 |
| CI/CD | Continuous Integration / Continuous Delivery, 지속적 통합 / 지속적 배포 |

### AWS / 네트워크

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| VPC | Virtual Private Cloud, 가상 사설 클라우드 |
| SG | Security Group, 보안 그룹 |
| NACL | Network Access Control List, 네트워크 ACL |
| IAM | Identity and Access Management, 자격 증명 및 접근 관리 |
| ELB | Elastic Load Balancer, 엘라스틱 로드 밸런서 |
| ALB | Application Load Balancer, 애플리케이션 로드 밸런서 |
| NLB | Network Load Balancer, 네트워크 로드 밸런서 |
| RDS | Relational Database Service, 관계형 데이터베이스 서비스 |
| S3 | Simple Storage Service, 객체 스토리지 |
| EC2 | Elastic Compute Cloud, 가상 머신 서비스 |
| EBS | Elastic Block Store, 블록 스토리지 |
| EFS | Elastic File System, 파일 스토리지 |
| NAT | Network Address Translation, 네트워크 주소 변환 |
| CIDR | Classless Inter-Domain Routing |
| DNS | Domain Name System, 도메인 이름 시스템 |
| CDN | Content Delivery Network, 콘텐츠 전송 네트워크 |
| TGW | Transit Gateway |
| VGW | Virtual Private Gateway |
| IGW | Internet Gateway |

### JVM / 언어 / 동시성

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| JVM | Java Virtual Machine, 자바 가상 머신 |
| GC | Garbage Collection, 가비지 컬렉션 |
| JIT | Just-In-Time compilation, 즉시 컴파일 |
| AOT | Ahead-Of-Time compilation, 사전 컴파일 |
| AOP | Aspect-Oriented Programming, 관점 지향 프로그래밍 |
| DI | Dependency Injection, 의존성 주입 |
| IoC | Inversion of Control, 제어의 역전 |
| POJO | Plain Old Java Object |
| AQS | AbstractQueuedSynchronizer |
| CAS | Compare-And-Swap, 비교-교환 |
| ABA | ABA problem, ABA 문제 (CAS 의 함정) |
| TLAB | Thread-Local Allocation Buffer |
| ZGC | Z Garbage Collector |
| G1 | Garbage-First Collector |
| CMS | Concurrent Mark-Sweep |
| Loom | Project Loom (가상 스레드 프로젝트) |

### 데이터베이스 / 트랜잭션

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| RDB | Relational Database, 관계형 데이터베이스 |
| ACID | Atomicity / Consistency / Isolation / Durability, 원자성·일관성·격리성·내구성 |
| BASE | Basically Available / Soft state / Eventually consistent |
| MVCC | Multi-Version Concurrency Control, 다중 버전 동시성 제어 |
| WAL | Write-Ahead Log, 선기록 로그 |
| LSM | Log-Structured Merge-tree, 로그 구조 병합 트리 |
| TTL | Time To Live, 생존 시간 |
| DDL | Data Definition Language |
| DML | Data Manipulation Language |
| DCL | Data Control Language |
| TCL | Transaction Control Language |
| MDL | Metadata Lock, 메타데이터 락 |
| FK | Foreign Key, 외래 키 |
| PK | Primary Key, 기본 키 |
| 2PL | Two-Phase Locking, 2단계 잠금 |
| OCC | Optimistic Concurrency Control, 낙관적 동시성 제어 |
| PCC | Pessimistic Concurrency Control, 비관적 동시성 제어 |

### 분산 시스템 / 메시징

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| CAP | Consistency / Availability / Partition tolerance, 일관성·가용성·분할 내성 |
| PACELC | Partition → Availability/Consistency, Else → Latency/Consistency |
| 2PC | Two-Phase Commit, 2단계 커밋 |
| 3PC | Three-Phase Commit, 3단계 커밋 |
| EC | Eventual Consistency, 최종 일관성 |
| SoR | System of Record, 원본 데이터 시스템 |
| DLQ | Dead Letter Queue, 데드 레터 큐 |
| CRDT | Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입 |
| MRDT | Mergeable Replicated Data Type, 병합 가능 복제 데이터 타입 |
| CDC | Change Data Capture, 변경 데이터 캡처 |
| Saga | (약어 아님 — pattern 이름, 풀 스펠링 불필요) |
| ISR | In-Sync Replicas (Kafka 컨텍스트) |
| LEO | Log End Offset (Kafka) |
| HW | High Watermark (Kafka) |

### 검색 / NLP

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| ES | Elasticsearch |
| OS | OpenSearch (Operating System 과 혼동되므로 검색 컨텍스트 첫 등장 시 명시) |
| BM25 | Best Match 25 (랭킹 함수) |
| TF-IDF | Term Frequency – Inverse Document Frequency, 용어 빈도-역문서 빈도 |
| RRF | Reciprocal Rank Fusion, 상호 순위 융합 |
| HNSW | Hierarchical Navigable Small World (벡터 인덱스 그래프 알고리즘) |
| LTR | Learning to Rank, 랭킹 학습 |
| DSL | Domain-Specific Language, 도메인 특화 언어 |
| ILM | Index Lifecycle Management, 인덱스 생명주기 관리 |
| ANN | Approximate Nearest Neighbor, 근사 최근접 이웃 |
| KNN | K-Nearest Neighbors, K-최근접 이웃 |
| FST | Finite State Transducer, 유한 상태 변환기 (completion suggester 자료구조) |
| ICU | International Components for Unicode, 유니코드 국제화 컴포넌트 |
| NFD | Normalization Form Decomposed, 정규화 분해 (Unicode 정규화 형식 — 한글 자모 분리에 사용) |
| ELSER | Elastic Learned Sparse EncodeR (Elastic 의 sparse 임베딩 모델) |
| MRR | Mean Reciprocal Rank, 평균 상호 순위 |
| MAP | Mean Average Precision, 평균 평균 정밀도 |
| DCG | Discounted Cumulative Gain, 할인 누적 이득 |
| IDCG | Ideal DCG, 이상적 DCG (정렬이 완벽할 때의 DCG) |
| NDCG / nDCG | Normalized Discounted Cumulative Gain, 정규화된 누적 할인 이득 |
| CTR | Click-Through Rate, 클릭률 |
| CVR | Conversion Rate, 전환율 |
| IPW | Inverse Propensity Weighting, 역경향 가중 (랭킹 debias) |

### 쿠버네티스 / 컨테이너

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| K8s | Kubernetes (k8s 는 약어 아닌 별칭이지만 첫 등장 시 풀이) |
| HPA | Horizontal Pod Autoscaler, 수평 파드 오토스케일러 |
| VPA | Vertical Pod Autoscaler, 수직 파드 오토스케일러 |
| PDB | Pod Disruption Budget, 파드 중단 예산 |
| CRD | Custom Resource Definition, 커스텀 리소스 정의 |
| RBAC | Role-Based Access Control, 역할 기반 접근 제어 |
| CNI | Container Network Interface, 컨테이너 네트워크 인터페이스 |
| CSI | Container Storage Interface, 컨테이너 스토리지 인터페이스 |
| CRI | Container Runtime Interface, 컨테이너 런타임 인터페이스 |
| PV | PersistentVolume, 영구 볼륨 |
| PVC | PersistentVolumeClaim, 영구 볼륨 요청 |

### 보안 / 암호

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| TLS | Transport Layer Security, 전송 계층 보안 |
| SSL | Secure Sockets Layer (TLS 의 구버전) |
| mTLS | mutual TLS, 양방향 TLS |
| JWT | JSON Web Token |
| JWS | JSON Web Signature |
| JWE | JSON Web Encryption |
| SSO | Single Sign-On, 단일 로그인 |
| OAuth | Open Authorization (인가 프로토콜) |
| OIDC | OpenID Connect (OAuth 위 인증 레이어) |
| KMS | Key Management Service, 키 관리 서비스 |
| HSM | Hardware Security Module, 하드웨어 보안 모듈 |
| HMAC | Hash-based Message Authentication Code, 해시 기반 메시지 인증 코드 |
| RSA | Rivest–Shamir–Adleman (공개키 알고리즘) |
| AES | Advanced Encryption Standard, 고급 암호화 표준 |
| ECC | Elliptic Curve Cryptography, 타원 곡선 암호 |
| ECDSA | Elliptic Curve Digital Signature Algorithm |
| PKI | Public Key Infrastructure, 공개키 기반구조 |
| CA | Certificate Authority, 인증 기관 |
| CSRF | Cross-Site Request Forgery, 사이트 간 요청 위조 |
| XSS | Cross-Site Scripting, 사이트 간 스크립팅 |
| RBAC | Role-Based Access Control, 역할 기반 접근 제어 |
| ABAC | Attribute-Based Access Control, 속성 기반 접근 제어 |

### 웹 / RPC / 통신

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| REST | Representational State Transfer |
| RPC | Remote Procedure Call, 원격 프로시저 호출 |
| gRPC | gRPC Remote Procedure Call (Google 발 RPC 프레임워크) |
| NIO | Non-blocking I/O, 비차단 입출력 |
| AIO | Asynchronous I/O, 비동기 입출력 |
| BIO | Blocking I/O, 차단 입출력 |
| WebSocket | (약어 아님 — 그대로) |
| SSE | Server-Sent Events |
| HTTP/2 / HTTP/3 | HyperText Transfer Protocol v2 / v3 |
| QUIC | Quick UDP Internet Connections |
| UI | User Interface, 사용자 인터페이스 |
| UX | User Experience, 사용자 경험 |
| DTO | Data Transfer Object, 데이터 전송 객체 |
| VO | Value Object, 값 객체 |
| ORM | Object-Relational Mapping, 객체-관계 매핑 |

### 캐시 / Redis

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| LRU | Least Recently Used, 최근 사용 빈도 |
| LFU | Least Frequently Used, 사용 빈도 |
| RDB | Redis 컨텍스트에서는 Redis Database 스냅샷 (RDB persistence) — RDBMS 의 RDB 와 구분 필요 |
| AOF | Append-Only File (Redis persistence) |
| TTL | Time To Live, 만료 시간 |

### MSA / 일반 아키텍처

| 약어 | 풀 스펠링 + 한글 풀이 |
|---|---|
| MSA | Microservices Architecture, 마이크로서비스 아키텍처 |
| DDD | Domain-Driven Design, 도메인 주도 설계 |
| CQRS | Command Query Responsibility Segregation, 명령-조회 책임 분리 |
| ES | Event Sourcing, 이벤트 소싱 (검색 컨텍스트의 ES=Elasticsearch 와 구분) |
| BFF | Backend For Frontend |
| API GW | API Gateway, API 게이트웨이 |

## 컨텍스트 의존 약어 (모호성 주의)

다음 약어는 컨텍스트에 따라 의미가 달라지므로, **첫 등장 시 어떤 의미인지 명확히** 풀이한다:

| 약어 | 의미 1 | 의미 2 |
|---|---|---|
| ES | Elasticsearch (검색) | Event Sourcing (아키텍처) |
| OS | OpenSearch (검색) | Operating System (일반) |
| RDB | Relational Database (DB) | Redis Database snapshot (Redis persistence) |
| AOP | Aspect-Oriented Programming (Spring) | (보통 Spring 의미만) |
| GC | Garbage Collection (JVM) | Group Coordinator (Kafka — 흔치 않음) |
| SLA | Service Level Agreement | (단일 의미) |
| HW | High Watermark (Kafka) | Hardware (일반) |

## 자명해서 생략하는 약어

다음은 풀 스펠링을 굳이 병기하지 않는다 (모든 백엔드 개발자에게 자명):

- HTTP, HTTPS, URL, URI, URN
- API, JSON, XML, YAML, HTML, CSS
- SQL, NoSQL
- ID, UUID
- PC, CPU, GPU, RAM, ROM, SSD, HDD
- OS (Operating System 의미일 때 — 검색 컨텍스트 OpenSearch 는 명시)
- TCP, UDP, IP
- LAN, WAN
- IDE, CLI, GUI

## 유지보수

- 새로운 약어가 학습 자료에 도입되면 본 표에 즉시 추가.
- 컨텍스트 의존 약어 추가 시 "모호성 주의" 섹션도 갱신.
- 본 표는 study/ 한정. 전사 컨벤션 (`docs/conventions/`) 과 별도.
