package com.kgd.order.infrastructure.persistence.readmodel.adapter

import com.kgd.order.application.readmodel.port.CouponDefinitionViewRepositoryPort
import com.kgd.order.application.readmodel.port.PointBalanceViewRepositoryPort
import com.kgd.order.application.readmodel.port.ProductViewRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.application.readmodel.port.UserCouponViewRepositoryPort
import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.infrastructure.persistence.readmodel.entity.CouponDefinitionViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.PointBalanceViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.ProductViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.SellerViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.UserCouponViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.repository.CouponDefinitionViewJpaRepository
import com.kgd.order.infrastructure.persistence.readmodel.repository.PointBalanceViewJpaRepository
import com.kgd.order.infrastructure.persistence.readmodel.repository.ProductViewJpaRepository
import com.kgd.order.infrastructure.persistence.readmodel.repository.SellerViewJpaRepository
import com.kgd.order.infrastructure.persistence.readmodel.repository.UserCouponViewJpaRepository
import org.springframework.stereotype.Component

// save 는 호출자(ReadModelSyncService)의 트랜잭션 안에서 부른다 — 읽은 관리 엔티티를 고치면 커밋 때 반영된다.

@Component
class ProductViewRepositoryAdapter(private val jpa: ProductViewJpaRepository) : ProductViewRepositoryPort {
    override fun findById(productId: Long): ProductView? = jpa.findById(productId).orElse(null)?.toDomain()
    override fun findAllByIds(productIds: Collection<Long>): List<ProductView> =
        if (productIds.isEmpty()) emptyList() else jpa.findAllById(productIds).map { it.toDomain() }

    override fun save(view: ProductView) {
        jpa.findById(view.productId).orElse(null)?.overwrite(view) ?: jpa.save(ProductViewJpaEntity.from(view))
    }
}

@Component
class SellerViewRepositoryAdapter(private val jpa: SellerViewJpaRepository) : SellerViewRepositoryPort {
    override fun findById(sellerId: Long): SellerView? = jpa.findById(sellerId).orElse(null)?.toDomain()
    override fun findAllByIds(sellerIds: Collection<Long>): List<SellerView> =
        if (sellerIds.isEmpty()) emptyList() else jpa.findAllById(sellerIds).map { it.toDomain() }

    override fun save(view: SellerView) {
        jpa.findById(view.sellerId).orElse(null)?.overwrite(view) ?: jpa.save(SellerViewJpaEntity.from(view))
    }
}

@Component
class CouponDefinitionViewRepositoryAdapter(
    private val jpa: CouponDefinitionViewJpaRepository,
) : CouponDefinitionViewRepositoryPort {
    override fun findById(couponDefinitionId: Long): CouponDefinitionView? =
        jpa.findById(couponDefinitionId).orElse(null)?.toDomain()

    override fun save(view: CouponDefinitionView) {
        jpa.findById(view.couponDefinitionId).orElse(null)?.overwrite(view) ?: jpa.save(CouponDefinitionViewJpaEntity.from(view))
    }
}

@Component
class UserCouponViewRepositoryAdapter(private val jpa: UserCouponViewJpaRepository) : UserCouponViewRepositoryPort {
    override fun findById(userCouponId: Long): UserCouponView? = jpa.findById(userCouponId).orElse(null)?.toDomain()

    override fun save(view: UserCouponView) {
        jpa.findById(view.userCouponId).orElse(null)?.overwrite(view) ?: jpa.save(UserCouponViewJpaEntity.from(view))
    }
}

@Component
class PointBalanceViewRepositoryAdapter(private val jpa: PointBalanceViewJpaRepository) : PointBalanceViewRepositoryPort {
    override fun findByMemberId(memberId: String): PointBalanceView? = jpa.findById(memberId).orElse(null)?.toDomain()

    override fun save(view: PointBalanceView) {
        jpa.findById(view.memberId).orElse(null)?.overwrite(view) ?: jpa.save(PointBalanceViewJpaEntity.from(view))
    }
}
