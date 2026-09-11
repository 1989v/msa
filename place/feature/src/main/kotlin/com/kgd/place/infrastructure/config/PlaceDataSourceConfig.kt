package com.kgd.place.infrastructure.config

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
 * ADR-0093 — content 모듈러 모놀리스. place 도메인의 **전용** datasource(place_db) + EMF + TM.
 * 이 호스트에서 @Primary 다 — game 은 비-@Primary 를 그대로 유지한다.
 *
 * 독립 앱일 때 place 는 datasource 를 전부 자동 구성에 맡기고 있었다. 같은 JVM 에 들어오는
 * game 이 `gameDataSource` 를 만드는 순간 `DataSourceAutoConfiguration` 이
 * `@ConditionalOnMissingBean(DataSource)` 로 back-off 해 **place 의 JPA 가 조용히 사라진다**.
 * 컴파일도 단위 테스트도 통과한 채로. 그래서 명시로 내린다.
 *
 * Flyway 도 `classpath:db/migration` → `classpath:placedb/migration` 으로 옮겼다. 호스트 기본
 * Flyway 는 그 경로를 재귀 스캔해 남의 도메인 마이그레이션까지 place_db 에 적용한다.
 * 파일 내용은 그대로라 기존 `flyway_schema_history` 의 버전·체크섬과 어긋나지 않는다.
 *
 * 재분리 시 이 설정이 그대로 standalone place:app 으로 따라간다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.place"],
    entityManagerFactoryRef = "placeEntityManagerFactory",
    transactionManagerRef = "placeTransactionManager",
)
class PlaceDataSourceConfig {

    /**
     * `@ConfigurationProperties` 를 DataSource 에 직접 걸지 않는다 — Hikari 는 `jdbcUrl` 을
     * 요구하는데 표준 키는 `url` 이라 바인딩이 비고 `IllegalArgumentException` 이 난다.
     */
    @Bean
    @Primary
    @ConfigurationProperties(prefix = "spring.datasource.place")
    fun placeDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    @Primary
    fun placeDataSource(
        @Qualifier("placeDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /** place 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun placeFlyway(
        @Qualifier("placeDataSource") dataSource: DataSource,
        @Value("\${place.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:placedb/migration",
        enabled = enabled,
        // 운영 스키마는 Hibernate 가 만든 것이라 이력이 없다. 독립 앱 시절 yml 의
        // baseline-version 과 같은 값이고, 이력 테이블이 생긴 뒤에는 무시된다.
        baselineVersion = "2",
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @Primary
    @DependsOn("placeFlyway")
    fun placeEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("placeDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.place")
            .persistenceUnit("place")
            .build()

    @Bean
    @Primary
    fun placeTransactionManager(
        @Qualifier("placeEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
