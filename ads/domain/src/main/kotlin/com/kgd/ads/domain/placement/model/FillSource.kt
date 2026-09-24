package com.kgd.ads.domain.placement.model

/**
 * 지면이 최종적으로 무엇으로 채워졌는지 — 화면이 보고하는 참고 통계. 과금과 무관하다.
 * 허용 값은 이 넷뿐이고 모르는 값은 세지 않는다(요청이 정하는 문자열이 저장 필드가 되지 않게).
 */
enum class FillSource {
    PAID,
    ADSENSE,
    HOUSE,
    EMPTY,
    ;

    companion object {
        fun parse(value: String): FillSource? = entries.firstOrNull { it.name == value }
    }
}
