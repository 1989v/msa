package com.kgd.codedictionary.domain.resume.model

/**
 * 이력서 사이트의 공개 상태 (ADR-0064).
 *
 * 구직 중이 아닐 때는 [TOKEN_ONLY] 로 두고, 직접 전달한 링크(토큰)로만 열리게 한다.
 */
enum class ResumeVisibility {
    /** 전체 공개 — 토큰 없이 누구나 열람 */
    PUBLIC,

    /** 유효한 공유 토큰이 있어야만 열람 */
    TOKEN_ONLY,
    ;

    companion object {
        fun parse(raw: String?): ResumeVisibility =
            entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) } ?: TOKEN_ONLY
    }
}
