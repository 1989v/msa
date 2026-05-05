package com.kgd.quant.domain.twofa

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.experimental.and

/**
 * TotpVerifier — RFC 6238 TOTP 자체 구현 (ADR-0037 Phase 3 / TG-P3-09).
 *
 * - HMAC-SHA1 (RFC 6238 default — Google Authenticator/Authy 호환)
 * - 30 초 step
 * - 6 자리 OTP
 * - ±1 step tolerance (시계 drift 허용)
 *
 * 의존성: javax.crypto (JDK 표준) — 외부 라이브러리 없음, 도메인 순수성 보존.
 */
object TotpVerifier {
    private const val STEP_SECONDS = 30L
    private const val DIGITS = 6
    private const val ALGORITHM = "HmacSHA1"
    private const val TOLERANCE_STEPS = 1

    /**
     * 주어진 secret + epochSeconds 로 OTP 생성.
     */
    fun generate(secret: ByteArray, epochSeconds: Long): String {
        val counter = epochSeconds / STEP_SECONDS
        return generateForCounter(secret, counter)
    }

    /**
     * 사용자가 입력한 OTP 검증. 현재 step 기준 ±1 step 까지 허용.
     */
    fun verify(secret: ByteArray, candidate: String, epochSeconds: Long): Boolean {
        if (candidate.length != DIGITS || !candidate.all { it.isDigit() }) return false
        val baseCounter = epochSeconds / STEP_SECONDS
        for (offset in -TOLERANCE_STEPS..TOLERANCE_STEPS) {
            val expected = generateForCounter(secret, baseCounter + offset)
            if (constantTimeEquals(expected, candidate)) return true
        }
        return false
    }

    private fun generateForCounter(secret: ByteArray, counter: Long): String {
        val msg = ByteArray(8)
        var c = counter
        for (i in 7 downTo 0) {
            msg[i] = (c and 0xff).toByte()
            c = c shr 8
        }
        val mac = Mac.getInstance(ALGORITHM).apply {
            init(SecretKeySpec(secret, "RAW"))
        }
        val hash = mac.doFinal(msg)
        // Dynamic Truncation — RFC 4226 §5.3
        val offset = (hash[hash.size - 1] and 0x0f).toInt()
        val binary = ((hash[offset].toInt() and 0x7f) shl 24) or
            ((hash[offset + 1].toInt() and 0xff) shl 16) or
            ((hash[offset + 2].toInt() and 0xff) shl 8) or
            (hash[offset + 3].toInt() and 0xff)
        val otp = binary % POW10[DIGITS]
        return otp.toString().padStart(DIGITS, '0')
    }

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) {
            diff = diff or (a[i].code xor b[i].code)
        }
        return diff == 0
    }

    private val POW10 = intArrayOf(1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000)
}
