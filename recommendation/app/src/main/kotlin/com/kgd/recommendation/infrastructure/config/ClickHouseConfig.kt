package com.kgd.recommendation.infrastructure.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

/**
 * analytics ClickHouse 연결.
 *
 * recommendation 서비스는 analytics DB 의 recommendation_events / recommendation_score_daily 만
 * 조회 (read-only). 추후 별도 user (recommendation_writer) 분리 시 yml 만 변경.
 */
@Configuration
class ClickHouseConfig(
    @Value("\${recommendation.clickhouse.url}") private val url: String,
    @Value("\${recommendation.clickhouse.username:default}") private val username: String,
    @Value("\${recommendation.clickhouse.password:}") private val password: String,
) {
    @Bean(name = ["clickHouseDataSource"], destroyMethod = "close")
    fun clickHouseDataSource(): DataSource {
        val config = HikariConfig().apply {
            jdbcUrl = url
            this.username = this@ClickHouseConfig.username
            this.password = this@ClickHouseConfig.password
            driverClassName = "com.clickhouse.jdbc.ClickHouseDriver"
            maximumPoolSize = 4
            minimumIdle = 1
            connectionTimeout = 5_000
            poolName = "recommendation-clickhouse-pool"
            isReadOnly = true
        }
        return HikariDataSource(config)
    }
}
