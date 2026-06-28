package com.kgd.fulfillment.infrastructure.config

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
 * ADR-0058 — commerce 모듈러 모놀리스. fulfillment 도메인의 **전용** datasource(fulfillment_db) +
 * EMF + TM. 비-@Primary(=inventory 가 primary). EMF 는 fulfillment 엔티티 + common OutboxEntity 를
 * 관리하고, fulfillment 의 JPA repository 는 이 EMF/TM 에 바인딩된다.
 *
 * 전용 outbox/idempotency 빈은 [FulfillmentMessagingConfig] 가 이 TM/EMF 에 묶어 등록한다.
 * 재분리 시 이 설정이 그대로 standalone fulfillment:app 으로 따라간다(@Primary 만 부여).
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.fulfillment"],
    entityManagerFactoryRef = "fulfillmentEntityManagerFactory",
    transactionManagerRef = "fulfillmentTransactionManager",
)
class FulfillmentDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.fulfillment.master")
    fun fulfillmentMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.fulfillment.replica")
    fun fulfillmentReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun fulfillmentRoutingDataSource(
        @Qualifier("fulfillmentMasterDataSource") master: DataSource,
        @Qualifier("fulfillmentReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica,
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun fulfillmentDataSource(
        @Qualifier("fulfillmentRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    @Bean
    fun fulfillmentEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("fulfillmentDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            // fulfillment 엔티티 + common OutboxEntity(전용 outbox 가 fulfillment_db 에 기록)
            .packages("com.kgd.fulfillment", "com.kgd.common.messaging.outbox")
            .persistenceUnit("fulfillment")
            .build()

    @Bean
    fun fulfillmentTransactionManager(
        @Qualifier("fulfillmentEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
