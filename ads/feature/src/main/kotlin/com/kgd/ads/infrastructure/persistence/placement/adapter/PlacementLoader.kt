package com.kgd.ads.infrastructure.persistence.placement.adapter

import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.infrastructure.persistence.placement.entity.PlacementFormatJpaEntity
import com.kgd.ads.infrastructure.persistence.placement.entity.PlacementJpaEntity
import com.kgd.ads.infrastructure.persistence.placement.repository.PlacementFormatJpaRepository
import com.kgd.ads.infrastructure.persistence.placement.repository.PlacementJpaRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import java.time.LocalDateTime

/**
 * 지면 행과 형태 규격 행을 함께 읽고 쓴다 — 어드민 경로([PlacementRepositoryAdapter])와 후보 인덱스 경로가
 * 같은 조립을 써야 한 지면이 두 곳에서 다른 규격으로 보이지 않는다. 규격은 지면 여러 개를 한 번에 읽는다.
 */
@Component
class PlacementLoader(
    private val placementRepository: PlacementJpaRepository,
    private val formatRepository: PlacementFormatJpaRepository,
) {
    fun findAll(): List<AdPlacement> = assemble(placementRepository.findAll(), ::rethrow)

    fun findByKeys(keys: Collection<String>): List<AdPlacement> =
        if (keys.isEmpty()) emptyList() else assemble(placementRepository.findAllById(keys), ::rethrow)

    fun findByKey(key: String): AdPlacement? = placementRepository.findByIdOrNull(key)?.let { assemble(listOf(it), ::rethrow).single() }

    /** 활성 지면. 불변식을 어긴 지면(규격 없음 등)은 [onInvalid] 에 넘기고 빼서, 한 지면 때문에 전체가 실패하지 않게 한다. */
    fun findActive(onInvalid: (placementKey: String, error: RuntimeException) -> Unit): List<AdPlacement> =
        assemble(placementRepository.findAllByActiveTrue(), onInvalid)

    /**
     * 지면 행(옛 컬럼에는 대표 규격)과 형태 규격 행을 도메인 값으로 맞춘다 — 빠진 규격은 지우고 나머지는 덮어쓴다.
     * 부모 행의 `updated_at` 과 같은 트랜잭션에서 부른다.
     */
    fun save(placement: AdPlacement, createdAt: LocalDateTime, now: LocalDateTime) {
        placementRepository.save(PlacementJpaEntity.of(placement, createdAt, now))
        val current = formatRepository.findAllByPlacementKey(placement.key)
        formatRepository.deleteAll(current.filter { row -> placement.spec(row.format) == null })
        placement.formats.forEach { formatRepository.save(PlacementFormatJpaEntity.of(placement.key, it)) }
    }

    private fun assemble(
        rows: List<PlacementJpaEntity>,
        onInvalid: (String, RuntimeException) -> Unit,
    ): List<AdPlacement> {
        if (rows.isEmpty()) return emptyList()
        val specs = formatRepository.findAllByPlacementKeyIn(rows.map { it.placementKey }).groupBy { it.placementKey }
        return rows.mapNotNull { row ->
            try {
                row.toDomain(specs[row.placementKey].orEmpty().map { it.toDomain() })
            } catch (e: RuntimeException) {
                onInvalid(row.placementKey, e)
                null
            }
        }
    }

    private fun rethrow(@Suppress("UNUSED_PARAMETER") placementKey: String, error: RuntimeException): Nothing = throw error
}
