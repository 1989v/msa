package com.kgd.fulfillment.application.ownership.service

import com.kgd.common.exception.ForbiddenException
import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.application.ownership.port.OwnershipRepositoryPort
import com.kgd.fulfillment.application.ownership.usecase.AuthorizeFulfillmentAccessUseCase
import com.kgd.fulfillment.application.ownership.usecase.FulfillmentRequester
import com.kgd.fulfillment.domain.fulfillment.exception.FulfillmentNotFoundException
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

/**
 * 이행 REST 권한 — 게이트웨이는 ROLE_SELLER|ROLE_ADMIN 까지만 본다. 여기서 소유를 다시 판정한다.
 *
 * 어드민은 전부. 판매자는 토큰의 ROLE_SELLER 와 **ACTIVE 판매자 행**을 둘 다 가져야 하고:
 * - 쓰기(전이·취소)는 이행의 **모든 라인**이 자기 상품일 때만 — 남의 상품이 섞인 출고를 움직이지 못한다.
 * - 읽기는 라인 **하나라도** 자기 상품이면 — 합배송 이행의 상태는 각 판매자가 봐야 한다(응답에 라인은 없다).
 * 라인이 없는 이행(수동 생성)과 이행 생성 자체는 어드민만이다 — 소유를 판정할 상품이 없다.
 * 소유를 모르는 상품(읽기 모델에 행이 없다)은 남의 것으로 본다.
 */
@Component
class FulfillmentAccessAuthorizer(
    private val fulfillments: FulfillmentRepositoryPort,
    private val ownership: OwnershipRepositoryPort,
) : AuthorizeFulfillmentAccessUseCase {

    override fun requireAdmin(requester: FulfillmentRequester) {
        if (!requester.isAdmin) throw forbidden(requester, "이행 생성은 어드민만")
    }

    @Transactional(transactionManager = "fulfillmentTransactionManager", readOnly = true)
    override fun requireWrite(requester: FulfillmentRequester, fulfillmentId: Long) {
        if (requester.isAdmin) return
        val owned = ownedLineCounts(requester, listOf(find(fulfillmentId))).single()
        if (owned.total == 0 || owned.owned != owned.total) throw forbidden(requester, "fulfillmentId=$fulfillmentId")
    }

    @Transactional(transactionManager = "fulfillmentTransactionManager", readOnly = true)
    override fun requireRead(requester: FulfillmentRequester, fulfillmentId: Long) {
        if (requester.isAdmin) return
        if (ownedLineCounts(requester, listOf(find(fulfillmentId))).single().owned == 0) {
            throw forbidden(requester, "fulfillmentId=$fulfillmentId")
        }
    }

    @Transactional(transactionManager = "fulfillmentTransactionManager", readOnly = true)
    override fun readableIdsOfOrder(requester: FulfillmentRequester, orderId: Long): Set<Long>? {
        if (requester.isAdmin) return null
        val orders = fulfillments.findAllByOrderId(orderId)
        val readable = ownedLineCounts(requester, orders).filter { it.owned > 0 }.map { it.fulfillmentId }.toSet()
        if (readable.isEmpty()) throw forbidden(requester, "orderId=$orderId")
        return readable
    }

    private data class OwnedLines(val fulfillmentId: Long, val owned: Int, val total: Int)

    private fun ownedLineCounts(requester: FulfillmentRequester, orders: List<FulfillmentOrder>): List<OwnedLines> {
        val seller = (if (requester.isSeller) ownership.findActiveSellerByMemberId(requester.userId) else null)
            ?: throw forbidden(requester, "ACTIVE 판매자가 아니다")
        val productIds = orders.flatMap { fo -> fo.getLines().map { it.productId } }.toSet()
        val owners = ownership.findProductOwners(productIds).associate { it.productId to it.sellerId }
        return orders.map { fo ->
            val lines = fo.getLines()
            OwnedLines(requireNotNull(fo.id), lines.count { owners[it.productId] == seller.sellerId }, lines.size)
        }
    }

    private fun find(fulfillmentId: Long): FulfillmentOrder =
        fulfillments.findById(fulfillmentId) ?: throw FulfillmentNotFoundException(fulfillmentId)

    private fun forbidden(requester: FulfillmentRequester, detail: String) =
        ForbiddenException("이 이행을 다룰 권한이 없습니다: userId=${requester.userId}, $detail")
}
