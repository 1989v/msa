package com.kgd.inventory.application.reservation.port

/**
 * 명령에 낸 답의 원장 — (orderId, commandKey) 하나에 답 하나. 같은 명령이 다시 오면 여기 있는 답을 그대로 다시 낸다.
 * commandKey 는 RESERVE · CONFIRM · RELEASE · `RESTOCK:{restockKey|ALL}`.
 */
interface CommandAnswerRepositoryPort {
    fun find(orderId: Long, commandKey: String): CommandAnswer?
    fun save(answer: CommandAnswer)

    /** 사가가 예약한 주문 — 옛 흐름 전환 대상에서 뺀다 */
    fun existsReserveAnswer(orderId: Long): Boolean
}

data class CommandAnswer(val orderId: Long, val commandKey: String, val eventType: String, val payload: String)

/** 한 번만 도는 데이터 전환의 표식 */
interface MigrationMarkerPort {
    fun exists(name: String): Boolean
    fun mark(name: String)
}
