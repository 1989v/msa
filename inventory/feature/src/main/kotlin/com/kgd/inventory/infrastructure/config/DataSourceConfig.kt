package com.kgd.inventory.infrastructure.config

import org.springframework.context.annotation.DependsOn
import org.springframework.beans.factory.annotation.Value
import com.kgd.common.persistence.ScopedFlywayMigrator
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.DataSourceBuilder
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
import javax.sql.DataSource

/**
 * ADR-0058 — commerce 모듈러 모놀리스(스키마 4개 유지).
 *
 * inventory 도메인의 datasource/EMF/TM 를 **명시적**으로 정의해
 * `com.kgd.inventory` 패키지로 스코프한다(@Primary). warehouse 등 다른 도메인은
 * 각자 [com.kgd.warehouse.infrastructure.config.WarehouseDataSourceConfig] 처럼
 * 별도 datasource/EMF/TM 로 분리되어 스키마 격리를 유지한다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.inventory"],
    entityManagerFactoryRef = "inventoryEntityManagerFactory",
    transactionManagerRef = "inventoryTransactionManager",
)
class DataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master")
    fun masterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.replica")
    fun replicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun routingDataSource(
        @Qualifier("masterDataSource") master: DataSource,
        @Qualifier("replicaDataSource") replica: DataSource
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    @Primary
    fun dataSource(@Qualifier("routingDataSource") routingDataSource: DataSource): DataSource =
        LazyConnectionDataSourceProxy(routingDataSource)

    // 폴드된 앱(ADR-0058)이라 Boot 의 Flyway 자동설정을 쓸 수 없다 — primary datasource 하나에
    // classpath:db/migration 전부를 적용해 도메인 간 버전이 충돌한다. 전용 location 으로 직접 돌린다.
    // baseline: 운영 스키마가 Hibernate 산물이라 이력이 없다. 정의와 실제가 일치함을 대조 확인했다.
    @Bean
    fun inventoryFlyway(
        @Qualifier("masterDataSource") dataSource: DataSource,
        @Value("\${inventory.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:inventorydb/migration",
        enabled = enabled,
        baselineVersion = "3",
    )

    @Bean
    @Primary
    @DependsOn("inventoryFlyway")
    fun inventoryEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("dataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        // common 의 outbox/processed_event 엔티티를 이 EMF 가 관리한다 — 두 테이블은 inventory_db 에 있다.
        // 상위 com.kgd.common 을 통째로 넣지 않는다(다른 도메인 전용 엔티티가 섞이면 prod validate 실패).
        builder.dataSource(dataSource)
            .packages("com.kgd.inventory", "com.kgd.common.messaging.outbox", "com.kgd.common.messaging.idempotency")
            .persistenceUnit("inventory")
            .build()

    @Bean
    @Primary
    fun inventoryTransactionManager(
        @Qualifier("inventoryEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
