package com.kgd.quant.infrastructure.audit

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

/**
 * TG-P2-05 — chain replay 무결성 검증 로직 단위 테스트.
 *
 * 통합 테스트(Testcontainers ClickHouse)는 [AuditChainVerifier] 의 SQL 경로를 검증하지만, 본 spec 은
 * "chain replay 알고리즘 자체"가 변조 1건을 정확히 검출하는지 in-memory 로 시뮬레이션한다.
 */
class AuditChainTamperDetectionSpec : BehaviorSpec({

    /**
     * 테스트용 row 표현. Verifier 가 ResultSet 으로 읽는 6필드와 같은 정보를 담는다.
     */
    data class Row(
        val tenantId: String,
        val payloadJson: String,
        val occurredAt: Instant,
        val actor: String,
        val prevHash: String,
        val currentHash: String,
    )

    fun buildValidChain(tenantId: String, count: Int, base: Instant): List<Row> {
        val rows = mutableListOf<Row>()
        var prev = AuditHashing.GENESIS_HASH
        for (i in 0 until count) {
            val payload = """{"i":$i}"""
            val occurredAt = base.plusSeconds(i.toLong())
            val actor = "user-$i"
            val current = AuditHashing.computeCurrentHash(prev, payload, occurredAt, actor)
            rows += Row(tenantId, payload, occurredAt, actor, prev, current)
            prev = current
        }
        return rows
    }

    /**
     * Verifier core algorithm 모사: prev_hash 가 직전 row 의 current_hash 와 같고,
     * 본 row 의 current_hash 가 입력 재계산과 같으면 valid 로 간주.
     */
    fun replay(rows: List<Row>): Int {
        var invalid = 0
        val expectedPrev = mutableMapOf<String, String>()
        for (row in rows.sortedWith(compareBy({ it.tenantId }, { it.occurredAt }))) {
            val expected = expectedPrev[row.tenantId] ?: AuditHashing.GENESIS_HASH
            val prevOk = row.prevHash == expected
            val recomputed = AuditHashing.computeCurrentHash(
                prevHash = row.prevHash,
                payloadJson = row.payloadJson,
                occurredAt = row.occurredAt,
                actor = row.actor,
            )
            val hashOk = row.currentHash == recomputed
            if (!prevOk || !hashOk) invalid++
            expectedPrev[row.tenantId] = row.currentHash
        }
        return invalid
    }

    given("정상 chain 5건") {
        `when`("verifier 가 replay 하면") {
            then("invalid 0 이어야 한다") {
                val rows = buildValidChain("tenant-A", 5, Instant.parse("2026-04-24T12:00:00Z"))
                replay(rows) shouldBe 0
            }
        }
    }

    given("중간 row 의 payload 가 변조된 chain") {
        `when`("verifier 가 replay 하면") {
            then("변조 row 1건이 invalid 로 검출되어야 한다") {
                val original = buildValidChain("tenant-A", 5, Instant.parse("2026-04-24T12:00:00Z"))
                // 인덱스 2번 row 의 payload 만 손댄다 (current_hash 는 그대로 — 즉 hash 재계산이 어긋남).
                val tampered = original.toMutableList().also {
                    it[2] = it[2].copy(payloadJson = """{"i":99-tampered}""")
                }
                replay(tampered) shouldBe 1
            }
        }
    }

    given("중간 row 의 current_hash 가 변조된 chain") {
        `when`("verifier 가 replay 하면") {
            then("변조 row + 그 다음 row 까지 chain break 로 invalid 가 검출되어야 한다") {
                val original = buildValidChain("tenant-A", 5, Instant.parse("2026-04-24T12:00:00Z"))
                val tampered = original.toMutableList().also {
                    it[2] = it[2].copy(currentHash = "f".repeat(64))
                }
                // row[2] 의 current_hash 자체 무결성 깨짐 + row[3] 의 prev_hash 가 expected 와 불일치.
                replay(tampered) shouldBe 2
            }
        }
    }

    given("genesis row 1건만") {
        `when`("verifier 가 replay 하면") {
            then("정상이면 invalid 0, prev_hash 가 GENESIS 가 아니면 1") {
                val occurredAt = Instant.parse("2026-04-24T12:00:00Z")
                val payload = """{"k":"v"}"""
                val actor = "user-1"
                val current = AuditHashing.computeCurrentHash(
                    AuditHashing.GENESIS_HASH, payload, occurredAt, actor,
                )
                val ok = listOf(Row("t", payload, occurredAt, actor, AuditHashing.GENESIS_HASH, current))
                replay(ok) shouldBe 0

                // prev 를 0이 아닌 임의 값으로 위조.
                val bogusPrev = "1".repeat(64)
                val mismatchedCurrent = AuditHashing.computeCurrentHash(bogusPrev, payload, occurredAt, actor)
                val tampered = listOf(Row("t", payload, occurredAt, actor, bogusPrev, mismatchedCurrent))
                replay(tampered) shouldBe 1
            }
        }
    }
})
