package com.kgd.game.domain.suggestion.model

/**
 * 답글을 쓴 사람의 자격.
 *
 * 이름만으로는 운영자와 제안자를 가를 수 없다 — 닉네임은 사용자가 정하므로 「운영자」라고
 * 지을 수 있다. 화면의 배지는 이 값이 그리고, 이 값은 요청이 아니라 서버가 정한다
 * ([GameSuggestion.reply]).
 */
enum class ReplyAuthorType {
    /** 운영자 */
    OPERATOR,

    /** 제안을 쓴 본인 */
    AUTHOR,
}
