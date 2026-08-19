package com.kgd.deal.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 혜택 링크의 분류 (ADR-0069).
 *
 * 규제 업권(의료·금융)은 여기에 `HOLD` 로 숨기는 게 아니라 **행 자체를 만들지 않는다** —
 * 전시 테이블에 비전시 행을 심는 것은 모순이고, 노출하지 않기로 한 결정을 데이터로 남길
 * 이유가 없다 (ADR-0066 이 프라이빗 서비스에 적용한 규칙과 같다).
 */
data class DealCategory(
    val id: Long?,
    val code: String,
    val label: String,
    val tagline: String?,
    val status: DisplayStatus,
    val orderNo: Int,
) {
    init {
        if (!CODE_PATTERN.matches(code)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 코드 형식이 올바르지 않습니다: $code")
        }
        if (label.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 이름은 비어 있을 수 없습니다")
        }
    }

    companion object {
        private val CODE_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,39}$")
    }
}
