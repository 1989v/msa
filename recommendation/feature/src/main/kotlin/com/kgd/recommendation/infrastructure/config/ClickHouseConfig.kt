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
        // ADR-0044 Phase 2 — read + write 둘 다 필요 (item_similarity TRUNCATE/INSERT).
        // analytics DB 의 recommendation_* 테이블만 접근. 향후 별도 user (recommendation_writer)
        // 분리 가능 — DBA 정책 결정 시점에.
        val config = HikariConfig().apply {
            jdbcUrl = url
            this.username = this@ClickHouseConfig.username
            this.password = this@ClickHouseConfig.password
            driverClassName = "com.clickhouse.jdbc.ClickHouseDriver"
            maximumPoolSize = 4
            minimumIdle = 1
            connectionTimeout = 5_000
            poolName = "recommendation-clickhouse-pool"
            // 기동 때 연결을 열지 않는다 (ADR-0093). 기본값이면 HikariDataSource 생성자가
            // 그 자리에서 풀을 채우다 실패하고, 폴드 뒤에는 그 실패가 **같은 파드의
            // experiment 까지** 못 뜨게 한다. 추천은 ClickHouse 없이 성능이 깎일 뿐이지만
            // A/B 배정은 무관하게 살아 있어야 한다 — 장애 반경을 파드 경계에서 끊는다.
            initializationFailTimeout = -1
        }
        return HikariDataSource(config)
    }
}
