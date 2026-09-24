package com.kgd.ads.application.placement.usecase

import com.kgd.ads.application.placement.dto.PlacementView
import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.domain.placement.model.PlacementFormat

/** 운영자의 지면 등록부 관리. 변경은 다음 인덱스 갱신(1분 안)에 결정에 반영된다. */
interface ManagePlacementUseCase {
    fun list(): List<PlacementView>
    fun create(command: Create): PlacementView
    fun update(command: Update): PlacementView
    fun unregistered(): List<UnregisteredPlacementView>

    data class Create(
        val key: String,
        val host: String,
        val format: PlacementFormat,
        val aspectRatios: List<String>,
        val floorMicros: Long,
        val active: Boolean,
        val paidAllowed: Boolean,
        val description: String,
        val actorMemberId: Long,
    )

    /** null 인 값은 바꾸지 않는다. */
    data class Update(
        val key: String,
        val floorMicros: Long?,
        val active: Boolean?,
        val paidAllowed: Boolean?,
        val description: String?,
        val actorMemberId: Long,
    )
}
