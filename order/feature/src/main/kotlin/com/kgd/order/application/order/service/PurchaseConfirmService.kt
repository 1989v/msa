package com.kgd.order.application.order.service

import com.kgd.order.application.claim.port.ClaimRepositoryPort
import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.port.PurchaseConfirmTrigger
import com.kgd.order.application.order.usecase.AutoConfirmPurchaseUseCase
import com.kgd.order.application.order.usecase.ConfirmPurchaseUseCase
import com.kgd.order.application.order.usecase.TrackDeliveryUseCase
import com.kgd.order.domain.claim.exception.PurchaseConfirmNotAllowedException
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Duration

/**
 * 구매 확정 (스펙 SR-8) — 버튼(본인) 또는 배송 완료 후 `order.purchase-confirm-days`(기본 7)일 자동.
 * 확정 라인마다 `order.line.purchase-confirmed`(판매자의 첫 확정 라인이면 배송비 라인 포함), 남은 라인이 전부 확정이면 COMPLETED.
 *
 * 진행 중 클레임(REQUESTED·APPROVED)이 있는 주문은 확정하지 않는다 — 클레임의 배송비 환불 여부는 환불을 시작할 때
 * 「그 판매자 라인이 전부 취소되는가」로 정해지는데, 그 사이 같은 판매자 라인이 확정되면 배송비가 환불과 정산에 둘 다 오를 수 있다.
 */
@Service
class PurchaseConfirmService(
    private val orders: OrderRepositoryPort,
    private val claims: ClaimRepositoryPort,
    private val events: OrderEventPort,
    @Qualifier("orderClock") private val clock: Clock,
    @Value("\${order.purchase-confirm-days:7}") confirmDays: Long,
    @Qualifier("orderTransactionManager") transactionManager: PlatformTransactionManager,
) : ConfirmPurchaseUseCase, AutoConfirmPurchaseUseCase, TrackDeliveryUseCase {

    private val log = KotlinLogging.logger {}
    private val tx = TransactionTemplate(transactionManager)
    private val confirmAfter: Duration = Duration.ofDays(confirmDays)

    override fun confirm(userId: String, orderId: Long): List<Int> = inTx {
        val order = orders.findById(orderId)?.takeIf { it.userId == userId } ?: throw OrderNotFoundException(orderId)
        if (order.status != OrderStatus.FULFILLING) throw PurchaseConfirmNotAllowedException("이행 중인 주문만 구매 확정할 수 있습니다: ${order.status}")
        if (hasOpenClaim(orderId)) throw PurchaseConfirmNotAllowedException("취소 처리 중인 주문입니다 — 끝난 뒤 구매 확정해 주세요")
        val lineNos = order.items.filter { it.status == OrderLineStatus.ACTIVE }.map { it.lineNo }
        if (lineNos.isEmpty()) throw PurchaseConfirmNotAllowedException("구매 확정할 라인이 없습니다")
        confirmLines(order, lineNos, PurchaseConfirmTrigger.BUYER)
    }

    override fun candidateOrderIds(limit: Int): List<Long> =
        tx.execute { orders.findAutoConfirmCandidateIds(clock.instant().minus(confirmAfter), limit) }.orEmpty()

    override fun autoConfirm(orderId: Long): List<Int> = inTx {
        val order = orders.findById(orderId) ?: return@inTx emptyList()
        if (order.status != OrderStatus.FULFILLING || hasOpenClaim(orderId)) return@inTx emptyList()
        val lineNos = order.autoConfirmableLineNos(clock.instant().minus(confirmAfter))
        if (lineNos.isEmpty()) emptyList() else confirmLines(order, lineNos, PurchaseConfirmTrigger.AUTO)
    }

    override fun onShipped(orderId: Long, productIds: Collection<Long>) = mark(orderId) { it.markShipped(productIds, clock.instant()) }

    override fun onDelivered(orderId: Long, productIds: Collection<Long>) = mark(orderId) { it.markDelivered(productIds, clock.instant()) }

    private fun mark(orderId: Long, block: (Order) -> Unit) = inTx {
        val order = orders.findById(orderId) ?: return@inTx log.info { "주문이 없는 출고·배송 이벤트 — 건너뛴다: orderId=$orderId" }
        block(order)
        orders.save(order)
        Unit
    }

    private fun confirmLines(order: Order, lineNos: List<Int>, trigger: PurchaseConfirmTrigger): List<Int> {
        val now = clock.instant()
        val confirmations = order.confirmPurchases(lineNos, now)
        events.publishPurchaseConfirmed(order, confirmations, trigger, now)
        orders.save(order)
        log.info { "구매 확정: orderId=${order.id}, lines=$lineNos, trigger=$trigger, order=${order.status}" }
        return lineNos
    }

    private fun hasOpenClaim(orderId: Long) = claims.findAllByOrderId(orderId).any { it.status.open }

    private fun <T> inTx(block: () -> T): T {
        var conflict: OptimisticLockingFailureException? = null
        repeat(MAX_CONFLICT_ATTEMPTS) { attempt ->
            try {
                @Suppress("UNCHECKED_CAST")
                return tx.execute { block() } as T
            } catch (e: OptimisticLockingFailureException) {
                conflict = e
                log.info { "구매 확정 동시 갱신 충돌 — 다시 읽는다(${attempt + 1}/$MAX_CONFLICT_ATTEMPTS): ${e.message}" }
            }
        }
        throw requireNotNull(conflict)
    }

    private companion object {
        const val MAX_CONFLICT_ATTEMPTS = 5
    }
}
