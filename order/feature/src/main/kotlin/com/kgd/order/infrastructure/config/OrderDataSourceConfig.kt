package com.kgd.order.infrastructure.config

import org.springframework.context.annotation.DependsOn
import org.springframework.beans.factory.annotation.Value
import com.kgd.common.persistence.ScopedFlywayMigrator
import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.DataSourceBuilder
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0058 — commerce 모듈러 모놀리스. order 도메인의 **전용** datasource(order_db) + EMF + TM.
 * 비-@Primary. EMF 는 order 엔티티 + common OutboxEntity 를 관리하고, order JPA repository 는 이
 * EMF/TM 에 바인딩된다. 전용 outbox/idempotency 는 [OrderMessagingConfig] 가 이 TM 에 묶는다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.order"],
    entityManagerFactoryRef = "orderEntityManagerFactory",
    transactionManagerRef = "orderTransactionManager",
)
class OrderDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.order.master")
    fun orderMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.order.replica")
    fun orderReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun orderRoutingDataSource(
        @Qualifier("orderMasterDataSource") master: DataSource,
        @Qualifier("orderReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica,
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun orderDataSource(
        @Qualifier("orderRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    // 폴드된 앱(ADR-0058)이라 Boot 의 Flyway 자동설정을 쓸 수 없다 — primary datasource 하나에
    // classpath:db/migration 전부를 적용해 도메인 간 버전이 충돌한다. 전용 location 으로 직접 돌린다.
    // baseline: 운영 스키마가 Hibernate 산물이라 이력이 없다. 정의와 실제가 일치함을 대조 확인했다.
    @Bean
    fun orderFlyway(
        @Qualifier("orderMasterDataSource") dataSource: DataSource,
        @Value("\${order.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:orderdb/migration",
        enabled = enabled,
        baselineVersion = "20260502.002",
    )

    @Bean
    @DependsOn("orderFlyway")
    fun orderEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("orderDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.order", "com.kgd.common.messaging.outbox", "com.kgd.common.messaging.idempotency")
            .persistenceUnit("order")
            .build()

    @Bean
    fun orderTransactionManager(
        @Qualifier("orderEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
