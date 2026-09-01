package com.kgd.game.application.suggestion.dto

import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.ReplyAuthorType
import com.kgd.game.domain.suggestion.model.SuggestionReply
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import java.time.LocalDateTime

/**
 * 답글 한 줄. [authorType] 이 화면의 배지를 정한다 — 닉네임은 사용자가 「운영자」로
 * 지을 수 있어서 이름만으로는 진짜 답변과 사칭을 가를 수 없다.
 */
data class SuggestionReplyDto(
    val id: Long,
    val authorType: ReplyAuthorType,
    val authorName: String,
    val body: String,
    val createdAt: LocalDateTime?,
) {
    companion object {
        fun from(reply: SuggestionReply) = SuggestionReplyDto(
            id = reply.id ?: 0L,
            authorType = reply.authorType,
            authorName = reply.authorName,
            body = reply.body,
            createdAt = reply.createdAt,
        )
    }
}

/**
 * 게임 상세에 그려지는 제안 한 건. 본문·상태·답글은 **전부 공개**다.
 *
 * 회원 id 는 내보내지 않는다 — 화면이 필요로 하는 것은 「이 글에 수정 버튼을 그릴까」뿐이고,
 * 그 판정([mine])은 게이트웨이가 넣어 준 신원으로 서버가 한다. id 를 실어 클라이언트가
 * 비교하게 하면 남의 회원 번호가 목록마다 딸려 나간다.
 */
data class GameSuggestionDto(
    val id: Long,
    val nickname: String,
    val body: String,
    val status: SuggestionStatus,
    val createdAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
    /** 작성 후 고쳐진 적이 있는가 — 화면이 「수정됨」을 붙인다 */
    val edited: Boolean,
    /** 보는 사람이 이 제안의 주인인가 */
    val mine: Boolean,
    val replies: List<SuggestionReplyDto>,
) {
    companion object {
        fun of(
            suggestion: GameSuggestion,
            replies: List<SuggestionReply>,
            viewerId: Long?,
        ) = GameSuggestionDto(
            id = suggestion.id ?: 0L,
            nickname = suggestion.nickname,
            body = suggestion.body,
            status = suggestion.status,
            createdAt = suggestion.createdAt,
            updatedAt = suggestion.updatedAt,
            edited = isEdited(suggestion),
            mine = suggestion.isOwnedBy(viewerId),
            replies = replies.map(SuggestionReplyDto::from),
        )

        /**
         * 초 단위로 비교한다. `updated_at` 에 `ON UPDATE CURRENT_TIMESTAMP` 가 걸려 있어
         * 저장 직후 두 값이 밀리초에서 갈릴 수 있고, 그러면 방금 쓴 글이 「수정됨」으로 뜬다.
         */
        private fun isEdited(suggestion: GameSuggestion): Boolean {
            val created = suggestion.createdAt ?: return false
            val updated = suggestion.updatedAt ?: return false
            return updated.withNano(0) > created.withNano(0)
        }
    }
}

/** 어드민 목록 — 전 게임 횡단이라 어느 게임의 제안인지가 함께 온다 */
data class AdminGameSuggestionDto(
    val id: Long,
    val gameId: Long,
    val gameSlug: String,
    val gameTitle: String,
    val nickname: String,
    val body: String,
    val status: SuggestionStatus,
    val createdAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
    val replies: List<SuggestionReplyDto>,
)
