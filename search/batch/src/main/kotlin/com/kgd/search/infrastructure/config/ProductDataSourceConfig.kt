package com.kgd.search.infrastructure.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "db")
class ProductDataSourceConfig {

    @Value("\${product.datasource.url}")
    private lateinit var url: String

    @Value("\${product.datasource.username}")
    private lateinit var username: String

    @Value("\${product.datasource.password}")
    private lateinit var password: String

    @Bean("productDataSource")
    fun productDataSource(): DataSource = HikariDataSource().apply {
        jdbcUrl = url
        this.username = this@ProductDataSourceConfig.username
        this.password = this@ProductDataSourceConfig.password
        driverClassName = "com.mysql.cj.jdbc.Driver"
        maximumPoolSize = 5
        isReadOnly = true
        connectionTimeout = 30_000L
        poolName = "product-replica-pool"
    }
}
