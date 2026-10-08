package com.kgd.search.domain.attraction.model

/**
 * 원천(TourAPI) 관광 유형의 국문·영문 코드 대응표. 두 서비스는 같은 유형에 다른 코드를 쓴다(관광지 국 12 · 영 76).
 * 값은 수집기 `place/ingest/src/sync_tour.py` 의 `CONTENT_TYPES` 와 같다.
 *
 * [pairable] 이 false 인 유형은 언어 대체 짝 판정에서 뺀다 — 행사는 회차마다 따로 올라와 국·영이 같은 회차인지 모르고,
 * 코스는 영문 서비스에 유형이 없다.
 */
enum class ContentTypeLang(val ko: String, val en: String?, val pairable: Boolean) {
    ATTRACTION("12", "76", true),
    CULTURE("14", "78", true),
    LEISURE("28", "75", true),
    SHOPPING("38", "79", true),
    FOOD("39", "82", true),
    STAY("32", "80", true),
    FESTIVAL("15", "85", false),
    COURSE("25", null, false),
    ;

    companion object {
        private val byKo = entries.associateBy { it.ko }
        private val byEn = entries.filter { it.en != null }.associateBy { it.en!! }

        /** 문서 언어([lang] ko·en)와 그 언어의 코드로 유형을 찾는다. 다른 언어의 코드·표에 없는 코드는 null. */
        fun of(lang: String, code: String?): ContentTypeLang? = when (lang) {
            "ko" -> byKo[code]
            "en" -> byEn[code]
            else -> null
        }
    }
}
