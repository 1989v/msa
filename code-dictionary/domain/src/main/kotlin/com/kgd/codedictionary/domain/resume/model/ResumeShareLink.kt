package com.kgd.codedictionary.domain.resume.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 제출처별 공유 토큰 (ADR-0064).
 *
 * [label] 은 "어디에 낸 링크인지"를 사람이 알아볼 이름이다. 열람 기록이 이 라벨 단위로 집계된다.
 *
 * [shortCode] 는 단축 주소 `1989v.com/r/{code}` 의 코드다. 무작위로 정해 저장하고 바꾸지 않는다 —
 * id 에서 계산하면 추측할 수 있게 되어 토큰 게이트가 무력해진다. 폐기한 링크의 코드는 해석에 실패한다.
 */
class ResumeShareLink private constructor(
    val id: Long?,
    val token: String,
    val shortCode: String,
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

        /**
         * 단축 주소 코드 길이 — 10자 base62(약 59비트). 토큰과 같은 열람 권한이라 추측할 수 없어야 하고,
         * 지원서 입력란에 옮겨 적을 만큼 짧아야 한다.
         */
        const val SHORT_CODE_LENGTH = 10

        const val SHORT_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

        // 대소문자를 구분한다. 구분하지 않으면 실효 엔트로피가 약 52비트로 준다.
        private val SHORT_CODE_PATTERN = Regex("^[0-9A-Za-z]{$SHORT_CODE_LENGTH}$")

        fun isValidShortCode(code: String): Boolean = SHORT_CODE_PATTERN.matches(code)

        fun create(token: String, shortCode: String, label: String, note: String? = null): ResumeShareLink = restore(
            id = null,
            token = token,
            shortCode = shortCode,
            label = label,
            note = note,
            createdAt = null,
            revokedAt = null,
        )

        fun restore(
            id: Long?,
            token: String,
            shortCode: String,
            label: String,
            note: String?,
            createdAt: LocalDateTime?,
            revokedAt: LocalDateTime?,
        ): ResumeShareLink {
            if (!TOKEN_PATTERN.matches(token)) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "토큰 형식이 올바르지 않습니다")
            }
            if (!isValidShortCode(shortCode)) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "단축 코드 형식이 올바르지 않습니다")
            }
            if (label.isBlank()) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "제출처 라벨은 비어 있을 수 없습니다")
            }
            return ResumeShareLink(
                id = id,
                token = token,
                shortCode = shortCode,
                label = label.trim(),
                note = note?.trim()?.takeIf { it.isNotEmpty() },
                createdAt = createdAt,
                revokedAt = revokedAt,
            )
        }
    }
}
