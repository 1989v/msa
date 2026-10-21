package com.kgd.ranking.application.cafe.port

import com.kgd.ranking.application.cafe.dto.*

interface CafeStoreRepositoryPort {
    fun metadata(): CafeSnapshotMeta?
    fun areas(parent: String?): List<CafeArea>
    fun area(code: String): CafeArea?
    fun candidates(minLat: Double, maxLat: Double, minLng: Double, maxLng: Double, limit: Int): List<CafeStoreRecord>
    /** All writes plus active pointer switch share one ranking transaction. */
    fun replace(snapshot: CafeStoreSnapshot): Int
}
