# 소프트웨어 아키텍처 — 커버리지 체크리스트

원천:
- `study/docs/8-system-design/` — 01-design-framework(절차·빌딩 블록·트레이드오프·장애 표), 02~17 시나리오(각 시나리오가 쓰는 아키텍처 개념), 99-concept-catalog(평가 축·의사결정 카드)
- `docs/architecture/` — 00.clean-architecture · module-structure · service-boundary · communication · data-strategy · common-features · resilience-strategy · platform-overview
- `docs/conventions/package-structure.md` · ADR-0058(모듈러 모놀리스·워크로드 티어) · ADR-0083(계층 표준·빌드 게이트) · ADR-0093(성격 축 재그룹핑·파드 토폴로지 게이트)
- `study/docs/00-ADR-CANDIDATES.md` — 아키텍처 영역 후보(사가 오케스트레이터 · 인박스 · 스키마 레지스트리 · 멀티 리전)는 대부분 다른 도메인 소유라 아래 제외 표로 간다
- 분야 표준 — GoF 『Design Patterns』(23개 전부) · Fowler 『PoEAA』 · Evans/Vernon DDD(전략·전술) · Martin 『Clean Architecture』(SOLID·컴포넌트 원칙·안정도 지표) · Richards/Ford 『Fundamentals of Software Architecture』(아키텍처 스타일·품질 특성) · Newman 『Building Microservices』(통합·분해) · ISO/IEC 25010 품질 모델 · C4 모델 · ADR · 『Building Evolutionary Architectures』(피트니스 함수)

## 이 도메인에 놓은 개념

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| arch-software-architecture | 소프트웨어 아키텍처 (software architecture) | 기존 온톨로지 | placed |
| arch-design-principles | 설계 원칙 적용 | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-solid | SOLID (SOLID principles) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-srp | 단일 책임 원칙 (SRP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-ocp | 개방 폐쇄 원칙 (OCP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-lsp | 리스코프 치환 원칙 (LSP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-isp | 인터페이스 분리 원칙 (ISP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-dip | 의존성 역전 원칙 (DIP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-dry | DRY (Don't Repeat Yourself) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-kiss | KISS (Keep It Simple, Stupid) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-yagni | YAGNI (You Aren't Gonna Need It) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-rule-of-three | 세 번의 법칙 (Rule of Three) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-law-of-demeter | 디미터 법칙 (Law of Demeter) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-composition-over-inheritance | 상속보다 조합 (composition over inheritance) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-separation-of-concerns | 관심사 분리 (SoC) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-tell-dont-ask | 묻지 말고 시켜라 (Tell, Don't Ask) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-cqs | 명령-조회 분리 (CQS) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-grasp | GRASP (General Responsibility Assignment Software Patterns) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-package-principles | 패키지·컴포넌트 원칙 (component principles) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-reuse-release-equivalence | 재사용·릴리스 등가 원칙 (REP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-common-closure | 공통 폐쇄 원칙 (CCP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-common-reuse | 공통 재사용 원칙 (CRP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-acyclic-dependencies | 비순환 의존 원칙 (ADP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-stable-dependencies | 안정 의존 원칙 (SDP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-stable-abstractions | 안정 추상 원칙 (SAP) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-god-class | 갓 클래스 (God Object) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-shotgun-surgery | 산탄총 수술 (shotgun surgery) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-wrong-abstraction | 잘못된 추상화 (wrong abstraction) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-afferent-coupling | 구심 결합도 (Ca) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-efferent-coupling | 원심 결합도 (Ce) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-instability | 불안정도 (instability) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-abstractness | 추상도 (abstractness) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-main-sequence-distance | 주계열 거리 (distance from the main sequence) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-lcom | LCOM (Lack of Cohesion in Methods) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-cyclomatic-complexity | 순환 복잡도 (cyclomatic complexity) | 분야 표준(Martin 『Clean Architecture』·SOLID·PoEAA) · CLAUDE.md Design Principles | placed |
| arch-object-design | 객체 설계 (GoF design patterns) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| arch-creational-design | 객체 생성 설계 | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| factory-pattern | 팩토리 메서드 패턴 (factory method) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| abstract-factory | 추상 팩토리 (abstract factory) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| builder-pattern | 빌더 패턴 (builder) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| prototype-pattern | 프로토타입 패턴 (prototype) | 분야 표준(GoF 23) | placed |
| singleton-pattern | 싱글톤 패턴 (singleton) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| arch-structural-design | 구조 조합 설계 | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| adapter-pattern | 어댑터 패턴 (adapter) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| bridge-pattern | 브리지 패턴 (bridge) | 분야 표준(GoF 23) | placed |
| composite-pattern | 컴포지트 패턴 (composite) | 분야 표준(GoF 23) | placed |
| decorator-pattern | 데코레이터 패턴 (decorator) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| facade-pattern | 퍼사드 패턴 (facade) | 분야 표준(GoF 23) | placed |
| flyweight-pattern | 플라이웨이트 패턴 (flyweight) | 분야 표준(GoF 23) | placed |
| proxy-pattern | 프록시 패턴 (proxy) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| arch-class-explosion | 클래스 폭발 (class explosion) | 분야 표준(GoF 23) | placed |
| arch-behavioral-design | 행위 분배 설계 | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| strategy-pattern | 전략 패턴 (strategy) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| template-method | 템플릿 메서드 (template method) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| observer-pattern | 옵저버 패턴 (observer) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| command-pattern | 커맨드 패턴 (command) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| chain-of-responsibility | 책임 연쇄 (chain of responsibility) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| mediator-pattern | 중재자 패턴 (mediator) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| state-pattern | 상태 패턴 (state) | 분야 표준(GoF 23) | placed |
| iterator-pattern | 이터레이터 패턴 (iterator) | 분야 표준(GoF 23) | placed |
| visitor-pattern | 비지터 패턴 (visitor) | 분야 표준(GoF 23) | placed |
| memento-pattern | 메멘토 패턴 (memento) | 분야 표준(GoF 23) | placed |
| interpreter-pattern | 인터프리터 패턴 (interpreter) | 분야 표준(GoF 23) | placed |
| specification-pattern | 스펙 패턴 (specification) | 기존 온톨로지 · 분야 표준(GoF 23) | placed |
| arch-null-object | 널 객체 패턴 (Null Object) | 분야 표준(GoF 23) | placed |
| arch-enterprise-patterns | 엔터프라이즈 애플리케이션 패턴 (PoEAA) | 분야 표준(Fowler PoEAA) | placed |
| arch-transaction-script | 트랜잭션 스크립트 (Transaction Script) | 분야 표준(Fowler PoEAA) | placed |
| arch-table-module | 테이블 모듈 (Table Module) | 분야 표준(Fowler PoEAA) | placed |
| arch-service-layer | 서비스 계층 (Service Layer) | 00.clean-architecture §3.2 · 분야 표준(PoEAA) | placed |
| arch-repository-pattern | 리포지토리 패턴 (Repository) | 00.clean-architecture §4.2 · 분야 표준(PoEAA·DDD) | placed |
| arch-data-mapper | 데이터 매퍼 (Data Mapper) | 00.clean-architecture §3.3 · 분야 표준(PoEAA) | placed |
| arch-active-record | 액티브 레코드 (Active Record) | 분야 표준(Fowler PoEAA) | placed |
| arch-table-data-gateway | 테이블 데이터 게이트웨이 (Table Data Gateway) | 분야 표준(Fowler PoEAA) | placed |
| arch-row-data-gateway | 로우 데이터 게이트웨이 (Row Data Gateway) | 분야 표준(Fowler PoEAA) | placed |
| arch-unit-of-work | 작업 단위 (Unit of Work) | 분야 표준(Fowler PoEAA) | placed |
| arch-identity-map | 아이덴티티 맵 (Identity Map) | 분야 표준(Fowler PoEAA) | placed |
| arch-gateway-pattern | 게이트웨이 패턴 (Gateway) | 분야 표준(Fowler PoEAA) | placed |
| arch-impedance-mismatch | 객체-관계 임피던스 불일치 (object-relational impedance mismatch) | 분야 표준(Fowler PoEAA) | placed |
| arch-layer-design | 계층 설계 | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| layered-architecture | 레이어드 아키텍처 (layered architecture) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| clean-architecture | 클린 아키텍처 (clean architecture) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| hexagonal-architecture | 헥사고날 아키텍처 (hexagonal architecture) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| port-adapter | 포트-어댑터 (port and adapter) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-onion-architecture | 어니언 아키텍처 (onion architecture) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-vertical-slice | 버티컬 슬라이스 아키텍처 (vertical slice architecture) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-package-by-feature | 기능별 패키지 (package by feature) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-package-by-layer | 계층별 패키지 (package by layer) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-mvc | MVC (Model-View-Controller) | 00.clean-architecture §3.4 · 분야 표준 | placed |
| arch-layer-dependency-gate | 계층 의존 빌드 게이트 | ADR-0083 §5 | placed |
| arch-layer-violation | 계층 침범 (layer violation) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-framework-coupling | 프레임워크 종속 (framework lock-in) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-boundary-design | 도메인 경계 설계 | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| ddd | 도메인 주도 설계 (DDD) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-strategic-design | 전략 설계 (strategic design) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-event-storming | 이벤트 스토밍 (Event Storming) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-context-mapping | 컨텍스트 매핑 (context mapping) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-partnership | 파트너십 (Partnership) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-shared-kernel | 공유 커널 (Shared Kernel) | 분야 표준(DDD) · docs/architecture/module-structure.md | placed |
| arch-customer-supplier | 고객-공급자 (Customer-Supplier) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-conformist | 준수자 (Conformist) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-anti-corruption-layer | 부패 방지 계층 (ACL) | 분야 표준(DDD) · 00.clean-architecture §7.2 | placed |
| arch-open-host-service | 공개 호스트 서비스 (OHS) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-published-language | 공표된 언어 (PL) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-separate-ways | 각자의 길 (Separate Ways) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-tactical-design | 전술 설계 (tactical design) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-rich-domain-model | 풍부한 도메인 모델 (rich domain model) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-reference-by-id | ID 로 참조 (reference by identity) | CLAUDE.md JPA 컨벤션(FK-as-ID) · 분야 표준(Vernon) | placed |
| arch-anemic-domain-model | 빈약한 도메인 모델 (anemic domain model) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-oversized-aggregate | 거대 애그리거트 (large aggregate) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-cohesion | 응집도 (cohesion) | 기존 온톨로지 | placed |
| arch-system-decomposition | 시스템 분해 | 기존 온톨로지 · 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| monolith | 모놀리스 (monolith) | 기존 온톨로지 · 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-modular-monolith | 모듈러 모놀리스 (modular monolith) | ADR-0058 · ADR-0093 | placed |
| arch-service-based | 서비스 기반 아키텍처 (service-based architecture) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| soa | 서비스 지향 아키텍처 (SOA) | 기존 온톨로지 · 분야 표준 | placed |
| msa | 마이크로서비스 (MSA) | 기존 온톨로지 · docs/architecture/service-boundary.md | placed |
| event-driven-architecture | 이벤트 기반 아키텍처 (EDA) | 기존 온톨로지 · 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-eda-broker-topology | 브로커 토폴로지 (broker topology) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-eda-mediator-topology | 중재자 토폴로지 (mediator topology) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-pipe-and-filter | 파이프-필터 (pipeline architecture) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-microkernel | 마이크로커널 (microkernel) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-space-based | 공간 기반 아키텍처 (space-based architecture) | 분야 표준(Richards·Ford) · study/8 08-ticketing | placed |
| arch-serverless | 서버리스 (serverless) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-decompose-by-capability | 비즈니스 역량별 분해 (decompose by business capability) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-decompose-by-subdomain | 하위 도메인별 분해 (decompose by subdomain) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-service-granularity | 서비스 입도 결정 (service granularity) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-database-per-service | 서비스별 데이터베이스 (database per service) | docs/architecture/data-strategy.md §1 · ADR-0058 불변식 3 | placed |
| arch-shared-database | 공유 데이터베이스 (shared database) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-workload-tiering | 워크로드 티어링 (workload tiering) | ADR-0058 §1 | placed |
| arch-inverse-conway-maneuver | 역콘웨이 전략 (Inverse Conway Maneuver) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-distributed-monolith | 분산 모놀리스 (distributed monolith) | 기존 온톨로지 · 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-over-decomposition | 과분할 (nanoservices) | ADR-0058 Context | placed |
| arch-big-ball-of-mud | 큰 진흙 공 (Big Ball of Mud) | 분야 표준(Richards·Ford 『Fundamentals of Software Architecture』) · ADR-0058 · ADR-0093 | placed |
| arch-coupling | 결합도 (coupling) | 기존 온톨로지 · study/8 §5 | placed |
| spring-boot | Spring Boot (Spring) | 기존 온톨로지 · build.gradle.kts | placed |
| arch-integration-design | 서비스 통합 설계 | docs/architecture/communication.md · study/8 §4 · 분야 표준(Newman 『Building Microservices』) | placed |
| arch-sync-integration | 동기 호출 통합 (synchronous integration) | docs/architecture/communication.md §1 · study/8 01 §5 | placed |
| arch-async-integration | 비동기 메시지 통합 (asynchronous messaging) | docs/architecture/communication.md §2 · ADR-0058 | placed |
| arch-orchestration | 오케스트레이션 (orchestration) | study/8 99 §4 · 16-payment-idempotency §6-3 | placed |
| arch-choreography | 코레오그래피 (choreography) | study/8 99 §4 · ADR-0058 | placed |
| arch-api-composition | API 조합 (API composition) | docs/architecture/communication.md · study/8 §4 · 분야 표준(Newman 『Building Microservices』) | placed |
| arch-bff | BFF (Backend for Frontend) | 분야 표준(Newman) | placed |
| arch-strangler-fig | 스트랭글러 피그 (Strangler Fig) | 분야 표준(Fowler) | placed |
| arch-shared-library | 공통 라이브러리 (shared library) | docs/architecture/common-features.md | placed |
| arch-temporal-coupling | 시간적 결합 (temporal coupling) | docs/architecture/communication.md · study/8 §4 · 분야 표준(Newman 『Building Microservices』) | placed |
| arch-chatty-communication | 수다스러운 통신 (chatty API) | docs/architecture/communication.md · study/8 §4 · 분야 표준(Newman 『Building Microservices』) | placed |
| arch-system-design | 시스템 설계 (system design) | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-requirements-clarification | 요구사항 명확화 | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-nfr-tiering | 서비스 등급별 비기능 요구 (NFR tiering) | study/8 01 Step 1 · ADR-0025 | placed |
| arch-availability | 가용성 (availability) | study/8 01 Step 1 · 99 §2-B | excluded — 같은 개념 obs-availability 로 합쳤다 |
| arch-durability | 내구성 (durability) | study/8 99 §2-B | placed |
| arch-capacity-estimation | 용량 산정 | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-back-of-envelope | 봉투 뒷면 계산 (back-of-the-envelope estimation) | study/8 01 Step 2 | placed |
| arch-peak-qps | 피크 QPS (peak QPS) | study/8 01 Step 2 | placed |
| arch-read-write-ratio | 읽기·쓰기 비율 (read/write ratio) | study/8 99 §2-B · 01 Step 4 | placed |
| arch-high-level-design | 상위 수준 설계 | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-stateless-service | 무상태 서비스 (stateless service) | study/8 01 §2 | placed |
| arch-horizontal-scaling | 수평 확장 (scale-out) | study/8 02·09 Scale-out | placed |
| arch-vertical-scaling | 수직 확장 (scale-up) | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-redundancy | 이중화 (redundancy) | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-read-path-scaling | 읽기 경로 확장 (read scaling) | study/8 01 Step 4 조립 룰 | placed |
| arch-write-path-scaling | 쓰기 경로 확장 (write scaling) | study/8 01 Step 4 조립 룰 | placed |
| arch-fanout-on-write | 쓰기 시 팬아웃 (fan-out on write) | study/8 04-feed-system §4 | excluded — 같은 개념 dist-fanout-on-write 로 합쳤다 |
| arch-fanout-on-read | 읽기 시 팬아웃 (fan-out on read) | study/8 04-feed-system §4 | excluded — 같은 개념 dist-fanout-on-read 로 합쳤다 |
| arch-multi-tenancy | 멀티 테넌시 (multi-tenancy) | study/8 99 §4 | placed |
| arch-single-point-of-failure | 단일 장애점 (SPOF) | study/8 01 §6 · 분야 표준 | placed |
| arch-deep-dive | 병목 심화와 트레이드오프 | study/8 01-design-framework · 99-concept-catalog §2·§4 | placed |
| arch-tradeoff-analysis | 트레이드오프 분석 (trade-off analysis) | study/8 01 §5 · 분야 표준(SEI ATAM) | placed |
| arch-failure-mode-analysis | 장애 모드 분석 (failure mode analysis) | study/8 01 §6 · 99 §3 | placed |
| arch-scaling-path | 단계별 확장 경로 (scaling path) | study/8 14~17 Scaling Path | placed |
| arch-architecture-governance | 아키텍처 결정과 거버넌스 | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-adr | 아키텍처 결정 기록 (ADR) | docs/adr · ADR-0026 | placed |
| arch-c4-model | C4 모델 (C4 model) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-4plus1-view | 4+1 뷰 모델 (4+1 architectural view model) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-fitness-function | 피트니스 함수 (architecture fitness function) | ADR-0083 · 분야 표준(Ford 외) | placed |
| arch-pod-topology-gate | 파드 토폴로지 게이트 | ADR-0093 · build.gradle.kts | placed |
| arch-evolutionary-architecture | 진화적 아키텍처 (evolutionary architecture) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-architecture-erosion | 아키텍처 침식 (architecture erosion) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-technical-debt | 기술 부채 (technical debt) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-glossary | 아키텍처 용어 사전 (glossary) | 기존 온톨로지 | placed |
| arch-glossary-ddd | DDD 용어 | 분야 표준(Evans·Vernon DDD) | placed |
| arch-ubiquitous-language | 유비쿼터스 언어 (Ubiquitous Language) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-subdomain | 하위 도메인 (Subdomain) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-core-domain | 핵심 도메인 (Core Domain) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-supporting-subdomain | 지원 하위 도메인 (Supporting Subdomain) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-generic-subdomain | 일반 하위 도메인 (Generic Subdomain) | 분야 표준(Evans·Vernon DDD) | placed |
| bounded-context | 바운디드 컨텍스트 (Bounded Context) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-context-map | 컨텍스트 맵 (Context Map) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-upstream-downstream | 상류·하류 (upstream) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-entity | 엔티티 (Entity) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| value-object | 값 객체 (Value Object) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| aggregate | 애그리거트 (Aggregate) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-invariant | 불변식 (Invariant) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-domain-event | 도메인 이벤트 (Domain Event) | 기존 온톨로지 · 분야 표준(Evans·Vernon DDD) | placed |
| arch-integration-event | 통합 이벤트 (Integration Event) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-domain-service | 도메인 서비스 (Domain Service) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-domain-factory | 도메인 팩토리 (DDD Factory) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-ddd-module | 모듈 (DDD) (Module) | 분야 표준(Evans·Vernon DDD) | placed |
| arch-glossary-layer | 계층 용어 | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-domain-layer | 도메인 계층 (domain layer) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-application-layer | 애플리케이션 계층 (application layer) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-infrastructure-layer | 인프라 계층 (infrastructure layer) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-presentation-layer | 표현 계층 (presentation layer) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-usecase | 유스케이스 (Use Case) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-application-service | 애플리케이션 서비스 (Application Service) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-inbound-port | 인바운드 포트 (inbound port) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-outbound-port | 아웃바운드 포트 (outbound port) | docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-dto | DTO (Data Transfer Object) | 00.clean-architecture §6 · 분야 표준(PoEAA) | placed |
| arch-composition-root | 합성 루트 (Composition Root) | ADR-0058 재분리 체크리스트 | placed |
| arch-dependency-rule | 의존성 규칙 (Dependency Rule) | 기존 온톨로지 · docs/architecture/00.clean-architecture.md · docs/conventions/package-structure.md · ADR-0083 | placed |
| arch-glossary-quality | 품질 속성 용어 (quality attributes) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-functional-requirement | 기능 요구사항 (functional requirement) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-nfr | 비기능 요구사항 (non-functional requirement) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-quality-attribute-scenario | 품질 속성 시나리오 (quality attribute scenario) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-scalability | 확장성 (scalability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-elasticity | 탄력성 (elasticity) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-reliability | 신뢰성 (reliability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-fault-tolerance | 내결함성 (fault tolerance) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-performance | 성능 (performance) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-maintainability | 유지보수성 (maintainability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-testability | 테스트 용이성 (testability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-deployability | 배포 용이성 (deployability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-interoperability | 상호 운용성 (interoperability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-portability | 이식성 (portability) | 분야 표준(ISO/IEC 25010 · SEI 품질 속성) | placed |
| arch-glossary-coupling | 결합·응집 용어 | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-connascence | 코나센스 (connascence) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-coupling-kinds | 결합 종류 (types of coupling) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-content-coupling | 내용 결합 (content coupling) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-common-coupling | 공통 결합 (common coupling) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-control-coupling | 제어 결합 (control coupling) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-stamp-coupling | 스탬프 결합 (stamp coupling) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-data-coupling | 자료 결합 (data coupling) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-cohesion-kinds | 응집 종류 (types of cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-functional-cohesion | 기능 응집 (functional cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-sequential-cohesion | 순차 응집 (sequential cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-communicational-cohesion | 통신 응집 (communicational cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-procedural-cohesion | 절차 응집 (procedural cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-temporal-cohesion | 시간 응집 (temporal cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-logical-cohesion | 논리 응집 (logical cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-coincidental-cohesion | 우연 응집 (coincidental cohesion) | 분야 표준(구조적 설계 결합·응집 분류 · connascence) | placed |
| arch-glossary-doc | 아키텍처 문서화 용어 | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-c4-system-context | 시스템 컨텍스트 다이어그램 (C4 Level 1) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-c4-container | 컨테이너 다이어그램 (C4 Level 2) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-c4-component | 컴포넌트 다이어그램 (C4 Level 3) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-c4-code | 코드 다이어그램 (C4 Level 4) | 분야 표준(ADR·C4·『Building Evolutionary Architectures』) · ADR-0083 | placed |
| arch-conways-law | 콘웨이 법칙 (Conway's Law) | 분야 표준(Conway) · ADR-0093 | placed |

## 다른 도메인 소유 · 제외

시스템 설계 빌딩 블록과 분산·데이터 패턴은 소유 도메인에만 둔다. 이 파일에서는 USES 등으로 잇는다(지금 파일에 있는 개념만).

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| api-gateway | API 게이트웨이 | study/8 01 §2 빌딩 블록 · docs/architecture/service-boundary.md §2 | excluded — owned by infrastructure (msa·arch-bff·arch-strangler-fig 가 USES·ALTERNATIVE_TO 로 잇는다) |
| load-balancer | 로드 밸런서 (L4/L7) | study/8 01 §2 | excluded — owned by infrastructure (arch-horizontal-scaling 이 USES) |
| service-discovery | 서비스 디스커버리 (K8s DNS) | docs/architecture/k8s-deployment-model.md §5 | excluded — owned by infrastructure (msa 가 USES) |
| reverse-proxy | 리버스 프록시 | study/8 01 Step 4 | excluded — owned by infrastructure (arch-strangler-fig 가 USES) |
| auto-scaler | 오토스케일러 (HPA) | study/8 01 §2 Stateless · ASG | excluded — owned by infrastructure (arch-horizontal-scaling 이 USES) |
| health-check | 헬스 체크 | study/8 01 §6 | excluded — owned by infrastructure (arch-redundancy 가 USES) |
| canary-deployment | 카나리 · 블루그린 배포 | study/8 99 §2-E | excluded — owned by infrastructure |
| infra-sidecar | 사이드카 · 앰배서더 패턴 | 분야 표준(클라우드 디자인 패턴) | excluded — owned by infrastructure |
| caching | 캐시 | study/8 01 §2·§4-1 | excluded — owned by data (arch-read-path-scaling 이 USES) |
| data-cache-patterns | 캐시 패턴 (cache-aside · read/write-through · write-behind · refresh-ahead) | study/8 01 §4-1 · 99 §4 | excluded — owned by data |
| data-cache-stampede | 캐시 스탬피드 | study/8 01 §4-1 · 12 §3-3 | excluded — owned by data |
| data-read-replica-routing | 읽기 복제본 라우팅 · read-your-writes 라우팅 | study/8 99 §4 · docs/architecture/data-strategy.md §2 | excluded — owned by data (arch-read-path-scaling 이 USES) |
| data-olap-timeseries | 시계열 · OLAP 저장소 선택 | study/8 01 §2 · 17 §6-4 | excluded — owned by data |
| data-lazy-loading | 지연 로딩 (PoEAA Lazy Load) | 분야 표준(PoEAA) | excluded — owned by data |
| data-inheritance-mapping | 상속 매핑 (단일·조인·구체 테이블) | 분야 표준(PoEAA) | excluded — owned by data (ORM 매핑) |
| data-identity-field | 식별자 필드 · 외래 키 매핑 | 분야 표준(PoEAA) | excluded — owned by data |
| optimistic-lock | 낙관적 오프라인 락 | 분야 표준(PoEAA) · ADR 후보 0037 | excluded — owned by data (arch-rich-domain-model 이 USES) |
| sharding | 샤딩 · 샤딩 키 선택 | study/8 01 §3 · 99 §4 | excluded — owned by distributed (arch-write-path-scaling 이 USES) |
| consistent-hashing | 일관 해싱 | study/8 02 §7 | excluded — owned by distributed |
| replication | 복제 · 읽기 복제본 | study/8 01 Step 4 | excluded — owned by distributed (arch-redundancy·arch-space-based 가 USES) |
| dist-hot-partition | 핫 키 · 핫 파티션 | study/8 01 Step 5 · 02 §7-3 · 04 §7-4 | excluded — owned by distributed |
| dist-id-generation | 분산 ID 생성 (Snowflake · UUIDv7 · KSUID) | study/8 01 §3 · 02 §4 · 12 §4-1 | excluded — owned by distributed |
| idempotency | 멱등성 · Idempotency-Key | study/8 01 §4-3 · 16 | excluded — owned by distributed (arch-async-integration 이 USES) |
| outbox-pattern | 아웃박스 | study/8 01 §4-2 · 16 §5-3 | excluded — owned by distributed |
| saga-pattern | 사가 | study/8 05 §5-2 · 16 §6-3 | excluded — owned by distributed (arch-orchestration·arch-choreography 가 USES) |
| dist-inbox-pattern | 인박스 패턴 | study/docs/00-ADR-CANDIDATES.md (가번호 0058) | excluded — owned by distributed |
| cqrs | CQRS | study/8 16 Phase 4 | excluded — owned by distributed (arch-api-composition 이 ALTERNATIVE_TO) |
| event-sourcing | 이벤트 소싱 | study/8 16 Phase 4 | excluded — owned by distributed |
| circuit-breaker | 서킷 브레이커 | study/8 05 §7 · docs/architecture/resilience-strategy.md | excluded — owned by distributed |
| bulkhead-pattern | 벌크헤드 | docs/architecture/resilience-strategy.md §4 | excluded — owned by distributed |
| retry-pattern | 재시도 · 타임아웃 정책 | docs/architecture/resilience-strategy.md §2·§3 | excluded — owned by distributed |
| dist-graceful-degradation | 우아한 성능 저하 · fail-open/fail-closed | study/8 01 §6 · 06 §5-2 | excluded — owned by distributed |
| cap-theorem | CAP · 강한/최종 일관성 선택 | study/8 99 §2-B · §4 | excluded — owned by distributed (arch-tradeoff-analysis 가 USES) |
| eventual-consistency | 최종 일관성 | study/8 01 §5 | excluded — owned by distributed |
| dist-read-your-writes | read-your-writes 일관성 | study/8 01 Step 5 · ADR 후보 0029 | excluded — owned by distributed |
| backpressure | 배압 | study/8 17 | excluded — owned by distributed |
| service-mesh | 서비스 메시 | study/8 12 §4-2 | excluded — owned by distributed |
| fan-out | 팬아웃 | study/8 04 | excluded — owned by distributed (arch-fanout-on-write/read 가 USES) |
| dist-dead-letter-queue | DLQ | study/8 01 §4-2 · docs/architecture/communication.md §8 | excluded — owned by distributed |
| kafka | 메시지 브로커 (Kafka) | study/8 01 §2 · docs/architecture/kafka-convention.md | excluded — owned by messaging (이동 중이라 간선은 보고에 남김) |
| msg-work-queue-pubsub | 작업 큐 · pub/sub | study/8 01 §4-2 | excluded — owned by messaging |
| msg-enterprise-integration-patterns | 엔터프라이즈 통합 패턴 (라우터 · 번역기 · 집계기 · 클레임 체크) | 분야 표준(Hohpe EIP) | excluded — owned by messaging |
| msg-stream-processing | 스트림 처리 · 워터마크 | study/8 01 §2 · 15 | excluded — owned by messaging |
| msg-schema-registry | 스키마 레지스트리 · 스키마 진화 | study/8 17 §6-3 · ADR 후보(가번호 0059) | excluded — owned by messaging |
| cloud-cdn | CDN | study/8 01 §2 · 08 §7 | excluded — owned by cloud |
| cloud-object-storage | 오브젝트 스토리지 · presigned URL | study/8 01 §2 | excluded — owned by cloud |
| cloud-multi-region | 멀티 리전 active-active / active-passive · DNS failover | study/8 99 §4 · 12 §4-3 · ADR 후보(가번호 0061) | excluded — owned by cloud |
| rate-limiting | 레이트 리미터 알고리즘 (토큰·리키 버킷 · 윈도) | study/8 06 | excluded — owned by security |
| rest | REST API 설계 | study/8 01 Step 3 | excluded — owned by network (arch-sync-integration 이 USES) |
| grpc | gRPC | study/8 17 §6-1 · ADR 후보(가번호 0055) | excluded — owned by network |
| websocket | WebSocket · SSE · 폴링 · 웹훅 선택 | study/8 03 · 99 §4 | excluded — owned by network |
| net-api-pagination | 커서 페이지네이션 | study/8 01 Step 3 | excluded — owned by network (API 스타일) |
| net-api-versioning | API 버전 관리 | 분야 표준 | excluded — owned by network |
| net-mqtt | MQTT · 디바이스 프로토콜 선택 | study/8 17 §6-1 | excluded — owned by network |
| inverse-index | 역색인 · 자동완성 · 검색 서빙 | study/8 09 · 14 | excluded — owned by search |
| cs-geospatial-index | 공간 인덱스 (지오해시 · 쿼드트리 · R-tree · S2) | study/8 11 §3 | excluded — owned by cs-fundamentals |
| cs-hyperloglog | HyperLogLog | study/8 15 §6-2 | excluded — owned by cs-fundamentals |
| order-ledger | 원장 · 복식부기 · 대사 | study/8 05 §5-3 · §8 | excluded — owned by commerce-order |
| order-payment-state-machine | 결제 상태 머신 · PG 타임아웃 처리 | study/8 16 §5-2 · §6-4 | excluded — owned by commerce-order |
| order-money | 금액 모델 (PoEAA Money) | 분야 표준(PoEAA) | excluded — owned by commerce-order |
| catalog-overselling-guard | 좌석·재고 선점과 오버셀링 방어 | study/8 08 §5 | excluded — owned by commerce-catalog |
| obs-latency-budget | 지연 예산 · Tier 1 P99 SLA (ADR-0025) | study/8 01 Step 1 · ADR-0025 | excluded — owned by observability |
| latency-percentile | 지연 백분위 (P50/P95/P99) | study/8 99 §2-B | excluded — owned by observability |
| obs-distributed-tracing | 분산 추적 | study/8 12 §2-3 · ADR 후보(0028) | excluded — owned by observability |
| spring-di | 의존성 주입 · IoC 컨테이너 | 분야 표준 | excluded — owned by spring |
| spring-aop | AOP | 00.clean-architecture · 분야 표준 | excluded — owned by spring (proxy-pattern 이 설명) |
| test-consumer-driven-contract | 소비자 주도 계약 테스트 | 분야 표준(Newman) | excluded — owned by testing |
| encapsulation | 캡슐화 · 추상화 · 다형성 · 상속 | 분야 표준(OOP) | excluded — owned by language (원칙·패턴이 USES) |
