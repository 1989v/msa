package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.port.AttractionSearchPort
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable

/**
 * 속성 파라미터가 없는 대표 질의. 속성 패싯을 넣기 **전** 커밋에서 이 질의들로 뜬 요청 JSON 이
 * `attraction-search-baseline/{name}.json` 이고, 패싯 테스트가 지금 요청과 바이트 단위로 대조한다.
 * 질의를 바꾸면 기준을 새로 떠야 하므로 여기 항목을 고치지 않는다.
 */
object AttractionSearchBaselineQueries {

    const val MODEL_REF = "microsoft/harrier-oss-v1-270m@abc1234#d640"
    val VECTOR = listOf(0.6f, 0.8f)

    val cases: Map<String, Pair<AttractionSearchPort.SearchQuery, Pageable>> = linkedMapOf(
        "keyword-only" to (AttractionSearchPort.SearchQuery(keyword = "한옥", lang = "ko") to PageRequest.of(0, 20)),
        "keyword-category-region" to (
            AttractionSearchPort.SearchQuery(
                keyword = "바다",
                lang = "ko",
                sidoCode = "51",
                sigunguCode = "51150",
                categories = listOf("nature", "history"),
                facets = mapOf("contentTypeId" to "12"),
            ) to PageRequest.of(1, 20)
        ),
        "browse-geo-distance" to (
            AttractionSearchPort.SearchQuery(
                lang = "ko",
                geo = AttractionSearchPort.GeoFilter(37.5796, 126.977, 5.0, sortByDistance = true),
            ) to PageRequest.of(0, 20)
        ),
        "keyword-geo-radius" to (
            AttractionSearchPort.SearchQuery(
                keyword = "Palace",
                lang = "en",
                geo = AttractionSearchPort.GeoFilter(37.5796, 126.977, 3.0),
            ) to PageRequest.of(0, 20)
        ),
        "hybrid" to (
            AttractionSearchPort.SearchQuery(keyword = "야시장", lang = "ko", sidoCode = "26", embedding = VECTOR)
                to PageRequest.of(0, 20)
        ),
        "vector-only" to (
            AttractionSearchPort.SearchQuery(
                lang = "ko",
                facets = mapOf("lclsSystm3" to "NA040500"),
                embedding = VECTOR,
            ) to PageRequest.of(0, 20)
        ),
        "commerce-intent" to (
            AttractionSearchPort.SearchQuery(keyword = "시장", lang = "ko", commerceIntent = true) to PageRequest.of(0, 20)
        ),
    )
}
