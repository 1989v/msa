package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 좋아요·평점의 1표 식별자.
 *
 * 로그인 여부에 따라 주체가 달라지므로 종류와 값을 함께 들고 다닌다. 값만 들고 다니면
 * 회원 id `7` 과 방문자 id `7` 이 같은 표가 된다.
 */
data class VoterKey(
    val voterType: VoterType,
    val key: String,
) {
    init {
        if (key.isBlank() || key.length > MAX_KEY_LENGTH) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "투표자 식별자가 올바르지 않습니다")
        }
    }

    companion object {
        const val MAX_KEY_LENGTH = 64

        /**
         * 게이트웨이가 넘긴 헤더에서 투표 주체를 정한다. 로그인 사용자가 우선이다 —
         * 로그인한 뒤에도 방문자 키를 쓰면 쿠키를 지울 때마다 표가 새로 생긴다.
         */
        fun of(memberId: String?, visitorId: String?): VoterKey {
            val member = memberId?.takeIf { it.isNotBlank() }
            if (member != null) return VoterKey(VoterType.MEMBER, member)
            val visitor = visitorId?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(ErrorCode.INVALID_INPUT, "투표자를 식별할 수 없습니다")
            return VoterKey(VoterType.VISITOR, visitor.take(MAX_KEY_LENGTH))
        }
    }
}
