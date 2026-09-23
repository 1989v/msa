package com.kgd.ads.support

import org.springframework.test.context.DynamicPropertyRegistry
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

/** ads 통합 스펙이 함께 쓰는 MySQL(ads_db)·Redis — JVM 안에서 한 번만 띄운다. */
object AdsTestContainers {

    val dockerAvailable: Boolean =
        runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

    val mysql: MySQLContainer<*>? by lazy {
        if (!dockerAvailable) return@lazy null
        MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
            .withDatabaseName("ads_db")
            .withUsername("root")
            .withPassword("test")
            .also { it.start() }
    }

    val redis: GenericContainer<*>? by lazy {
        if (!dockerAvailable) return@lazy null
        GenericContainer(DockerImageName.parse("redis:7")).withExposedPorts(6379).also { it.start() }
    }

    fun register(registry: DynamicPropertyRegistry) {
        val db = mysql ?: return
        registry.add("spring.datasource.ads.url") {
            db.jdbcUrl + (if ("?" in db.jdbcUrl) "&" else "?") + "characterEncoding=UTF-8&useUnicode=true"
        }
        registry.add("spring.datasource.ads.username") { db.username }
        registry.add("spring.datasource.ads.password") { db.password }
        registry.add("spring.datasource.ads.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        val r = redis ?: return
        registry.add("spring.data.redis.host") { r.host }
        registry.add("spring.data.redis.port") { r.getMappedPort(6379) }
    }

    /** Redis 를 멈춘다(프로세스 정지 — 연결은 열린 채 응답만 없다). 타임아웃 경로를 보기 위한 것. */
    fun pauseRedis() {
        DockerClientFactory.instance().client().pauseContainerCmd(requireNotNull(redis).containerId).exec()
    }

    fun unpauseRedis() {
        DockerClientFactory.instance().client().unpauseContainerCmd(requireNotNull(redis).containerId).exec()
    }

    const val TEST_TOKEN_SECRET = "ads-feature-test-token-secret-0123456789"
}

@Suppress("unused")
fun adsDockerAvailable(): Boolean = AdsTestContainers.dockerAvailable
