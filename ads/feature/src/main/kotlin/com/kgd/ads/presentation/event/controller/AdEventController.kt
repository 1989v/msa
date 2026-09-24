package com.kgd.ads.presentation.event.controller

import com.kgd.ads.application.event.usecase.AcceptAdEventsUseCase
import com.kgd.ads.application.event.usecase.RedirectClickUseCase
import com.kgd.ads.presentation.event.dto.EventsRequest
import com.kgd.ads.presentation.event.dto.EventsResponse
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import jakarta.validation.Validator
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import tools.jackson.core.JacksonException
import tools.jackson.databind.json.JsonMapper
import java.net.URI

/**
 * 광고 이벤트 수락과 클릭 리다이렉터. 과금 신원은 게이트웨이가 넣는 `X-Visitor-Id` 만 믿는다.
 */
@RestController
@RequestMapping("/api/v1/ads")
class AdEventController(
    private val acceptEvents: AcceptAdEventsUseCase,
    private val redirectClick: RedirectClickUseCase,
    private val jsonMapper: JsonMapper,
    private val validator: Validator,
) {
    /**
     * 본문은 JSON 이지만 `text/plain` 으로도 받는다 — 화면을 떠날 때 쓰는 `sendBeacon` 은 문자열 본문을
     * `text/plain` 으로 보낸다. 두 형식이 같은 해석·검증을 거치도록 문자열로 받아 여기서 읽는다.
     */
    @PostMapping("/events", consumes = [MediaType.APPLICATION_JSON_VALUE, MediaType.TEXT_PLAIN_VALUE])
    fun accept(
        @RequestBody body: String,
        @RequestHeader(VISITOR_HEADER, required = false) visitorId: String?,
        @RequestHeader(HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ApiResponse<EventsResponse> {
        val request = parse(body)
        return ApiResponse.success(EventsResponse.from(acceptEvents.execute(request.toCommand(visitorId, userAgent))))
    }

    @GetMapping("/click/{clickToken}")
    fun click(
        @PathVariable clickToken: String,
        @RequestHeader(VISITOR_HEADER, required = false) visitorId: String?,
        @RequestHeader(HttpHeaders.USER_AGENT, required = false) userAgent: String?,
    ): ResponseEntity<Void> {
        val location = redirectClick.execute(RedirectClickUseCase.Command(clickToken, visitorId, userAgent))
        return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(location))
            // 302 가 캐시되면 소재 랜딩을 바꾸거나 승인을 거둬도 옛 목적지로 계속 나가고, 클릭이 서버에 닿지 않는다.
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            // 공유·수집된 클릭 주소가 색인되면 광고주 랜딩으로 가는 링크 신호가 된다.
            .header(ROBOTS_HEADER, "noindex, nofollow")
            .build()
    }

    private fun parse(body: String): EventsRequest {
        val request = try {
            jsonMapper.readValue(body, EventsRequest::class.java)
        } catch (e: JacksonException) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "이벤트 본문을 읽을 수 없습니다")
        }
        val violations = validator.validate(request)
        if (violations.isNotEmpty()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, violations.joinToString { "${it.propertyPath}: ${it.message}" })
        }
        return request
    }

    companion object {
        const val VISITOR_HEADER = "X-Visitor-Id"
        const val ROBOTS_HEADER = "X-Robots-Tag"
    }
}
