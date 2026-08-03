package com.kgd.codedictionary.infrastructure.config

import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

/**
 * ADR-0059 — game:feature 가 자체 @EnableJpaRepositories 를 선언하면 Boot 의
 * JpaRepositoriesAutoConfiguration 이 back-off 하므로, code-dictionary 리포지토리는
 * 여기서 명시 등록한다 (기본 entityManagerFactory/transactionManager 바인딩).
 */
@Configuration
@EnableJpaRepositories(basePackages = ["com.kgd.codedictionary"])
class CodeDictionaryJpaConfig
