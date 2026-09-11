package com.kgd.codedictionary.infrastructure.config

import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

/**
 * ADR-0059 — game:feature 가 자체 @EnableJpaRepositories 를 선언하면 Boot 의
 * JpaRepositoriesAutoConfiguration 이 back-off 하므로, code-dictionary 리포지토리는
 * 여기서 명시 등록한다 (기본 entityManagerFactory/transactionManager 바인딩).
 *
 * ADR-0093 ②③ — deal·ranking·blog 가 각자 전용 스키마를 갖고 떠났다.
 * 이제 이 호스트의 EMF/TM 을 쓰는 것은 자기 도메인(개념사전·포트폴리오·전시·이력서)뿐이다.
 * ADR-0072 — blog:feature 도 같은 이유로 com.kgd.blog 을 더한다.
 * ADR-0081 — ranking:feature 도 같은 이유로 com.kgd.ranking 을 더한다.
 *
 * **엔티티 스캔은 여기서 못 한다.** `@EntityScan` 은 Boot 가 자동 구성한 EMF 에만 반영되는데,
 * 이 앱은 `DataSourceConfig` 가 EMF 를 명시 정의해 자동 구성이 back-off 한 상태다. 엔티티
 * 패키지는 그 EMF 의 `.packages(...)` 에 더해야 한다 — 여기에 @EntityScan 을 달아두면
 * 다음 사람이 그게 동작한다고 믿는다.
 */
@Configuration
@EnableJpaRepositories(basePackages = ["com.kgd.codedictionary"])
class CodeDictionaryJpaConfig
