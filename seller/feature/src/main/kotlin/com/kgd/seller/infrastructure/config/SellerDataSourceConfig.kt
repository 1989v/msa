package com.kgd.seller.infrastructure.config

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
 * ADR-0099 — seller 도메인의 **전용** datasource(seller_db) + EMF + TM. 비-@Primary.
 *
 * **이 도메인의 `@Transactional` 은 전부 `sellerTransactionManager` 를 한정자로 갖는다.**
 * 빠뜨리면 호스트의 primary(inventory) TM 에 붙어 seller 쓰기가 조용히 사라진다.
 *
 * 풀 크기는 `spring.datasource.seller.{master,replica}.maximum-pool-size`(=3)로 준다 — 이 빈은
 * HikariDataSource 에 직접 바인딩되므로 `hikari.` 하위 키는 적용되지 않는다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.seller"],
    entityManagerFactoryRef = "sellerEntityManagerFactory",
    transactionManagerRef = "sellerTransactionManager",
)
class SellerDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.seller.master")
    fun sellerMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.seller.replica")
    fun sellerReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun sellerRoutingDataSource(
        @Qualifier("sellerMasterDataSource") master: DataSource,
        @Qualifier("sellerReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(DataSourceType.MASTER to master, DataSourceType.REPLICA to replica))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun sellerDataSource(
        @Qualifier("sellerRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    /** 새 스키마라 baseline 이 필요 없다 — V1 부터 적용된다. */
    @Bean
    fun sellerFlyway(
        @Qualifier("sellerMasterDataSource") dataSource: DataSource,
        @Value("\${seller.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:sellerdb/migration",
        enabled = enabled,
        baselineVersion = null,
    )

    /**
     * 스키마는 Flyway 만 만든다. 호스트의 `ddl-auto`(운영 none · 로컬 update · 컨텍스트 테스트 create)를
     * 따르지 않고 이 EMF 만 `validate` 로 고정한다 — 처음부터 Flyway 로 태어난 스키마라 어긋나면
     * 기동 단계에서 드러나야 하고, 컨텍스트 테스트가 마이그레이션과 엔티티의 일치까지 확인하게 된다.
     */
    @Bean
    @DependsOn("sellerFlyway")
    fun sellerEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("sellerDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.seller", "com.kgd.common.messaging.outbox", "com.kgd.common.messaging.idempotency")
            .persistenceUnit("seller")
            .properties(mapOf("hibernate.hbm2ddl.auto" to "validate"))
            .build()

    @Bean
    fun sellerTransactionManager(
        @Qualifier("sellerEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
