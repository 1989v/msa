package com.kgd.ranking.application.admin.port

import com.kgd.ranking.application.admin.dto.*
import com.kgd.ranking.domain.cafe.model.CafeDrink
import java.time.Instant

/** The adapter owns serialization, DB transactions and shared brand locks. */
interface RankingAdminPort {
    fun <T : Any> atomic(brands: List<String> = emptyList(), action: () -> T): T
    fun validateSourceKeys(rows: List<CafeDrink>)
    fun project(key: String, value: CafeDrink?)
    fun sourceDrinks(): List<CafeDrink>
    fun corrections(): List<DrinkCorrections>
    fun save(value: DrinkCorrections)
    fun brands(): List<BrandVerification>
    fun save(value: BrandVerification)
    fun operation(id: String): AdminOperation?
    fun save(value: AdminOperation)
    fun audits(): List<AuditEvent>
    fun save(value: AuditEvent)
    fun preview(id: String): GroupPreview?
    fun save(value: GroupPreview)
    fun runs(): List<IngestRun>
    fun save(value: IngestRun)
    fun gasBoards(): List<Map<String, Any?>>
    fun gasSnapshots(boardId: Long): List<Map<String, Any?>>
    fun gasSnapshot(snapshotId: Long): Map<String, Any?>?
    fun purgeAudits(before: Instant): Int
}
