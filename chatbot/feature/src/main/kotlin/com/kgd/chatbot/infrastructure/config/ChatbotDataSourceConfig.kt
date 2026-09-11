package com.kgd.chatbot.infrastructure.config

import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties
import org.springframework.boot.jpa.EntityManagerFactoryBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
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

    @Bean
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
