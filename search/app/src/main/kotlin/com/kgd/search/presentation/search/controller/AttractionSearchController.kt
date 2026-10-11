package com.kgd.search.presentation.search.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.search.application.attraction.usecase.AttractionShortUrlUseCase
import com.kgd.search.application.attraction.usecase.NearbyAttractionsUseCase
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import com.kgd.search.presentation.search.dto.AttractionConditionParams
import com.kgd.search.presentation.search.dto.AttractionDetailResponse
import com.kgd.search.presentation.search.dto.AttractionSearchResponse
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

/**
 * 관광지 검색 (ADR-0065) — 키워드/카테고리/지역 필터 + geo 반경/거리순.
 * keyword 없이 필터만으로도 호출 가능 (지도 영역 브라우징).
 */
@RestController
@RequestMapping("/api/search/attractions")
class AttractionSearchController(
    private val searchAttractionUseCase: SearchAttractionUseCase,
    private val suggestAttractionUseCase: SuggestAttractionUseCase,
    private val nearbyAttractionsUseCase: NearbyAttractionsUseCase,
    private val attractionShortUrlUseCase: AttractionShortUrlUseCase,
) {

    /** 통합 자동완성 — 지역(도시/광역, 인구 부스트 상단) + 관광지 prefix (ADR-0065). */
    @GetMapping("/suggest")
    fun suggest(
        @RequestParam q: String,
        @RequestParam(required = false) lang: String?,
        @RequestParam(defaultValue = "8") size: Int,
    ): ApiResponse<List<SuggestAttractionUseCase.Suggestion>> {
        if (q.isBlank()) return ApiResponse.success(emptyList())
        return ApiResponse.success(suggestAttractionUseCase.execute(q.trim(), lang, size.coerceIn(1, 20)))
    }

    @GetMapping
    fun search(
        @RequestParam(required = false) keyword: String?,
        @RequestParam(required = false) lang: String?,
        @RequestParam(required = false) areaCode: String?,
        @RequestParam(required = false) sidoCode: String?,
        @RequestParam(required = false) sigunguCode: String?,
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) lat: Double?,
        @RequestParam(required = false) lng: Double?,
        @RequestParam(required = false) radiusKm: Double?,
        @RequestParam(defaultValue = "relevance") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        // 속성 패싯 — 긍정 값만 필터가 된다(openToday=true · parking|creditCard|strollerRental=YES ·
        // pet=ALLOWED,PARTIAL · admission=FREE). 다른 값은 무시하고 그 속성은 거르지 않는다.
        @RequestParam(defaultValue = "false") openToday: Boolean,
        @RequestParam(name = AttractionConditionParams.PARKING, required = false) parking: String?,
        @RequestParam(name = AttractionConditionParams.CREDIT_CARD, required = false) creditCard: String?,
        @RequestParam(name = AttractionConditionParams.STROLLER_RENTAL, required = false) strollerRental: String?,
        @RequestParam(name = AttractionConditionParams.PET, required = false) pet: String?,
        @RequestParam(name = AttractionConditionParams.ADMISSION, required = false) admission: String?,
        // 무장애(WHEELCHAIR·ELEVATOR·RESTROOM, 쉼표 AND) · 웰니스 테마 있음 — 연 코드 밖의 값은 무시한다
        @RequestParam(name = AttractionConditionParams.BARRIER_FREE, required = false) barrierFree: String?,
        @RequestParam(defaultValue = "false") wellness: Boolean,
        // 건수는 요청할 때만 센다 — 상세의 주변·편의시설·지도가 같은 API 를 부른다. 필터 적용과는 무관하다.
        @RequestParam(defaultValue = "false") facets: Boolean,
        // 행사 상태 ONGOING·WEEKEND·UPCOMING·THIS_MONTH·NOT_ENDED — 행사가 아닌 곳은 거르지 않는다. 다른 값은 무시.
        @RequestParam(required = false) eventStatus: String?,
        // true 면 오타 교정 없이 받은 검색어 그대로 찾는다 — 교정 안내의 「원래 검색어로 검색」
        @RequestParam(defaultValue = "false") exact: Boolean,
        // 「조건으로 읽지 않고 검색」 — 조건어를 하나도 속성으로 옮기지 않는다
        @RequestParam(defaultValue = "false") keepConditionWords: Boolean,
        // 해석된 칩을 끈 것 — 그 파라미터 이름(parking·pet …)의 해석만 버린다. 여럿 가능
        @RequestParam(required = false) skipCondition: List<String>?,
    ): ApiResponse<AttractionSearchResponse> {
        val result = searchAttractionUseCase.execute(
            SearchAttractionUseCase.Query(
                keyword = keyword,
                lang = lang,
                areaCode = areaCode,
                sidoCode = sidoCode,
                sigunguCode = sigunguCode,
                category = category,
                lat = lat,
                lng = lng,
                radiusKm = radiusKm,
                sort = sort,
                page = page,
                size = size,
                openToday = openToday,
                parking = parking,
                creditCard = creditCard,
                strollerRental = strollerRental,
                pet = pet,
                admission = admission,
                barrierFree = barrierFree,
                wellness = wellness,
                attributeFacets = facets,
                eventStatus = eventStatus,
                exact = exact,
                keepConditionWords = keepConditionWords,
                skipConditions = AttractionConditionParams.kindsOf(skipCondition),
            )
        )
        return ApiResponse.success(AttractionSearchResponse.of(result))
    }

    /** 상세 — 색인은 하루 한 번 바뀌므로 엣지가 1시간 쥔다 (ADR-0105). 404 에는 붙이지 않는다(예외 경로). */
    @GetMapping("/{id}")
    fun findById(@PathVariable id: String): ResponseEntity<ApiResponse<AttractionDetailResponse>> {
        val result = searchAttractionUseCase.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "관광지를 찾을 수 없습니다: id=$id")
        val body = AttractionDetailResponse(result, attractionShortUrlUseCase.shortUrlOf(result.id))
        return ResponseEntity.ok().cacheControl(INDEX_CACHE).body(ApiResponse.success(body))
    }

    /** 상세 「주변 탐색」 — 명소·숙소·행사·편의시설을 한 번에. 키가 관광지 id 라 상세와 같은 주기로 캐시한다 (ADR-0105). */
    @GetMapping("/{id}/nearby")
    fun nearby(@PathVariable id: String): ResponseEntity<ApiResponse<NearbyAttractionsUseCase.Nearby>> {
        val result = nearbyAttractionsUseCase.nearby(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "관광지를 찾을 수 없습니다: id=$id")
        return ResponseEntity.ok().cacheControl(INDEX_CACHE).body(ApiResponse.success(result))
    }

    companion object {
        /** 브라우저 60초 · 엣지 1시간 · 만료 뒤 10분은 옛 값을 내주며 뒤에서 갱신 */
        private val INDEX_CACHE: CacheControl = CacheControl.maxAge(Duration.ofSeconds(60))
            .cachePublic()
            .sMaxAge(Duration.ofHours(1))
            .staleWhileRevalidate(Duration.ofMinutes(10))
    }
}
