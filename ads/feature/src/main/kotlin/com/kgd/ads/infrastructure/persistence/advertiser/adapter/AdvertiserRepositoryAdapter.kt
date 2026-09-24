package com.kgd.ads.infrastructure.persistence.advertiser.adapter

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.infrastructure.persistence.advertiser.entity.AdvertiserJpaEntity
import com.kgd.ads.infrastructure.persistence.advertiser.repository.AdvertiserJpaRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class AdvertiserRepositoryAdapter(
    private val repository: AdvertiserJpaRepository,
) : AdvertiserPort {

    override fun findByMemberId(memberId: Long): Advertiser? = repository.findByMemberId(memberId)?.toDomain()

    override fun findById(id: Long): Advertiser? = repository.findByIdOrNull(id)?.toDomain()

    override fun findAll(): List<Advertiser> = repository.findAll().sortedBy { it.id }.map { it.toDomain() }

    override fun findSystem(): Advertiser =
        requireNotNull(repository.findFirstByKindOrderByIdAsc(AdvertiserKind.SYSTEM)) { "SYSTEM 광고주 시드가 없습니다" }.toDomain()

    override fun save(advertiser: Advertiser, now: LocalDateTime): Advertiser {
        require(advertiser.id == null) { "기존 광고주는 updateStatus 로 갱신합니다" }
        return repository.save(AdvertiserJpaEntity.newOf(advertiser, now)).toDomain()
    }

    override fun updateStatus(advertiser: Advertiser, now: LocalDateTime) {
        val entity = repository.findByIdOrNull(requireNotNull(advertiser.id)) ?: error("광고주 없음: ${advertiser.id}")
        entity.applyStatus(advertiser, now)
        repository.save(entity)
    }
}
