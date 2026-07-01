package com.kgd.wishlist.infrastructure.config

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
 * ADR-0058 round 2 — commerce 모듈러 모놀리스. wishlist 도메인의 **전용** datasource(wishlist_db) +
 * EMF + TM. 비-@Primary(=inventory 가 primary). wishlist 는 Kafka consumer 만(outbox 없음).
 * 재분리 시 이 설정이 그대로 standalone wishlist:app 으로 따라간다(@Primary 만 부여).
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.wishlist"],
    entityManagerFactoryRef = "wishlistEntityManagerFactory",
    transactionManagerRef = "wishlistTransactionManager",
)
class WishlistDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.wishlist.master")
    fun wishlistMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.wishlist.replica")
    fun wishlistReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun wishlistRoutingDataSource(
        @Qualifier("wishlistMasterDataSource") master: DataSource,
        @Qualifier("wishlistReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica,
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun wishlistDataSource(
        @Qualifier("wishlistRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    @Bean
    fun wishlistEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("wishlistDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.wishlist")
            .persistenceUnit("wishlist")
            .build()

    @Bean
    fun wishlistTransactionManager(
        @Qualifier("wishlistEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
