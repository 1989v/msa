package com.kgd.quant.infrastructure.persistence.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.core.JdbcTemplate

/**
 * QuantPostgresDataSourceConfig — pgvector(`quant_pattern`) 전용 secondary DataSource.
 *
 * ## 격리 정책
 * 메인 JPA(MySQL) 의 EntityManagerFactory 에 영향을 주지 않기 위해 DataSource 를 Spring 빈으로
 * 등록하지 않는다 — 메서드 내부에서 직접 인스턴스화 후 [JdbcTemplate] 만 노출.
 * (DataSource 빈을 두 개 등록하면 Spring Boot auto-config 가 ambiguity 로 PostgreSQL 을 default 로
 *  잘못 선택해 indicator_content 등 MySQL 테이블 lookup 이 PostgreSQL 로 빗겨가는 결함이 있었음.)
 *
 * Activation: `quant.pgvector.enabled=true` (default false). k3s-lite overlay 에서 환경변수 주입.
 */
@Configuration
@ConditionalOnProperty(name = ["quant.pgvector.enabled"], havingValue = "true", matchIfMissing = false)
class QuantPostgresDataSourceConfig {

    @Bean(name = ["quantPostgresJdbcTemplate"])
    fun quantPostgresJdbcTemplate(
        @Value("\${quant.pgvector.url:jdbc:postgresql://quant-postgres:5432/quant}")
        url: String,
        @Value("\${quant.pgvector.username:quant}")
        username: String,
        @Value("\${quant.pgvector.password:quant}")
        password: String,
        @Value("\${quant.pgvector.pool-size:5}")
        poolSize: Int,
    ): JdbcTemplate {
        val ds = HikariDataSource().apply {
            jdbcUrl = url
            this.username = username
            this.password = password
            driverClassName = "org.postgresql.Driver"
            maximumPoolSize = poolSize
            poolName = "quant-postgres-pool"
            isAutoCommit = true
        }
        return JdbcTemplate(ds)
    }
}
