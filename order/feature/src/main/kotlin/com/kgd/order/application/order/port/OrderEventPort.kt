package com.kgd.order.application.order.port

import com.kgd.order.domain.order.model.Order
import java.time.Instant

/** order 가 settlement 에 내는 이벤트 — 호출자의 order 트랜잭션 안에서 아웃박스 행으로 남긴다 */
interface OrderEventPort {
    /** `order.order.confirmed` — 매입 분개의 원천. 라인(판매자·안분·수수료)과 판매자별 배송비 라인을 싣는다 */
    fun publishConfirmed(order: Order, confirmedAt: Instant)
}
