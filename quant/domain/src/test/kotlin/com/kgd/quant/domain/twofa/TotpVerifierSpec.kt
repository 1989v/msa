package com.kgd.quant.domain.twofa

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * TotpVerifierSpec — RFC 6238 Appendix B test vectors 검증 (TG-P3-09).
 *
 * 검증 데이터: RFC 6238 SHA-1 secret "12345678901234567890" (ASCII).
 *
 * | epochSeconds | T (counter) | TOTP   |
 * |--------------|-------------|--------|
 * | 59           | 1           | 287082 |
 * | 1111111109   | 0x23523EC   | 081804 |
 * | 1234567890   | 0x273EF07   | 005924 |
 *
 * (RFC 6238 Appendix B 의 8자리 OTP 중 하위 6자리만 사용)
 */
class TotpVerifierSpec : BehaviorSpec({
    val secret = "12345678901234567890".toByteArray(Charsets.US_ASCII)

    given("RFC 6238 SHA-1 test vectors (6 digits)") {
        listOf(
            59L to "287082",
            1111111109L to "081804",
            1234567890L to "005924",
        ).forEach { (epoch, expected) ->
            `when`("epochSeconds=$epoch") {
                then("TOTP=$expected") {
                    TotpVerifier.generate(secret, epoch) shouldBe expected
                }
                then("verify 통과") {
                    TotpVerifier.verify(secret, expected, epoch) shouldBe true
                }
                then("±1 step (30s) 안에서 verify 통과") {
                    TotpVerifier.verify(secret, expected, epoch + 29) shouldBe true
                    TotpVerifier.verify(secret, expected, epoch - 29) shouldBe true
                }
                then("±2 step (60s) 밖에서 verify 실패") {
                    TotpVerifier.verify(secret, expected, epoch + 90) shouldBe false
                }
            }
        }
    }

    given("입력 검증") {
        `when`("길이가 6 이 아닌 candidate") {
            then("verify 실패") {
                TotpVerifier.verify(secret, "12345", 59L) shouldBe false
                TotpVerifier.verify(secret, "1234567", 59L) shouldBe false
            }
        }
        `when`("숫자 외 문자 candidate") {
            then("verify 실패") {
                TotpVerifier.verify(secret, "abc123", 59L) shouldBe false
                TotpVerifier.verify(secret, "12345a", 59L) shouldBe false
            }
        }
    }
})
