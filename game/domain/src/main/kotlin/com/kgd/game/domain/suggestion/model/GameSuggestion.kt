package com.kgd.game.domain.suggestion.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 게임 하나에 달린 플레이어의 개선 제안.
 *
 * 로그인한 사람만 쓸 수 있고, 쓴 사람만 고칠 수 있다. **어드민에게도 본문 수정 권한을 주지
 * 않는다** — 남이 고칠 수 있으면 「내가 쓴 말」이 아니게 되고, 반영·반려의 근거로 남은 문장이
 * 사후에 달라질 수 있다. 운영자가 할 일은 처리 상태를 바꾸고([changeStatus]) 답글을
 * 다는 것([reply])이다.
 *
 * 표시 이름([nickname])은 랭킹에 남는 것과 **같은 값**이다(브라우저의 `game_nickname`).
 * 회원 프로필을 따로 부르지 않으므로 목록 조회에 서비스 간 호출이 없고, 한 사람이 게임 안에서
 * 늘 같은 이름으로 보인다. 신원은 [memberId] 가 갖고 있어 이름을 바꿔도 소유권은 그대로다.
 *
 * 데이터 클래스가 아닌 것은 의도다 — `copy(body = …)` 가 열려 있으면 [editBy] 의 소유자
 * 확인을 지나쳐 본문을 갈아 끼울 수 있다.
 */
class GameSuggestion private constructor(
    val id: Long?,
    val gameId: Long,
    val memberId: Long,
    val nickname: String,
    val body: String,
    val status: SuggestionStatus,
    val createdAt: LocalDateTime? = null,
    val updatedAt: LocalDateTime? = null,
) {
    fun isOwnedBy(memberId: Long?): Boolean = memberId != null && memberId == this.memberId

    /**
     * 본문 수정. 소유자만 통과한다 — 확인과 변경을 한 함수로 묶어, 부르는 쪽이 확인을
     * 건너뛴 채 본문만 바꾸는 조립이 불가능하게 한다.
     */
    fun editBy(memberId: Long?, body: String): GameSuggestion {
        if (!isOwnedBy(memberId)) {
            throw BusinessException(ErrorCode.FORBIDDEN, "본인이 쓴 제안만 수정할 수 있습니다")
        }
        return with(status, validateBody(body))
    }

    fun changeStatus(status: SuggestionStatus): GameSuggestion = with(status, body)

    /**
     * 답글을 만든다. **제안자 본인과 운영자만** 쓸 수 있다 — 제3자의 참견까지 받으면
     * 개선 제안이 아니라 게임별 게시판이 되고, 그때 필요한 것(신고·정렬·차단)은 여기 없다.
     *
     * 자격([ReplyAuthorType])과 표시 이름을 여기서 함께 정한다. 요청이 정하게 두면
     * 아무나 운영자 배지를 달 수 있고, 서비스가 조립하게 두면 두 경로가 각자 다른 규칙을
     * 갖게 된다.
     */
    fun reply(memberId: Long?, isOperator: Boolean, body: String): SuggestionReply {
        val suggestionId = id ?: error("저장되지 않은 제안에는 답글을 달 수 없습니다")
        if (!isOperator && !isOwnedBy(memberId)) {
            throw BusinessException(ErrorCode.FORBIDDEN, "제안을 쓴 본인과 운영자만 답글을 달 수 있습니다")
        }
        val authorId = memberId ?: throw BusinessException(ErrorCode.UNAUTHORIZED, "로그인이 필요합니다")
        return SuggestionReply.of(
            suggestionId = suggestionId,
            memberId = authorId,
            authorType = if (isOperator) ReplyAuthorType.OPERATOR else ReplyAuthorType.AUTHOR,
            authorName = if (isOperator) OPERATOR_NAME else nickname,
            body = body,
        )
    }

    private fun with(status: SuggestionStatus, body: String) = GameSuggestion(
        id = id,
        gameId = gameId,
        memberId = memberId,
        nickname = nickname,
        body = body,
        status = status,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    companion object {
        const val MIN_BODY = 5
        const val MAX_BODY = 500

        /** 랭킹 위젯(`public/games/lib/rank.js`)의 닉네임 규격과 같은 값이다 */
        const val MIN_NICKNAME = 2
        const val MAX_NICKNAME = 16

        /** 운영자 답글에 남는 이름. 사용자가 정하는 닉네임과 섞이지 않게 서버가 붙인다 */
        const val OPERATOR_NAME = "운영자"

        fun open(gameId: Long, memberId: Long, nickname: String, body: String): GameSuggestion =
            GameSuggestion(
                id = null,
                gameId = gameId,
                memberId = memberId,
                nickname = validateNickname(nickname),
                body = validateBody(body),
                status = SuggestionStatus.OPEN,
            )

        fun restore(
            id: Long?,
            gameId: Long,
            memberId: Long,
            nickname: String,
            body: String,
            status: SuggestionStatus,
            createdAt: LocalDateTime?,
            updatedAt: LocalDateTime?,
        ): GameSuggestion = GameSuggestion(
            id = id,
            gameId = gameId,
            memberId = memberId,
            nickname = nickname,
            body = body,
            status = status,
            createdAt = createdAt,
            updatedAt = updatedAt,
        )

        /**
         * 저장 직전의 본문 정규화 + 검증. 컨트롤러의 `@Size` 와 규칙이 갈리면 어느 쪽이
         * 진짜인지 알 수 없게 되므로, 실제로 저장되는 값은 항상 여기를 통과한 것이다.
         *
         * 상한이 짧은 것은 의도다 — 한 제안에 한 가지를 적어야 상태 하나로 처리할 수 있다.
         */
        fun validateBody(body: String): String {
            val trimmed = body.trim()
            if (trimmed.length !in MIN_BODY..MAX_BODY) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "제안은 $MIN_BODY~$MAX_BODY 자여야 합니다")
            }
            return trimmed
        }

        fun validateNickname(nickname: String): String {
            val trimmed = nickname.trim()
            if (trimmed.length !in MIN_NICKNAME..MAX_NICKNAME) {
                throw BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "닉네임은 $MIN_NICKNAME~$MAX_NICKNAME 자여야 합니다",
                )
            }
            return trimmed
        }
    }
}
