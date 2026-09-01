package com.kgd.game.domain.suggestion.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 제안의 처리 단계.
 *
 * 「확인했다」와 「반영했다」를 가른다 — 하나로 합치면 제안자는 자기 글이 읽혔는지조차
 * 알 수 없고, 운영자는 검토 중인 것과 손대지 않은 것을 구분할 수 없다.
 *
 * 전이를 한 방향으로 잠그지 않는다. 상태를 바꾸는 손이 하나뿐이라 오조작을 되돌릴
 * 다른 경로가 없고, 반영했다가 되돌리는 일도 실제로 일어난다.
 */
enum class SuggestionStatus {
    /** 접수 — 아직 아무도 보지 않았다 */
    OPEN,

    /** 검토중 */
    REVIEWING,

    /** 반영 */
    APPLIED,

    /** 반려 */
    DECLINED,
    ;

    companion object {
        fun parse(raw: String?): SuggestionStatus? =
            raw?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
                entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
                    ?: throw BusinessException(ErrorCode.INVALID_INPUT, "알 수 없는 처리 상태입니다: $value")
            }
    }
}
