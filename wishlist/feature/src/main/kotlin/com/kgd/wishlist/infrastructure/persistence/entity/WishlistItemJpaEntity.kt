package com.kgd.wishlist.infrastructure.persistence.entity

import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(
    name = "wishlist_items",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_member_target", columnNames = ["member_id", "target_type", "target_key"])
    ]
)
class WishlistItemJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    /**
     * 소속 묶음 (ADR-0080). NULL = 미분류 — '기본' 묶음 행을 만들지 않는다.
     *
     * FK 는 ON DELETE SET NULL 이다: 묶음을 지워도 찜은 남는다. 묶음을 없애는 것과
     * 장소를 버리는 것은 다른 일이다.
     */
    @Column(name = "collection_id")
    var collectionId: Long? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 30)
    val targetType: WishlistTargetType,
    // 대상 서비스의 식별자를 담는 불투명 키 — FK/조인 없음 (ADR-0074 §1)
    @Column(name = "target_key", nullable = false, length = 120)
    val targetKey: String,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain(): WishlistItem = WishlistItem.restore(
        id = id,
        memberId = memberId,
        collectionId = collectionId,
        targetType = targetType,
        targetKey = targetKey,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(item: WishlistItem) = WishlistItemJpaEntity(
            id = item.id,
            memberId = item.memberId,
            collectionId = item.collectionId,
            targetType = item.targetType,
            targetKey = item.targetKey,
            createdAt = item.createdAt
        )
    }
}
