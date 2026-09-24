package com.kgd.order.application.readmodel.service

import com.kgd.order.application.readmodel.port.CouponDefinitionViewRepositoryPort
import com.kgd.order.application.readmodel.port.PointBalanceViewRepositoryPort
import com.kgd.order.application.readmodel.port.ProductViewRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.application.readmodel.port.UserCouponViewRepositoryPort
import com.kgd.order.application.readmodel.usecase.SyncReadModelUseCase
import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
class ReadModelSyncService(
    private val products: ProductViewRepositoryPort,
    private val sellers: SellerViewRepositoryPort,
    private val couponDefinitions: CouponDefinitionViewRepositoryPort,
    private val userCoupons: UserCouponViewRepositoryPort,
    private val points: PointBalanceViewRepositoryPort,
) : SyncReadModelUseCase {

    @Transactional("orderTransactionManager")
    override fun syncProduct(view: ProductView): Boolean {
        val current = products.findById(view.productId)
        if (current != null && !current.isSupersededBy(view)) return skipped("product", view.productId, view.occurredAt, current.occurredAt)
        products.save(view)
        return true
    }

    @Transactional("orderTransactionManager")
    override fun syncSeller(view: SellerView): Boolean {
        val current = sellers.findById(view.sellerId)
        if (current != null && !current.isSupersededBy(view)) return skipped("seller", view.sellerId, view.occurredAt, current.occurredAt)
        sellers.save(view)
        return true
    }

    @Transactional("orderTransactionManager")
    override fun syncCouponDefinition(view: CouponDefinitionView): Boolean {
        val current = couponDefinitions.findById(view.couponDefinitionId)
        if (current != null && !current.isSupersededBy(view)) {
            return skipped("coupon_definition", view.couponDefinitionId, view.occurredAt, current.occurredAt)
        }
        couponDefinitions.save(view)
        return true
    }

    @Transactional("orderTransactionManager")
    override fun syncUserCoupon(view: UserCouponView): Boolean {
        val current = userCoupons.findById(view.userCouponId)
        if (current != null && !current.isSupersededBy(view)) return skipped("user_coupon", view.userCouponId, view.occurredAt, current.occurredAt)
        userCoupons.save(view)
        return true
    }

    @Transactional("orderTransactionManager")
    override fun syncPointBalance(view: PointBalanceView): Boolean {
        val current = points.findByMemberId(view.memberId)
        if (current != null && !current.isSupersededBy(view)) return skipped("point_balance", view.memberId, view.occurredAt, current.occurredAt)
        points.save(view)
        return true
    }

    private fun skipped(model: String, id: Any, incoming: Any, current: Any): Boolean {
        log.info { "읽기 모델: 옛 이벤트 무시 model=$model id=$id incoming=$incoming current=$current" }
        return false
    }
}
