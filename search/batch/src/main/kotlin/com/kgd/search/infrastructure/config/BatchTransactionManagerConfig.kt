package com.kgd.search.infrastructure.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.support.JdbcTransactionManager
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * Spring Boot 4.0 의 DataSource / TransactionManager auto-config 가 본 모듈의 classpath
 * 조합(starter-batch 만 있고 starter-jdbc / starter-data-jpa 부재)에서 활성화되지 않아
 * 두 빈이 모두 미등록된다. `ProductApiReindexJobConfig` 가 PlatformTransactionManager 를
 * 생성자 주입으로 요구하므로 DataSource + TransactionManager 를 명시 등록한다.
 *
 * H2 in-memory 는 batch metadata 전용 (application.yml 의 spring.datasource).
 * `productDataSource` (replica 직접 접속 모드, reindex.source=db) 는 별도 빈으로 공존.
 */
@Configuration
class BatchTransactionManagerConfig {

    @Bean
    @ConditionalOnMissingBean(DataSource::class)
    fun dataSource(
        @Value("\${spring.datasource.url}") url: String,
        @Value("\${spring.datasource.username:}") username: String,
        @Value("\${spring.datasource.password:}") password: String,
        @Value("\${spring.datasource.driver-class-name:}") driverClassName: String,
    ): DataSource = HikariDataSource().apply {
        jdbcUrl = url
        if (username.isNotEmpty()) this.username = username
        if (password.isNotEmpty()) this.password = password
        if (driverClassName.isNotEmpty()) this.driverClassName = driverClassName
        poolName = "batch-meta-pool"
        maximumPoolSize = 5
    }

    @Bean
    @ConditionalOnMissingBean(PlatformTransactionManager::class)
    fun transactionManager(dataSource: DataSource): PlatformTransactionManager =
        JdbcTransactionManager(dataSource)
}
