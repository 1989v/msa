package com.kgd.place.domain.attraction.model

/**
 * TourAPI 분류체계 코드 하나 (`/lclsSystmCode2`). 코드와 이름을 잇는 것이 전부다.
 *
 * `attractions.lcls_systm1~3` 은 코드만 갖고 있어 사람에게도 질의에게도 뜻이 없다.
 * 이 표가 「NA02 = 자연경관(하천‧해양)」을 알려 주고, 그것이 필터 이름과 질의 사전의 근거가 된다.
 */
class AttractionCategoryCode private constructor(
    val id: Long? = null,
    val lang: String,
    val code: String,
    val depth: Int,
    val parentCode: String?,
    val name: String,
) {
    companion object {
        /** 코드 길이가 곧 깊이다 — 2(대)/4(중)/8(소). 원천이 이 규칙으로 코드를 만든다. */
        fun depthOf(code: String): Int = when (code.length) {
            2 -> 1
            4 -> 2
            8 -> 3
            else -> throw IllegalArgumentException("분류 코드 길이가 2/4/8 이 아닙니다: $code")
        }

        fun of(lang: String, code: String, name: String, parentCode: String? = null): AttractionCategoryCode {
            require(lang.isNotBlank()) { "lang 은 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "name 은 비어있을 수 없습니다" }
            val depth = depthOf(code)
            return AttractionCategoryCode(
                lang = lang,
                code = code,
                depth = depth,
                // 원천이 상위 코드를 따로 주지 않으므로 앞자리에서 잘라 쓰되, 준 값이 있으면 그것을 믿는다.
                parentCode = parentCode ?: if (depth == 1) null else code.take(if (depth == 2) 2 else 4),
                name = name,
            )
        }

        fun restore(id: Long, lang: String, code: String, depth: Int, parentCode: String?, name: String) =
            AttractionCategoryCode(id, lang, code, depth, parentCode, name)
    }
}
