package com.kgd.commerce.ops

import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.spec.Spec
import org.apache.kafka.clients.admin.AdminClient
import org.apache.kafka.clients.admin.AdminClientConfig
import org.apache.kafka.clients.admin.NewTopic
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.common.TopicPartition
import org.apache.kafka.common.errors.TopicExistsException
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.kafka.config.KafkaListenerEndpointRegistry
import org.springframework.test.context.DynamicPropertyRegistry
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.kafka.KafkaContainer
import org.testcontainers.utility.DockerImageName
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.TimeUnit
import kotlin.reflect.KClass

/** Docker 가 없으면 로컬에선 건너뛰지만 `CI=true` 면 그대로 실행해 **실패**한다 */
class OpsDockerOrCi : EnabledCondition {
    override fun enabled(kclass: KClass<out Spec>): Boolean =
        System.getenv("CI") == "true" || runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)
}

/**
 * 운영 큐 통합 spec 의 실제 MySQL(모든 도메인 스키마) + 실제 Kafka. **spec 마다 한 벌** — 컨텍스트가 도메인 열 개의
 * 커넥션 풀을 열어서, 캐시에 남은 다른 spec 의 컨텍스트와 한 MySQL 을 나눠 쓰면 연결 한도(1040)를 넘는다.
 */
class OpsIntegrationInfra {

    private val domains = listOf("warehouse", "fulfillment", "order", "product", "seller", "payment", "promotion", "settlement")

    val mysql: MySQLContainer<*> by lazy {
        MySQLContainer(DockerImageName.parse("mysql:8.0"))
            .withDatabaseName("inventory_db")
            .withUsername("root")
            .withPassword("test")
            .also { c ->
                c.start()
                c.createConnection("").use { conn ->
                    conn.createStatement().use { st -> (domains + "deal").forEach { st.execute("CREATE DATABASE IF NOT EXISTS ${it}_db") } }
                }
            }
    }

    val kafka: KafkaContainer by lazy {
        // 3.9 이미지는 이 Testcontainers 버전의 advertised.listeners(0.0.0.0) 와 맞지 않아 기동하지 않는다.
        KafkaContainer(DockerImageName.parse("apache/kafka:3.8.1")).also { it.start() }
    }

    fun register(registry: DynamicPropertyRegistry) {
        val inv = mysql.jdbcUrl
        registry.add("spring.kafka.bootstrap-servers") { kafka.bootstrapServers }
        fun ds(prefix: String, url: String) {
            registry.add("$prefix.jdbc-url") { url }
            registry.add("$prefix.username") { mysql.username }
            registry.add("$prefix.password") { mysql.password }
            registry.add("$prefix.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
        for (role in listOf("master", "replica")) {
            ds("spring.datasource.$role", inv)
            for (domain in domains) ds("spring.datasource.$domain.$role", inv.replace("/inventory_db", "/${domain}_db"))
        }
        registry.add("spring.datasource.deal.url") { inv.replace("/inventory_db", "/deal_db") }
        registry.add("spring.datasource.deal.username") { mysql.username }
        registry.add("spring.datasource.deal.password") { mysql.password }
        registry.add("spring.datasource.deal.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
    }

    fun createTopics(vararg topics: String) {
        AdminClient.create(mapOf(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers)).use { admin ->
            val existing = admin.listTopics().names().get()
            topics.filterNot { it in existing }.forEach { topic ->
                // 리스너가 구독하며 자동 생성할 수 있다 — 먼저 생겼으면 그대로 쓴다
                runCatching { admin.createTopics(listOf(NewTopic(topic, 1, 1.toShort()))).all().get(30, TimeUnit.SECONDS) }
                    .onFailure { if (it.cause !is TopicExistsException) throw it }
            }
        }
    }

    /** 토픽 전체를 처음부터 [until] 이 참이 될 때까지(최대 30초) 읽는다 */
    fun readAll(topic: String, until: (List<ConsumerRecord<String?, String?>>) -> Boolean): List<ConsumerRecord<String?, String?>> {
        val props = mapOf<String, Any>(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers,
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
        )
        KafkaConsumer<String?, String?>(props).use { consumer ->
            val partitions = consumer.partitionsFor(topic).map { TopicPartition(topic, it.partition()) }
            consumer.assign(partitions)
            consumer.seekToBeginning(partitions)
            val out = mutableListOf<ConsumerRecord<String?, String?>>()
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
            while (System.nanoTime() < deadline && !until(out)) out += consumer.poll(Duration.ofMillis(200))
            return out
        }
    }

    fun awaitTrue(timeout: Duration = Duration.ofSeconds(60), condition: () -> Boolean) {
        val deadline = System.nanoTime() + timeout.toNanos()
        while (System.nanoTime() < deadline) {
            if (condition()) return
            Thread.sleep(250)
        }
        error("조건이 ${timeout.seconds}초 안에 참이 되지 않았다")
    }

    /** [group] 의 컨테이너가 [topic] 의 파티션을 받을 때까지 — 컨텍스트가 뜬 뒤 만든 토픽은 메타데이터 갱신을 기다려야 한다 */
    fun awaitTopicAssigned(registry: KafkaListenerEndpointRegistry, group: String, topic: String) = awaitTrue {
        registry.listenerContainers.any { c -> c.groupId == group && c.assignedPartitions.orEmpty().any { it.topic() == topic } }
    }

    /** 파티션을 받은 리스너 컨테이너가 [groups] 전부를 덮을 때까지 */
    fun awaitAssigned(registry: KafkaListenerEndpointRegistry, groups: Set<String>) = awaitTrue {
        val assigned = registry.listenerContainers.filter { !it.assignedPartitions.isNullOrEmpty() }.mapNotNull { it.groupId }.toSet()
        assigned.containsAll(groups)
    }

    private val http = HttpClient.newHttpClient()

    fun post(port: Int, path: String, headers: Map<String, String>, body: String? = null): HttpResponse<String> =
        http.send(
            HttpRequest.newBuilder(URI.create("http://localhost:$port$path"))
                .apply { headers.forEach { (k, v) -> header(k, v) } }
                .header("Content-Type", "application/json")
                .POST(body?.let { HttpRequest.BodyPublishers.ofString(it) } ?: HttpRequest.BodyPublishers.noBody())
                .build(),
            HttpResponse.BodyHandlers.ofString(),
        )

    fun get(port: Int, path: String, headers: Map<String, String>): HttpResponse<String> =
        http.send(
            HttpRequest.newBuilder(URI.create("http://localhost:$port$path")).apply { headers.forEach { (k, v) -> header(k, v) } }.GET().build(),
            HttpResponse.BodyHandlers.ofString(),
        )

    companion object {
        val ADMIN = mapOf("X-User-Id" to "ops-admin-1", "X-User-Roles" to "ROLE_ADMIN")
    }
}
