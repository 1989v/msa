package com.kgd.quant.domain.live

import com.kgd.quant.domain.common.TenantId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.math.BigDecimal
import java.time.Instant

/**
 * LiveDomainSpec — Phase 3 도메인 invariant 검증 (ADR-0037 H5).
 *
 * - LiveTradingMode.Enabled 의 twoFaTokenHash 길이
 * - RiskLimit 의 양수 / 단일주문 ≤ 일일 한도 invariant
 * - AuditEvent.append → verify chain 가역성
 * - AuditEvent verify 가 변조를 검출하는지
 */
class LiveDomainSpec : BehaviorSpec({
    val tenant = TenantId("tenant-test")
    val now = Instant.parse("2026-05-05T00:00:00Z")
    val sha256Hex = "a".repeat(64)
    val sha256HexB = "b".repeat(64)

    given("LiveTradingMode.Enabled") {
        `when`("twoFaTokenHash 길이가 64 가 아니면") {
            then("require 실패") {
                shouldThrow<IllegalArgumentException> {
                    LiveTradingMode.Enabled(tenant, now, "tooShort")
                }
            }
        }
        `when`("64 자 hex") {
            then("정상 생성") {
                val m = LiveTradingMode.Enabled(tenant, now, sha256Hex)
                m.shouldBeInstanceOf<LiveTradingMode.Enabled>()
            }
        }
    }

    given("RiskLimit") {
        `when`("singleOrderMaxKrw > dailyVolumeLimitKrw") {
            then("require 실패") {
                shouldThrow<IllegalArgumentException> {
                    RiskLimit(tenant, BigDecimal("1000"), BigDecimal("100"), BigDecimal("1000"), now, 1L)
                }
            }
        }
        `when`("default 사용") {
            then("100k loss / 1M volume / 100k single") {
                val r = RiskLimit.default(tenant, 1L, now)
                r.dailyLossLimitKrw shouldBe BigDecimal("100000")
                r.dailyVolumeLimitKrw shouldBe BigDecimal("1000000")
                r.singleOrderMaxKrw shouldBe BigDecimal("100000")
            }
        }
        `when`("breach 평가") {
            then("loss/volume/single 각각 작동") {
                val r = RiskLimit.default(tenant, 1L, now)
                r.lossBreached(BigDecimal("100000")) shouldBe true
                r.lossBreached(BigDecimal("99999")) shouldBe false
                r.volumeBreached(BigDecimal("1000001")) shouldBe true
                r.singleOrderExceeds(BigDecimal("100001")) shouldBe true
                r.singleOrderExceeds(BigDecimal("100000")) shouldBe false
            }
        }
    }

    given("AuditEvent chain") {
        `when`("3 개 이벤트 append") {
            val ev1 = AuditEvent.append(tenant, AuditEventType.LIVE_MODE_TOGGLE, "{\"v\":1}", now, null)
            val ev2 = AuditEvent.append(tenant, AuditEventType.RISK_LIMIT_CHANGE, "{\"v\":2}", now.plusSeconds(1), ev1.currentHash)
            val ev3 = AuditEvent.append(tenant, AuditEventType.ORDER_PLACED, "{\"v\":3}", now.plusSeconds(2), ev2.currentHash)
            then("verify Ok") {
                val r = AuditEvent.verify(listOf(ev1, ev2, ev3))
                r.shouldBeInstanceOf<AuditEvent.VerifyResult.Ok>()
                (r as AuditEvent.VerifyResult.Ok).count shouldBe 3
                r.tipHash shouldBe ev3.currentHash
            }
            then("payload 변조 시 HashMismatch") {
                val tampered = ev2.copy(payloadCanonical = "{\"v\":99}")
                val r = AuditEvent.verify(listOf(ev1, tampered, ev3))
                r.shouldBeInstanceOf<AuditEvent.VerifyResult.HashMismatch>()
            }
            then("prev_hash 변조 시 PrevHashMismatch") {
                val tampered = ev2.copy(prevHash = sha256HexB)
                val r = AuditEvent.verify(listOf(ev1, tampered, ev3))
                r.shouldBeInstanceOf<AuditEvent.VerifyResult.PrevHashMismatch>()
            }
        }
    }
})
