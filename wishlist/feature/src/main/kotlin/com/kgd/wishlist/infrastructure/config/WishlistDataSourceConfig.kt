package com.kgd.wishlist.infrastructure.config

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

    // 폴드된 앱이라 Boot 의 Flyway 자동설정을 쓸 수 없다 (도메인별 V1__… 이 한 클래스패스에 공존).
    // baseline=1: 운영 스키마는 Hibernate 산물이라 이력이 없다 — V1 은 그 형태의 재현이고,
    // 실제 변경(다형 대상 전환, ADR-0074)은 V2 부터다.
    @Bean
    fun wishlistFlyway(
        @Qualifier("wishlistMasterDataSource") dataSource: DataSource,
        @Value("\${wishlist.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:wishlistdb/migration",
        enabled = enabled,
        baselineVersion = "1",
    )

    @Bean
    @DependsOn("wishlistFlyway")
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
