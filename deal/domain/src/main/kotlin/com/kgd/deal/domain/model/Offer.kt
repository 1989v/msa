package com.kgd.deal.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 혜택 링크 하나 (ADR-0069).
 *
 * [targetUrl] 은 **원본 그대로** 보관하고 원본 그대로 넘긴다. 제휴 링크의 파라미터를
 * 재조립하거나 서브ID 를 임의로 끼워 넣는 것은 대부분의 네트워크 약관 위반이고,
 * 302 가 아닌 방식으로 감싸면 트래킹 쿠키(30~90일)가 깨져 수익 자체가 사라진다.
 */
data class Offer(
    val id: Long?,
    val slug: String,
    val categoryId: Long,
    val merchant: String,
    val title: String,
    val benefit: String,
    val summary: String?,
    val targetUrl: String,
    val revenueType: RevenueType,
    val network: String?,
    val status: DisplayStatus,
    val validFrom: LocalDateTime?,
    val validUntil: LocalDateTime?,
    val orderNo: Int,
    // ─── 관측값 — 어드민 편집 대상이 아니다. 저장 시 무시되고 시스템만 갱신한다 (entity-mutation.md) ───
    val clickCount: Long = 0,
    val linkStatus: LinkStatus = LinkStatus.UNKNOWN,
    val linkStatusCode: Int? = null,
    val linkCheckedAt: LocalDateTime? = null,
    val updatedAt: LocalDateTime? = null,
) {
    init {
        if (!SLUG_PATTERN.matches(slug)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "오퍼 slug 형식이 올바르지 않습니다: $slug")
        }
        if (merchant.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "제공처는 비어 있을 수 없습니다")
        }
        if (title.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "오퍼 제목은 비어 있을 수 없습니다")
        }
        if (benefit.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "혜택 요약은 비어 있을 수 없습니다")
        }
        // http 링크는 등록 자체를 막는다 — 아웃바운드가 평문이면 파라미터가 그대로 노출되고,
        // 대상이 https 로 리다이렉트하는 순간 일부 브라우저가 referrer 를 떨어뜨려
        // 제휴 트래킹이 끊긴다.
        if (!targetUrl.startsWith("https://")) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "링크는 https 여야 합니다: $targetUrl")
        }
        // 수익 유형과 네트워크는 함께 움직인다. 제휴인데 네트워크를 모르면 정산 대조가 불가능하고,
        // 제휴가 아닌데 네트워크가 붙어 있으면 고지 판정이 흔들린다.
        if (revenueType == RevenueType.AFFILIATE && network.isNullOrBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "제휴 링크에는 네트워크가 필요합니다: $slug")
        }
        if (revenueType == RevenueType.PLAIN && !network.isNullOrBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "제휴가 아닌 링크에는 네트워크를 붙이지 않습니다: $slug")
        }
        if (validFrom != null && validUntil != null && !validUntil.isAfter(validFrom)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "종료 시각은 시작 시각보다 뒤여야 합니다: $slug")
        }
    }

    /**
     * 지금 전시·진입 가능한가. 화면이 아니라 도메인이 판단한다.
     *
     * 경계는 `[validFrom, validUntil)` — 시작 시각은 포함, 종료 시각은 제외.
     */
    fun isVisibleAt(now: LocalDateTime): Boolean =
        status == DisplayStatus.OPEN &&
            (validFrom == null || !now.isBefore(validFrom)) &&
            (validUntil == null || now.isBefore(validUntil))

    /** 공정위 고지(제휴 배지) 대상인가 */
    fun requiresDisclosure(): Boolean = revenueType.requiresDisclosure

    companion object {
        /** `/go/{slug}` 로 공유되는 주소라 짧고 읽히는 형태로 제한한다 */
        private val SLUG_PATTERN = Regex("^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$")
    }
}
