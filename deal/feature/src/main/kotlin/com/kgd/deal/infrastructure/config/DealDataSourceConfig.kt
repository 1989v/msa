package com.kgd.deal.infrastructure.config

import com.kgd.common.persistence.ScopedFlywayMigrator
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
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
 * ADR-0093 ② — deal 도메인의 **전용** datasource(deal_db) + EMF + TM. 비-@Primary.
 *
 * ## 왜 조건부인가
 *
 * 이 설정은 `spring.datasource.deal.url` 이 있을 때만 켜진다. 전환 기간 동안 **두 호스트가
 * 동시에 deal 을 서빙해야 하기 때문**이다 —
 *
 *   code-dictionary : 속성 없음 → 이 설정 꺼짐 → 호스트 EMF·스캔이 그대로 처리(기존 그대로)
 *   commerce        : 속성 있음 → 이 설정 켜짐 → deal_db 로 분리
 *
 * 게이트웨이가 라우트를 옮기는 한 시점이 유일한 전환점이 되고, 그 전후로 경로가 빈 곳을
 * 가리키는 창이 없다. game 을 code-dictionary → content 로 옮길 때 이 준비 없이 커밋 A 를
 * 올려 `/api/v1/games` 가 수 분간 404 였다 — 같은 실수를 반복하지 않는다.
 *
 * code-dictionary 에서 deal 이 완전히 빠지면(②-C) 이 조건은 지워도 된다. 남겨 두면
 * 속성 하나로 스키마가 갈리는 상태가 영구가 되므로 **그때 지운다**.
 */
@Configuration
@ConditionalOnProperty(name = ["spring.datasource.deal.url"])
@EnableJpaRepositories(
    basePackages = ["com.kgd.deal"],
    entityManagerFactoryRef = "dealEntityManagerFactory",
    transactionManagerRef = "dealTransactionManager",
)
class DealDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.deal")
    fun dealDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    fun dealDataSource(
        @Qualifier("dealDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /** deal 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun dealFlyway(
        @Qualifier("dealDataSource") dataSource: DataSource,
        @Value("\${deal.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:dealdb/migration",
        // 새 스키마라 baseline 이 필요 없다 — V1 부터 정상 적용된다.
        enabled = enabled,
        baselineVersion = null,
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("dealFlyway")
    fun dealEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("dealDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.deal")
            .persistenceUnit("deal")
            .build()

    @Bean
    fun dealTransactionManager(
        @Qualifier("dealEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
