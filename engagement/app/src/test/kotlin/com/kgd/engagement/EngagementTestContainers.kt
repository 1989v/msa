package com.kgd.engagement

import org.springframework.test.context.DynamicPropertyRegistry
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import java.sql.DriverManager

/**
 * engagement 호스트 스펙들이 함께 쓰는 컨테이너 — JVM 안에서 한 번만 띄운다.
 *
 * MySQL 하나에 experiment_db 와 ads_db 를 **따로** 둔다. 한 스키마를 같이 쓰면 두 도메인의
 * Flyway 이력 테이블이 부딪친다. Redis 는 ads 전용 연결과 공용 연결이 같은 인스턴스를 본다(운영과 같다).
 */
object EngagementTestContainers {

    val dockerAvailable: Boolean =
        runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

    val mysql: MySQLContainer<*>? by lazy {
        if (!dockerAvailable) return@lazy null
        MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
            .withDatabaseName("experiment_db")
            .withUsername("root")
            .withPassword("test")
            .also { it.start() }
            .also { c ->
                DriverManager.getConnection(c.jdbcUrl, c.username, c.password).use { conn ->
                    conn.createStatement().use {
                        it.execute("CREATE DATABASE IF NOT EXISTS ads_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                    }
                }
            }
    }

    val redis: GenericContainer<*>? by lazy {
        if (!dockerAvailable) return@lazy null
        GenericContainer(DockerImageName.parse("redis:7")).withExposedPorts(6379).also { it.start() }
    }

    fun register(registry: DynamicPropertyRegistry) {
        val db = mysql ?: return
        registry.add("spring.datasource.url") { db.jdbcUrl }
        registry.add("spring.datasource.username") { db.username }
        registry.add("spring.datasource.password") { db.password }
        registry.add("spring.datasource.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        registry.add("spring.datasource.ads.url") {
            db.jdbcUrl.replace("/experiment_db", "/ads_db") +
                (if ("?" in db.jdbcUrl) "&" else "?") + "characterEncoding=UTF-8&useUnicode=true"
        }
        registry.add("spring.datasource.ads.username") { db.username }
        registry.add("spring.datasource.ads.password") { db.password }
        val r = redis ?: return
        registry.add("spring.data.redis.host") { r.host }
        registry.add("spring.data.redis.port") { r.getMappedPort(6379) }
    }

    /** 테스트용 서명 키 — 최소 길이(32바이트)를 넘는다. */
    const val TEST_TOKEN_SECRET = "engagement-test-ads-token-secret-0123456789"
}
