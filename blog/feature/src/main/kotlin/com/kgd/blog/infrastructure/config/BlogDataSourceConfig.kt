package com.kgd.blog.infrastructure.config

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
 * ADR-0093 ③ — blog 도메인의 **전용** datasource(blog_db) + EMF + TM. 비-@Primary.
 *
 * 전환 기간에는 `spring.datasource.blog.url` 조건부였다(두 호스트가 동시에 서빙해야
 * 게이트웨이 전환 한 시점만 전환점이 되기 때문). 전환이 끝나 조건을 걷었다.
 *
 * **이 도메인의 `@Transactional("blogTransactionManager")` 은 전부 `blogTransactionManager` 를 한정자로 갖는다.**
 * 빠뜨리면 primary(content 에서는 place) TM 에 붙고 blog EM 이 트랜잭션에 참여하지 않아
 * 쓰기가 조용히 사라진다. blog 는 @Modifying 이 6건(조회수·좋아요·평점 집계)이라 deal 보다
 * 노출이 크다 — deal 을 옮길 때 운영에서 click_count 가 그렇게 멈췄다.
 * (전환 기간에는 code-dictionary 가 호스트 TM 을 같은 이름으로 노출했고, 지금은 제거됐다.)
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.blog"],
    entityManagerFactoryRef = "blogEntityManagerFactory",
    transactionManagerRef = "blogTransactionManager",
)
class BlogDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.blog")
    fun blogDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    fun blogDataSource(
        @Qualifier("blogDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /** blog 전용 Flyway — 호스트 기본(`classpath:db/migration`) 재귀 스캔과 분리한다 */
    @Bean
    fun blogFlyway(
        @Qualifier("blogDataSource") dataSource: DataSource,
        @Value("\${blog.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:blogdb/migration",
        // 새 스키마라 baseline 이 필요 없다 — V1 부터 정상 적용된다.
        enabled = enabled,
        baselineVersion = null,
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("blogFlyway")
    fun blogEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("blogDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.blog")
            .persistenceUnit("blog")
            .build()

    @Bean
    fun blogTransactionManager(
        @Qualifier("blogEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
