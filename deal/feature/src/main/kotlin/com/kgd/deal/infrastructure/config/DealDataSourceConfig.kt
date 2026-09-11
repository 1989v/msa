package com.kgd.deal.infrastructure.config

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
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0093 ② — deal 도메인의 **전용** datasource(deal_db) + EMF + TM. 비-@Primary.
 *
 * 전환 기간에는 `spring.datasource.deal.url` 조건부였다 — code-dictionary 와 commerce 가
 * 동시에 deal 을 서빙해야 게이트웨이 전환 한 시점만 전환점이 되기 때문이다. 전환이 끝나
 * deal 은 commerce 에만 있으므로 조건을 걷었다(속성 하나로 스키마가 갈리는 상태를 영구로
 * 두지 않는다).
 *
 * **이 도메인의 `@Transactional` 은 전부 `dealTransactionManager` 를 한정자로 갖는다.**
 * 빠뜨리면 primary(inventory) TM 에 붙고 deal EM 이 트랜잭션에 참여하지 않아
 * `@Modifying` UPDATE 가 조용히 실패한다 — 2026-09-11 운영에서 click_count 가 그렇게 멈췄다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.deal"],
    entityManagerFactoryRef = "dealEntityManagerFactory",
    transactionManagerRef = "dealTransactionManager",
)
class DealDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.deal")
    fun dealDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    fun dealDataSource(
        @Qualifier("dealDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /** deal 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun dealFlyway(
        @Qualifier("dealDataSource") dataSource: DataSource,
        @Value("\${deal.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:dealdb/migration",
        // 새 스키마라 baseline 이 필요 없다 — V1 부터 정상 적용된다.
        enabled = enabled,
        baselineVersion = null,
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("dealFlyway")
    fun dealEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("dealDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.deal")
            .persistenceUnit("deal")
            .build()

    @Bean
    fun dealTransactionManager(
        @Qualifier("dealEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
