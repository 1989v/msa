package com.kgd.game.infrastructure.persistence.ads.adapter

import com.kgd.game.application.ads.port.AdFrequencyPort
import com.kgd.game.application.ads.port.AdPlacementRepositoryPort
import com.kgd.game.application.ads.port.AdPolicyRepositoryPort
import com.kgd.game.application.ads.port.RewardGrantRepositoryPort
import com.kgd.game.domain.ads.model.AdPlacement
import com.kgd.game.domain.ads.model.AdPolicy
import com.kgd.game.domain.ads.model.AdType
import com.kgd.game.domain.ads.model.RewardGrant
import com.kgd.game.infrastructure.persistence.ads.entity.AdPlacementJpaEntity
import com.kgd.game.infrastructure.persistence.ads.entity.AdPolicyJpaEntity
import com.kgd.game.infrastructure.persistence.ads.entity.RewardGrantJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import java.time.Duration

interface AdPlacementJpaRepository : JpaRepository<AdPlacementJpaEntity, Long> {
    fun findByPlacementKey(placementKey: String): AdPlacementJpaEntity?
}

interface AdPolicyJpaRepository : JpaRepository<AdPolicyJpaEntity, Long> {
    fun findByAdType(adType: AdType): AdPolicyJpaEntity?
}

interface RewardGrantJpaRepository : JpaRepository<RewardGrantJpaEntity, Long> {
    fun findByIdempotencyKey(idempotencyKey: String): RewardGrantJpaEntity?
}

@Repository
class AdPlacementRepositoryAdapter(
    private val jpaRepository: AdPlacementJpaRepository,
) : AdPlacementRepositoryPort {
    override fun findByKey(placementKey: String): AdPlacement? =
        jpaRepository.findByPlacementKey(placementKey)?.toDomain()
}

@Repository
class AdPolicyRepositoryAdapter(
    private val jpaRepository: AdPolicyJpaRepository,
) : AdPolicyRepositoryPort {
    override fun findByType(adType: AdType): AdPolicy? = jpaRepository.findByAdType(adType)?.toDomain()
}

@Repository
class RewardGrantRepositoryAdapter(
    private val jpaRepository: RewardGrantJpaRepository,
) : RewardGrantRepositoryPort {

    override fun findByIdempotencyKey(idempotencyKey: String): RewardGrant? =
        jpaRepository.findByIdempotencyKey(idempotencyKey)?.toDomain()

    override fun save(grant: RewardGrant): RewardGrant {
        val id = grant.id
        val entity = if (id != null) {
            val existing = jpaRepository.findById(id).orElseThrow()
            existing.update(grant)
            existing
        } else {
            jpaRepository.save(RewardGrantJpaEntity.fromDomain(grant))
        }
        return entity.toDomain()
    }
}

/** Redis SETNX + TTL — minInterval 창 안의 재노출을 차단 */
@Component
class RedisAdFrequencyStore(
    private val redis: StringRedisTemplate,
) : AdFrequencyPort {

    override fun tryAcquire(placementKey: String, subject: String, minInterval: Duration): Boolean {
        if (minInterval.isZero) return true
        val key = "game:ads:freq:$placementKey:$subject"
        return redis.opsForValue().setIfAbsent(key, "1", minInterval) == true
    }
}
