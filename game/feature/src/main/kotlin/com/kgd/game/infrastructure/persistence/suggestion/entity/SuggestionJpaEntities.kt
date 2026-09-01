package com.kgd.game.infrastructure.persistence.suggestion.entity

import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.ReplyAuthorType
import com.kgd.game.domain.suggestion.model.SuggestionReply
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "game_suggestion")
class GameSuggestionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false, updatable = false)
    val gameId: Long,
    @Column(name = "member_id", nullable = false, updatable = false)
    val memberId: Long,
    @Column(nullable = false, length = 24)
    val nickname: String,
    body: String,
    status: SuggestionStatus,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(nullable = false, length = 500)
    var body: String = body
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: SuggestionStatus = status
        private set

    /**
     * 도메인이 판정을 끝낸 값을 그대로 옮긴다. 필드를 서비스에서 직접 대입하지 않는 것이
     * 규약이라(entity-mutation) 갱신 통로를 하나로 둔다 — 본문과 상태 말고는 바뀌지 않는다.
     */
    fun apply(suggestion: GameSuggestion) {
        this.body = suggestion.body
        this.status = suggestion.status
    }

    fun toDomain(): GameSuggestion = GameSuggestion.restore(
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
        fun from(suggestion: GameSuggestion) = GameSuggestionJpaEntity(
            id = suggestion.id,
            gameId = suggestion.gameId,
            memberId = suggestion.memberId,
            nickname = suggestion.nickname,
            body = suggestion.body,
            status = suggestion.status,
        )
    }
}

@Entity
@Table(name = "game_suggestion_reply")
class SuggestionReplyJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "suggestion_id", nullable = false, updatable = false)
    val suggestionId: Long,
    @Column(name = "member_id", nullable = false, updatable = false)
    val memberId: Long,
    /** 요청이 아니라 서버가 정한 값이다 — 화면의 「운영자」 배지가 이걸 본다 */
    @Enumerated(EnumType.STRING)
    @Column(name = "author_type", nullable = false, length = 16)
    val authorType: ReplyAuthorType,
    @Column(name = "author_name", nullable = false, length = 24)
    val authorName: String,
    @Column(nullable = false, length = 1000)
    val body: String,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    fun toDomain(): SuggestionReply = SuggestionReply.restore(
        id = id,
        suggestionId = suggestionId,
        memberId = memberId,
        authorType = authorType,
        authorName = authorName,
        body = body,
        createdAt = createdAt,
    )

    companion object {
        fun from(reply: SuggestionReply) = SuggestionReplyJpaEntity(
            id = reply.id,
            suggestionId = reply.suggestionId,
            memberId = reply.memberId,
            authorType = reply.authorType,
            authorName = reply.authorName,
            body = reply.body,
        )
    }
}
