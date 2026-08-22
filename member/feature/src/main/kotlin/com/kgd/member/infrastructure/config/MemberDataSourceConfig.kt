package com.kgd.member.infrastructure.config

import com.kgd.common.persistence.DataSourceType
import com.kgd.common.persistence.ScopedFlywayMigrator
import com.kgd.common.persistence.ReadReplicaRoutingDataSource
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
 * ADR-0058 round 2 — commerce 모듈러 모놀리스. member 도메인의 **전용** datasource(member_db) +
 * EMF + TM. 비-@Primary(=inventory 가 primary). member 는 outbox/kafka 미사용.
 * 재분리 시 이 설정이 그대로 standalone member:app 으로 따라간다(@Primary 만 부여).
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.member"],
    entityManagerFactoryRef = "memberEntityManagerFactory",
    transactionManagerRef = "memberTransactionManager",
)
class MemberDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.member.master")
    fun memberMasterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.member.replica")
    fun memberReplicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun memberRoutingDataSource(
        @Qualifier("memberMasterDataSource") master: DataSource,
        @Qualifier("memberReplicaDataSource") replica: DataSource,
    ): DataSource = ReadReplicaRoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica,
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    fun memberDataSource(
        @Qualifier("memberRoutingDataSource") routingDataSource: DataSource,
    ): DataSource = LazyConnectionDataSourceProxy(routingDataSource)

    /**
     * member 전용 Flyway (ADR-0078).
     *
     * 호스트 기본 Flyway 의 classpath:db/migration 은 하위까지 재귀 스캔하므로 충돌을 피해
     * classpath:memberdb/migration 에 둔다 (game 과 같은 구조).
     *
     * **baseline 1** — member_db 는 Flyway 없이 Hibernate 가 만든 스키마다. 기존 `members`
     * 테이블을 V1 로 간주하고 V2 부터 적용한다. 이력 테이블이 생긴 뒤에는 이 값이 무시되므로
     * 마이그레이션을 더 추가해도 갱신할 필요가 없다.
     */
    @Bean
    fun memberFlyway(
        @Qualifier("memberMasterDataSource") dataSource: DataSource,
        @Value("\${member.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:memberdb/migration",
        enabled = enabled,
        baselineVersion = "1",
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다 — ddl-auto=validate 라
    // email 컬럼이 남아 있는 채로 검증이 돌면 기동 자체가 갈린다.
    @Bean
    @DependsOn("memberFlyway")
    fun memberEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("memberDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.member")
            .persistenceUnit("member")
            .build()

    @Bean
    fun memberTransactionManager(
        @Qualifier("memberEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
