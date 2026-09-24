package com.kgd.order.application.saga.service

import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.usecase.CancelOrderUseCase
import com.kgd.order.application.order.usecase.OrderDetail
import com.kgd.order.application.saga.port.OrderOpsIssueRepositoryPort
import com.kgd.order.application.saga.port.OrderSagaRepositoryPort
import com.kgd.order.application.saga.port.SagaCommand
import com.kgd.order.application.saga.port.SagaCommandPort
import com.kgd.order.application.saga.usecase.HandleSagaEventUseCase
import com.kgd.order.application.saga.usecase.InventoryAnswer
import com.kgd.order.application.saga.usecase.InventoryAnswerType
import com.kgd.order.application.saga.usecase.PaymentOutcome
import com.kgd.order.application.saga.usecase.PaymentOutcomeType
import com.kgd.order.application.saga.usecase.ProcessSagaDeadlineUseCase
import com.kgd.order.application.saga.usecase.PromotionAnswer
import com.kgd.order.application.saga.usecase.PromotionAnswerType
import com.kgd.order.domain.order.exception.OrderCancelNotAllowedException
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderFailureReason
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.opsissue.model.OpsIssue
import com.kgd.order.domain.opsissue.model.OpsIssueType
import com.kgd.order.domain.saga.model.DeadlineDecision
import com.kgd.order.domain.saga.model.OrderSaga
import com.kgd.order.domain.saga.model.SagaStatus
import com.kgd.order.domain.saga.model.SagaStep
import com.kgd.order.domain.saga.model.SagaTiming
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Instant

/**
 * 주문 사가 오케스트레이터 (스펙 SR-4). 답·이벤트 하나를 order_db 한 트랜잭션에서 처리한다 —
 * 주문 상태(+ 이력) · 사가 행 · 다음 명령 아웃박스 행이 함께 커밋된다.
 *
 * - 정방향: 재고 예약 → 혜택 예약 → 결제 승인(피벗) → 재고 확정 → 혜택 확정 → 결제 매입 → CONFIRMED → 이행 생성.
 *   결제액 0원이면 결제 단계 둘을 건너뛴다.
 * - 피벗 전 실패는 이미 한 것을 역순으로 되돌린 뒤 FAILED. 피벗 뒤는 기한 재발행만 하고 한도를 넘으면 STUCK + 운영 이슈.
 * - 유일한 예외는 보류 만료다: 매입 전에 재고·혜택 예약이 사라지면 재시도로는 수렴하지 않아
 *   VOID(결과 미상이면 결제 쪽이 결론 시 실행) + 재입고·원복 후 FAILED. 매입 명령을 낸 뒤에는 이 경로가 닫힌다.
 * - 결제 결과 미상(UNKNOWN) 동안은 기다린다 — 주문을 먼저 취소하지 않는다.
 *
 * 같은 주문의 답이 다른 토픽으로 동시에 오면 `order_saga` 의 `@Version` 이 한쪽을 되돌리고, 그쪽은 다시 읽어 처리한다.
 */
@Service
class OrderSagaCoordinator(
    private val orders: OrderRepositoryPort,
    private val sagas: OrderSagaRepositoryPort,
    private val commands: SagaCommandPort,
    private val orderEvents: OrderEventPort,
    private val opsIssues: OrderOpsIssueRepositoryPort,
    @Qualifier("orderClock") private val clock: Clock,
    @Qualifier("orderSagaTiming") private val timing: SagaTiming,
    @Qualifier("orderTransactionManager") transactionManager: PlatformTransactionManager,
) : HandleSagaEventUseCase, ProcessSagaDeadlineUseCase, CancelOrderUseCase {

    private val log = KotlinLogging.logger {}
    private val tx = TransactionTemplate(transactionManager)

    /** 주문 접수 — 호출자(주문 접수)의 트랜잭션 안에서 사가 행을 만들고 첫 명령(재고 예약)을 낸다 */
    fun start(order: Order): OrderSaga {
        val orderId = requireNotNull(order.id) { "저장되지 않은 주문으로 사가를 시작할 수 없다" }
        val saga = OrderSaga.start(orderId, OrderSaga.orderNoOf(orderId), order.payableAmount > 0, clock.instant(), timing)
        sagas.create(saga)
        send(saga.step, order, saga)
        return saga
    }

    override fun onInventory(answer: InventoryAnswer) = withSaga(answer.orderId) { order, saga, now ->
        when (answer.type) {
            InventoryAnswerType.RESERVED -> if (saga.at(SagaStep.INVENTORY_RESERVE)) {
                saga.markInventoryReserved(answer.lines)
                advance(SagaStep.PROMOTION_RESERVE, order, saga, now)
            }
            InventoryAnswerType.FAILED -> when (answer.command) {
                COMMAND_RESERVE -> if (saga.at(SagaStep.INVENTORY_RESERVE)) {
                    compensate(order, saga, OrderFailureReason.INSUFFICIENT_STOCK, includeCurrent = false, now)
                }
                COMMAND_CONFIRM -> if (saga.at(SagaStep.INVENTORY_CONFIRM)) {
                    if (answer.reason == REASON_EXPIRED) holdExpired(order, saga, now) else stay(saga, answer)
                }
                COMMAND_RELEASE -> if (answer.reason == REASON_ALREADY_CONFIRMED) {
                    saga.markInventoryConfirmed(emptyList())
                    switchCompensation(SagaStep.INVENTORY_RELEASE, SagaStep.INVENTORY_RESTOCK, order, saga, now)
                }
                else -> stay(saga, answer)
            }
            InventoryAnswerType.CONFIRMED -> {
                saga.markInventoryConfirmed(answer.lines)
                if (saga.at(SagaStep.INVENTORY_CONFIRM)) {
                    advance(SagaStep.PROMOTION_CONFIRM, order, saga, now)
                } else {
                    switchCompensation(SagaStep.INVENTORY_RELEASE, SagaStep.INVENTORY_RESTOCK, order, saga, now)
                }
            }
            InventoryAnswerType.RELEASED -> if (saga.compensatingAt(SagaStep.INVENTORY_RELEASE)) nextCompensation(order, saga, now)
            InventoryAnswerType.RESTOCKED -> if (saga.compensatingAt(SagaStep.INVENTORY_RESTOCK)) nextCompensation(order, saga, now)
            InventoryAnswerType.EXPIRED -> if (!saga.inventoryConfirmed) holdExpired(order, saga, now)
        }
    }

    override fun onPromotion(answer: PromotionAnswer) = withSaga(answer.orderId) { order, saga, now ->
        when (answer.type) {
            PromotionAnswerType.RESERVED -> if (saga.at(SagaStep.PROMOTION_RESERVE)) {
                if (saga.paymentRequired) {
                    order.awaitPayment(now)
                    advance(SagaStep.PAYMENT_AUTHORIZE, order, saga, now)
                } else {
                    advance(SagaStep.INVENTORY_CONFIRM, order, saga, now)
                }
            }
            PromotionAnswerType.FAILED -> when (answer.command) {
                COMMAND_RESERVE -> if (saga.at(SagaStep.PROMOTION_RESERVE)) {
                    compensate(order, saga, OrderFailureReason.BENEFIT_UNAVAILABLE, includeCurrent = false, now)
                }
                COMMAND_CONFIRM -> if (saga.at(SagaStep.PROMOTION_CONFIRM)) {
                    if (answer.reason == REASON_EXPIRED) holdExpired(order, saga, now) else stay(saga, answer)
                }
                COMMAND_CANCEL -> if (answer.reason == REASON_ALREADY_CONFIRMED) {
                    saga.markPromotionConfirmed()
                    switchCompensation(SagaStep.PROMOTION_CANCEL, SagaStep.PROMOTION_RESTORE, order, saga, now)
                }
                else -> stay(saga, answer)
            }
            PromotionAnswerType.CONFIRMED -> {
                saga.markPromotionConfirmed()
                if (saga.at(SagaStep.PROMOTION_CONFIRM)) {
                    if (saga.paymentRequired) {
                        advance(SagaStep.PAYMENT_CAPTURE, order, saga, now)
                    } else {
                        confirmOrder(order, saga, now)
                    }
                } else {
                    switchCompensation(SagaStep.PROMOTION_CANCEL, SagaStep.PROMOTION_RESTORE, order, saga, now)
                }
            }
            PromotionAnswerType.CANCELLED -> if (saga.compensatingAt(SagaStep.PROMOTION_CANCEL)) nextCompensation(order, saga, now)
            PromotionAnswerType.RESTORED -> if (saga.compensatingAt(SagaStep.PROMOTION_RESTORE)) nextCompensation(order, saga, now)
            PromotionAnswerType.EXPIRED -> if (!saga.promotionConfirmed) holdExpired(order, saga, now)
        }
    }

    override fun onPayment(outcome: PaymentOutcome) = withSaga(outcome.orderId) { order, saga, now ->
        when (outcome.type) {
            PaymentOutcomeType.UNKNOWN ->
                if (saga.at(SagaStep.PAYMENT_AUTHORIZE) || saga.compensatingAt(SagaStep.PAYMENT_VOID)) saga.markPaymentUnknown()
            PaymentOutcomeType.AUTHORIZED -> when {
                saga.at(SagaStep.PAYMENT_AUTHORIZE) -> {
                    saga.markPaymentConcluded()
                    order.markPaid(now)
                    advance(SagaStep.INVENTORY_CONFIRM, order, saga, now)
                }
                // VOID 를 예약해 둔 채 승인 결론 — 결제 쪽이 미뤄 둔 VOID 를 실행하고 voided 로 답한다
                saga.compensatingAt(SagaStep.PAYMENT_VOID) -> {
                    saga.markPaymentConcluded()
                    if (order.status == OrderStatus.PAYMENT_PENDING) order.markPaid(now)
                }
            }
            PaymentOutcomeType.FAILED -> when {
                saga.at(SagaStep.PAYMENT_AUTHORIZE) -> {
                    saga.markPaymentConcluded()
                    compensate(order, saga, OrderFailureReason.PAYMENT_DECLINED, includeCurrent = false, now)
                }
                // 결론이 거절 — 되돌릴 결제가 없다
                saga.compensatingAt(SagaStep.PAYMENT_VOID) -> {
                    saga.markPaymentConcluded()
                    nextCompensation(order, saga, now)
                }
            }
            PaymentOutcomeType.VOIDED -> if (saga.compensatingAt(SagaStep.PAYMENT_VOID)) nextCompensation(order, saga, now)
            PaymentOutcomeType.CAPTURED -> if (saga.at(SagaStep.PAYMENT_CAPTURE)) confirmOrder(order, saga, now)
        }
    }

    override fun onFulfillmentCreated(orderId: Long) = withSaga(orderId) { order, saga, now ->
        if (saga.at(SagaStep.FULFILLMENT_CREATE)) {
            // 클레임 컨슈머가 같은 이행 생성 답을 먼저 받아 전체 취소까지 끝냈으면 주문은 이미 CANCELLED 다
            if (order.status == OrderStatus.CONFIRMED) order.startFulfilling(now)
            saga.complete()
        }
    }

    override fun dueOrderIds(limit: Int): List<Long> =
        tx.execute { sagas.findDueOrderIds(clock.instant(), limit) }.orEmpty()

    override fun onDeadline(orderId: Long) = withSaga(orderId) { order, saga, now ->
        when (saga.checkDeadline(now, timing)) {
            DeadlineDecision.NOT_DUE, DeadlineDecision.WAIT -> Unit
            DeadlineDecision.REISSUE, DeadlineDecision.REISSUE_WAITING -> {
                log.info { "사가 기한 — 같은 명령 재발행: orderId=$orderId, step=${saga.step}, attempts=${saga.attempts}" }
                send(saga.step, order, saga)
            }
            DeadlineDecision.PRE_PIVOT_EXPIRED -> compensate(order, saga, OrderFailureReason.TIMEOUT, includeCurrent = true, now)
            DeadlineDecision.STUCK -> {
                log.warn { "사가 재시도 한도 초과 → STUCK: orderId=$orderId, step=${saga.step}" }
                opsIssues.save(
                    OpsIssue.open(
                        OpsIssueType.SAGA_STUCK, orderId.toString(),
                        "사가 단계 ${saga.step} 가 재시도 ${timing.maxRetries}회로도 끝나지 않았다 (status=${saga.status})", now,
                    ),
                )
            }
        }
    }

    override fun cancel(userId: String, orderId: Long): OrderDetail {
        inTx {
            val order = orders.findById(orderId)?.takeIf { it.userId == userId } ?: throw OrderNotFoundException(orderId)
            when (order.status) {
                OrderStatus.PAYMENT_PENDING -> throw OrderCancelNotAllowedException("결제 결과 확인 중입니다 — 결론이 난 뒤 취소해 주세요")
                OrderStatus.CREATED -> Unit
                else -> throw OrderCancelNotAllowedException("결제 뒤 취소는 클레임으로 합니다: status=${order.status}")
            }
            val saga = sagas.findByOrderId(orderId)
            if (saga == null || saga.status != SagaStatus.RUNNING ||
                (saga.step != SagaStep.INVENTORY_RESERVE && saga.step != SagaStep.PROMOTION_RESERVE)
            ) {
                throw OrderCancelNotAllowedException("주문을 처리하고 있어 지금은 취소할 수 없습니다")
            }
            saga.requestCancel()
            compensate(order, saga, OrderFailureReason.BUYER_CANCELLED, includeCurrent = true, clock.instant())
            sagas.save(saga)
            orders.save(order)
        }
        return inTx { OrderDetail.of(requireNotNull(orders.findById(orderId)), sagas.findByOrderId(orderId)) }
    }

    // ---- 전이 ----

    private fun advance(next: SagaStep, order: Order, saga: OrderSaga, now: Instant) {
        saga.advance(next, now, timing)
        send(next, order, saga)
    }

    /** 재고·혜택 확정(+ 매입) 완료 → CONFIRMED · 정산 이벤트 · 이행 생성 명령 */
    private fun confirmOrder(order: Order, saga: OrderSaga, now: Instant) {
        order.confirm(now)
        orderEvents.publishConfirmed(order, now)
        advance(SagaStep.FULFILLMENT_CREATE, order, saga, now)
    }

    /**
     * 보류 만료 — 결제 결론 전(규칙 b)이면 VOID 를 예약하고, 승인 뒤·매입 전(규칙 a)이면 VOID 후 재입고·원복.
     * 매입 명령을 낸 뒤(PAYMENT_CAPTURE 이후)와 이미 보상 중이면 무시한다.
     */
    private fun holdExpired(order: Order, saga: OrderSaga, now: Instant) {
        if (saga.status != SagaStatus.RUNNING || saga.step !in HOLD_EXPIRY_STEPS) {
            log.info { "보류 만료 무시(경로 닫힘): orderId=${saga.orderId}, status=${saga.status}, step=${saga.step}" }
            return
        }
        saga.markHoldsExpired()
        compensate(order, saga, OrderFailureReason.HOLD_EXPIRED, includeCurrent = true, now)
    }

    private fun compensate(order: Order, saga: OrderSaga, reason: OrderFailureReason, includeCurrent: Boolean, now: Instant) {
        log.info { "사가 보상 시작: orderId=${saga.orderId}, step=${saga.step}, reason=$reason" }
        val first = saga.failAt(reason, includeCurrent, now, timing)
        if (first != null) send(first, order, saga) else finish(order, saga, now)
    }

    private fun nextCompensation(order: Order, saga: OrderSaga, now: Instant) {
        val next = saga.nextCompensation(now, timing)
        if (next != null) send(next, order, saga) else finish(order, saga, now)
    }

    private fun switchCompensation(from: SagaStep, to: SagaStep, order: Order, saga: OrderSaga, now: Instant) {
        if (saga.switchCompensation(from, to, now, timing)) send(to, order, saga)
    }

    /** 보상 완료 — 구매자 취소면 CANCELLED, 아니면 FAILED(사유) */
    private fun finish(order: Order, saga: OrderSaga, now: Instant) {
        if (saga.cancelRequested) {
            order.cancelBeforePayment(order.userId, now)
        } else {
            order.fail(requireNotNull(saga.failureReason), now)
        }
        log.info { "사가 종료 FAILED: orderId=${saga.orderId}, order=${order.status}, reason=${saga.failureReason}" }
    }

    private fun stay(saga: OrderSaga, answer: Any) {
        log.info { "사가 단계를 바꾸지 않는 답 — 기한 재발행에 맡긴다: orderId=${saga.orderId}, step=${saga.step}, answer=$answer" }
    }

    private fun send(step: SagaStep, order: Order, saga: OrderSaga) = commands.send(commandFor(step, order, saga))

    private fun commandFor(step: SagaStep, order: Order, saga: OrderSaga): SagaCommand {
        val orderId = saga.orderId
        return when (step) {
            SagaStep.INVENTORY_RESERVE -> SagaCommand.ReserveInventory(
                orderId,
                order.items.groupBy { it.productId }.map { (productId, lines) -> SagaCommand.StockLine(productId, lines.sumOf { it.quantity }) },
            )
            SagaStep.PROMOTION_RESERVE -> SagaCommand.ReservePromotion(
                orderId = orderId, memberId = order.userId, userCouponId = order.userCouponId,
                couponDiscount = order.couponDiscount, pointAmount = order.pointAmount,
                lines = order.items.map { SagaCommand.SellerAmount(it.sellerId, it.amount) },
            )
            SagaStep.PAYMENT_AUTHORIZE -> SagaCommand.AuthorizePayment(orderId, saga.orderNo, order.payableAmount)
            SagaStep.INVENTORY_CONFIRM -> SagaCommand.ConfirmInventory(orderId)
            SagaStep.PROMOTION_CONFIRM -> SagaCommand.ConfirmPromotion(orderId)
            SagaStep.PAYMENT_CAPTURE -> SagaCommand.CapturePayment(orderId, saga.orderNo)
            SagaStep.FULFILLMENT_CREATE -> SagaCommand.CreateFulfillment(orderId, saga.reservedLines)
            SagaStep.PAYMENT_VOID -> SagaCommand.VoidPayment(orderId, saga.orderNo)
            SagaStep.PROMOTION_CANCEL -> SagaCommand.CancelPromotion(orderId)
            SagaStep.PROMOTION_RESTORE -> SagaCommand.RestorePromotion(orderId, "saga-undo:$orderId", order.pointAmount, fullCancel = true)
            SagaStep.INVENTORY_RELEASE -> SagaCommand.ReleaseInventory(orderId)
            SagaStep.INVENTORY_RESTOCK -> SagaCommand.RestockInventory(orderId)
        }
    }

    // ---- 트랜잭션 ----

    /** 사가가 없는 주문(옛 흐름·다른 테스트가 낸 이벤트)은 건너뛴다 */
    private fun withSaga(orderId: Long, block: (Order, OrderSaga, Instant) -> Unit) = inTx {
        val saga = sagas.findByOrderId(orderId)
        if (saga == null) {
            log.info { "사가 없는 주문의 답 — 건너뛴다: orderId=$orderId" }
            return@inTx
        }
        val order = orders.findById(orderId) ?: error("사가는 있는데 주문이 없다: orderId=$orderId")
        block(order, saga, clock.instant())
        sagas.save(saga)
        orders.save(order)
    }

    /** 낙관락 충돌이면 처음부터 다시 읽어 처리한다 — 충돌한 쪽의 변경은 롤백돼 남지 않는다 */
    private fun <T> inTx(block: () -> T): T {
        var conflict: OptimisticLockingFailureException? = null
        repeat(MAX_CONFLICT_ATTEMPTS) { attempt ->
            try {
                @Suppress("UNCHECKED_CAST")
                return tx.execute { block() } as T
            } catch (e: OptimisticLockingFailureException) {
                conflict = e
                log.info { "사가 동시 갱신 충돌 — 다시 읽는다(${attempt + 1}/$MAX_CONFLICT_ATTEMPTS): ${e.message}" }
            }
        }
        throw requireNotNull(conflict)
    }

    private fun OrderSaga.at(step: SagaStep) = status == SagaStatus.RUNNING && this.step == step
    private fun OrderSaga.compensatingAt(step: SagaStep) = status == SagaStatus.COMPENSATING && this.step == step

    private companion object {
        const val MAX_CONFLICT_ATTEMPTS = 5
        const val COMMAND_RESERVE = "RESERVE"
        const val COMMAND_CONFIRM = "CONFIRM"
        const val COMMAND_RELEASE = "RELEASE"
        const val COMMAND_CANCEL = "CANCEL"
        const val REASON_EXPIRED = "EXPIRED"
        const val REASON_ALREADY_CONFIRMED = "ALREADY_CONFIRMED"

        /** 보류 만료가 주문을 되돌리는 단계 — 결제 결론 전(b) · 승인 뒤 확정 중(a) · 0원 확정 중. 매입 이후는 닫혀 있다 */
        val HOLD_EXPIRY_STEPS = setOf(
            SagaStep.PROMOTION_RESERVE, SagaStep.PAYMENT_AUTHORIZE, SagaStep.INVENTORY_CONFIRM, SagaStep.PROMOTION_CONFIRM,
        )
    }
}
