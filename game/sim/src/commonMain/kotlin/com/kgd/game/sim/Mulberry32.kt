package com.kgd.game.sim

/**
 * 결정적 32-bit PRNG (mulberry32) — 함수형(불변 상태).
 *
 * Int 연산만 사용한다: 곱셈은 32-bit wrap(= JS `Math.imul`), `ushr` = JS `>>>`.
 * 따라서 JVM(Tier B 리플레이 검증)과 Kotlin/JS(브라우저 플레이)에서 **동일 비트** 결과를 낸다.
 * Double·초월함수·시스템 난수 미사용 — 이것이 리플레이 재현의 결정성 불변식이다.
 */
object Mulberry32 {

    /** (난수, 다음 상태) 반환. 상태를 받고 새 상태를 돌려줘 공유 가변성을 제거 → step() 을 순수하게 유지. */
    fun next(state: Int): Pair<Int, Int> {
        val s = state + 0x6D2B79F5
        var t = s
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        val result = t xor (t ushr 14)
        return result to s
    }

    /** [0, bound) 균등 정수 + 다음 상태. bound > 0. */
    fun nextInt(state: Int, bound: Int): Pair<Int, Int> {
        require(bound > 0) { "bound must be positive: $bound" }
        val (r, ns) = next(state)
        return ((r ushr 1) % bound) to ns
    }
}
