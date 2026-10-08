package com.kgd.search.domain.attraction.model

/**
 * 요금 텍스트 규칙의 단일 원본. 재색인이 한 번 계산해 색인 `feeText` 로 싣고,
 * 입장 무료 판정([AttractionAttributeParser])·서버 렌더·FE 가 모두 그 값만 읽는다.
 *
 * place `use_fee` 가 우선이고, 비었을 때만 반복정보(`infoRaw`)의 요금 행으로 채운다 —
 * 관광지(12)는 접힌 요금 컬럼이 비고 요금이 반복정보에만 있는 곳이 많다.
 *
 * 결과는 [AttractionSeoText.sourceText] 를 이미 거친 평문이다. 다시 `sourceText` 하면
 * 디코드된 `<어린이>` 가 태그로 지워진다 — 출력할 때는 이스케이프만 한다.
 */
object AttractionFee {

    /** 공백을 지우고 비교한다(운영 원문에 「입 장 료」가 있다). 「주차요금」 같은 다른 요금은 넣지 않는다. */
    private val FEE_ROW_NAMES = setOf("입장료", "관람료", "이용요금")

    /**
     * @param info infoRaw 를 JSON 으로 푼 값(List · Map · 그 밖). domain 은 JSON 을 풀지 않는다 — [CourseStopsParser] 와 같다.
     * @return 요금 평문. use_fee 도 요금 행도 없으면 null.
     */
    fun text(useFee: String?, info: Any?): String? {
        AttractionSeoText.sourceText(useFee).takeIf { it.isNotEmpty() }?.let { return it }

        val rows = when (info) {
            is List<*> -> info
            is Map<*, *> -> listOf(info)
            else -> emptyList()
        }
        return rows.withIndex()
            .mapNotNull { (position, row) -> (row as? Map<*, *>)?.takeIf(::isFeeRow)?.let { order(it, position) to it } }
            // sortedBy 는 안정 정렬이라 같은 순서값은 원천 순서를 지킨다
            .sortedBy { (order, _) -> order }
            .map { (_, row) -> AttractionSeoText.sourceText(row["infotext"]?.toString()) }
            .filter { it.isNotEmpty() }
            .joinToString(" / ")
            .takeIf { it.isNotEmpty() }
    }

    private fun isFeeRow(row: Map<*, *>): Boolean =
        row["infoname"]?.toString()?.filterNot { it.isWhitespace() } in FEE_ROW_NAMES

    /** `serialnum` 수 값(수로 읽히는 문자열 포함). 수가 아니면 원천 위치 — FE `repeatInfoRows` 와 같은 순서 규칙. */
    private fun order(row: Map<*, *>, position: Int): Double {
        val serial = when (val value = row["serialnum"]) {
            is Number -> value.toDouble()
            is String -> value.trim().toDoubleOrNull()
            else -> null
        }
        return serial?.takeIf { it.isFinite() } ?: position.toDouble()
    }
}
