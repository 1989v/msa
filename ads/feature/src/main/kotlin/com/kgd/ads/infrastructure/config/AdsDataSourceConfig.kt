package com.kgd.ads.infrastructure.config

import com.kgd.common.persistence.ScopedFlywayMigrator
import com.zaxxer.hikari.HikariDataSource
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.DependsOn
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager

/**
 * ads 도메인의 **전용** datasource(ads_db) + EMF + TM. 비-@Primary (engagement 의 primary 는 experiment).
 *
 * **이 도메인의 `@Transactional` 은 전부 `adsTransactionManager` 를 한정자로 갖는다.**
 * 빠뜨리면 primary TM 에 붙고 ads EntityManager 가 트랜잭션에 참여하지 않아 쓰기가 조용히 사라진다.
 * 원장 잔액이 그렇게 사라지면 돈이 틀린다 — 호스트 컨텍스트 스펙이 충전 뒤 잔액을 다시 읽어 확인한다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.ads"],
    entityManagerFactoryRef = "adsEntityManagerFactory",
    transactionManagerRef = "adsTransactionManager",
)
class AdsDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.ads")
    fun adsDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    // 풀 설정(spring.datasource.ads.hikari.*)은 DataSourceProperties 가 옮기지 않으므로 여기서 받는다.
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.ads.hikari")
    fun adsDataSource(
        @Qualifier("adsDataSourceProperties") properties: DataSourceProperties,
    ): HikariDataSource = properties.initializeDataSourceBuilder().type(HikariDataSource::class.java).build()

    @Bean
    fun adsFlyway(
        @Qualifier("adsDataSource") dataSource: HikariDataSource,
        @Value("\${ads.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:adsdb/migration",
        // 새 스키마라 baseline 이 필요 없다 — V1 부터 정상 적용된다.
        enabled = enabled,
        baselineVersion = null,
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    // ddl-auto 는 호스트 설정(experiment 의 update 등)을 따르지 않고 여기서 validate 로 고정한다 —
    // ads 스키마의 소유자는 Flyway 하나다.
    @Bean
    @DependsOn("adsFlyway")
    fun adsEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("adsDataSource") dataSource: HikariDataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.ads")
            .persistenceUnit("ads")
            .properties(mapOf(HBM2DDL_AUTO to "validate"))
            .build()

    @Bean
    fun adsTransactionManager(
        @Qualifier("adsEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)

    companion object {
        const val HBM2DDL_AUTO = "hibernate.hbm2ddl.auto"
    }
}
