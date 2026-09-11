package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "attraction_link_requests")
class AttractionLinkRequestJpaEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "attraction_id", nullable = false)
    val attractionId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val source: AttractionLinkSource,

    @Column(name = "view_count", nullable = false)
    val viewCount: Int,

    @Column(name = "requested_at", nullable = false)
    val requestedAt: LocalDateTime,

    @Column(name = "last_attempt_at")
    val lastAttemptAt: LocalDateTime? = null,

    @Column(name = "next_attempt_at")
    val nextAttemptAt: LocalDateTime? = null,
) {
    fun toDomain(): AttractionLinkRequest = AttractionLinkRequest.restore(
        id = id,
        attractionId = attractionId,
        source = source,
        viewCount = viewCount,
        requestedAt = requestedAt,
        lastAttemptAt = lastAttemptAt,
        nextAttemptAt = nextAttemptAt,
    )

    companion object {
        fun fromDomain(request: AttractionLinkRequest) = AttractionLinkRequestJpaEntity(
            id = request.id,
            attractionId = request.attractionId,
            source = request.source,
            viewCount = request.viewCount,
            requestedAt = request.requestedAt,
            lastAttemptAt = request.lastAttemptAt,
            nextAttemptAt = request.nextAttemptAt,
        )
    }
}
