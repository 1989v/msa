package com.kgd.ranking.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 랭킹 하나 — "무엇을(도메인) 무엇으로(지표) 어느 범위에서(스코프) 줄세우는가" (ADR-0081).
 *
 * 보드는 순위를 들고 있지 않다. 순위는 [RankingSnapshot] 에 시점과 함께 붙는다.
 */
data class RankingBoard(
    val id: Long?,
    val slug: String,
    val domain: RankingDomain,
    val metric: RankingMetric,
    val direction: SortDirection,
    /** 도메인의 범위 식별자 — 주유소는 오피넷 지역코드 */
    val scopeKey: String,
    val scopeName: String,
    val title: String,
    val subtitle: String?,
    /** 점수의 단위 — "원/L". 화면이 지표별 분기 없이 그릴 수 있게 보드가 들고 있다 */
    val unit: String,
    /**
     * 출처 표기 문자열 — "한국석유공사 오피넷".
     *
     * 공공누리·KOGL·CC BY 원천은 출처 표시가 **의무**다. 표기를 화면 코드에 흩으면
     * 원천이 늘 때 누락이 생기고, 누락은 라이선스 위반이다. 보드가 자기 출처를 들고 다닌다.
     */
    val sourceLabel: String,
    val status: BoardStatus,
) {
    init {
        if (!SLUG_PATTERN.matches(slug)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "보드 slug 형식이 올바르지 않습니다: $slug")
        }
        if (scopeKey.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "보드 스코프는 비어 있을 수 없습니다: $slug")
        }
        if (title.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "보드 제목은 비어 있을 수 없습니다: $slug")
        }
        if (unit.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "보드 단위는 비어 있을 수 없습니다: $slug")
        }
        if (sourceLabel.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "보드에는 출처 표기가 필요합니다: $slug")
        }
    }

    companion object {
        private val SLUG_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
    }
}
