package com.kgd.settlement.infrastructure.config

import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
import com.kgd.common.persistence.ScopedFlywayMigrator
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.DataSourceBuilder
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.DependsOn
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0099 — settlement 도메인의 **전용** datasource(settlement_db) + EMF + TM. 비-@Primary.
 *
 * **이 도메인의 `@Transactional` 은 전부 `settlementTransactionManager` 를 한정자로 갖는다.**
 * 빠뜨리면 호스트의 primary(inventory) TM 에 붙어 settlement 쓰기가 조용히 사라진다.
 *
 * 풀 크기는 `spring.datasource.settlement.{master,replica}.maximum-pool-size`(=3)로 준다 — 이 빈은
 * HikariDataSource 에 직접 바인딩되므로 `hikari.` 하위 키는 적용되지 않는다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.settlement"],
    entityManagerFactoryRef = "settlementEntityManagerFactory",
    transactionManagerRef = "settlementTransactionManager",
)
class SettlementDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.settlement.master")
    fun settlementMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.settlement.replica")
    fun settlementReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun settlementRoutingDataSource(
        @Qualifier("settlementMasterDataSource") master: DataSource,
        @Qualifier("settlementReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(DataSourceType.MASTER to master, DataSourceType.REPLICA to replica))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun settlementDataSource(
        @Qualifier("settlementRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    /** 새 스키마라 baseline 이 필요 없다 — V1 부터 적용된다. */
    @Bean
    fun settlementFlyway(
        @Qualifier("settlementMasterDataSource") dataSource: DataSource,
        @Value("\${settlement.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:settlementdb/migration",
        enabled = enabled,
        baselineVersion = null,
    )

    /**
     * 스키마는 Flyway 만 만든다. 호스트의 `ddl-auto`(운영 none · 로컬 update · 컨텍스트 테스트 create)를
     * 따르지 않고 이 EMF 만 `validate` 로 고정한다 — 처음부터 Flyway 로 태어난 스키마라 어긋나면
     * 기동 단계에서 드러나야 하고, 컨텍스트 테스트가 마이그레이션과 엔티티의 일치까지 확인하게 된다.
     */
    @Bean
    @DependsOn("settlementFlyway")
    fun settlementEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("settlementDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            // 아웃박스 패키지는 넣지 않는다 — settlement 는 발행하는 토픽이 없어 outbox_event 테이블이 없다
            .packages("com.kgd.settlement", "com.kgd.common.messaging.idempotency")
            .persistenceUnit("settlement")
            .properties(mapOf("hibernate.hbm2ddl.auto" to "validate"))
            .build()

    @Bean
    fun settlementTransactionManager(
        @Qualifier("settlementEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
