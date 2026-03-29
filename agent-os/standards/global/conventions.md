# Commerce Platform Conventions

## Architecture
- Clean Architecture + Microservice
- Dependency direction: always inward (domain ← application ← infrastructure)
- Domain module: pure Kotlin, no Spring/JPA annotations
- App module: Spring Boot (Application + Infrastructure + Presentation layers)
- Service isolation: each service owns its database
- Inter-service communication: Kafka events or WebClient API calls only

## Coding Style
- Language: Kotlin
- Base package: `com.kgd.{service}`
- Nullable property smart cast: assign to local var first when crossing module boundaries
- WebClient for external API calls, JPA for internal DB access
- Coroutines limited to external IO operations only

## Test Conventions
- Framework: Kotest BehaviorSpec (BDD style)
- Mocking: MockK only (Mockito prohibited)
- Domain tests: no mocks, pure unit tests
- Application tests: mock Outbound Ports via MockK
- File naming: `{ClassName}Test.kt`

## Git Conventions
- Commit messages: conventional commits
- Branch naming: feature/, fix/, chore/
- ADR required for architectural changes
