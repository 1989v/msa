package com.kgd.quant.application.security

/**
 * Base32 — RFC 4648 (no padding) — TOTP otpauth URI 에서 secret 인코딩에 사용.
 *
 * Google Authenticator / Authy 호환 — A-Z + 2-7 알파벳 (대문자, 패딩 제거).
 */
internal object Base32 {

    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

    fun encode(input: ByteArray): String {
        if (input.isEmpty()) return ""
        val sb = StringBuilder()
        var buffer = 0
        var bits = 0
        for (b in input) {
            buffer = (buffer shl 8) or (b.toInt() and 0xff)
            bits += 8
            while (bits >= 5) {
                bits -= 5
                sb.append(ALPHABET[(buffer shr bits) and 0x1f])
            }
        }
        if (bits > 0) {
            sb.append(ALPHABET[(buffer shl (5 - bits)) and 0x1f])
        }
        return sb.toString()
    }
}
