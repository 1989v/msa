package com.kgd.game.application.ads.port

import com.kgd.game.domain.ads.model.AdPlacement
import com.kgd.game.domain.ads.model.AdPolicy
import com.kgd.game.domain.ads.model.AdType
import com.kgd.game.domain.ads.model.RewardGrant
import java.time.Duration

interface AdPlacementRepositoryPort {
    fun findByKey(placementKey: String): AdPlacement?
}

interface AdPolicyRepositoryPort {
    fun findByType(adType: AdType): AdPolicy?
}

interface RewardGrantRepositoryPort {
    fun findByIdempotencyKey(idempotencyKey: String): RewardGrant?
    fun save(grant: RewardGrant): RewardGrant
}

/** frequency cap 판정 — Redis TTL 카운터. 정책 값의 SSOT 는 ad_policy 테이블 */
interface AdFrequencyPort {
    /** minInterval 안에 이미 노출됐으면 false */
    fun tryAcquire(placementKey: String, subject: String, minInterval: Duration): Boolean
}
