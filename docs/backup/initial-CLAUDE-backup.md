# Commerce Platform AI Working Agreement

## 1. Platform Intent

This project builds a production-ready MSA commerce platform.

The architecture must support:
- Horizontal scalability
- High availability
- Service isolation
- Kubernetes-ready deployment


## 2. Architecture Principles

This project strictly follows Clean Architecture.

- Dependency direction must always point inward.
- Domain layer must not depend on frameworks.
- Application layer depends only on ports.
- Infrastructure implements ports.
- Direct dependency from Application to Infrastructure is prohibited.
- Service-to-service database sharing is prohibited.

Reference: /docs/architecture/clean-architecture.md


## 3. Architectural Constraints

- Each service owns its database.
- Internal DB access remains blocking (JPA).
- External API communication uses WebClient.
- Coroutine usage is limited to external IO operations.
- Event-driven communication uses Kafka.
- Search is based on Elasticsearch.
- WebFlux full adoption is prohibited.
- Redis must be designed with cluster scalability in mind.


## 4. Architecture Governance

- Any architectural or structural change requires an ADR.
- Implementation code must not be generated before ADR approval.
- Existing ADRs must be reviewed before proposing new decisions.
- If a conflict with existing ADRs is detected, pause and request clarification.
- ADR numbering must be sequential.
- Superseded ADRs must explicitly reference replacement ADRs.


## 5. AI Execution Rules

Before generating implementation:

- Validate alignment with Architecture Principles.
- Validate consistency with existing ADRs.
- Validate consistency with relevant docs.
- If ambiguity or conflict exists, pause and request clarification.
- Avoid generating code before structure is finalized.