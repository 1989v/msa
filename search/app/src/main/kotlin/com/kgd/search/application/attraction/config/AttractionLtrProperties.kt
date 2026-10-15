package com.kgd.search.application.attraction.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 관광지 LTR 재정렬 (ADR-0051 트랙 B). 하이브리드 결과의 상위 [depth] 건을 학습한 트리로 다시 줄 세운다.
 *
 * [langs] 가 국문뿐인 이유: 사람 블라인드 비교에서 국문은 LTR 이 분명히 이겼고(승부 난 20쌍 중 18), 영문은 갈리지 않았다
 * (12 대 9). 근거는 `scripts/search-eval/README.md`.
 */
@ConfigurationProperties(prefix = "search.attraction-ltr")
data class AttractionLtrProperties(
    val enabled: Boolean = false,
    val langs: Set<String> = setOf("ko"),
    /** 다시 줄 세우는 상위 건수 — 학습 행이 라이브 상위 20 이라 이 값과 같아야 피처 분포가 맞는다 */
    val depth: Int = 20,
    /** 클래스패스 안 모델 파일. `export.py` 가 만든다 */
    val model: String = "ltr/attractions-2026-10-15.json",
)
