package com.kgd.ads.infrastructure.persistence.advertiser.adapter

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.infrastructure.persistence.advertiser.entity.AdvertiserJpaEntity
import com.kgd.ads.infrastructure.persistence.advertiser.repository.AdvertiserJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class AdvertiserRepositoryAdapter(
    private val repository: AdvertiserJpaRepository,
) : AdvertiserPort {

    override fun findByMemberId(memberId: Long): Advertiser? = repository.findByMemberId(memberId)?.toDomain()

    override fun save(advertiser: Advertiser, now: LocalDateTime): Advertiser {
        require(advertiser.id == null) { "기존 광고주 갱신은 아직 지원하지 않습니다" }
        return repository.save(AdvertiserJpaEntity.newOf(advertiser, now)).toDomain()
    }
}
