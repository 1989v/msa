package com.kgd.ranking.infrastructure.persistence.entity

import jakarta.persistence.*
import java.time.Instant

/** Separate from disposable source rows; no source FK/cascade. Payloads are versioned Kotlin contracts. */
@Entity
@Table(name = "ranking_admin_record")
class RankingAdminRecord(
    @Id @Column(length = 100) val id: String,
    @Column(nullable = false, length = 24) val kind: String,
    payload: String,
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now(),
) {
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    var payload: String = payload
        private set
    fun replace(payload: String) { this.payload = payload; updatedAt = Instant.now() }
}
