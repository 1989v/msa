package com.kgd.place.domain.attraction.model

/**
 * TourAPI 원천 제목의 파생 표기 (`docs/architecture/data-sources.md` §0 ②).
 *
 * 원천 `title` 은 꼬리 괄호에 다른 표기를 얹어 온다 — 영문 행은 국문명
 * (`Dosan Park(도산공원)`), 국문 행은 지역 구분자(`청룡사(서울)`)다. 이 문자열을
 * 그대로 외부 검색어·해시태그에 실으면 `dosanpark도산공원` 처럼 어디에도 없는 질의가 된다.
 *
 * 그래서 **꼬리 괄호 구간에 한글이 있을 때만** 가른다. `(Sunrise Peak)` 같은 영문 병기나
 * `(城山日出峰)` 한자 병기는 이름의 일부로 본다 — 병기까지 가르기 시작하면 무엇이 이름인지
 * 규칙으로 답할 수 없다.
 *
 * 원천 `title` 컬럼은 건드리지 않는다. display/local 은 저장할 때마다 이 파서로 다시
 * 계산되는 파생 값이라 전체 동기화(bulk)가 돌아도 지워질 수 없다 (§0 ③).
 * 같은 규칙이 두 곳에 복제돼 있다 — `place/ingest/src/title_parse.py`(수집기)와
 * `V9__add_attraction_title_display.sql`(기존 행 백필). 규칙을 바꾸면 셋을 같이 바꾼다.
 */
data class AttractionTitle(val display: String, val local: String?) {

    companion object {
        /** 꼬리 괄호(반각/전각) 안에 한글이 하나라도 있고, 앞에 본문이 남는 경우만 가른다. */
        private val TRAILING_LOCAL =
            Regex("""^(.*\S)\s*[(（]([^()（）]*[가-힣][^()（）]*)[)）]\s*$""")

        fun parse(raw: String): AttractionTitle {
            val title = raw.trim()
            val match = TRAILING_LOCAL.find(title)
                ?: return AttractionTitle(display = title, local = null)
            return AttractionTitle(
                display = match.groupValues[1].trim(),
                local = match.groupValues[2].trim(),
            )
        }
    }
}
