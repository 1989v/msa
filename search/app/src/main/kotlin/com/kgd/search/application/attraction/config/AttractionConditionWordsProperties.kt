package com.kgd.search.application.attraction.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 조건어 해석 — 「주차 되는」·「반려견과 함께」를 허브 칩과 같은 속성 선택으로 옮길지. **기본은 켜짐**이다.
 *
 * 끄면 조건어는 지금처럼 검색어로 남는다. 배포 없이 되돌리는 길이다(env `SEARCH_ATTRACTION_CONDITION_WORDS_ENABLED`).
 */
@ConfigurationProperties(prefix = "search.attraction.condition-words")
data class AttractionConditionWordsProperties(
    val enabled: Boolean = true,
)
