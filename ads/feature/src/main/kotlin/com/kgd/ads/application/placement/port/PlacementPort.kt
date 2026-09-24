package com.kgd.ads.application.placement.port

import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.domain.placement.model.AdPlacement
import java.time.LocalDateTime

interface PlacementPort {
    fun findAll(): List<AdPlacement>
    fun findByKeys(keys: Collection<String>): List<AdPlacement>
    fun findByKey(key: String): AdPlacement?

    /** 새 지면. 같은 키가 있으면 false. */
    fun create(placement: AdPlacement, now: LocalDateTime): Boolean

    /** 최저가·활성·유료 허용·설명을 반영한다. */
    fun update(placement: AdPlacement, now: LocalDateTime)

    fun findUnregistered(): List<UnregisteredPlacementView>

    /** 지면별 [from, until) 시각의 요청 수 합 — 지면 시간별 집계에서. */
    fun sumRequests(from: LocalDateTime, until: LocalDateTime): Map<String, Long>
}
