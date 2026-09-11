package com.kgd.quant.infrastructure.persistence.config

import com.kgd.common.persistence.ScopedFlywayMigrator
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.DependsOn
import org.springframework.context.annotation.Primary
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0093 — sideapp 모듈러 모놀리스. quant 도메인의 **전용** datasource(quant) + EMF + TM.
 * 셋 중 @Primary 다.
 *
 * 독립 앱일 때 quant 는 MySQL 을 **자동 구성에 맡기고 있었다** — Postgres·ClickHouse 는
 * `DataSource` 빈을 일부러 등록하지 않고 `JdbcTemplate` 만 노출해서 자동 구성을 지키는 방식이었다
 * (`QuantPostgresDataSourceConfig` 주석 참조). 그런데 같은 JVM 에 gifticon 이 들어오면 그쪽
 * `DataSource` 빈 하나로 `DataSourceAutoConfiguration` 이 back-off 하고, **quant 의 MySQL 과 JPA 가
 * 조용히 사라진다.** 지키던 전제가 폴드로 깨지는 것이라 명시 배선으로 내린다.
 *
 * Flyway 도 `classpath:db/migration` 에서 `classpath:quantdb/migration` 으로 옮겼다 — 호스트 기본
 * Flyway 가 그 경로를 재귀 스캔해 다른 도메인의 마이그레이션까지 quant 스키마에 적용하기 때문이다.
 * 파일 내용은 그대로라 기존 `flyway_schema_history` 의 버전·체크섬과 어긋나지 않는다.
 *
 * 재분리 시 이 설정이 그대로 standalone quant:app 으로 따라간다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.quant"],
    entityManagerFactoryRef = "quantEntityManagerFactory",
    transactionManagerRef = "quantTransactionManager",
)
class QuantDataSourceConfig {

    /**
     * `@ConfigurationProperties` 를 DataSource 에 직접 걸지 않는다 — Hikari 는 `jdbcUrl` 을
     * 요구하는데 표준 키는 `url` 이라 바인딩이 비고 `IllegalArgumentException` 이 난다.
     * `DataSourceProperties` 가 그 변환을 한다.
     */
    @Bean
    @Primary
    @ConfigurationProperties(prefix = "spring.datasource.quant")
    fun quantDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    @Primary
    fun quantDataSource(
        @Qualifier("quantDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /** quant 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun quantFlyway(
        @Qualifier("quantDataSource") dataSource: DataSource,
        @Value("\${quant.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:quantdb/migration",
        enabled = enabled,
        // 운영 스키마는 Hibernate ddl-auto=update 가 만든 것이라 이력이 없다. 독립 앱 시절
        // yml 의 baseline-version 과 같은 값이고, 이력 테이블이 생긴 뒤에는 무시된다.
        baselineVersion = "20260507.001",
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @Primary
    @DependsOn("quantFlyway")
    fun quantEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("quantDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            // common 의 멱등 원장 엔티티도 이 EMF 가 관리해야 한다 — 폴드 도메인 공통 규약.
            // 빼면 ProcessedEventEntity 가 "Not a managed type" 으로 컨텍스트가 깨진다.
            .packages("com.kgd.quant", "com.kgd.common.messaging.idempotency")
            .persistenceUnit("quant")
            .build()

    @Bean
    @Primary
    fun quantTransactionManager(
        @Qualifier("quantEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
