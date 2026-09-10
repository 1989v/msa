package com.kgd.product.infrastructure.config

import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
import com.kgd.common.persistence.ScopedFlywayMigrator
import com.querydsl.jpa.impl.JPAQueryFactory
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
 * ADR-0093 — commerce 모듈러 모놀리스. product 도메인의 **전용** datasource(product_db) +
 * EMF + TM. 비-@Primary(=inventory 가 primary).
 *
 * **빈 이름을 전부 `product*` 로 스코프한 것이 이 폴드의 핵심이다.** 독립 앱일 때는
 * `masterDataSource`·`dataSource`·`jpaQueryFactory` 같은 총칭 이름을 썼는데, 그 이름들이
 * inventory 에도 그대로 있어 한 JVM 에 올리면 넷이 정면으로 부딪친다. Spring 은 기본적으로
 * 빈 오버라이드를 막으므로 컨텍스트가 아예 안 뜬다.
 *
 * Flyway 도 `classpath:db/migration` 에서 `classpath:productdb/migration` 으로 옮겼다 —
 * 호스트 기본 Flyway 가 그 경로를 재귀 스캔해 **다른 도메인의 마이그레이션까지 product_db 에
 * 적용**하기 때문이다. 폴드된 도메인 전부가 쓰는 규약이다. 파일 내용은 그대로라
 * 기존 `flyway_schema_history` 의 버전·체크섬과 어긋나지 않는다.
 *
 * **클래스 이름도 도메인으로 스코프한다.** inventory 에도  가 있어
 * 컴포넌트 스캔이 같은 빈 이름()을 두 번 만들고
 * ConflictingBeanDefinitionException 으로 컨텍스트가 안 뜬다 — 빈 이름만 바꿔서는 부족하다.
 *
 * 재분리 시 이 설정이 그대로 standalone product:app 으로 따라간다(@Primary 만 부여).
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.product"],
    entityManagerFactoryRef = "productEntityManagerFactory",
    transactionManagerRef = "productTransactionManager",
)
class ProductDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.product.master")
    fun productMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.product.replica")
    fun productReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun productRoutingDataSource(
        @Qualifier("productMasterDataSource") master: DataSource,
        @Qualifier("productReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(
            mapOf(
                DataSourceType.MASTER to master,
                DataSourceType.REPLICA to replica,
            ),
        )
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun productDataSource(
        @Qualifier("productRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    /** product 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun productFlyway(
        @Qualifier("productMasterDataSource") dataSource: DataSource,
        @Value("\${product.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:productdb/migration",
        enabled = enabled,
        // 운영 product_db 에는 Flyway 이력이 없다 — Boot 4 자동설정 모듈 분리를 놓쳐
        // 마이그레이션이 한 번도 실행된 적이 없고, 스키마는 ddl-auto 가 만든 것이다.
        // 실제 스키마가 전 마이그레이션 적용 상태와 같음을 대조 확인해 최신 버전을
        // 기준선으로 잡는다(독립 앱 시절 yml 의 baseline-version 과 같은 값).
        baselineVersion = "20260703.001",
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("productFlyway")
    fun productEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("productDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            // common 의 멱등 원장 엔티티도 이 EMF 가 관리해야 한다 — 폴드 도메인 공통 규약.
            // 빼면 ProcessedEventEntity 가 "Not a managed type" 으로 컨텍스트가 깨진다.
            .packages("com.kgd.product", "com.kgd.common.messaging.idempotency")
            .persistenceUnit("product")
            .build()

    @Bean
    fun productTransactionManager(
        @Qualifier("productEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)

    /**
     * Querydsl — product EMF 에 묶는다.
     *
     * 총칭 `jpaQueryFactory` 로 두면 호스트의 기본 EMF(inventory)에 바인딩돼, 컴파일은 되는데
     * **product 쿼리가 inventory_db 로 나간다.** code-dictionary 폴드가 같은 이유로
     * `gameJpaQueryFactory` 를 쓴다.
     */
    @Bean
    fun productJpaQueryFactory(
        @Qualifier("productEntityManagerFactory") emf: EntityManagerFactory,
    ): JPAQueryFactory = JPAQueryFactory(emf.createEntityManager())
}
