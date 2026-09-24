package com.kgd.inventory.application.reservation.usecase

/**
 * 사가·클레임 명령 `inventory.command.{reserve,confirm,release,restock}` 처리 (키 = orderId).
 *
 * 답은 `inventory.reservation.*` 아웃박스 행이다. 효과는 orderId(재입고는 restockKey)로 한 번만 일어나고,
 * 같은 명령이 다시 오면 **처음 낸 답을 그대로** 다시 낸다 — 사가가 기한 재발행한 명령도 같은 답을 받는다.
 * 업무상 실패(재고 부족·만료·이미 확정)는 예외가 아니라 `inventory.reservation.failed` 다.
 */
interface ProcessInventoryCommandUseCase {
    fun reserve(command: Reserve): Answer
    fun confirm(orderId: Long): Answer
    fun release(orderId: Long): Answer
    fun restock(command: Restock): Answer

    data class Reserve(val orderId: Long, val lines: List<Line>)

    /**
     * [lines] 가 null 이면 이 주문의 확정 수량 중 남은 것 전부. 라인을 지정하면 [restockKey] 가 필수다 —
     * 같은 라인의 부분 재입고 두 번과 재배달 한 번을 가르는 키(클레임 id 등).
     */
    data class Restock(val orderId: Long, val restockKey: String?, val lines: List<Line>?)

    data class Line(val productId: Long, val quantity: Int)

    /** 발행한(또는 다시 낸) 답 — 테스트와 로그용 */
    data class Answer(val eventType: String, val reason: String? = null)
}
