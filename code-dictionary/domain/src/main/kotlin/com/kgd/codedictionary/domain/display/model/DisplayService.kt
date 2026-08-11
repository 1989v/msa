package com.kgd.codedictionary.domain.display.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 전시 상태 (ADR-0066). 커머스의 전시 상태 관례를 따른다.
 *
 * [PREOPEN] 자리에 `DRAFT` 를 쓰지 않는 이유: DRAFT 는 전시되지 않는 작성 중 상태라
 * "전시는 하되 아직 못 들어간다"와 성격이 반대다.
 *
 * [HOLD] 는 삭제와 다르다 — 존재하지만 전시하지 않는 서비스를 행으로 남긴다.
 */
enum class DisplayStatus {
    OPEN,
    PREOPEN,
    HOLD;

    val displayed: Boolean get() = this != HOLD
}

/**
 * 1989v.com 메인에 전시하는 서비스 (ADR-0066).
 *
 * 배포 단위가 아니라 **방문자가 클릭해 들어가는 진입점**이다.
 */
data class DisplayService(
    val id: Long?,
    val code: String,
    val label: String,
    val tagline: String?,
    val href: String?,
    val status: DisplayStatus,
    val orderNo: Int,
) {
    init {
        if (!CODE_PATTERN.matches(code)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "전시 서비스 코드 형식이 올바르지 않습니다: $code")
        }
        if (label.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "전시 서비스 이름은 비어 있을 수 없습니다")
        }
        // 진입 가능한데 갈 곳이 없으면 눌러도 아무 일이 없다
        if (status == DisplayStatus.OPEN && href.isNullOrBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "OPEN 상태에는 href 가 필요합니다: $code")
        }
    }

    companion object {
        private val CODE_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,39}$")
    }
}
