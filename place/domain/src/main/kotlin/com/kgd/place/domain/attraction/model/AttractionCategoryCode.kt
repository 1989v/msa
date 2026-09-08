package com.kgd.place.domain.attraction.model

/**
 * TourAPI 분류체계 코드 하나 (`/lclsSystmCode2`). 코드와 이름을 잇는 것이 전부다.
 *
 * `attractions.lcls_systm1~3` 은 코드만 갖고 있어 사람에게도 질의에게도 뜻이 없다.
 * 이 표가 「NA02 = 자연경관(하천‧해양)」을 알려 주고, 그것이 필터 이름과 질의 사전의 근거가 된다.
 *
 * **깊이와 상위 코드는 받는 값이지 코드에서 유도하는 값이 아니다.** 대부분은 2/4/8 자라
 * 길이로 유도할 수 있을 것 같지만 `C01`(추천코스) 계열만 3/5/9 자다(실측 13건).
 * 유도하면 그 13건에서 터지고, 관대하게 넘기면 엉뚱한 깊이로 저장된다.
 * 수집기는 단계별로 받으므로 깊이를 이미 알고 있다 — 그것을 그대로 쓴다.
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
        fun of(lang: String, code: String, depth: Int, name: String, parentCode: String? = null): AttractionCategoryCode {
            require(lang.isNotBlank()) { "lang 은 비어있을 수 없습니다" }
            require(code.isNotBlank()) { "code 는 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "name 은 비어있을 수 없습니다" }
            require(depth in 1..3) { "depth 는 1~3 이어야 합니다: $depth" }
            require(depth == 1 || parentCode != null) { "depth $depth 는 상위 코드가 필요합니다: $code" }
            return AttractionCategoryCode(
                lang = lang, code = code, depth = depth,
                parentCode = parentCode?.takeIf { depth > 1 }, name = name,
            )
        }

        fun restore(id: Long, lang: String, code: String, depth: Int, parentCode: String?, name: String) =
            AttractionCategoryCode(id, lang, code, depth, parentCode, name)
    }
}
