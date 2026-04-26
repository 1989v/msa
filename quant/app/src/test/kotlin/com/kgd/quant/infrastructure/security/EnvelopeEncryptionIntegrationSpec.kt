package com.kgd.quant.infrastructure.security

import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import com.kgd.quant.infrastructure.persistence.entity.NotificationTargetEntity
import com.kgd.quant.infrastructure.persistence.repository.ExchangeCredentialJpaRepository
import com.kgd.quant.infrastructure.persistence.repository.NotificationTargetJpaRepository
import com.kgd.quant.infrastructure.security.kms.FakeKmsAdapter
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.Primary
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-04.5 / 04.7 — Testcontainers MySQL + Flyway V001 + V002 적용 통합 테스트.
 *
 * 검증:
 *  - V002 마이그레이션이 정상 적용됨 (kek_version + dek_wrapped 컬럼)
 *  - 100건 envelope 적재 → KEK 회전 → LazyReencryptionJob 동등 로직 1회 → 모두 새 KEK 로 갱신
 *  - 회전 후에도 read 경로가 정상 동작 (envelope decrypt round-trip)
 *
 * 본 spec 은 Docker 가 활성된 환경에서만 실행된다 (`*IntegrationSpec` 패턴, build.gradle.kts 의 test 필터).
 *
 * ## KMS 어댑터 분기
 *  - `quant.security.kms.provider` 미설정 → LocalFileKmsAdapter / OciVaultKmsAdapter 모두 비활성.
 *  - `@Primary FakeKmsAdapter` 만 컨텍스트에 등록되어 KeyManagementService 주입 충족.
 *
 * ## LazyReencryptionJob 비활성
 *  - `quant.security.lazy-reencryption.enabled=false` + `@Profile("!test")` 양쪽으로 비활성.
 *  - 본 spec 은 잡 로직을 직접 호출(updateExecutor 사용) 하여 결과를 검증한다.
 */
@SpringBootTest(
    classes = [EnvelopeEncryptionIntegrationSpec.IntegrationConfig::class],
    properties = [
        "spring.flyway.enabled=true",
        "quant.security.lazy-reencryption.enabled=false"
    ]
)
@Testcontainers
class EnvelopeEncryptionIntegrationSpec(
    @Autowired private val credentialRepo: ExchangeCredentialJpaRepository,
    @Autowired private val notificationRepo: NotificationTargetJpaRepository,
    @Autowired private val codec: EnvelopeCryptoCodec,
    @Autowired private val updateExecutor: EnvelopeUpdateExecutor,
    @Autowired private val fakeKms: FakeKmsAdapter
) : BehaviorSpec({

    extension(SpringExtension)

    Given("V002 마이그레이션 적용된 MySQL + 100건 envelope 적재") {
        runBlocking {
            credentialRepo.deleteAll()
            notificationRepo.deleteAll()
            repeat(100) { i ->
                val plain = "api-key-$i".toByteArray()
                val envelope = codec.encrypt(plain)
                val entity = ExchangeCredentialEntity(
                    credentialId = UUID.randomUUID(),
                    tenantId = "tenant-$i",
                    exchange = "BITHUMB",
                    apiKeyCipher = envelope.ciphertext,
                    apiSecretCipher = envelope.ciphertext,
                    passphraseCipher = null,
                    ipWhitelist = "[]",
                    createdAt = Instant.now(),
                    kekVersion = 1,
                    dekWrapped = envelope.wrappedDek.ciphertext
                )
                credentialRepo.save(entity)
            }
        }

        When("KEK 회전 (fake-v1 → fake-v2)") {
            fakeKms.addVersion("fake-v2")
            fakeKms.setActive("fake-v2")

            And("LazyReencryptionJob 동등 로직을 직접 시뮬") {
                runBlocking {
                    val stale = credentialRepo.findTop100ByKekVersionLessThanOrderByCreatedAtAsc(2)
                    for (entity in stale) {
                        val plain = codec.decrypt(
                            entity.apiKeyCipher,
                            WrappedDek(entity.dekWrapped!!, "fake-v${entity.kekVersion}")
                        )
                        val newEnvelope = codec.encrypt(plain)
                        updateExecutor.updateCredential(
                            credentialId = entity.credentialId,
                            expectedOldVersion = entity.kekVersion,
                            apiKeyCt = newEnvelope.ciphertext,
                            apiSecretCt = newEnvelope.ciphertext,
                            passphraseCt = null,
                            dekWrapped = newEnvelope.wrappedDek.ciphertext,
                            newVersion = 2
                        )
                    }
                }

                Then("모든 row kek_version = 2") {
                    credentialRepo.findAll().all { it.kekVersion == 2 } shouldBe true
                }
                Then("재암호화 후에도 envelope decrypt 가 정상 동작") {
                    val sample = credentialRepo.findAll().first()
                    val recovered = runBlocking {
                        codec.decrypt(
                            sample.apiKeyCipher,
                            WrappedDek(sample.dekWrapped!!, "fake-v2")
                        )
                    }
                    String(recovered).startsWith("api-key-") shouldBe true
                }
            }
        }
    }

    Given("notification_target 도 동일 패턴 검증") {
        runBlocking {
            notificationRepo.deleteAll()
            val plain = "telegram-bot-token-12345".toByteArray()
            val envelope = codec.encrypt(plain)
            notificationRepo.save(
                NotificationTargetEntity(
                    targetId = UUID.randomUUID(),
                    tenantId = "tenant-1",
                    channel = "TELEGRAM",
                    botTokenCipher = envelope.ciphertext,
                    chatId = "chat-1",
                    createdAt = Instant.now(),
                    kekVersion = 1,
                    dekWrapped = envelope.wrappedDek.ciphertext
                )
            )
        }

        When("envelope decrypt round-trip") {
            val sample = notificationRepo.findAll().first()
            val recovered = runBlocking {
                codec.decrypt(
                    sample.botTokenCipher,
                    WrappedDek(sample.dekWrapped!!, "fake-v${sample.kekVersion}")
                )
            }

            Then("원본 평문 복원") {
                String(recovered) shouldBe "telegram-bot-token-12345"
            }
        }
    }
}) {

    /**
     * Spring Boot test 컨텍스트 — 최소 빈만 등록.
     *
     * - JPA + Flyway: 자동 구성 (DataSource → Testcontainers MySQL)
     * - FakeKmsAdapter: KMS Port 주입 (운영 어댑터는 provider 프로퍼티 미설정으로 비활성)
     * - EnvelopeCryptoCodec / EnvelopeUpdateExecutor / KmsDekCache: 컴포넌트 스캔
     */
    @TestConfiguration
    @EnableAutoConfiguration
    @EnableJpaRepositories(basePackages = ["com.kgd.quant.infrastructure.persistence.repository"])
    @EntityScan(basePackages = ["com.kgd.quant.infrastructure.persistence.entity"])
    @ComponentScan(
        basePackageClasses = [
            EnvelopeCryptoCodec::class,
            EnvelopeUpdateExecutor::class,
            com.kgd.quant.infrastructure.security.kms.KmsDekCache::class,
            com.kgd.quant.infrastructure.metrics.QuantMetrics::class
        ]
    )
    class IntegrationConfig {
        @Bean
        @Primary
        fun fakeKms(): FakeKmsAdapter = FakeKmsAdapter(seed = 0xABCDEFL)
    }

    companion object {
        @JvmStatic
        val mysql: MySQLContainer<*> = MySQLContainer("mysql:8.0.36")
            .withDatabaseName("quant")
            .withUsername("seven")
            .withPassword("seven")
            .also { it.start() }

        @JvmStatic
        @DynamicPropertySource
        fun props(reg: DynamicPropertyRegistry) {
            reg.add("spring.datasource.url") { mysql.jdbcUrl }
            reg.add("spring.datasource.username") { mysql.username }
            reg.add("spring.datasource.password") { mysql.password }
            reg.add("spring.jpa.hibernate.ddl-auto") { "validate" }
            reg.add("spring.jpa.properties.hibernate.dialect") { "org.hibernate.dialect.MySQL8Dialect" }
            reg.add("spring.flyway.locations") { "classpath:db/migration" }
        }
    }
}
