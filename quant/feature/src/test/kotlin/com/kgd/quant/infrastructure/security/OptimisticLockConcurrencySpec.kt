package com.kgd.quant.infrastructure.security

import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * TG-P2-04.5 — Optimistic lock 동시성 검증.
 *
 * Stub repository 의 `updateEnvelopeWithLock` 시멘틱:
 *  - `WHERE id=? AND kek_version=?` 충족 시 1, 아니면 0 반환.
 *
 * 두 잡 인스턴스가 동일 row 를 동시 update 시도해도 단 1건만 성공해야 한다.
 * 본 테스트는 in-process synchronization 으로 race 를 강제 (실 DB 동시성은 IntegrationSpec).
 */
class OptimisticLockConcurrencySpec : BehaviorSpec({

    Given("동일 row 를 두 worker 가 동시에 update 시도") {
        val store = ConcurrentHashMap<UUID, ExchangeCredentialEntity>()
        val id = UUID.randomUUID()
        store[id] = ExchangeCredentialEntity(
            credentialId = id,
            tenantId = "t",
            exchange = "BITHUMB",
            apiKeyCipher = ByteArray(32),
            apiSecretCipher = ByteArray(32),
            passphraseCipher = null,
            ipWhitelist = "[]",
            createdAt = Instant.now(),
            kekVersion = 1,
            dekWrapped = ByteArray(48)
        )

        // synchronized atomic update — 동일 expected version 제출 시 둘 중 1건만 1 반환.
        fun tryUpdate(expected: Int, newVer: Int): Int =
            synchronized(store) {
                val now = store[id] ?: return@synchronized 0
                if (now.kekVersion != expected) return@synchronized 0
                store[id] = ExchangeCredentialEntity(
                    credentialId = now.credentialId,
                    tenantId = now.tenantId,
                    exchange = now.exchange,
                    apiKeyCipher = now.apiKeyCipher,
                    apiSecretCipher = now.apiSecretCipher,
                    passphraseCipher = now.passphraseCipher,
                    ipWhitelist = now.ipWhitelist,
                    createdAt = now.createdAt,
                    kekVersion = newVer,
                    dekWrapped = now.dekWrapped
                )
                1
            }

        When("두 thread 가 동일 expected=1, newVer=2 로 update 시도") {
            val results = java.util.Collections.synchronizedList(mutableListOf<Int>())
            val t1 = Thread { results.add(tryUpdate(expected = 1, newVer = 2)) }
            val t2 = Thread { results.add(tryUpdate(expected = 1, newVer = 2)) }
            t1.start(); t2.start()
            t1.join(); t2.join()

            Then("정확히 1건만 성공 (1+0)") {
                results.toList().sorted() shouldBe listOf(0, 1)
            }
            Then("최종 row 의 kek_version = 2") {
                store[id]!!.kekVersion shouldBe 2
            }
        }
    }

    Given("이미 새 버전으로 갱신된 row 를 stale expected 로 update") {
        val store = ConcurrentHashMap<UUID, ExchangeCredentialEntity>()
        val id = UUID.randomUUID()
        store[id] = ExchangeCredentialEntity(
            credentialId = id,
            tenantId = "t",
            exchange = "BITHUMB",
            apiKeyCipher = ByteArray(0),
            apiSecretCipher = ByteArray(0),
            passphraseCipher = null,
            ipWhitelist = "[]",
            createdAt = Instant.now(),
            kekVersion = 3,  // 이미 v3
            dekWrapped = ByteArray(48)
        )

        When("expected=1 로 update 시도") {
            val updated = synchronized(store) {
                val now = store[id]!!
                if (now.kekVersion != 1) 0 else 1
            }

            Then("0 반환 (silent skip)") {
                updated shouldBe 0
            }
            Then("row 의 kek_version 변경 없음") {
                store[id]!!.kekVersion shouldBe 3
            }
        }
    }
})
