package com.kgd.order.domain.sheet.model

import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.CouponQuote
import com.kgd.order.domain.benefit.model.CouponTargetLine
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.domain.sheet.exception.OrderSheetUnavailableException
import java.time.Duration
import java.time.Instant

/**
 * 주문서 금액 계산 — 입력은 읽기 모델뿐이고 요청의 가격은 받지 않는다.
 *
 * 0. 같은 상품이 여러 번 오면 처음 나온 자리에서 수량을 합쳐 한 라인으로 만든다 — 라인이 곧 상품 한 종이라
 *    화면·클레임이 헷갈리지 않는다(이행은 주문 라인 id 로 식별하므로 두 라인이어도 동작은 한다).
 * 1. 판매 가능: 상품 ACTIVE + 판매자 판매 가능(ACTIVE·수수료율 있음). 아니면 422.
 * 2. 쿠폰 견적을 대상 라인 금액 비율로 안분.
 * 3. 포인트: 잔액 이하, 쿠폰 뒤 상품 금액 이하(배송비는 포인트 대상이 아니다). 쿠폰 뒤 라인 금액 비율로 안분.
 * 4. 배송비: 등장 순서대로 판매자마다 한 번.
 */
object OrderSheetPricing {

    data class Item(val productId: Long, val quantity: Int)

    /** 선택한 쿠폰 — 읽기 모델에 없으면 view 가 null */
    data class CouponChoice(
        val userCouponId: Long,
        val userCoupon: UserCouponView?,
        val definition: CouponDefinitionView?,
    )

    fun price(
        memberId: String,
        items: List<Item>,
        products: Map<Long, ProductView>,
        sellers: Map<Long, SellerView>,
        coupon: CouponChoice?,
        pointAmount: Long,
        pointBalance: Long,
        now: Instant,
        ttl: Duration,
    ): OrderSheet {
        require(items.isNotEmpty()) { "주문 항목이 없다" }
        require(items.all { it.quantity > 0 }) { "수량은 1 이상" }
        val merged = items.groupBy { it.productId }.map { (productId, same) -> Item(productId, same.sumOf { it.quantity }) }
        return priceMerged(memberId, merged, products, sellers, coupon, pointAmount, pointBalance, now, ttl)
    }

    private fun priceMerged(
        memberId: String,
        items: List<Item>,
        products: Map<Long, ProductView>,
        sellers: Map<Long, SellerView>,
        coupon: CouponChoice?,
        pointAmount: Long,
        pointBalance: Long,
        now: Instant,
        ttl: Duration,
    ): OrderSheet {
        require(pointAmount >= 0) { "포인트는 음수일 수 없다" }

        val sold = items.map { item ->
            val product = products[item.productId]?.takeIf { it.isOnSale } ?: reject(OrderSheetRejection.PRODUCT_UNAVAILABLE)
            val seller = sellers[product.sellerId]?.takeIf { it.isSellable } ?: reject(OrderSheetRejection.SELLER_UNAVAILABLE)
            Triple(item, product, seller)
        }
        val amounts = sold.map { (item, product, _) -> Math.multiplyExact(product.price, item.quantity.toLong()) }

        val couponShares = MutableList(sold.size) { 0L }
        val quote = coupon?.let { quoteCoupon(memberId, it, sold.map { s -> s.second.sellerId }, amounts, now) }
        if (quote != null) {
            val shares = Allocation.allocate(quote.discount, quote.targetIndexes.map { amounts[it] })
            quote.targetIndexes.forEachIndexed { k, i -> couponShares[i] = shares[k] }
        }

        val afterCoupon = amounts.indices.map { amounts[it] - couponShares[it] }
        if (pointAmount > pointBalance) reject(OrderSheetRejection.POINT_EXCEEDS_BALANCE)
        if (pointAmount > afterCoupon.sum()) reject(OrderSheetRejection.POINT_EXCEEDS_PAYABLE)
        val pointShares = Allocation.allocate(pointAmount, afterCoupon)

        val bearer = coupon?.definition?.bearer
        val lines = sold.mapIndexed { i, (item, product, seller) ->
            OrderSheetLine(
                lineNo = i + 1,
                productId = product.productId,
                productName = product.name,
                sellerId = product.sellerId,
                unitPrice = product.price,
                quantity = item.quantity,
                couponDiscount = couponShares[i],
                couponBearer = if (couponShares[i] > 0) bearer else null,
                pointAmount = pointShares[i],
                commissionRateBp = requireNotNull(seller.commissionRateBp),
            )
        }
        val shipping = sold.map { it.third }.distinctBy { it.sellerId }.map { ShippingLine(it.sellerId, it.shippingFee) }

        return OrderSheet.create(
            memberId = memberId,
            lines = lines,
            shippingLines = shipping,
            userCouponId = coupon?.userCouponId,
            couponDefinitionId = coupon?.definition?.couponDefinitionId,
            expiresAt = now.plus(ttl),
            createdAt = now,
        )
    }

    private fun quoteCoupon(
        memberId: String,
        choice: CouponChoice,
        sellerIds: List<Long>,
        amounts: List<Long>,
        now: Instant,
    ): CouponQuote.Applicable {
        // 남의 쿠폰은 없는 쿠폰과 같게 — 다른 회원의 쿠폰 존재를 흘리지 않는다
        val userCoupon = choice.userCoupon?.takeIf { it.memberId == memberId } ?: reject(OrderSheetRejection.COUPON_NOT_FOUND)
        if (!userCoupon.isUsable) reject(OrderSheetRejection.COUPON_NOT_USABLE)
        val definition = choice.definition?.takeIf { it.couponDefinitionId == userCoupon.couponDefinitionId }
            ?: reject(OrderSheetRejection.COUPON_NOT_FOUND)
        return when (val q = definition.quote(sellerIds.indices.map { CouponTargetLine(sellerIds[it], amounts[it]) }, now)) {
            is CouponQuote.Applicable -> q
            is CouponQuote.NotApplicable -> reject(q.reason)
        }
    }

    private fun reject(rejection: OrderSheetRejection): Nothing = throw OrderSheetUnavailableException(rejection)
}
