package com.kgd.codedictionary.infrastructure.config

import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

/**
 * ADR-0059 — game:feature 가 자체 @EnableJpaRepositories 를 선언하면 Boot 의
 * JpaRepositoriesAutoConfiguration 이 back-off 하므로, code-dictionary 리포지토리는
 * 여기서 명시 등록한다 (기본 entityManagerFactory/transactionManager 바인딩).
 *
 * ADR-0069 — deal:feature 는 game 과 달리 **전용 datasource 를 두지 않고** 이 기본
 * EMF/TM 을 그대로 쓴다(같은 스키마). 그래서 리포지토리·엔티티 스캔 범위에 com.kgd.deal 을
 * 더한다. @EntityScan 이 없으면 스캔 기준이 @SpringBootApplication 클래스의 패키지
 * (com.kgd.codedictionary)로 고정돼 deal 엔티티가 조용히 빠진다.
 */
@Configuration
@EnableJpaRepositories(basePackages = ["com.kgd.codedictionary", "com.kgd.deal"])
@EntityScan(basePackages = ["com.kgd.codedictionary", "com.kgd.deal"])
class CodeDictionaryJpaConfig
