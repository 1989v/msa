package com.kgd.search.infrastructure.opensearch

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 관광지 검색 순위에 클릭 계수(`clickBoost`)를 곱할지. **기본은 꺼짐**이다.
 *
 * 계수는 재색인이 14일 고유 클릭 방문자 수로 미리 계산해 싣는다
 * ([com.kgd.search.domain.attraction.model.AttractionClickSignal]). 켜면 키워드 레그의 점수 함수에만 붙는다 —
 * 벡터 단독·상업 의도·검색어 없는 목록·자동완성은 그대로다.
 *
 * 켜기 전에 같은 색인에서 켠 상태·끈 상태를 질의별로 짝지어 nDCG 를 잰다
 * (`k8s/base/search-batch/eval/live-eval.py --click-boost-pair`). 그 판정이 「켬」일 때만 켠다.
 */
@ConfigurationProperties(prefix = "search.attraction.click-boost")
data class AttractionClickBoostProperties(
    val enabled: Boolean = false,
)
