package com.kgd.common.shortlink

/**
 * 공개 콘텐츠(관광지·게임·글)의 단축 코드. 숫자 id 에서 결정되므로 매핑 테이블이 없다.
 *
 * id(0 ~ 2^40−1)에 40비트 위의 고정 순열을 적용한 뒤 base62 로 쓴다. 6자를 하한으로 0 을 채우고,
 * 2^40 이 62^6 보다 커서 큰 값은 7자가 된다.
 *
 * 순열은 연속한 id 가 연속한 코드로 보이지 않게 하려는 것이고 비밀이 아니다. 공개 여부는 해석하는
 * 도메인이 판정한다.
 *
 * **상수(SEED·M1·M2·SHIFT·ALPHABET)를 바꾸지 않는다.** 바꾸면 이미 퍼진 단축 주소가 전부 다른 대상을
 * 가리키거나 해석에 실패한다. `ShortCodeTest` 의 고정 벡터가 이를 지킨다.
 */
object ShortCode {
    private const val BITS = 40
    private const val MASK = (1L shl BITS) - 1
    const val MAX_ID: Long = MASK

    private const val MIN_LENGTH = 6
    private const val MAX_LENGTH = 7
    private const val ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

    // 순열: xor SEED → xorshift → ×M1 → xorshift → ×M2 → xorshift (모두 40비트 안에서 가역).
    // 시프트가 폭의 절반이라 xorshift 는 자기 자신이 역이고, 홀수 곱은 2^40 에서 역원이 있다.
    private const val SEED = 0x5A3C96E1F0L
    private const val M1 = 0xC2B2AE3D27L
    private const val M2 = 0x165667B19FL
    private const val SHIFT = 20

    private val M1_INV = inverseOdd(M1)
    private val M2_INV = inverseOdd(M2)

    fun encode(id: Long): String {
        require(id in 0..MAX_ID) { "단축 코드 id 범위(0..$MAX_ID) 밖: $id" }
        return toBase62(permute(id))
    }

    /** 해석할 수 없는 코드는 예외 없이 null 이다 — 길이·글자·범위·비정규 표기. */
    fun decode(code: String): Long? {
        if (code.length !in MIN_LENGTH..MAX_LENGTH) return null
        var value = 0L
        for (c in code) {
            val digit = ALPHABET.indexOf(c)
            if (digit < 0) return null
            value = value * ALPHABET.length + digit
        }
        if (value > MAX_ID) return null
        val id = unpermute(value)
        return id.takeIf { encode(it) == code }
    }

    private fun permute(id: Long): Long {
        var x = id xor SEED
        x = x xor (x ushr SHIFT)
        x = (x * M1) and MASK
        x = x xor (x ushr SHIFT)
        x = (x * M2) and MASK
        return x xor (x ushr SHIFT)
    }

    private fun unpermute(value: Long): Long {
        var x = value xor (value ushr SHIFT)
        x = (x * M2_INV) and MASK
        x = x xor (x ushr SHIFT)
        x = (x * M1_INV) and MASK
        x = x xor (x ushr SHIFT)
        return x xor SEED
    }

    private fun toBase62(value: Long): String {
        val sb = StringBuilder()
        var v = value
        while (v > 0) {
            sb.append(ALPHABET[(v % ALPHABET.length).toInt()])
            v /= ALPHABET.length
        }
        while (sb.length < MIN_LENGTH) sb.append(ALPHABET[0])
        return sb.reverse().toString()
    }

    /** 홀수의 2^40 곱셈 역원 — 뉴턴 반복은 한 번에 맞는 비트 수가 두 배가 된다(3 → 96). */
    private fun inverseOdd(a: Long): Long {
        var inv = a
        repeat(5) { inv *= 2 - a * inv }
        return inv and MASK
    }
}
