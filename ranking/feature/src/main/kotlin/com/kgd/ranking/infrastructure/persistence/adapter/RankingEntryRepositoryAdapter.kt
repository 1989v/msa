package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.ranking.port.RankingEntryRepositoryPort
import com.kgd.ranking.domain.model.RankingEntry
import com.kgd.ranking.infrastructure.persistence.entity.RankingEntryJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.RankingEntryJpaRepository
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * 순위 줄의 [RankingEntry.payload] 는 DB 에 JSON 문자열로 있다. 직렬화·역직렬화는 여기서만 한다 —
 * 서비스가 ObjectMapper 를 쥐면 저장 형식이 application 으로 샌다.
 */
@Component
class RankingEntryRepositoryAdapter(
    private val jpaRepository: RankingEntryJpaRepository,
    private val objectMapper: ObjectMapper,
) : RankingEntryRepositoryPort {

    override fun findBySnapshotId(snapshotId: Long): List<RankingEntry> =
        jpaRepository.findBySnapshotIdOrderByRankNoAsc(snapshotId).map { it.toDomain(readPayload(it.payload)) }

    override fun countBySnapshotId(snapshotId: Long): Int = jpaRepository.countBySnapshotId(snapshotId).toInt()

    override fun saveAll(snapshotId: Long, entries: List<RankingEntry>) {
        jpaRepository.saveAll(
            entries.map { RankingEntryJpaEntity.fromDomain(snapshotId, it, objectMapper.writeValueAsString(it.payload)) },
        )
    }

    override fun deleteBySnapshotIdIn(snapshotIds: Collection<Long>) {
        jpaRepository.deleteBySnapshotIdIn(snapshotIds)
    }

    private fun readPayload(json: String?): Map<String, Any?> = json?.let {
        @Suppress("UNCHECKED_CAST")
        objectMapper.readValue(it, Map::class.java) as Map<String, Any?>
    } ?: emptyMap()
}
