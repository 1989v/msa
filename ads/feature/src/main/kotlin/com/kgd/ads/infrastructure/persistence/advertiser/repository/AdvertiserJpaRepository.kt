package com.kgd.ads.infrastructure.persistence.advertiser.repository

import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.infrastructure.persistence.advertiser.entity.AdvertiserJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface AdvertiserJpaRepository : JpaRepository<AdvertiserJpaEntity, Long> {
    fun findByMemberId(memberId: Long): AdvertiserJpaEntity?
    fun findFirstByKindOrderByIdAsc(kind: AdvertiserKind): AdvertiserJpaEntity?
}
