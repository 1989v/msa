package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.infrastructure.persistence.entity.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.domain.Pageable

interface CafeStoreSnapshotJpaRepository : JpaRepository<CafeStoreSnapshotJpaEntity, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CafeStoreSnapshotJpaEntity s where s.id = 1")
    fun lockCurrent(): CafeStoreSnapshotJpaEntity?
}
interface CafeStoreAreaJpaRepository : JpaRepository<CafeStoreAreaJpaEntity, String> {
    fun findByParentCodeOrderByCode(parent: String?): List<CafeStoreAreaJpaEntity>
}
interface CafeStoreJpaRepository : JpaRepository<CafeStoreJpaEntity, String> {
    @Query("select s from CafeStoreJpaEntity s where s.mappingStatus = 'CONFIRMED' and s.missingRounds < 2 and s.latitude between :minLat and :maxLat and s.longitude between :minLng and :maxLng order by s.storeKey")
    fun candidates(minLat: Double, maxLat: Double, minLng: Double, maxLng: Double, pageable: Pageable): List<CafeStoreJpaEntity>
}
