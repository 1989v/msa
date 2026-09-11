package com.kgd.place.infrastructure.persistence.attraction.entity

import com.kgd.place.domain.attraction.model.AttractionOverviewProbe
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "attraction_overview_probes")
class AttractionOverviewProbeJpaEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "content_id", nullable = false, length = 32)
    val contentId: String,

    @Column(nullable = false, length = 8)
    val lang: String,

    @Column(name = "checked_at", nullable = false)
    val checkedAt: LocalDateTime,
) {
    fun toDomain(): AttractionOverviewProbe = AttractionOverviewProbe.restore(
        id = id,
        contentId = contentId,
        lang = lang,
        checkedAt = checkedAt,
    )

    companion object {
        fun fromDomain(probe: AttractionOverviewProbe) = AttractionOverviewProbeJpaEntity(
            id = probe.id,
            contentId = probe.contentId,
            lang = probe.lang,
            checkedAt = probe.checkedAt,
        )
    }
}
