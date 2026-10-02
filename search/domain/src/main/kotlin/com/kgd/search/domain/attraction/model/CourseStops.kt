package com.kgd.search.domain.attraction.model

/** 관광지 자연키. 코스 구성 지점을 같은 언어 관광지 id 로 잇는 지도의 키다. */
data class AttractionKey(val lang: String, val contentId: String)

/**
 * 여행코스 구성 지점 하나. [order] 는 원천 `subnum` 의 수 값(0 부터 오고 같은 값이 두 번 올 수 있다).
 * [attractionId] 는 같은 언어 관광지가 있을 때만 있다 — 없으면 이름만 그리고 링크하지 않는다.
 */
data class CourseStop(val order: Int, val contentId: String?, val name: String, val attractionId: Long?)

/** [warning] 이 있으면 원문을 해석하지 못한 것이고 [stops] 는 비어 있다. */
data class CourseStopsParse(val stops: List<CourseStop>, val warning: String?)

/**
 * 여행코스 `infoRaw`(TourAPI detailInfo2 원문) → 코스 구성.
 *
 * 입력은 infoRaw 를 JSON 으로 푼 값(List · Map · String · null)이다. place 는 원천을 목록으로 싣지만
 * 원천 자체는 1건이면 객체 하나를 주므로 둘 다 받는다.
 * 순서는 `subnum` 수 값 오름차순이고, 같은 값은 원천 순서를 지킨다(운영 표본에 subnum 3·4 가 두 번씩 온다).
 * 한 행이라도 읽지 못하면 일부만 싣지 않고 전체를 비운다 — 빠진 지점이 있는 순서를 맞는 코스처럼 보여주지 않는다.
 */
object CourseStopsParser {

    fun parse(info: Any?, lang: String, attractionIds: Map<AttractionKey, Long>): CourseStopsParse {
        val rows = when (info) {
            null -> return EMPTY
            is List<*> -> info
            is Map<*, *> -> listOf(info)
            else -> return failed("infoRaw 가 배열·객체가 아니다")
        }
        val stops = rows.mapIndexed { index, row ->
            if (row !is Map<*, *>) return failed("${index}번째 행이 객체가 아니다")
            val order = text(row["subnum"])?.toIntOrNull() ?: return failed("${index}번째 행 subnum 이 수가 아니다: ${row["subnum"]}")
            val name = text(row["subname"]) ?: return failed("${index}번째 행 subname 이 비었다")
            val contentId = text(row["subcontentid"])
            CourseStop(order, contentId, name, contentId?.let { attractionIds[AttractionKey(lang, it)] })
        }
        return CourseStopsParse(stops.sortedBy { it.order }, warning = null)
    }

    private val EMPTY = CourseStopsParse(emptyList(), warning = null)

    private fun failed(reason: String) = CourseStopsParse(emptyList(), reason)

    private fun text(value: Any?): String? = value?.toString()?.trim()?.takeIf { it.isNotEmpty() }
}
