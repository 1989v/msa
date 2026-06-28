package com.kgd.order.infrastructure.config

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

    @Bean
    fun orderEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("orderDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.order", "com.kgd.common.messaging.outbox")
            .persistenceUnit("order")
            .build()

    @Bean
    fun orderTransactionManager(
        @Qualifier("orderEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
