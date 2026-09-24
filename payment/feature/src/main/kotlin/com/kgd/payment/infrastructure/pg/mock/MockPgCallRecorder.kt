package com.kgd.payment.infrastructure.pg.mock

import java.util.concurrent.ConcurrentLinkedDeque

/**
 * 모의 PG 가 받은 호출 기록 — 테스트가 "orderNo 하나에 승인 호출 한 번"을 PG 쪽에서 센다.
 * 운영에서도 켜져 있으므로 최근 [CAPACITY] 건만 남긴다.
 */
class MockPgCallRecorder {
    enum class Op { AUTHORIZE, CONFIRM, CAPTURE, VOID, REFUND, INQUIRE }

    data class Call(val op: Op, val key: String)

    private val calls = ConcurrentLinkedDeque<Call>()

    fun record(op: Op, key: String) {
        calls.addLast(Call(op, key))
        while (calls.size > CAPACITY) calls.pollFirst()
    }

    fun count(op: Op, key: String): Int = calls.count { it.op == op && it.key == key }

    fun clear() = calls.clear()

    private companion object {
        const val CAPACITY = 10_000
    }
}
