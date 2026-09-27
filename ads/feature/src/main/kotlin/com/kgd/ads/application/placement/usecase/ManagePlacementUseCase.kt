package com.kgd.ads.application.placement.usecase

import com.kgd.ads.application.placement.dto.PlacementView
import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.domain.placement.model.PlacementFormat

/**
 * 운영자의 지면 등록부 관리. 변경은 다음 인덱스 갱신(1분 안)에 결정에 반영된다.
 * 형태 규격을 지우거나 최저가를 올리면 그 형태의 유료 캠페인은 이 지면 결정에서 빠지고 시작·재개가 거절된다(타기팅 행은 남는다).
 */
interface ManagePlacementUseCase {
    fun list(): List<PlacementView>
    fun create(command: Create): PlacementView
    fun update(command: Update): PlacementView
    fun addFormat(command: AddFormat): PlacementView
    fun changeFormatFloor(command: ChangeFormatFloor): PlacementView
    fun removeFormat(command: RemoveFormat): PlacementView
    fun unregistered(): List<UnregisteredPlacementView>

    data class FormatSpecInput(val format: PlacementFormat, val aspectRatios: List<String>, val floorMicros: Long)

    data class Create(
        val key: String,
        val host: String,
        val formats: List<FormatSpecInput>,
        val active: Boolean,
        val paidAllowed: Boolean,
        val description: String,
        val actorMemberId: Long,
    )

    /**
     * null 인 값은 바꾸지 않는다. [floorMicros] 는 형태 규격 이전 화면의 요청 모양이라 대표 규격(카드가 있으면 카드)에 적용한다.
     */
    data class Update(
        val key: String,
        val floorMicros: Long?,
        val active: Boolean?,
        val paidAllowed: Boolean?,
        val description: String?,
        val actorMemberId: Long,
    )

    data class AddFormat(val key: String, val spec: FormatSpecInput, val actorMemberId: Long)

    data class ChangeFormatFloor(val key: String, val format: PlacementFormat, val floorMicros: Long, val actorMemberId: Long)

    /** 마지막 규격은 지울 수 없다. */
    data class RemoveFormat(val key: String, val format: PlacementFormat, val actorMemberId: Long)
}
