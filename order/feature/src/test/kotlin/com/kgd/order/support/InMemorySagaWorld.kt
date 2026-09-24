package com.kgd.order.support

import com.kgd.order.application.order.port.DailyOrderCount
import com.kgd.order.application.order.port.IdempotencyKeyRepositoryPort
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.port.PurchaseConfirmTrigger
import com.kgd.order.application.saga.port.OrderOpsIssueRepositoryPort
import com.kgd.order.application.saga.port.OrderSagaRepositoryPort
import com.kgd.order.application.saga.port.SagaCommand
import com.kgd.order.application.saga.port.SagaCommandPort
import com.kgd.order.domain.claim.model.Claim
import com.kgd.order.domain.idempotency.model.IdempotencyKey
import com.kgd.order.domain.idempotency.model.IdempotencyStatus
import com.kgd.order.domain.opsissue.model.OpsIssue
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.PurchaseConfirmation
import com.kgd.order.domain.order.model.StatusChange
import com.kgd.order.domain.saga.model.OrderSaga
import com.kgd.order.domain.saga.model.SagaStatus
import com.kgd.order.domain.sheet.model.ShippingLine
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.AbstractPlatformTransactionManager
import org.springframework.transaction.support.DefaultTransactionStatus
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDateTime

/**
 * order 사가·주문 포트의 메모리 구현 + 트랜잭션 흉내. 트랜잭션이 롤백되면 그 안에서 쓴 주문·사가·명령·이력이 전부 사라진다 —
 * 실제 아웃박스 행이 롤백으로 사라지는 것과 같게 해 두어야 충돌 재시도 테스트가 명령을 두 번 세지 않는다.
 * 사가 저장은 `@Version` 과 같게 버전이 다르면 충돌을 던진다.
 */
class InMemorySagaWorld {
    private var orderRows = linkedMapOf<Long, Order>()
    private var sagaRows = linkedMapOf<Long, OrderSaga>()
    private var keyRows = linkedMapOf<Pair<String, String>, IdempotencyKey>()
    private var commandRows = mutableListOf<SagaCommand>()
    private var historyRows = mutableListOf<Pair<Long, StatusChange>>()
    private var confirmedRows = mutableListOf<Order>()
    private var issueRows = mutableListOf<OpsIssue>()
    private var claimRefundedRows = mutableListOf<Claim>()
    private var purchaseConfirmedRows = mutableListOf<PurchaseConfirmedEvent>()
    private var orderSeq = 0L
    private var itemSeq = 0L

    /** 다음 사가 저장 [n] 번을 동시 커밋과 충돌한 것처럼 만든다 */
    var sagaConflicts = 0

    val commands: List<SagaCommand> get() = commandRows.toList()
    val history: List<Pair<Long, StatusChange>> get() = historyRows.toList()
    val confirmedEvents: List<Order> get() = confirmedRows.toList()
    val issues: List<OpsIssue> get() = issueRows.toList()
    val claimRefundedEvents: List<Claim> get() = claimRefundedRows.toList()
    val purchaseConfirmedEvents: List<PurchaseConfirmedEvent> get() = purchaseConfirmedRows.toList()
    fun order(id: Long): Order = requireNotNull(orderRows[id])
    fun saga(orderId: Long): OrderSaga = requireNotNull(sagaRows[orderId])
    fun orderCount() = orderRows.size
    fun key(userId: String, key: String) = keyRows[userId to key]
    fun putKey(key: IdempotencyKey) { keyRows[key.userId to key.key] = key }
    fun clearCommands() = commandRows.clear()

    private data class Snapshot(
        val orders: LinkedHashMap<Long, Order>, val sagas: LinkedHashMap<Long, OrderSaga>,
        val keys: LinkedHashMap<Pair<String, String>, IdempotencyKey>, val commands: MutableList<SagaCommand>,
        val history: MutableList<Pair<Long, StatusChange>>, val confirmed: MutableList<Order>, val issues: MutableList<OpsIssue>,
        val orderSeq: Long, val itemSeq: Long,
        val claimRefunded: MutableList<Claim>, val purchaseConfirmed: MutableList<PurchaseConfirmedEvent>,
    )

    private fun snapshot() = Snapshot(
        LinkedHashMap(orderRows.mapValues { copy(it.value) }), LinkedHashMap(sagaRows.mapValues { copy(it.value, it.value.version) }),
        LinkedHashMap(keyRows), commandRows.toMutableList(), historyRows.toMutableList(), confirmedRows.toMutableList(),
        issueRows.toMutableList(), orderSeq, itemSeq, claimRefundedRows.toMutableList(), purchaseConfirmedRows.toMutableList(),
    )

    private fun restore(s: Snapshot) {
        orderRows = s.orders; sagaRows = s.sagas; keyRows = s.keys; commandRows = s.commands; historyRows = s.history
        confirmedRows = s.confirmed; issueRows = s.issues; orderSeq = s.orderSeq; itemSeq = s.itemSeq
        claimRefundedRows = s.claimRefunded; purchaseConfirmedRows = s.purchaseConfirmed
    }

    val transactionManager = object : AbstractPlatformTransactionManager() {
        override fun doGetTransaction(): Any = Holder()
        override fun doBegin(transaction: Any, definition: TransactionDefinition) { (transaction as Holder).snapshot = snapshot() }
        override fun doCommit(status: DefaultTransactionStatus) = Unit
        override fun doRollback(status: DefaultTransactionStatus) { restore(requireNotNull((status.transaction as Holder).snapshot)) }
    }

    private class Holder { var snapshot: Snapshot? = null }

    val orders = object : OrderRepositoryPort {
        override fun save(order: Order): Order {
            val id = order.id ?: ++orderSeq
            val stored = orderRows[id]
            if (stored != null && stored.version != order.version) throw ObjectOptimisticLockingFailureException(Order::class.java, id)
            order.pullStatusChanges().forEach { historyRows += id to it }
            val items = order.items.map { if (it.id != null) it else withId(it, ++itemSeq) }
            val saved = Order.restore(
                id, order.userId, order.orderSheetId, order.userCouponId, items, order.shippingLines, order.status,
                order.failureReason, order.refundedAmount, order.createdAt, (stored?.version ?: -1) + 1,
            )
            orderRows[id] = saved
            return copy(saved)
        }
        override fun findById(id: Long) = orderRows[id]?.let(::copy)
        override fun findAllByUserId(userId: String) = orderRows.values.filter { it.userId == userId }.map(::copy).reversed()
        override fun findAutoConfirmCandidateIds(deliveredBefore: Instant, limit: Int) = orderRows.values
            .filter { o ->
                o.status == com.kgd.order.domain.order.model.OrderStatus.FULFILLING &&
                    o.items.any { it.status == com.kgd.order.domain.order.model.OrderLineStatus.ACTIVE && it.deliveredAt?.isAfter(deliveredBefore) == false }
            }
            .mapNotNull { it.id }.take(limit)
        override fun countAwaitingPayment(userId: String) = orderRows.values.count { it.userId == userId && it.status.awaitingPayment }.toLong()
        override fun countCreatedAfter(from: LocalDateTime) = 0L
        override fun sumRevenueCreatedAfter(from: LocalDateTime): BigDecimal = BigDecimal.ZERO
        override fun countDailyCreatedAfter(from: LocalDateTime) = emptyList<DailyOrderCount>()
    }

    val sagas = object : OrderSagaRepositoryPort {
        override fun create(saga: OrderSaga) { sagaRows[saga.orderId] = copy(saga, 0) }
        override fun save(saga: OrderSaga) {
            val stored = requireNotNull(sagaRows[saga.orderId])
            if (sagaConflicts > 0) {
                sagaConflicts--
                // 다른 트랜잭션이 먼저 커밋했다 — 저장본 버전이 올라가 있다
                sagaRows[saga.orderId] = copy(stored, stored.version + 1)
                throw ObjectOptimisticLockingFailureException(OrderSaga::class.java, saga.orderId)
            }
            if (stored.version != saga.version) throw ObjectOptimisticLockingFailureException(OrderSaga::class.java, saga.orderId)
            sagaRows[saga.orderId] = copy(saga, saga.version + 1)
        }
        override fun findByOrderId(orderId: Long) = sagaRows[orderId]?.let { copy(it, it.version) }
        override fun findAllByOrderIds(orderIds: Collection<Long>) = orderIds.mapNotNull { findByOrderId(it) }
        override fun findDueOrderIds(now: Instant, limit: Int) = sagaRows.values
            .filter { (it.status == SagaStatus.RUNNING || it.status == SagaStatus.COMPENSATING) && !it.nextDeadlineAt.isAfter(now) }
            .sortedBy { it.nextDeadlineAt }.take(limit).map { it.orderId }
    }

    val commandPort = object : SagaCommandPort {
        override fun send(command: SagaCommand) { commandRows += command }
    }

    val events = object : OrderEventPort {
        override fun publishConfirmed(order: Order, confirmedAt: Instant) { confirmedRows += copy(order) }
        override fun publishClaimRefunded(order: Order, claim: Claim, refundedAt: Instant) { claimRefundedRows += claim }
        override fun publishPurchaseConfirmed(
            order: Order, confirmations: List<PurchaseConfirmation>, trigger: PurchaseConfirmTrigger, confirmedAt: Instant,
        ) { confirmations.forEach { purchaseConfirmedRows += PurchaseConfirmedEvent(it.line.lineNo, it.line.sellerId, it.shipping, trigger) } }
        override fun publishShippingSettlementDue(order: Order, shipping: List<ShippingLine>, confirmedAt: Instant) {
            shipping.forEach { purchaseConfirmedRows += PurchaseConfirmedEvent(null, it.sellerId, it, PurchaseConfirmTrigger.CLAIM_CLOSED) }
        }
    }

    /** `order.line.purchase-confirmed` 한 건 — [lineNo] 가 null 이면 배송비만 실은 건 */
    data class PurchaseConfirmedEvent(val lineNo: Int?, val sellerId: Long, val shipping: ShippingLine?, val trigger: PurchaseConfirmTrigger)

    val opsIssues = object : OrderOpsIssueRepositoryPort {
        override fun save(issue: OpsIssue) { issueRows += issue }
    }

    val keys = object : IdempotencyKeyRepositoryPort {
        override fun insert(key: IdempotencyKey) {
            if (keyRows.containsKey(key.userId to key.key)) throw DataIntegrityViolationException("uk_idempotency_key_user_key")
            keyRows[key.userId to key.key] = key
        }
        override fun find(userId: String, key: String) = keyRows[userId to key]?.let {
            IdempotencyKey.restore(it.userId, it.key, it.status, it.leaseUntil, it.response, it.createdAt)
        }
        override fun takeOver(userId: String, key: String, now: Instant, leaseUntil: Instant): Boolean {
            val k = keyRows[userId to key] ?: return false
            if (k.status != IdempotencyStatus.PROCESSING || k.leaseUntil.isAfter(now)) return false
            keyRows[userId to key] = IdempotencyKey.restore(k.userId, k.key, k.status, leaseUntil, k.response, k.createdAt)
            return true
        }
        override fun complete(key: IdempotencyKey) { keyRows[key.userId to key.key] = key }
        override fun release(userId: String, key: String) {
            if (keyRows[userId to key]?.status == IdempotencyStatus.PROCESSING) keyRows.remove(userId to key)
        }
        override fun deleteCreatedBefore(cutoff: Instant): Int {
            val old = keyRows.filterValues { it.createdAt.isBefore(cutoff) }.keys
            old.forEach { keyRows.remove(it) }
            return old.size
        }
    }

    private fun copy(o: Order): Order = Order.restore(
        o.id, o.userId, o.orderSheetId, o.userCouponId,
        o.items.map { withId(it, it.id) }, o.shippingLines, o.status, o.failureReason, o.refundedAmount, o.createdAt, o.version,
    )

    private fun withId(i: OrderItem, id: Long?) = OrderItem.restore(
        id, i.lineNo, i.productId, i.productName, i.sellerId, i.unitPrice, i.quantity, i.couponDiscount, i.couponBearer,
        i.pointAmount, i.commissionRateBp, i.status, i.shippedAt, i.deliveredAt, i.purchaseConfirmedAt,
    )

    private fun copy(s: OrderSaga, version: Long) = OrderSaga.restore(
        s.orderId, s.orderNo, s.paymentRequired, s.status, s.step, s.attempts, s.nextDeadlineAt, s.startedAt,
        s.prePivotDeadlineAt, s.pendingVoid, s.holdsExpired, s.paymentUnknown, s.inventoryConfirmed, s.promotionConfirmed,
        s.cancelRequested, s.compensationPlan, s.failureReason, s.reservedLines, version,
    )
}
