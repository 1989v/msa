package com.kgd.game.infrastructure.config

import com.kgd.common.persistence.ScopedFlywayMigrator
import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
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
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0059 — game 도메인의 **전용** datasource(game_db) + EMF + TM + Flyway.
 * 비-@Primary. 호스트(code-dictionary:app)의 기본 EMF/Flyway 와 완전 분리되며,
 * 재분리 시 이 설정과 yml 의 spring.datasource.game 블록만 새 app 으로 이동하면 된다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.game"],
    entityManagerFactoryRef = "gameEntityManagerFactory",
    transactionManagerRef = "gameTransactionManager",
)
class GameDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.game.master")
    fun gameMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.game.replica")
    fun gameReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun gameRoutingDataSource(
        @Qualifier("gameMasterDataSource") master: DataSource,
        @Qualifier("gameReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica,
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun gameDataSource(
        @Qualifier("gameRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    /**
     * game 전용 Flyway — 호스트 기본 Flyway 의 classpath:db/migration 은 하위 폴더까지 재귀
     * 스캔하므로, 충돌을 피해 game 마이그레이션은 classpath:gamedb/migration 에 둔다.
     * 토글도 `game.flyway.enabled` 로 분리해 호스트의 `spring.flyway.enabled` 와 독립시킨다.
     */
    @Bean
    fun gameFlyway(
        @Qualifier("gameMasterDataSource") dataSource: DataSource,
        @Value("\${game.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:gamedb/migration",
        enabled = enabled,
        // game_db 는 처음부터 Flyway 가 만들었다 — 기준선 없이 전부 적용한다.
        baselineVersion = null,
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다 — Boot 의 Flyway 자동 구성이
    // 걸어주는 의존을 직접 선언한다. 비활성일 때도 빈은 존재하므로 @DependsOn 이 항상 성립.
    @Bean
    @DependsOn("gameFlyway")
    fun gameEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("gameDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.game")
            .persistenceUnit("game")
            .build()

    @Bean
    fun gameTransactionManager(
        @Qualifier("gameEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)

    @Bean
    fun gameJpaQueryFactory(
        @Qualifier("gameEntityManagerFactory") emf: EntityManagerFactory,
    ): JPAQueryFactory = JPAQueryFactory(SharedEntityManagerCreator.createSharedEntityManager(emf))
}

