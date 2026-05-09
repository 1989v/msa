package com.kgd.quant.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * QuantChartsProperties — 차트/발견 화면 설정 외부화 (ADR-0042 GlobalIndices 등).
 *
 * application.yml 에서:
 *   quant.charts.global-indices:
 *     - ticker: "^IXIC"
 *       name: "나스닥"
 */
@ConfigurationProperties(prefix = "quant.charts")
data class QuantChartsProperties(
    val globalIndices: List<GlobalIndexConfig> = DEFAULT_GLOBAL_INDICES,
) {
    data class GlobalIndexConfig(
        val ticker: String,
        val name: String,
    )

    companion object {
        /** ADR-0042 D4 8종 default — properties 미설정 시 fallback. */
        val DEFAULT_GLOBAL_INDICES = listOf(
            GlobalIndexConfig("^IXIC", "나스닥"),
            GlobalIndexConfig("^GSPC", "S&P 500"),
            GlobalIndexConfig("^SOX", "필라델피아 반도체"),
            GlobalIndexConfig("^VIX", "VIX"),
            GlobalIndexConfig("^KS11", "코스피"),
            GlobalIndexConfig("^KQ11", "코스닥"),
            GlobalIndexConfig("KRW=X", "달러환율"),
            GlobalIndexConfig("DX-Y.NYB", "달러인덱스"),
        )
    }
}
