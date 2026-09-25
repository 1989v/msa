package com.kgd.fulfillment.application.fulfillment.usecase

/**
 * 사가·클레임 명령 `fulfillment.command.{create,cancel}` 처리 (키 = orderId). 답은 `fulfillment.order.*` 아웃박스 행.
 * 효과는 orderId 로 한 번만 일어나고, 같은 명령이 다시 오면 지금 상태로 같은 답을 다시 낸다.
 */
interface ProcessFulfillmentCommandUseCase {
    fun create(command: Create): Answer
    fun cancel(command: Cancel): Answer

    /** 창고별로 이행 하나, 주문 라인마다 이행 라인 하나. 라인의 창고는 재고 예약 답(`inventory.reservation.reserved`)이 정한 것 */
    data class Create(val orderId: Long, val lines: List<CreateLine>)
    data class CreateLine(val orderItemId: Long, val productId: Long, val quantity: Int, val warehouseId: Long)

    /** [orderItemIds] 가 null 이면 주문의 모든 라인. 라인 취소는 라인 전체(수량 일부 취소 없음) */
    data class Cancel(val orderId: Long, val orderItemIds: Set<Long>?)

    data class Answer(val eventType: String)
}
