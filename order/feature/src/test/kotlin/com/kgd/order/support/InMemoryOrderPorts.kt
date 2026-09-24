package com.kgd.order.support

import com.kgd.order.application.cart.port.CartRepositoryPort
import com.kgd.order.application.readmodel.port.CouponDefinitionViewRepositoryPort
import com.kgd.order.application.readmodel.port.PointBalanceViewRepositoryPort
import com.kgd.order.application.readmodel.port.ProductViewRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.application.readmodel.port.UserCouponViewRepositoryPort
import com.kgd.order.application.sheet.port.OrderSheetRepositoryPort
import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.cart.model.CartItem
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.domain.sheet.model.OrderSheet

/** order 포트의 메모리 구현 — 서비스·컨트롤러 테스트가 저장된 값을 직접 읽어 판정한다 */
class InMemoryOrderPorts {
    val productRows = linkedMapOf<Long, ProductView>()
    val sellerRows = linkedMapOf<Long, SellerView>()
    val definitionRows = linkedMapOf<Long, CouponDefinitionView>()
    val userCouponRows = linkedMapOf<Long, UserCouponView>()
    val pointRows = linkedMapOf<String, PointBalanceView>()
    val cartRows = mutableListOf<CartItem>()
    val sheetRows = linkedMapOf<Long, OrderSheet>()

    val products = object : ProductViewRepositoryPort {
        override fun findById(productId: Long) = productRows[productId]
        override fun findAllByIds(productIds: Collection<Long>) = productIds.mapNotNull { productRows[it] }
        override fun save(view: ProductView) { productRows[view.productId] = view }
    }
    val sellers = object : SellerViewRepositoryPort {
        override fun findById(sellerId: Long) = sellerRows[sellerId]
        override fun findAllByIds(sellerIds: Collection<Long>) = sellerIds.mapNotNull { sellerRows[it] }
        override fun save(view: SellerView) { sellerRows[view.sellerId] = view }
    }
    val couponDefinitions = object : CouponDefinitionViewRepositoryPort {
        override fun findById(couponDefinitionId: Long) = definitionRows[couponDefinitionId]
        override fun save(view: CouponDefinitionView) { definitionRows[view.couponDefinitionId] = view }
    }
    val userCoupons = object : UserCouponViewRepositoryPort {
        override fun findById(userCouponId: Long) = userCouponRows[userCouponId]
        override fun save(view: UserCouponView) { userCouponRows[view.userCouponId] = view }
    }
    val points = object : PointBalanceViewRepositoryPort {
        override fun findByMemberId(memberId: String) = pointRows[memberId]
        override fun save(view: PointBalanceView) { pointRows[view.memberId] = view }
    }
    val carts = object : CartRepositoryPort {
        override fun findAllByMemberId(memberId: String) = cartRows.filter { it.memberId == memberId }
        override fun save(item: CartItem) {
            cartRows.removeIf { it.memberId == item.memberId && it.productId == item.productId }
            cartRows += item
        }
        override fun delete(memberId: String, productId: Long) { cartRows.removeIf { it.memberId == memberId && it.productId == productId } }
        override fun deleteAll(memberId: String) { cartRows.removeIf { it.memberId == memberId } }
    }
    val sheets = object : OrderSheetRepositoryPort {
        private var seq = 0L
        override fun save(sheet: OrderSheet): OrderSheet {
            val id = sheet.id ?: ++seq
            val saved = OrderSheet.restore(
                id, sheet.memberId, sheet.lines, sheet.shippingLines, sheet.userCouponId, sheet.couponDefinitionId,
                sheet.status, sheet.usedOrderId, sheet.expiresAt, sheet.createdAt,
            )
            sheetRows[id] = saved
            return saved
        }
        override fun findById(id: Long) = sheetRows[id]
    }
}
