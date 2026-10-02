package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.application.attraction.service.SearchAttractionService
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.application.unified.port.UnifiedSearchPort
import com.kgd.search.application.unified.service.SearchUnifiedService
import com.kgd.search.application.unified.usecase.SearchUnifiedUseCase
import com.kgd.search.domain.query.model.QueryIntent
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.mockk
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * 통합 검색이 관광지 묶음을 위해 내는 OpenSearch 요청 JSON — 통합 서비스 → 관광지 서비스 → 어댑터를 실제로 잇고
 * OpenSearch 클라이언트만 가짜다. 행사 조건을 넣기 전 커밋에서 뜬 결과가 `attraction-search-baseline-event/unified-attraction.json`.
 */
object UnifiedAttractionRequests {

    /** 2026-10-07 02:00 KST (수요일) — UTC 로는 10-06 이라 날짜를 UTC 로 세면 하루 어긋난다. */
    val CLOCK: Clock = Clock.fixed(Instant.parse("2026-10-06T17:00:00Z"), ZoneOffset.UTC)

    /** 한 글자 검색어 — 오타 교정은 두 글자부터라 가짜 클라이언트에 count 를 묻지 않는다. */
    const val Q = "탑"

    fun request(q: String = Q): String {
        val (adapter, captured) = AttractionSearchRequestSnapshots.adapter()
        val lexicon = object : CategoryLexiconPort {
            override fun lexicon(lang: String?) = QueryIntent.Lexicon.EMPTY
        }
        val attraction = SearchAttractionService(
            adapter,
            mockk<ResolveQueryVectorUseCase>(relaxed = true),
            lexicon,
            AttractionHybridProperties(enabled = false),
            QueryVectorProperties(modelRef = AttractionSearchBaselineQueries.MODEL_REF),
            SimpleMeterRegistry(),
            CLOCK,
        )
        val others = mockk<UnifiedSearchPort>(relaxed = true)
        SearchUnifiedService(attraction, others, lexicon)
            .execute(SearchUnifiedUseCase.Query(q = q, type = QueryIntent.Types.ATTRACTION))
        return captured.main.single().toJsonString()
    }
}
