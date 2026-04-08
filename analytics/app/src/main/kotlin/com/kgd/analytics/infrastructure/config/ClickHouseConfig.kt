package com.kgd.analytics.infrastructure.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

@Configuration
class ClickHouseConfig(
    @Value("\${spring.datasource.clickhouse.url}") private val url: String,
    @Value("\${spring.datasource.clickhouse.username}") private val username: String,
    @Value("\${spring.datasource.clickhouse.password}") private val password: String,
    @Value("\${spring.datasource.clickhouse.driver-class-name}") private val driverClassName: String
) {
    @Bean
    fun clickHouseDataSource(): DataSource {
        val config = HikariConfig().apply {
            jdbcUrl = url
            this.username = this@ClickHouseConfig.username
            this.password = this@ClickHouseConfig.password
            this.driverClassName = this@ClickHouseConfig.driverClassName
            maximumPoolSize = 10
            minimumIdle = 2
            connectionTimeout = 30000
            idleTimeout = 600000
        }
        return HikariDataSource(config)
    }
}
