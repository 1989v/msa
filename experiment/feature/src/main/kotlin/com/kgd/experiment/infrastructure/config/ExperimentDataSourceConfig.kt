package com.kgd.experiment.infrastructure.config

import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0093 — engagement 모듈러 모놀리스. experiment 도메인의 **전용** datasource(experiment_db)
 * + EMF + TM.
 *
 * **자동 구성에 기대던 것을 명시로 내린 이유**가 이 폴드의 핵심이다. 같은 JVM 에 올라오는
 * recommendation 이 `clickHouseDataSource` 라는 `DataSource` 빈을 만드는데, Spring Boot 의
 * `DataSourceAutoConfiguration` 은 `@ConditionalOnMissingBean(DataSource)` 이라 **그 빈 하나 때문에
 * 통째로 back-off 한다.** 그러면 experiment 의 MySQL 연결과 JPA 가 조용히 사라진다 — 컴파일도
 * 단위 테스트도 통과한 채로. 폴드는 얹는 쪽이 아니라 **받는 쪽의 자동 구성을 무너뜨린다.**
 *
 * 그래서 여기서 직접 만들고 `@Primary` 를 붙인다. ClickHouse 쪽은 `@Qualifier` 로만 주입되므로
 * 둘이 섞이지 않는다.
 *
 * 재분리 시 이 설정이 그대로 standalone experiment:app 으로 따라간다.
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.experiment"],
    entityManagerFactoryRef = "experimentEntityManagerFactory",
    transactionManagerRef = "experimentTransactionManager",
)
class ExperimentDataSourceConfig {

    /**
     * `spring.datasource.*` 를 그대로 읽는다 — yml 키를 바꾸지 않아 재분리 시 설정이 그대로다.
     *
     * `@ConfigurationProperties` 를 DataSource 에 직접 걸지 않는 이유: Hikari 는 `jdbcUrl` 을
     * 요구하는데 표준 키는 `url` 이라 바인딩이 비고 `IllegalArgumentException` 이 난다.
     * `DataSourceProperties` 가 그 변환을 한다.
     */
    @Bean
    @Primary
    @ConfigurationProperties(prefix = "spring.datasource")
    fun experimentDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    @Primary
    fun experimentDataSource(
        @Qualifier("experimentDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    @Bean
    @Primary
    fun experimentEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("experimentDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.experiment")
            .persistenceUnit("experiment")
            .build()

    @Bean
    @Primary
    fun experimentTransactionManager(
        @Qualifier("experimentEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
