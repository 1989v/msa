package com.kgd.codedictionary.infrastructure.config

import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

/**
 * ADR-0059 — game:feature 가 자체 @EnableJpaRepositories 를 선언하면 Boot 의
 * JpaRepositoriesAutoConfiguration 이 back-off 하므로, code-dictionary 리포지토리는
 * 여기서 명시 등록한다 (기본 entityManagerFactory/transactionManager 바인딩).
 *
 * ADR-0069 — deal:feature 는 game 과 달리 **전용 datasource 를 두지 않고** 이 기본
 * EMF/TM 을 그대로 쓴다(같은 스키마). 그래서 리포지토리 스캔 범위에 com.kgd.deal 을 더한다.
 *
 * **엔티티 스캔은 여기서 못 한다.** `@EntityScan` 은 Boot 가 자동 구성한 EMF 에만 반영되는데,
 * 이 앱은 `DataSourceConfig` 가 EMF 를 명시 정의해 자동 구성이 back-off 한 상태다. 엔티티
 * 패키지는 그 EMF 의 `.packages(...)` 에 더해야 한다 — 여기에 @EntityScan 을 달아두면
 * 다음 사람이 그게 동작한다고 믿는다.
 */
@Configuration
@EnableJpaRepositories(basePackages = ["com.kgd.codedictionary", "com.kgd.deal"])
class CodeDictionaryJpaConfig
