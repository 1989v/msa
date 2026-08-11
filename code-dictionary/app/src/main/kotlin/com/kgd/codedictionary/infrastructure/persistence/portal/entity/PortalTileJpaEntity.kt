package com.kgd.codedictionary.infrastructure.persistence.portal.entity

import com.kgd.codedictionary.domain.portal.model.PortalTile
import com.kgd.codedictionary.domain.portal.model.TileStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "portal_tile")
class PortalTileJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 40, unique = true)
    val code: String = "",

    label: String = "",
    tagline: String? = null,
    href: String? = null,
    status: TileStatus = TileStatus.SOON,
    orderNo: Int = 0,
) {
    @Column(nullable = false, length = 80)
    var label: String = label
        private set

    @Column(length = 200)
    var tagline: String? = tagline
        private set

    @Column(length = 300)
    var href: String? = href
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: TileStatus = status
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    fun update(tile: PortalTile) {
        label = tile.label
        tagline = tile.tagline
        href = tile.href
        status = tile.status
        orderNo = tile.orderNo
    }

    fun toDomain() = PortalTile(
        id = id,
        code = code,
        label = label,
        tagline = tagline,
        href = href,
        status = status,
        orderNo = orderNo,
    )

    companion object {
        fun fromDomain(tile: PortalTile) = PortalTileJpaEntity(
            id = tile.id,
            code = tile.code,
            label = tile.label,
            tagline = tile.tagline,
            href = tile.href,
            status = tile.status,
            orderNo = tile.orderNo,
        )
    }
}
