package com.kgd.wishlist.infrastructure.persistence.entity

import com.kgd.wishlist.domain.model.WishlistItem
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(
    name = "wishlist_items",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_member_product", columnNames = ["member_id", "product_id"])
    ]
)
class WishlistItemJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    @Column(name = "product_id", nullable = false)
    val productId: Long,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain(): WishlistItem = WishlistItem.restore(
        id = id,
        memberId = memberId,
        productId = productId,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(item: WishlistItem) = WishlistItemJpaEntity(
            id = item.id,
            memberId = item.memberId,
            productId = item.productId,
            createdAt = item.createdAt
        )
    }
}
