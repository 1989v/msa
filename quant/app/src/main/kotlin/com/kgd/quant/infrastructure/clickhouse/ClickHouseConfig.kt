package com.kgd.quant.infrastructure.clickhouse

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import jakarta.annotation.PreDestroy
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.core.JdbcTemplate
import javax.sql.DataSource

/**
 * TG-06.5: quant 전용 ClickHouse JdbcTemplate 등록.
 *
 * analytics DB 와 분리된 별도 DB `quant` 사용 (ADR-0024 §12).
 * application.yml 의 `quant.clickhouse.*` 프로퍼티와 바인딩.
 *
 * ## DataSource 빈 미등록 사유
 * Spring Boot `DataSourceAutoConfiguration` 의 `@ConditionalOnMissingBean(DataSource.class)`
 * 가드 때문에 ClickHouse DataSource 빈을 등록하면 MySQL primary DataSource auto-configure
 * 가 차단되어 Hibernate/JPA 가 ClickHouse 로 fallback 한다 (`indicator_content` 테이블
 * not found). 따라서 DataSource 는 빈으로 노출하지 않고 내부 필드로만 보유, 정리는
 * `@PreDestroy` 로 처리.
 */
@Configuration
@ConfigurationProperties(prefix = "quant.clickhouse")
@ConditionalOnProperty(name = ["quant.clickhouse.url"])
class ClickHouseConfig {
    /** JDBC URL. 예: jdbc:clickhouse://clickhouse:8123/quant */
    lateinit var url: String
    lateinit var username: String
    lateinit var password: String

    /** DB 이름은 quant 로 고정. 다른 DB 로 덮어쓰면 ADR-0024 §12 위반. */
    var database: String = "quant"

    var poolSize: Int = 8

    private var managedDataSource: HikariDataSource? = null

    @Bean("quantClickHouseJdbcTemplate")
    fun quantClickHouseJdbcTemplate(): JdbcTemplate {
        val ds: DataSource = HikariDataSource(HikariConfig().apply {
            jdbcUrl = url
            username = this@ClickHouseConfig.username
            password = this@ClickHouseConfig.password
            driverClassName = "com.clickhouse.jdbc.ClickHouseDriver"
            maximumPoolSize = poolSize
            poolName = "quant-clickhouse"
            isAutoCommit = true
        }).also { managedDataSource = it }
        return JdbcTemplate(ds)
    }

    @PreDestroy
    fun close() {
        managedDataSource?.close()
    }
}
