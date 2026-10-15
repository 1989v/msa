package com.kgd.place.domain.market.model

import java.time.LocalDateTime

enum class GeometryRequestKind { BOUNDARY, PATH, ENTRANCE, NOTE }
enum class GeometryRequestStatus { PENDING, APPROVED, REJECTED }
enum class GeometryRequestAction { APPROVE, REJECT }

/** A proposal only: neither submission nor approval changes market geometry or judgement. */
data class MarketGeometryRequest(
    val marketId: Long,
    val stewardId: Long,
    val memberId: Long,
    val kind: GeometryRequestKind,
    val geometry: List<List<Double>>?,
    val description: String,
    val status: GeometryRequestStatus = GeometryRequestStatus.PENDING,
    val decidedByMemberId: Long? = null,
    val decidedAt: LocalDateTime? = null,
    val decisionReason: String? = null,
    val appliedChangeLogId: Long? = null,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(marketId > 0 && stewardId > 0 && memberId > 0)
        require(description.isNotBlank() && description.length <= 5000)
        geometry?.let { points ->
            val minimum = when (kind) { GeometryRequestKind.BOUNDARY -> 3; GeometryRequestKind.PATH -> 2; else -> 1 }
            require(points.size in minimum..2000)
            require(points.all { it.size == 2 && it[0].isFinite() && it[1].isFinite() && it[0] in -90.0..90.0 && it[1] in -180.0..180.0 })
            require(points.distinct().size >= minimum)
            if (kind == GeometryRequestKind.ENTRANCE || kind == GeometryRequestKind.NOTE) require(points.size == 1)
        }
    }

    fun decide(action: GeometryRequestAction, adminId: Long, reason: String, now: LocalDateTime = LocalDateTime.now()): MarketGeometryRequest {
        require(adminId > 0 && reason.isNotBlank() && reason.length <= 2000)
        if (status != GeometryRequestStatus.PENDING) throw GeometryRequestAlreadyDecided()
        return copy(status = if (action == GeometryRequestAction.APPROVE) GeometryRequestStatus.APPROVED else GeometryRequestStatus.REJECTED,
            decidedByMemberId = adminId, decidedAt = now, decisionReason = reason.trim())
    }
}

class GeometryRequestAlreadyDecided : RuntimeException("Geometry request is already decided")
