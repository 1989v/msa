package com.kgd.ads.infrastructure.persistence.placement.adapter

import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.application.placement.port.PlacementPort
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.infrastructure.persistence.placement.entity.PlacementJpaEntity
import com.kgd.ads.infrastructure.persistence.placement.repository.PlacementJpaRepository
import com.kgd.ads.infrastructure.persistence.support.NativeRows
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.repository.findByIdOrNull
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class PlacementRepositoryAdapter(
    private val repository: PlacementJpaRepository,
    @Qualifier("adsEntityManagerFactory") emf: EntityManagerFactory,
) : PlacementPort {

    private val em: EntityManager = SharedEntityManagerCreator.createSharedEntityManager(emf)

    override fun findAll(): List<AdPlacement> = repository.findAll().map { it.toDomain() }

    override fun findByKeys(keys: Collection<String>): List<AdPlacement> =
        if (keys.isEmpty()) emptyList() else repository.findAllById(keys).map { it.toDomain() }

    override fun findByKey(key: String): AdPlacement? = repository.findByIdOrNull(key)?.toDomain()

    override fun create(placement: AdPlacement, now: LocalDateTime): Boolean {
        if (repository.existsById(placement.key)) return false
        repository.save(PlacementJpaEntity.of(placement, now, now))
        return true
    }

    override fun update(placement: AdPlacement, now: LocalDateTime) {
        val existing = repository.findByIdOrNull(placement.key) ?: error("지면 없음: ${placement.key}")
        repository.save(PlacementJpaEntity.of(placement, existing.createdAt, now))
    }

    override fun findUnregistered(): List<UnregisteredPlacementView> =
        em.createNativeQuery(
            "SELECT placement_key, requests, first_seen_at, last_seen_at FROM ad_unregistered_placement ORDER BY requests DESC, placement_key",
        ).resultList.map {
            val r = it as Array<*>
            UnregisteredPlacementView(r[0] as String, NativeRows.long(r[1]), NativeRows.dateTime(r[2]), NativeRows.dateTime(r[3]))
        }

    override fun sumRequests(from: LocalDateTime, until: LocalDateTime): Map<String, Long> =
        em.createNativeQuery(
            "SELECT placement_key, SUM(requests) FROM ad_placement_hourly WHERE hour_kst >= :from AND hour_kst < :until GROUP BY placement_key",
        )
            .setParameter("from", from)
            .setParameter("until", until)
            .resultList.associate {
                val r = it as Array<*>
                (r[0] as String) to NativeRows.long(r[1])
            }
}
