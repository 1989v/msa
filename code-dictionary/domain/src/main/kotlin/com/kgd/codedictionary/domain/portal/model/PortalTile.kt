package com.kgd.codedictionary.domain.portal.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 메인의 도메인 타일 노출 상태 (ADR-0066).
 *
 * [HIDDEN] 은 삭제와 다르다 — 존재하지만 공개하지 않는 프라이빗 서비스를 행으로 남긴다.
 */
enum class TileStatus {
    LIVE,
    SOON,
    HIDDEN;

    val visible: Boolean get() = this != HIDDEN
}

/**
 * 1989v.com 메인의 도메인 타일 (ADR-0066).
 *
 * 배포 단위가 아니라 **방문자가 클릭해 들어가는 진입점**이다.
 */
data class PortalTile(
    val id: Long?,
    val code: String,
    val label: String,
    val tagline: String?,
    val href: String?,
    val status: TileStatus,
    val orderNo: Int,
) {
    init {
        if (!CODE_PATTERN.matches(code)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "타일 코드 형식이 올바르지 않습니다: $code")
        }
        if (label.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "타일 이름은 비어 있을 수 없습니다")
        }
        // 활성인데 갈 곳이 없으면 눌러도 아무 일이 없는 타일이 된다
        if (status == TileStatus.LIVE && href.isNullOrBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "LIVE 타일에는 href 가 필요합니다: $code")
        }
    }

    companion object {
        private val CODE_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,39}$")
    }
}
