package com.kgd.analytics.presentation.popularity.controller

import com.kgd.analytics.application.popularity.usecase.AggregateAttractionPopularityUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 관광지 일 집계를 손으로 다시 접는 운영 경로. 표에 컬럼이 늘었을 때(V007) 과거 날짜를 채운다.
 *
 * `/api` 가 아니라 `/internal` 이라 게이트웨이를 거쳐 밖에서 닿지 않는다(게이트웨이는 analytics 로
 * 정해진 `/api/v1` 아래 경로만 보낸다). 스키마 적용과 무관하다 — 기동 때 한 번 도는 마이그레이션을
 * 다시 부르지 않는다.
 *
 *   kubectl -n commerce port-forward deploy/analytics 18090:8090
 *   curl -s -X POST 'http://localhost:18090/internal/attraction-popularity/reaggregate?days=14'
 */
@RestController
@RequestMapping("/internal/attraction-popularity")
class AttractionPopularityInternalController(
    private val aggregateAttractionPopularity: AggregateAttractionPopularityUseCase,
) {

    /** 날짜마다 지우고 넣으므로 다시 불러도 같다. 날짜별 적재 행 수를 돌려준다. */
    @PostMapping("/reaggregate")
    fun reaggregate(@RequestParam(defaultValue = "14") days: Int): ApiResponse<Map<String, Int>> =
        ApiResponse.success(
            aggregateAttractionPopularity.reaggregateRecent(days).mapKeys { (day, _) -> day.toString() },
        )
}
