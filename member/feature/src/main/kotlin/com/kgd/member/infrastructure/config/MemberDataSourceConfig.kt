package com.kgd.member.infrastructure.config

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

    @Bean
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
