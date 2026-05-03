package com.kgd.quant.domain.learn

import com.kgd.quant.domain.asset.AssetCode
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * IndicatorContent — 입문자 학습 메뉴(/quant/learn) 의 지표 콘텐츠 (CMS).
 *
 * Phase 1 은 DB 기반 CMS — `indicator_content` 테이블 (ADR-0033 §3.1).
 * Phase 2 에서 미디어 업로드 / 검토 워크플로 추가 검토.
 *
 * ## 게시 상태
 * - [publishedAt] 이 null 이면 draft (어드민만 조회 가능).
 * - non-null 이면 public read API 에 노출.
 */
data class IndicatorContent(
    val id: ContentId,
    val slug: Slug,
    val title: String,
    val category: IndicatorCategory,
    /** 1줄 요약 — 카탈로그 카드에 노출 */
    val summary: String,
    /** 본문 — markdown */
    val bodyMarkdown: String,
    /** 수식 (KaTeX) — null 허용 */
    val formulaTeX: String?,
    val examples: List<IndicatorExample>,
    val createdAt: Instant,
    val updatedAt: Instant,
    val publishedAt: Instant?,
) {
    init {
        require(title.isNotBlank()) { "title must not be blank" }
        require(summary.isNotBlank()) { "summary must not be blank" }
        require(bodyMarkdown.isNotBlank()) { "bodyMarkdown must not be blank" }
    }

    val isPublished: Boolean get() = publishedAt != null
}

@JvmInline
value class ContentId(val value: UUID)

@JvmInline
value class Slug(val value: String) {
    init {
        require(value.isNotBlank()) { "Slug must not be blank" }
        require(PATTERN.matches(value)) { "Slug must match $PATTERN (got '$value')" }
        require(value.length in 1..64) { "Slug length 1..64 (got ${value.length})" }
    }
    override fun toString(): String = value
    companion object {
        private val PATTERN = Regex("^[a-z0-9-]+$")
    }
}

enum class IndicatorCategory {
    TREND,         // SMA, EMA, MACD, Ichimoku
    MOMENTUM,      // RSI, Stochastic
    VOLATILITY,    // Bollinger Band, ATR
    VOLUME,        // OBV, VolumeSpike
    MARKET_STRUCTURE, // 김치프리미엄, 거래소 갭 (Phase 2)
}

/**
 * 지표 학습 시 차트 위에 토글로 보여주는 historical 예제.
 */
data class IndicatorExample(
    val label: String,
    val assetCode: AssetCode,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val description: String,
) {
    init {
        require(label.isNotBlank()) { "label must not be blank" }
        require(periodStart < periodEnd) {
            "periodStart($periodStart) must be < periodEnd($periodEnd)"
        }
    }
}
