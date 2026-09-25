package com.kgd.order.application.claim.service

import com.kgd.common.exception.ForbiddenException
import com.kgd.order.application.claim.port.ClaimCommand
import com.kgd.order.application.claim.port.ClaimCommandPort
import com.kgd.order.application.claim.port.ClaimRepositoryPort
import com.kgd.order.application.claim.usecase.ClaimView
import com.kgd.order.application.claim.usecase.DecideClaimUseCase
import com.kgd.order.application.claim.usecase.HandleClaimEventUseCase
import com.kgd.order.application.claim.usecase.ProcessClaimDeadlineUseCase
import com.kgd.order.application.claim.usecase.RequestClaimUseCase
import com.kgd.order.application.claim.usecase.ResumeClaimUseCase
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.application.saga.port.OrderOpsIssueRepositoryPort
import com.kgd.order.domain.claim.exception.ClaimNotAllowedException
import com.kgd.order.domain.claim.exception.ClaimNotFoundException
import com.kgd.order.domain.claim.model.Claim
import com.kgd.order.domain.claim.model.ClaimDeadlineDecision
import com.kgd.order.domain.claim.model.ClaimRefundPlan
import com.kgd.order.domain.claim.model.ClaimStatus
import com.kgd.order.domain.claim.model.ClaimStep
import com.kgd.order.domain.opsissue.model.OpsIssue
import com.kgd.order.domain.opsissue.model.OpsIssueType
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.saga.model.OrderSaga
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
 * 클레임 처리 (스펙 SR-8) — 사가 코디네이터와 같은 모양의 작은 사가다. 답 하나를 order_db 한 트랜잭션에서 처리한다:
 * 주문(라인 상태·환불 누계·상태 이력) · 클레임 행 · 다음 명령 아웃박스 행 · 정산 이벤트가 함께 커밋된다.
 *
 * 흐름: 이행 취소 명령 → cancelled 면 자동 승인 / cancel-rejected 면 판매자 결정 → 승인이면
 * 재입고(출고 전만) → 혜택 원복(포인트 · 전체 취소면 쿠폰) → PG 부분 환불(0원이면 생략) → REFUNDED:
 * 라인 CANCELLED · 환불 누계 · (전부 취소면) 주문 CANCELLED · `order.claim.refunded`.
 *
 * 답(이행·재고·혜택·결제)에는 클레임 id 가 없고 키가 orderId 다. 그래서 한 주문에서 답을 기다리는 클레임을 하나로 두고
 * 나머지는 QUEUED 로 줄 세운다 — 앞 클레임이 끝나거나 판매자 결정으로 멈추면 다음 것을 꺼낸다.
 */
@Service
class ClaimCoordinator(
    private val orders: OrderRepositoryPort,
    private val claims: ClaimRepositoryPort,
    private val sellers: SellerViewRepositoryPort,
    private val commands: ClaimCommandPort,
    private val events: OrderEventPort,
    private val opsIssues: OrderOpsIssueRepositoryPort,
    @Qualifier("orderClock") private val clock: Clock,
    @Qualifier("orderSagaTiming") private val timing: SagaTiming,
    @Qualifier("orderTransactionManager") transactionManager: PlatformTransactionManager,
) : RequestClaimUseCase, DecideClaimUseCase, HandleClaimEventUseCase, ProcessClaimDeadlineUseCase, ResumeClaimUseCase {

    private val log = KotlinLogging.logger {}
    private val tx = TransactionTemplate(transactionManager)

    override fun request(userId: String, orderId: Long, lineNos: List<Int>?): List<ClaimView> = inTx {
        val order = orders.findById(orderId)?.takeIf { it.userId == userId } ?: throw OrderNotFoundException(orderId)
        if (order.status != OrderStatus.CONFIRMED && order.status != OrderStatus.FULFILLING) {
            throw ClaimNotAllowedException("취소할 수 없는 주문 상태입니다: ${order.status}")
        }
        val existing = claims.findAllByOrderId(orderId)
        val inClaim = existing.filter { it.status.open }.flatMap { it.lineNos }.toSet()
        val targets = lineNos?.distinct() ?: order.items.filter { it.status == OrderLineStatus.ACTIVE && it.lineNo !in inClaim }.map { it.lineNo }
        targets.firstOrNull { it in inClaim }?.let { throw ClaimNotAllowedException("이미 취소 요청 중인 라인입니다: 라인 $it") }
        // 금액·라인 상태 검증은 환불 계산과 같은 규칙으로 — 여기서 통과하면 환불 단계에서 같은 이유로 막히지 않는다
        ClaimRefundPlan.of(order, targets, emptySet())

        val now = clock.instant()
        val created = order.items.filter { it.lineNo in targets }.groupBy { it.sellerId }.map { (sellerId, lines) ->
            claims.save(Claim.request(orderId, userId, sellerId, lines.map { it.lineNo }, now))
        }
        log.info { "클레임 접수: orderId=$orderId, claims=${created.map { it.id }}, lines=$targets" }
        pump(order, now)
        orders.save(order)
        claims.findAllByOrderId(orderId).filter { c -> created.any { it.id == c.id } }.map(ClaimView::of)
    }

    override fun approve(userId: String, claimId: Long): ClaimView = decide(userId, claimId) { claim, sellerActor ->
        claim.approveBySeller(sellerActor)
    }

    override fun reject(userId: String, claimId: Long, reason: String): ClaimView = decide(userId, claimId) { claim, sellerActor ->
        claim.rejectBySeller(sellerActor, reason)
    }

    private fun decide(userId: String, claimId: Long, action: (Claim, String) -> Unit): ClaimView = inTx {
        val seller = sellers.findActiveByMemberId(userId) ?: throw ForbiddenException("ACTIVE 판매자만 클레임을 처리할 수 있습니다")
        val claim = claims.findById(claimId)?.takeIf { it.sellerId == seller.sellerId } ?: throw ClaimNotFoundException(claimId)
        if (claim.step != ClaimStep.SELLER_DECISION) throw ClaimNotAllowedException("판매자 결정을 기다리는 클레임이 아닙니다: ${claim.status}/${claim.step}")
        val order = orders.findById(claim.orderId) ?: error("클레임의 주문이 없다: orderId=${claim.orderId}")
        action(claim, "seller:${seller.sellerId}:$userId")
        claims.save(claim)
        log.info { "판매자 결정: claimId=$claimId, status=${claim.status}, by=$userId" }
        pump(order, clock.instant())
        orders.save(order)
        ClaimView.of(requireNotNull(claims.findById(claimId)))
    }

    // ---- 답 ----

    override fun onFulfillmentCreated(orderId: Long) = withAwaiting(orderId, ClaimStep.FULFILLMENT_WAIT) { order, claim, now ->
        claim.fulfillmentCreated(now, timing)
        send(order, claim)
    }

    override fun onFulfillmentCancelled(orderId: Long) = withAwaiting(orderId, ClaimStep.FULFILLMENT_CANCEL) { order, claim, now ->
        claim.approveAutomatically()
        beginRefund(order, claim, now)
    }

    override fun onFulfillmentCancelRejected(orderId: Long) = withAwaiting(orderId, ClaimStep.FULFILLMENT_CANCEL) { _, claim, _ ->
        log.info { "이미 출고 — 판매자 결정 대기: claimId=${claim.id}, sellerId=${claim.sellerId}" }
        claim.awaitSeller()
    }

    override fun onInventoryRestocked(orderId: Long, restockKey: String?) =
        withAwaiting(orderId, ClaimStep.INVENTORY_RESTOCK) { order, claim, now ->
            if (restockKey != claim.idempotencyKey) {
                log.info { "다른 재입고의 답 — 무시: orderId=$orderId, restockKey=$restockKey, claim=${claim.idempotencyKey}" }
                return@withAwaiting
            }
            advance(order, claim, ClaimStep.INVENTORY_RESTOCK, now)
        }

    override fun onPromotionRestored(orderId: Long) = withAwaiting(orderId, ClaimStep.PROMOTION_RESTORE) { order, claim, now ->
        advance(order, claim, ClaimStep.PROMOTION_RESTORE, now)
    }

    override fun onPaymentRefunded(orderId: Long) = withAwaiting(orderId, ClaimStep.PAYMENT_REFUND) { order, claim, now ->
        advance(order, claim, ClaimStep.PAYMENT_REFUND, now)
    }

    override fun onStepFailed(orderId: Long, what: String, reason: String?) {
        log.warn { "클레임 단계 실패 답 — 기한 재발행에 맡긴다: orderId=$orderId, what=$what, reason=$reason" }
    }

    // ---- 기한 ----

    override fun dueOrderIds(limit: Int): List<Long> = tx.execute { claims.findDueOrderIds(clock.instant(), limit) }.orEmpty()

    override fun onDeadline(orderId: Long) = inTx {
        val order = orders.findById(orderId) ?: return@inTx
        val claim = claims.findAllByOrderId(orderId).firstOrNull { it.awaitingAnswer } ?: return@inTx
        val now = clock.instant()
        when (claim.checkDeadline(now, timing)) {
            ClaimDeadlineDecision.NOT_DUE -> return@inTx
            // 이행 생성 답을 놓쳤어도 주문이 이행 중이면 이행이 있다 — 취소 명령으로 넘어간다
            ClaimDeadlineDecision.WAIT_FULFILLMENT -> if (order.status == OrderStatus.FULFILLING) {
                claim.fulfillmentCreated(now, timing)
                send(order, claim)
            }
            ClaimDeadlineDecision.REISSUE -> {
                log.info { "클레임 기한 — 같은 명령 재발행: claimId=${claim.id}, step=${claim.step}, attempts=${claim.attempts}" }
                send(order, claim)
            }
            ClaimDeadlineDecision.STUCK -> {
                log.warn { "클레임 재시도 한도 초과: claimId=${claim.id}, step=${claim.step}" }
                opsIssues.save(
                    OpsIssue.open(
                        OpsIssueType.CLAIM_STUCK, requireNotNull(claim.id).toString(),
                        "클레임 단계 ${claim.step} 가 재시도 ${timing.maxRetries}회로도 끝나지 않았다 (orderId=$orderId)", now,
                    ),
                )
            }
        }
        claims.save(claim)
    }

    override fun resume(claimId: Long) = inTx {
        val claim = claims.findById(claimId) ?: throw ClaimNotFoundException(claimId)
        if (!claim.stuck || !claim.status.open) {
            log.info { "재개할 필요 없는 클레임: claimId=$claimId, status=${claim.status}, step=${claim.step}, stuck=${claim.stuck}" }
            return@inTx
        }
        val order = orders.findById(claim.orderId) ?: error("클레임은 있는데 주문이 없다: orderId=${claim.orderId}")
        claim.resume(clock.instant(), timing)
        log.info { "클레임 재개: claimId=$claimId, step=${claim.step}" }
        send(order, claim)
        claims.save(claim)
    }

    // ---- 전이 ----

    /** 승인된 클레임의 금액을 정하고 첫 환불 단계로. 할 일이 없으면 바로 끝낸다 */
    private fun beginRefund(order: Order, claim: Claim, now: Instant) {
        val plan = ClaimRefundPlan.of(order, claim.lineNos, shippedSellers(order.id!!, claim))
        val step = claim.beginRefund(plan, now, timing)
        log.info { "클레임 환불 시작: claimId=${claim.id}, pg=${plan.pgRefund}, point=${plan.pointRestore}, shipping=${plan.shippingRefund}, full=${plan.fullCancel}" }
        if (step == ClaimStep.DONE) finish(order, claim, now) else send(order, claim)
    }

    private fun advance(order: Order, claim: Claim, done: ClaimStep, now: Instant) {
        if (claim.completeStep(done, now, timing) == ClaimStep.DONE) finish(order, claim, now) else send(order, claim)
    }

    /** REFUNDED — 라인 취소 · 환불 누계 · 주문 상태 · 정산 이벤트. 클레임 행은 호출자가 저장한다 */
    private fun finish(order: Order, claim: Claim, now: Instant) {
        order.closeClaim(claim.lineNos, requireNotNull(claim.pgRefund), claim.userId, now)
        events.publishClaimRefunded(order, claim, now)
        log.info { "클레임 환불 완료: claimId=${claim.id}, orderId=${claim.orderId}, order=${order.status}, refunded=${order.refundedAmount}" }
    }

    /** 배송비를 돌려주지 않을 판매자 — 이번 클레임이 출고 뒤 승인이거나, 앞서 출고 뒤 취소된 라인이 있는 판매자 */
    private fun shippedSellers(orderId: Long, current: Claim): Set<Long> =
        claims.findAllByOrderId(orderId).filter { it.status == ClaimStatus.REFUNDED && it.goodsShipped }.map { it.sellerId }.toSet() +
            listOfNotNull(current.sellerId.takeIf { current.goodsShipped })

    /**
     * 답을 기다리는 클레임이 없으면 줄의 맨 앞을 꺼낸다 — 새 요청은 이행 취소부터, 판매자가 승인한 것은 환불부터.
     * 바로 끝나는 클레임(환불할 것 없음)이 있으면 다음 것을 이어서 꺼낸다.
     */
    private fun pump(order: Order, now: Instant) {
        while (true) {
            val all = claims.findAllByOrderId(requireNotNull(order.id))
            if (all.any { it.awaitingAnswer }) return
            val next = all.firstOrNull { it.status.open && it.step == ClaimStep.QUEUED } ?: return
            if (next.status == ClaimStatus.REQUESTED) {
                next.start(fulfillmentExists = order.status == OrderStatus.FULFILLING, now, timing)
                send(order, next)
            } else {
                beginRefund(order, next, now)
            }
            claims.save(next)
        }
    }

    private fun send(order: Order, claim: Claim) {
        val orderId = claim.orderId
        val lines = order.items.filter { it.lineNo in claim.lineNos }
        val command = when (claim.step) {
            ClaimStep.FULFILLMENT_WAIT -> return
            ClaimStep.FULFILLMENT_CANCEL -> ClaimCommand.CancelFulfillment(
                orderId, lines.map { requireNotNull(it.id) { "저장되지 않은 라인: orderId=$orderId, line=${it.lineNo}" } },
            )
            ClaimStep.INVENTORY_RESTOCK -> ClaimCommand.RestockInventory(
                orderId, claim.idempotencyKey,
                lines.groupBy { it.productId }.map { (productId, ls) -> ClaimCommand.Line(productId, ls.sumOf { it.quantity }) },
            )
            ClaimStep.PROMOTION_RESTORE ->
                ClaimCommand.RestorePromotion(orderId, claim.idempotencyKey, requireNotNull(claim.pointRestore), claim.fullCancel == true)
            ClaimStep.PAYMENT_REFUND ->
                ClaimCommand.RefundPayment(orderId, OrderSaga.orderNoOf(orderId), requireNotNull(claim.pgRefund), claim.idempotencyKey)
            ClaimStep.QUEUED, ClaimStep.SELLER_DECISION, ClaimStep.DONE -> error("명령이 없는 단계: ${claim.step}")
        }
        commands.send(command)
    }

    // ---- 트랜잭션 ----

    /** 답을 기다리는 클레임이 [expected] 단계일 때만 처리한다 — 늦게 온 답·다른 주체의 답은 무시 */
    private fun withAwaiting(orderId: Long, expected: ClaimStep, block: (Order, Claim, Instant) -> Unit) = inTx {
        val claim = claims.findAllByOrderId(orderId).firstOrNull { it.awaitingAnswer }
        if (claim == null || claim.step != expected) {
            log.info { "클레임이 기다리는 답이 아니다 — 무시: orderId=$orderId, expected=$expected, claim=${claim?.id}/${claim?.step}" }
            return@inTx
        }
        val order = orders.findById(orderId) ?: error("클레임은 있는데 주문이 없다: orderId=$orderId")
        val now = clock.instant()
        block(order, claim, now)
        claims.save(claim)
        pump(order, now)
        orders.save(order)
    }

    /** 낙관락 충돌(사가 코디네이터·다른 답과 같은 주문 행)이면 처음부터 다시 읽어 처리한다 */
    private fun <T> inTx(block: () -> T): T {
        var conflict: OptimisticLockingFailureException? = null
        repeat(MAX_CONFLICT_ATTEMPTS) { attempt ->
            try {
                @Suppress("UNCHECKED_CAST")
                return tx.execute { block() } as T
            } catch (e: OptimisticLockingFailureException) {
                conflict = e
                log.info { "클레임 동시 갱신 충돌 — 다시 읽는다(${attempt + 1}/$MAX_CONFLICT_ATTEMPTS): ${e.message}" }
            }
        }
        throw requireNotNull(conflict)
    }

    private companion object {
        const val MAX_CONFLICT_ATTEMPTS = 5
    }
}
