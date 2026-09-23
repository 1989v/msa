package com.kgd.ads.domain.category.model

/**
 * 문맥 카테고리 — ads 가 소유하는 고정 목록. FE 의 문맥 키(`blog:{slug}` 등)는 매핑 표를 거쳐
 * 이 코드로 바뀐다. 다른 도메인의 id 를 여기 두지 않는다.
 */
data class ContextCategory(val code: String, val label: String, val sortOrder: Int) {
    init {
        require(CODE_PATTERN.matches(code)) { "카테고리 코드는 대문자·숫자·밑줄 32자 이하: $code" }
        require(label.isNotBlank()) { "카테고리 이름이 비었습니다" }
    }

    companion object {
        private val CODE_PATTERN = Regex("^[A-Z][A-Z0-9_]{0,31}$")
    }
}
