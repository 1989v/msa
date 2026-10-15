package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.*
import jakarta.persistence.*
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDateTime

@Entity
@Table(name = "market_geometry_request")
class MarketGeometryRequestJpaEntity(
    @Column(name = "market_id", nullable = false) val marketId: Long,
    @Column(name = "steward_id", nullable = false) val stewardId: Long,
    @Column(name = "member_id", nullable = false) val memberId: Long,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, columnDefinition = "varchar(20)") val kind: GeometryRequestKind,
    @Column(columnDefinition = "json") val geometry: String?,
    @Column(nullable = false, columnDefinition = "text") val description: String,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, columnDefinition = "varchar(20)") val status: GeometryRequestStatus,
    @Column(name = "decided_by_member_id") val decidedByMemberId: Long?,
    @Column(name = "decided_at") val decidedAt: LocalDateTime?,
    @Column(name = "decision_reason", columnDefinition = "text") val decisionReason: String?,
    @Column(name = "applied_change_log_id") val appliedChangeLogId: Long?,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false) val createdAt: LocalDateTime,
) {
    fun toDomain() = MarketGeometryRequest(marketId, stewardId, memberId, kind, geometry?.let { raw ->
        val array = json.readTree(raw)
        (0 until array.size()).map { index -> listOf(array[index][0].asDouble(), array[index][1].asDouble()) }
    }, description, status,
        decidedByMemberId, decidedAt, decisionReason, appliedChangeLogId, id, createdAt)
    companion object {
        private val json = JsonMapper.builder().build()
        fun fromDomain(row: MarketGeometryRequest) = MarketGeometryRequestJpaEntity(row.marketId, row.stewardId, row.memberId,
            row.kind, row.geometry?.let { json.writeValueAsString(it) }, row.description, row.status, row.decidedByMemberId, row.decidedAt, row.decisionReason,
            row.appliedChangeLogId, row.id, row.createdAt)
    }
}
