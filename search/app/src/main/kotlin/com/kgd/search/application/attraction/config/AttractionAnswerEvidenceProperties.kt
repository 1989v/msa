package com.kgd.search.application.attraction.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 어휘 근거 — 잔여 검색어가 있으면 그 말이 색인에 실제로 있어야 결과를 낸다. **기본은 꺼짐(`OFF`)** 이다.
 *
 * 벡터 이웃은 답이 있다는 근거가 아니다. 「에펠탑」처럼 국내에 없는 대상도 벡터는 늘 가까운 문서 k 개를 채운다.
 * 판정 세트 짝 측정이 통과한 단계까지만 켜고, 되돌림은 env `SEARCH_ATTRACTION_ANSWER_EVIDENCE_MODE` 한 줄이다.
 */
@ConfigurationProperties(prefix = "search.attraction.answer-evidence")
data class AttractionAnswerEvidenceProperties(
    val mode: Mode = Mode.OFF,
) {
    enum class Mode {
        /** 지금 동작 그대로 */
        OFF,

        /** 근거 잔여가 같은 필터 안에서 하나도 맞지 않으면 0건 */
        GATE,

        /** GATE 에 더해, 쿼리 언더스탠딩이 집합을 좁히지 않은 질의는 결과를 어휘 근거 일치 문서로 한정 */
        CONFINE,
    }
}
