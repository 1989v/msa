package com.kgd.quant.infrastructure.audit

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldMatch
import java.security.MessageDigest
import java.time.Instant

/**
 * TG-P2-05 — prev_hash + payload + occurredAt + actor SHA-256 계산이
 * publisher / verifier 양쪽에서 동일하게 결정적으로 산출되는지 검증한다.
 */
class AuditChainHashSpec : BehaviorSpec({

    given("AuditHashing.computeCurrentHash") {

        `when`("같은 입력으로 두 번 호출하면") {
            then("동일한 hex 64자 결과가 나와야 한다 (결정적)") {
                val occurredAt = Instant.parse("2026-04-24T12:00:00Z")
                val a = AuditHashing.computeCurrentHash(
                    prevHash = AuditHashing.GENESIS_HASH,
                    payloadJson = """{"k":"v"}""",
                    occurredAt = occurredAt,
                    actor = "user-1",
                )
                val b = AuditHashing.computeCurrentHash(
                    prevHash = AuditHashing.GENESIS_HASH,
                    payloadJson = """{"k":"v"}""",
                    occurredAt = occurredAt,
                    actor = "user-1",
                )
                a shouldBe b
                a.length shouldBe 64
                a shouldMatch Regex("^[0-9a-f]{64}$")
            }
        }

        `when`("payload 만 1바이트 다르면") {
            then("결과가 달라야 한다 (avalanche)") {
                val occurredAt = Instant.parse("2026-04-24T12:00:00Z")
                val a = AuditHashing.computeCurrentHash(
                    prevHash = AuditHashing.GENESIS_HASH,
                    payloadJson = """{"k":"v"}""",
                    occurredAt = occurredAt,
                    actor = "user-1",
                )
                val b = AuditHashing.computeCurrentHash(
                    prevHash = AuditHashing.GENESIS_HASH,
                    payloadJson = """{"k":"V"}""",
                    occurredAt = occurredAt,
                    actor = "user-1",
                )
                a shouldNotBe b
            }
        }

        `when`("prev_hash 만 다르면") {
            then("결과가 달라야 한다 (chain effect)") {
                val occurredAt = Instant.parse("2026-04-24T12:00:00Z")
                val payload = """{"k":"v"}"""
                val a = AuditHashing.computeCurrentHash(
                    prevHash = AuditHashing.GENESIS_HASH,
                    payloadJson = payload,
                    occurredAt = occurredAt,
                    actor = "user-1",
                )
                val b = AuditHashing.computeCurrentHash(
                    prevHash = "f".repeat(64),
                    payloadJson = payload,
                    occurredAt = occurredAt,
                    actor = "user-1",
                )
                a shouldNotBe b
            }
        }

        `when`("입력 형식 (prev || payload || occurredAt || actor) 의 SHA-256") {
            then("표준 java MessageDigest 결과와 정확히 일치해야 한다") {
                val occurredAt = Instant.parse("2026-04-24T12:00:00Z")
                val payload = """{"strategyId":"s-1","action":"ACTIVATE"}"""
                val actor = "user-7"
                val prev = AuditHashing.GENESIS_HASH

                val expected = MessageDigest.getInstance("SHA-256")
                    .digest((prev + payload + occurredAt.toString() + actor).toByteArray(Charsets.UTF_8))
                    .joinToString("") { "%02x".format(it) }

                AuditHashing.computeCurrentHash(prev, payload, occurredAt, actor) shouldBe expected
            }
        }
    }

    given("AuditHashing.GENESIS_HASH") {
        `when`("genesis chain start") {
            then("길이는 64이고 모두 0이어야 한다") {
                AuditHashing.GENESIS_HASH.length shouldBe 64
                AuditHashing.GENESIS_HASH.all { it == '0' } shouldBe true
            }
        }
    }
})
