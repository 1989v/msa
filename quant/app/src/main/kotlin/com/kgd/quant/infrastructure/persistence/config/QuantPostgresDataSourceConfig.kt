package com.kgd.quant.infrastructure.persistence.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.core.JdbcTemplate
import javax.sql.DataSource

/**
 * QuantPostgresDataSourceConfig — pgvector(`quant_pattern`) 전용 secondary DataSource.
 *
 * 메인 DataSource (MySQL) 와 분리. JpaConfig 영향 없음 — 본 DataSource 는 JdbcTemplate 만 노출.
 *
 * Activation: `quant.pgvector.enabled=true` (default false). k3s-lite overlay 에서 환경변수 주입.
 */
@Configuration
@ConditionalOnProperty(name = ["quant.pgvector.enabled"], havingValue = "true", matchIfMissing = false)
class QuantPostgresDataSourceConfig {

    @Bean(name = ["quantPostgresDataSource"])
    fun quantPostgresDataSource(
        @org.springframework.beans.factory.annotation.Value("\${quant.pgvector.url:jdbc:postgresql://quant-postgres:5432/quant}")
        url: String,
        @org.springframework.beans.factory.annotation.Value("\${quant.pgvector.username:quant}")
        username: String,
        @org.springframework.beans.factory.annotation.Value("\${quant.pgvector.password:quant}")
        password: String,
        @org.springframework.beans.factory.annotation.Value("\${quant.pgvector.pool-size:5}")
        poolSize: Int,
    ): DataSource = HikariDataSource().apply {
        jdbcUrl = url
        this.username = username
        this.password = password
        driverClassName = "org.postgresql.Driver"
        maximumPoolSize = poolSize
        poolName = "quant-postgres-pool"
        isAutoCommit = true
    }

    @Bean(name = ["quantPostgresJdbcTemplate"])
    fun quantPostgresJdbcTemplate(
        @org.springframework.beans.factory.annotation.Qualifier("quantPostgresDataSource")
        dataSource: DataSource,
    ): JdbcTemplate = JdbcTemplate(dataSource)
}
