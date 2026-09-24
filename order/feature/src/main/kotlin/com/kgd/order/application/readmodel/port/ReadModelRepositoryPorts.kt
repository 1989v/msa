package com.kgd.order.application.readmodel.port

import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView

/** order_db 의 읽기 모델 저장소. `save` 는 upsert — 있으면 덮어쓰고 없으면 만든다 */
interface ProductViewRepositoryPort {
    fun findById(productId: Long): ProductView?
    fun findAllByIds(productIds: Collection<Long>): List<ProductView>
    fun save(view: ProductView)
}

interface SellerViewRepositoryPort {
    fun findById(sellerId: Long): SellerView?
    fun findAllByIds(sellerIds: Collection<Long>): List<SellerView>
    fun save(view: SellerView)
}

interface CouponDefinitionViewRepositoryPort {
    fun findById(couponDefinitionId: Long): CouponDefinitionView?
    fun save(view: CouponDefinitionView)
}

interface UserCouponViewRepositoryPort {
    fun findById(userCouponId: Long): UserCouponView?
    fun save(view: UserCouponView)
}

interface PointBalanceViewRepositoryPort {
    fun findByMemberId(memberId: String): PointBalanceView?
    fun save(view: PointBalanceView)
}
