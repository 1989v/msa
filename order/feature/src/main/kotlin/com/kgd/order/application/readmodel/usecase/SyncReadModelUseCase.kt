package com.kgd.order.application.readmodel.usecase

import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView

/**
 * 다른 도메인 이벤트 → order 읽기 모델. 이벤트가 가진 값 전체로 덮어쓰되(전체 동기화),
 * 지금 행보다 오래된 이벤트는 반영하지 않는다.
 *
 * @return 반영했으면 true, 옛 이벤트라 버렸으면 false
 */
interface SyncReadModelUseCase {
    fun syncProduct(view: ProductView): Boolean
    fun syncSeller(view: SellerView): Boolean
    fun syncCouponDefinition(view: CouponDefinitionView): Boolean
    fun syncUserCoupon(view: UserCouponView): Boolean
    fun syncPointBalance(view: PointBalanceView): Boolean
}
