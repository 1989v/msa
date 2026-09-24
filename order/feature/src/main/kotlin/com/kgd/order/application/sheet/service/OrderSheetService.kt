package com.kgd.order.application.sheet.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.application.cart.port.CartRepositoryPort
import com.kgd.order.application.readmodel.port.CouponDefinitionViewRepositoryPort
import com.kgd.order.application.readmodel.port.PointBalanceViewRepositoryPort
import com.kgd.order.application.readmodel.port.ProductViewRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.application.readmodel.port.UserCouponViewRepositoryPort
import com.kgd.order.application.sheet.port.OrderSheetRepositoryPort
import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.order.application.sheet.usecase.GetOrderSheetUseCase
import com.kgd.order.application.sheet.usecase.OrderSheetResult
import com.kgd.order.domain.sheet.exception.OrderSheetNotFoundException
import com.kgd.order.domain.sheet.model.OrderSheetPricing
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration

/** 읽기 모델만 읽고 order_db 에만 쓴다 — 외부 호출이 없어 한 트랜잭션에 둔다 */
@Service
class OrderSheetService(
    private val sheets: OrderSheetRepositoryPort,
    private val carts: CartRepositoryPort,
    private val products: ProductViewRepositoryPort,
    private val sellers: SellerViewRepositoryPort,
    private val couponDefinitions: CouponDefinitionViewRepositoryPort,
    private val userCoupons: UserCouponViewRepositoryPort,
    private val points: PointBalanceViewRepositoryPort,
    @Qualifier("orderClock") private val clock: Clock,
    @Value("\${order.sheet.ttl-minutes:15}") ttlMinutes: Long,
) : CreateOrderSheetUseCase, GetOrderSheetUseCase {

    private val ttl: Duration = Duration.ofMinutes(ttlMinutes)

    @Transactional("orderTransactionManager")
    override fun execute(command: CreateOrderSheetUseCase.Command): OrderSheetResult {
        val items = if (command.fromCart) {
            carts.findAllByMemberId(command.memberId).map { OrderSheetPricing.Item(it.productId, it.quantity) }
        } else {
            requireNotNull(command.items).map { OrderSheetPricing.Item(it.productId, it.quantity) }
        }
        if (items.isEmpty()) throw BusinessException(ErrorCode.INVALID_INPUT, "주문 항목이 없습니다")

        val productById = products.findAllByIds(items.map { it.productId }).associateBy { it.productId }
        val sellerById = sellers.findAllByIds(productById.values.map { it.sellerId }.toSet()).associateBy { it.sellerId }
        val coupon = command.userCouponId?.let { id ->
            val userCoupon = userCoupons.findById(id)
            OrderSheetPricing.CouponChoice(id, userCoupon, userCoupon?.let { couponDefinitions.findById(it.couponDefinitionId) })
        }
        val balance = if (command.pointAmount > 0) points.findByMemberId(command.memberId)?.balance ?: 0L else 0L

        val sheet = OrderSheetPricing.price(
            memberId = command.memberId,
            items = items,
            products = productById,
            sellers = sellerById,
            coupon = coupon,
            pointAmount = command.pointAmount,
            pointBalance = balance,
            now = clock.instant(),
            ttl = ttl,
        )
        return OrderSheetResult.from(sheets.save(sheet))
    }

    @Transactional("orderTransactionManager", readOnly = true)
    override fun execute(memberId: String, orderSheetId: Long): OrderSheetResult {
        val sheet = sheets.findById(orderSheetId)?.takeIf { it.memberId == memberId }
            ?: throw OrderSheetNotFoundException(orderSheetId)
        return OrderSheetResult.from(sheet)
    }
}
