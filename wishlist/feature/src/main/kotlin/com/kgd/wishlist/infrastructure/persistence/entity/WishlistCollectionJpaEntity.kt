package com.kgd.wishlist.infrastructure.persistence.entity

import com.kgd.wishlist.domain.model.WishlistCollection
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(
    name = "wishlist_collection",
    uniqueConstraints = [
        // 같은 이름의 묶음이 둘이면 목록에서 구분할 수 없다
        UniqueConstraint(name = "uk_collection_member_name", columnNames = ["member_id", "name"]),
    ],
)
class WishlistCollectionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    name: String,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(nullable = false, length = 40)
    var name: String = name
        private set

    fun rename(value: String) {
        name = value
    }

    fun toDomain(): WishlistCollection = WishlistCollection.restore(
        id = id,
        memberId = memberId,
        name = name,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(collection: WishlistCollection) = WishlistCollectionJpaEntity(
            id = collection.id,
            memberId = collection.memberId,
            name = collection.name,
            createdAt = collection.createdAt,
        )
    }
}
