package com.kgd.ranking.infrastructure.persistence.repository
import com.kgd.ranking.infrastructure.persistence.entity.RankingAdminRecord
import org.springframework.data.jpa.repository.JpaRepository
interface RankingAdminRecordRepository : JpaRepository<RankingAdminRecord, String> {
    fun findByKind(kind: String): List<RankingAdminRecord>
}
