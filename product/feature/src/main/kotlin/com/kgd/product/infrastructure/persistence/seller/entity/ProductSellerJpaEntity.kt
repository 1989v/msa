package com.kgd.product.infrastructure.persistence.seller.entity

import com.kgd.product.domain.seller.model.ProductSeller
import com.kgd.product.domain.seller.model.ProductSellerStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 판매자 읽기 모델 `product_seller` — id 는 seller_db 의 판매자 id 를 그대로 쓴다(생성하지 않는다) */
@Entity
@Table(name = "product_seller")
class ProductSellerJpaEntity(
    @Id
    @Column(name = "seller_id")
    val sellerId: Long,
    memberId: String,
    status: ProductSellerStatus,
    occurredAt: Instant,
) {
    @Column(name = "member_id", nullable = false, length = 64)
    var memberId: String = memberId
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ProductSellerStatus = status
        private set

    @Column(name = "occurred_at", nullable = false)
    var occurredAt: Instant = occurredAt
        private set

    /** 전체 동기화 — 이벤트가 가진 상태로 덮어쓴다 (entity-mutation.md) */
    fun update(seller: ProductSeller) {
        memberId = seller.memberId
        status = seller.status
        occurredAt = seller.occurredAt
    }

    fun toDomain() = ProductSeller(sellerId, memberId, status, occurredAt)

    companion object {
        fun fromDomain(seller: ProductSeller) =
            ProductSellerJpaEntity(seller.sellerId, seller.memberId, seller.status, seller.occurredAt)
    }
}
