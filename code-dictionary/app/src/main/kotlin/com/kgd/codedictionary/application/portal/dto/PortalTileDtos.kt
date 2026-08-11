package com.kgd.codedictionary.application.portal.dto

import com.kgd.codedictionary.domain.portal.model.PortalTile
import com.kgd.codedictionary.domain.portal.model.TileStatus

data class PortalTileDto(
    val id: Long?,
    val code: String,
    val label: String,
    val tagline: String?,
    val href: String?,
    val status: TileStatus,
    val orderNo: Int,
) {
    companion object {
        fun from(tile: PortalTile) = PortalTileDto(
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

data class PortalTileUpsertRequest(
    val id: Long? = null,
    val code: String,
    val label: String,
    val tagline: String? = null,
    val href: String? = null,
    val status: TileStatus = TileStatus.SOON,
    val orderNo: Int = 0,
) {
    fun toDomain() = PortalTile(
        id = id,
        code = code.trim(),
        label = label.trim(),
        tagline = tagline?.trim()?.ifBlank { null },
        href = href?.trim()?.ifBlank { null },
        status = status,
        orderNo = orderNo,
    )
}
