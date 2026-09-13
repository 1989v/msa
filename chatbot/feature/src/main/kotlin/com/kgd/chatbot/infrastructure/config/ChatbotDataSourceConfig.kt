package com.kgd.chatbot.infrastructure.config

import jakarta.persistence.EntityManagerFactory
import com.kgd.common.persistence.ScopedFlywayMigrator
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
 * ADR-0093 — sideapp 모듈러 모놀리스. chatbot 도메인의 **전용** datasource(chatbot_db) + EMF + TM.
 * 비-@Primary(=quant 가 primary).
 *
 * 독립 앱일 때 chatbot 은 `@SpringBootApplication` 한 줄이 전부였고 datasource 는 전부 자동
 * 구성이었다. 같은 JVM 의 gifticon 이 `DataSource` 빈을 만드는 순간 그 자동 구성이 back-off 해
 * **chatbot 의 JPA 가 조용히 사라진다.** 그래서 명시로 내린다.
 *
 * Flyway 는 없다 — chatbot 스키마는 인프라 init Job 이 만들고 `ddl-auto: validate` 로 검증한다.
 *
 * 재분리 시 이 설정이 그대로 standalone chatbot:app 으로 따라간다(@Primary 만 부여).
 */
@Configuration
@EnableJpaRepositories(
    basePackages = ["com.kgd.chatbot"],
    entityManagerFactoryRef = "chatbotEntityManagerFactory",
    transactionManagerRef = "chatbotTransactionManager",
)
class ChatbotDataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.chatbot")
    fun chatbotDataSourceProperties(): DataSourceProperties = DataSourceProperties()

    @Bean
    fun chatbotDataSource(
        @Qualifier("chatbotDataSourceProperties") properties: DataSourceProperties,
    ): DataSource = properties.initializeDataSourceBuilder().build()

    /**
     * chatbot_db 는 Flyway 없이 Hibernate 가 만든 스키마다. V1 은 운영 DDL 을 그대로 옮긴 기준선이라
     * 이력 테이블이 없는 운영에서는 baseline 으로 표시만 되고, 빈 스키마에서만 실제로 돈다.
     * 이력 테이블이 생긴 뒤에는 baselineVersion 이 무시되므로 마이그레이션을 더해도 갱신할 필요가 없다.
     */
    @Bean
    fun chatbotFlyway(
        @Qualifier("chatbotDataSource") dataSource: DataSource,
        @Value("\${chatbot.flyway.enabled:true}") enabled: Boolean,
    ): ScopedFlywayMigrator = ScopedFlywayMigrator(
        dataSource = dataSource,
        location = "classpath:chatbotdb/migration",
        enabled = enabled,
        baselineVersion = "1",
    )

    // 마이그레이션이 EMF 생성(스키마 검증)보다 먼저 끝나야 한다.
    @Bean
    @DependsOn("chatbotFlyway")
    fun chatbotEntityManagerFactory(
        builder: EntityManagerFactoryBuilder,
        @Qualifier("chatbotDataSource") dataSource: DataSource,
    ): LocalContainerEntityManagerFactoryBean =
        builder.dataSource(dataSource)
            .packages("com.kgd.chatbot")
            .persistenceUnit("chatbot")
            .build()

    @Bean
    fun chatbotTransactionManager(
        @Qualifier("chatbotEntityManagerFactory") emf: EntityManagerFactory,
    ): PlatformTransactionManager = JpaTransactionManager(emf)
}
