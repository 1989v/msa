package com.kgd.codedictionary.infrastructure.config

import com.querydsl.jpa.impl.JPAQueryFactory
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.DataSourceBuilder
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionSynchronizationManager
import javax.sql.DataSource

enum class DataSourceType { MASTER, REPLICA }

class RoutingDataSource : org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}

@Configuration
class DataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master")
    fun masterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.replica")
    fun replicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    fun routingDataSource(
        @Qualifier("masterDataSource") master: DataSource,
        @Qualifier("replicaDataSource") replica: DataSource
    ): DataSource = RoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica
        ))
        setDefaultTargetDataSource(master)
        afterPropertiesSet()
    }

    @Bean
    @Primary
    fun dataSource(@Qualifier("routingDataSource") routingDataSource: DataSource): DataSource =
        LazyConnectionDataSourceProxy(routingDataSource)

    /**
     * ADR-0059 — game:feature 가 자체 `LocalContainerEntityManagerFactoryBean` 을 등록하면
     * Boot 의 EMF 자동 구성이 back-off 하므로(=`entityManagerFactory` 빈 소멸), code-dictionary
     * 도메인의 EMF/TM 도 명시 정의한다. 이름을 기본값 그대로 두어 기존 `@Transactional`·
     * Spring Data 기본 참조가 그대로 동작한다.
     *
     * **폴드된 도메인의 패키지는 여기에 더한다.** 이 EMF 가 명시 정의라 `@EntityScan` 은
     * 먹지 않는다 — 그 애너테이션은 Boot 가 자동 구성한 EMF 에만 반영되고, 위 back-off 때문에
     * 그 EMF 는 존재하지 않는다. 빠뜨리면 해당 도메인의 리포지토리가 "not a managed type" 으로
     * 컨텍스트 로드에서 죽는다 (ADR-0069 deal 폴드 때 실제로 겪었다).
     * game 은 예외 — 전용 datasource/EMF 를 따로 갖는다 (GameDataSourceConfig).
     */
    @Bean
    @Primary
    fun entityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("dataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.codedictionary", "com.kgd.deal")
            .persistenceUnit("code-dictionary")
            .build()

    @Bean
    @Primary
    fun transactionManager(
        @Qualifier("entityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)

    // game 도 자체 QueryFactory 를 두므로(@Qualifier("gameJpaQueryFactory")) 호스트 쪽을 기본으로 지정
    @Bean
    @Primary
    fun jpaQueryFactory(
        @Qualifier("entityManagerFactory") emf: EntityManagerFactory,
    ): JPAQueryFactory = JPAQueryFactory(SharedEntityManagerCreator.createSharedEntityManager(emf))
}
