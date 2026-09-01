package com.kgd.game.domain.suggestion.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 제안에 달린 답글. 제안자와 운영자가 시간순으로 주고받는 한 줄기다 —
 * 답글에 다시 답글을 달지 않는다(두 사람뿐이라 갈래가 생기지 않는다).
 *
 * 새 답글은 [GameSuggestion.reply] 만 만든다. 자격과 표시 이름을 그 함수가 함께 정하므로
 * 여기에 공개 생성자를 두면 그 판정을 건너뛴 답글을 만들 수 있게 된다.
 */
class SuggestionReply private constructor(
    val id: Long?,
    val suggestionId: Long,
    val memberId: Long,
    val authorType: ReplyAuthorType,
    val authorName: String,
    val body: String,
    val createdAt: LocalDateTime? = null,
) {
    companion object {
        const val MAX_BODY = 1000

        /** 새 답글. [GameSuggestion.reply] 를 통해서만 부른다 */
        internal fun of(
            suggestionId: Long,
            memberId: Long,
            authorType: ReplyAuthorType,
            authorName: String,
            body: String,
        ): SuggestionReply = SuggestionReply(
            id = null,
            suggestionId = suggestionId,
            memberId = memberId,
            authorType = authorType,
            authorName = authorName,
            body = validateBody(body),
        )

        /** 영속화된 답글의 복원 */
        fun restore(
            id: Long?,
            suggestionId: Long,
            memberId: Long,
            authorType: ReplyAuthorType,
            authorName: String,
            body: String,
            createdAt: LocalDateTime?,
        ): SuggestionReply = SuggestionReply(
            id = id,
            suggestionId = suggestionId,
            memberId = memberId,
            authorType = authorType,
            authorName = authorName,
            body = body,
            createdAt = createdAt,
        )

        fun validateBody(body: String): String {
            val trimmed = body.trim()
            if (trimmed.isEmpty() || trimmed.length > MAX_BODY) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "답글은 1~$MAX_BODY 자여야 합니다")
            }
            return trimmed
        }
    }
}
