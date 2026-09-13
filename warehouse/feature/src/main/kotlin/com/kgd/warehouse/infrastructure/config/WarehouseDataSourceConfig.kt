package com.kgd.warehouse.infrastructure.config

import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
import jakarta.persistence.EntityManagerFactory
import com.kgd.common.persistence.ScopedFlywayMigrator
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
 * ADR-0058 — commerce 모듈러 모놀리스. warehouse 도메인을 inventory(→commerce) app 에
 * 폴드하되, **별도 datasource(warehouse_db) + EMF + TM** 로 스키마를 격리한다.
 * `com.kgd.warehouse` 패키지의 JPA repository 는 이 EMF/TM 에 바인딩된다(비-primary).
 * 읽기-쓰기 라우팅은 inventory 와 동일한 [RoutingDataSource] 를 재사용.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.warehouse"],
    entityManagerFactoryRef = "warehouseEntityManagerFactory",
    transactionManagerRef = "warehouseTransactionManager",
)
class WarehouseDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.warehouse.master")
    fun warehouseMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.warehouse.replica")
    fun warehouseReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun warehouseRoutingDataSource(
        @Qualifier("warehouseMasterDataSource") master: DataSource,
        @Qualifier("warehouseReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica,
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun warehouseDataSource(
        @Qualifier("warehouseRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    /**
     * warehouse_db 는 Flyway 없이 Hibernate 가 만든 스키마다. V1 은 운영 DDL 을 그대로 옮긴 기준선이라
     * 이력 테이블이 없는 운영에서는 baseline 으로 표시만 되고, 빈 스키마에서만 실제로 돈다.
     * 이력 테이블이 생긴 뒤에는 baselineVersion 이 무시되므로 마이그레이션을 더해도 갱신할 필요가 없다.
     */
    @Bean
    fun warehouseFlyway(
        @Qualifier("warehouseMasterDataSource") dataSource: DataSource,
        @Value("\${warehouse.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:warehousedb/migration",
        enabled = enabled,
        baselineVersion = "1",
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("warehouseFlyway")
    fun warehouseEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("warehouseDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.warehouse")
            .persistenceUnit("warehouse")
            .build()

    @Bean
    fun warehouseTransactionManager(
        @Qualifier("warehouseEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
