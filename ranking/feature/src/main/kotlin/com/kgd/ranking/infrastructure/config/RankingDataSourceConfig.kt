package com.kgd.ranking.infrastructure.config

import com.kgd.common.persistence.ScopedFlywayMigrator
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.DependsOn
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * ADR-0093 ②b — ranking 도메인의 **전용** datasource(ranking_db) + EMF + TM. 비-@Primary.
 *
 * `spring.datasource.ranking.url` 이 있을 때만 켜진다. 전환 기간 동안 code-dictionary 와
 * content 가 **동시에** ranking 을 서빙해야 게이트웨이 전환 한 시점만 전환점이 되기 때문이다.
 * code-dictionary 에는 그 키가 없어 기존처럼 호스트 EMF 를 쓴다. ②b-C 에서 조건을 걷는다.
 *
 * **이 도메인의 `@Transactional("rankingTransactionManager")` 은 전부 `rankingTransactionManager` 를 한정자로 갖는다.**
 * 빠뜨리면 primary(content 에서는 place) TM 에 붙고 ranking EM 이 트랜잭션에 참여하지 않아
 * 쓰기가 조용히 사라진다 — deal 을 옮길 때 운영에서 click_count 가 그렇게 멈췄다.
 * 전환 기간에는 code-dictionary 도 그 이름을 알아야 해서, 거기서는 호스트 TM 을 같은
 * 이름으로 한 번 더 노출한다(CodeDictionaryJpaConfig, ②b-C 에서 제거).
 */
@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = ["spring.datasource.ranking.url"])
@EnableJpaRepositories(
    basePackages = ["com.kgd.ranking"],
    entityManagerFactoryRef = "rankingEntityManagerFactory",
    transactionManagerRef = "rankingTransactionManager",
)
class RankingDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.ranking")
    fun rankingDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    fun rankingDataSource(
        @Qualifier("rankingDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /** ranking 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun rankingFlyway(
        @Qualifier("rankingDataSource") dataSource: DataSource,
        @Value("\${ranking.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:rankingdb/migration",
        // 새 스키마라 baseline 이 필요 없다 — V1 부터 정상 적용된다.
        enabled = enabled,
        baselineVersion = null,
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("rankingFlyway")
    fun rankingEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("rankingDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.ranking")
            .persistenceUnit("ranking")
            .build()

    @Bean
    fun rankingTransactionManager(
        @Qualifier("rankingEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
