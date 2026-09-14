package com.kgd.analytics.presentation.event.controller

import com.kgd.analytics.presentation.event.dto.CollectEventsRequest
import com.kgd.analytics.presentation.event.dto.CollectEventsResponse
import com.kgd.analytics.application.event.usecase.CollectEventsUseCase
import com.kgd.common.response.ApiResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 화면 이벤트 수집 진입점 (ADR-0095).
 *
 * **이벤트 소유자가 받는다.** 게이트웨이가 바로 Kafka 에 넣으면 홉은 줄지만 게이트웨이가
 * 도메인을 알게 된다.
 *
 * 방문자 식별은 익명 키뿐이다 — 로그인 여부와 무관하게 동작한다 (ADR-0078 최소 식별).
 */
@RestController
@RequestMapping("/api/v1/events")
class EventCollectController(
    private val collectEvents: CollectEventsUseCase,
) {
    /**
     * **202 로 답한다.** 화면은 이 응답을 기다리지 않고, 실패해도 화면이 깨지면 안 된다 —
     * 계측이 기능을 막는 것은 본말전도다.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun collect(
        @Valid @RequestBody request: CollectEventsRequest,
        @RequestHeader(name = VISITOR_HEADER, required = false) visitorHeader: String?,
        @RequestHeader(name = SESSION_HEADER, required = false) sessionHeader: String?,
        servletRequest: HttpServletRequest,
    ): ApiResponse<CollectEventsResponse> {
        val visitorId = visitorHeader?.takeIf { it.isNotBlank() } ?: ANONYMOUS
        val sessionId = sessionHeader?.takeIf { it.isNotBlank() } ?: visitorId
        val userId = servletRequest.getHeader(USER_HEADER)?.toLongOrNull()

        val accepted = collectEvents.collect(
            request.events.map { it.toEvent(visitorId, sessionId, userId) },
        )
        return ApiResponse.success(CollectEventsResponse(accepted))
    }

    companion object {
        /** 게이트웨이가 인증에서 넘겨주는 헤더와 같은 규약. */
        const val USER_HEADER = "X-User-Id"
        const val VISITOR_HEADER = "X-Visitor-Id"
        const val SESSION_HEADER = "X-Session-Id"
        private const val ANONYMOUS = "anonymous"
    }
}
