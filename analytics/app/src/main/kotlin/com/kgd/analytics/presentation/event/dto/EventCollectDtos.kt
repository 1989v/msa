package com.kgd.analytics.presentation.event.dto

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import com.kgd.common.analytics.Placement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

/**
 * 화면이 보내는 이벤트 묶음 (ADR-0095).
 *
 * **묶어서 받는다.** 목록 한 화면이 카드 20장이면 노출도 20건이다 — 건당 요청이면
 * 사용자 브라우저와 서버 양쪽이 낭비다.
 */
data class CollectEventsRequest(
    @field:Valid
    @field:Size(min = 1, max = MAX_BATCH, message = "한 번에 1~$MAX_BATCH 건까지 보낼 수 있습니다")
    val events: List<CollectEventItem>,
    /**
     * beacon 은 헤더를 못 실어 본문에 같이 온다 — `X-Session-Id` 헤더가 없을 때만 쓴다.
     * `visitorId` 는 받지 않는다: 게이트웨이가 헤더를 항상 덮어써 본문 값은 도달 불가다.
     * 모르는 키는 Jackson 기본값대로 무시한다 — 거절하면 pagehide 전송 전부가 400 이 된다.
     */
    @field:Size(max = 128)
    val sessionId: String? = null,
) {
    companion object {
        /** 브라우저가 한 번에 보낼 수 있는 상한. 넘치면 FE 가 나눠 보낸다. */
        const val MAX_BATCH = 100
    }
}

data class CollectEventItem(
    @field:NotNull val entityType: EntityType?,
    @field:NotBlank val entityId: String?,
    @field:NotNull val action: EventAction?,
    val screenType: String? = null,
    val screenRef: String? = null,
    val sectionId: String? = null,
    val sectionIndex: Int? = null,
    val itemIndex: Int? = null,
    val viewId: String? = null,
    /** 밀리초. 브라우저가 이탈 직전에 모아 보내므로 **발생 시각을 화면이 준다.** */
    val occurredAt: Long? = null,
    /**
     * 대상별 부가 값. **값이 null 인 키를 받아 준다** — 화면은 「없음」을 null 로 적는 것이 자연스러운데
     * `Map<String, Any>` 로 받으면 Jackson 이 본문을 통째로 거절하고(400 `요청 본문을 읽을 수 없습니다`)
     * 계측은 조용히 사라진다. 실제로 통합 검색의 `understoodType: null` 이 그렇게 버려졌다(2026-09-20).
     * 저장할 때 null 키는 버린다 — JSON 에서 「값이 null」과 「키가 없다」는 같은 뜻이다.
     */
    val payload: Map<String, Any?>? = null,
) {
    /**
     * `eventId` 를 서버가 만들지 않고 **(viewId, entityType, entityId, sectionId, action) 으로 짓는 이유**:
     * 같은 노출이 재전송(재시도·중복 beacon)으로 두 번 와도 같은 id 가 되어 원장에서 가려낼 수
     * 있다. 서버에서 UUID 를 새로 만들면 재전송이 전부 다른 행이 되어 CTR 분모가 부푼다.
     * 섹션이 키에 들어가는 이유: 같은 관광지의 카드 선택·지도 열기·찜은 섹션이 달라 다른 행이다.
     */
    fun toEvent(visitorId: String, sessionId: String, userId: Long?): AnalyticsEvent {
        val view = viewId.orEmpty()
        val eventId = if (view.isBlank()) UUID.randomUUID().toString()
        else "$view:${entityType!!.name}:$entityId:${sectionId.orEmpty()}:${action!!.name}"
        return AnalyticsEvent(
            eventId = eventId,
            entityType = entityType!!,
            entityId = entityId!!,
            action = action!!,
            placement = screenType?.takeIf { it.isNotBlank() }?.let {
                Placement(
                    screenType = it,
                    screenRef = screenRef.orEmpty(),
                    sectionId = sectionId.orEmpty(),
                    sectionIndex = sectionIndex,
                    itemIndex = itemIndex,
                )
            },
            viewId = view,
            userId = userId,
            visitorId = visitorId,
            sessionId = sessionId,
            timestamp = occurredAt?.let(Instant::ofEpochMilli) ?: Instant.now(),
            experimentAssignments = null,
            payload = payload.orEmpty().filterValues { it != null }.mapValues { it.value!! },
        )
    }
}

data class CollectEventsResponse(val accepted: Int)
