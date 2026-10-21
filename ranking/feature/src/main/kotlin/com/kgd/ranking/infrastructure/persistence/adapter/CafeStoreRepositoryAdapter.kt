package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.CafeStoreRepositoryPort
import com.kgd.ranking.infrastructure.persistence.entity.*
import com.kgd.ranking.infrastructure.persistence.repository.*
import tools.jackson.databind.ObjectMapper
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class CafeStoreRepositoryAdapter(
    private val snapshots: CafeStoreSnapshotJpaRepository, private val stores: CafeStoreJpaRepository,
    private val areaRepository: CafeStoreAreaJpaRepository, private val mapper: ObjectMapper,
) : CafeStoreRepositoryPort {
    override fun metadata() = snapshots.findById(1).orElse(null)?.let { CafeSnapshotMeta(it.version, it.sourceAsOf, it.fetchedAt, it.projectionAsOf, it.mappingRuleVersion) }
    private fun area(e: CafeStoreAreaJpaEntity) = CafeArea(e.code, e.name, e.level, e.parentCode, e.latitude, e.longitude, e.centerSource, sourceAsOf = e.sourceAsOf)
    override fun areas(parent: String?) = areaRepository.findByParentCodeOrderByCode(parent).map(::area)
    override fun area(code: String) = areaRepository.findById(code).orElse(null)?.let(::area)
    @Suppress("UNCHECKED_CAST")
    private fun record(e: CafeStoreJpaEntity) = CafeStoreRecord(e.storeKey, e.brandSlug, e.brandName, e.storeName, e.branchName, e.address, e.latitude, e.longitude, e.areaCode, e.mappingStatus, mapper.readValue(e.rawJson, Map::class.java) as Map<String, Any?>, e.missingRounds)
    override fun candidates(minLat: Double, maxLat: Double, minLng: Double, maxLng: Double, limit: Int) = stores.candidates(minLat, maxLat, minLng, maxLng, PageRequest.of(0, limit)).map(::record)
    override fun replace(snapshot: CafeStoreSnapshot): Int {
        // Serialize concurrent batch writers; readers see old or new committed state under MVCC.
        val previous = snapshots.lockCurrent()
        if (previous?.version == snapshot.version) return 0 // retry must not count a missing round twice
        require(previous == null || snapshot.fetchedAt > previous.fetchedAt) { "Out of order snapshot" }
        val old = stores.findAll()
        val previousCount = old.count { it.missingRounds == 0 }
        require(previousCount == 0 || snapshot.stores.size >= previousCount * 0.7 && snapshot.stores.size <= previousCount * 1.5) { "Snapshot shrink requires source investigation" }
        val keys = snapshot.stores.map { it.storeKey }.toSet()
        val missing = old.filter { it.storeKey !in keys }.map { record(it).copy(missingRounds = (it.missingRounds + 1).coerceAtMost(2)) }
        val records = snapshot.stores.map { it.copy(missingRounds = 0) } + missing
        stores.saveAll(records.map { CafeStoreJpaEntity(it.storeKey, it.brandSlug, it.brandName, it.storeName, it.branchName, it.address, it.latitude, it.longitude, it.areaCode, it.mappingStatus, mapper.writeValueAsString(it.raw), it.missingRounds) })
        areaRepository.deleteAllInBatch()
        areaRepository.saveAll(snapshot.areas.map { CafeStoreAreaJpaEntity(it.code, it.name, it.level, it.parentCode, it.latitude, it.longitude, it.centerSource, it.sourceAsOf) })
        stores.flush(); areaRepository.flush()
        snapshots.saveAndFlush(CafeStoreSnapshotJpaEntity(version = snapshot.version, sourceAsOf = snapshot.sourceAsOf, fetchedAt = snapshot.fetchedAt, projectionAsOf = Instant.now(), mappingRuleVersion = snapshot.mappingRuleVersion))
        return snapshot.stores.size
    }
}
