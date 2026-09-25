package com.kgd.inventory.infrastructure.persistence.ownership.entity

import com.kgd.inventory.domain.ownership.model.OwnerSeller
import com.kgd.inventory.domain.ownership.model.OwnerSellerStatus
import com.kgd.inventory.domain.ownership.model.ProductOwner
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 상품 소유 읽기 모델 `product_owner` — id 는 product_db 의 상품 id 를 그대로 쓴다 */
@Entity
@Table(name = "product_owner")
class ProductOwnerJpaEntity(
    @Id
    @Column(name = "product_id")
    val productId: Long,
    sellerId: Long,
    occurredAt: Instant,
) {
    @Column(name = "seller_id", nullable = false)
    var sellerId: Long = sellerId
        private set

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant = occurredAt
        private set

    /** 전체 동기화 — 이벤트가 가진 값으로 덮어쓴다 (entity-mutation.md) */
    fun update(owner: ProductOwner) {
        sellerId = owner.sellerId
        occurredAt = owner.occurredAt
    }

    fun toDomain() = ProductOwner(productId, sellerId, occurredAt)

    companion object {
        fun fromDomain(owner: ProductOwner) = ProductOwnerJpaEntity(owner.productId, owner.sellerId, owner.occurredAt)
    }
}

/** 판매자 읽기 모델 `owner_seller` — id 는 seller_db 의 판매자 id 를 그대로 쓴다 */
@Entity
@Table(name = "owner_seller")
class OwnerSellerJpaEntity(
    @Id
    @Column(name = "seller_id")
    val sellerId: Long,
    memberId: String,
    status: OwnerSellerStatus,
    occurredAt: Instant,
) {
    @Column(name = "member_id", nullable = false, length = 64)
    var memberId: String = memberId
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OwnerSellerStatus = status
        private set

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant = occurredAt
        private set

    fun update(seller: OwnerSeller) {
        memberId = seller.memberId
        status = seller.status
        occurredAt = seller.occurredAt
    }

    fun toDomain() = OwnerSeller(sellerId, memberId, status, occurredAt)

    companion object {
        fun fromDomain(seller: OwnerSeller) = OwnerSellerJpaEntity(seller.sellerId, seller.memberId, seller.status, seller.occurredAt)
    }
}
