package com.kgd.codedictionary.domain.resume.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 제출처별 공유 토큰 (ADR-0064).
 *
 * [label] 은 "어디에 낸 링크인지"를 사람이 알아볼 이름이다. 열람 기록이 이 라벨 단위로 집계된다.
 */
class ResumeShareLink private constructor(
    val id: Long?,
    val token: String,
    val label: String,
    val note: String?,
    val createdAt: LocalDateTime?,
    val revokedAt: LocalDateTime?,
) {

    /** 폐기되지 않았으면 열람 가능. 만료는 두지 않는다 — 폐기는 명시적 행위여야 추적이 남는다. */
    fun isUsable(): Boolean = revokedAt == null

    companion object {
        /** 토큰 길이 — URL 에 붙는 값이라 사람이 옮겨 적을 일이 없다는 전제로 넉넉히 잡는다. */
        const val TOKEN_LENGTH = 32

        private val TOKEN_PATTERN = Regex("^[A-Za-z0-9_-]{16,64}$")

        fun create(token: String, label: String, note: String? = null): ResumeShareLink = restore(
            id = null,
            token = token,
            label = label,
            note = note,
            createdAt = null,
            revokedAt = null,
        )

        fun restore(
            id: Long?,
            token: String,
            label: String,
            note: String?,
            createdAt: LocalDateTime?,
            revokedAt: LocalDateTime?,
        ): ResumeShareLink {
            if (!TOKEN_PATTERN.matches(token)) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "토큰 형식이 올바르지 않습니다")
            }
            if (label.isBlank()) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "제출처 라벨은 비어 있을 수 없습니다")
            }
            return ResumeShareLink(
                id = id,
                token = token,
                label = label.trim(),
                note = note?.trim()?.takeIf { it.isNotEmpty() },
                createdAt = createdAt,
                revokedAt = revokedAt,
            )
        }
    }
}
