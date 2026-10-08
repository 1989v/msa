package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.FindContentUpdatedAttractionsUseCase
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime

/**
 * 본문이 바뀐 관광지 목록 — IndexNow 제출 잡(place-ingest)이 읽는다.
 * `/internal/attractions` 아래 다른 경로와 같이 게이트웨이가 라우팅하지 않아 클러스터 밖에서 닿지 않는다.
 * 시각은 ISO `LocalDateTime`(서울 시각, 오프셋 없음) — 저장된 본문 변경 시각과 같은 기준이다.
 */
@RestController
@RequestMapping("/internal/attractions")
class AttractionContentUpdatedInternalController(
    private val findContentUpdated: FindContentUpdatedAttractionsUseCase,
) {

    @GetMapping("/content-updated")
    fun contentUpdated(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) since: LocalDateTime,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) until: LocalDateTime,
        @RequestParam afterId: Long,
        @RequestParam size: Int,
    ): ApiResponse<FindContentUpdatedAttractionsUseCase.Result> =
        ApiResponse.success(findContentUpdated.find(FindContentUpdatedAttractionsUseCase.Query(since, until, afterId, size)))
}
