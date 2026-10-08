package com.kgd.common.shortlink

/**
 * 접두사 뒤 경로(`""`, `"/"`, `"/list"`, `"/abc123"`, `"/abc123/x"`)를 가른다.
 *
 * 세그먼트만 나누고 코드 형식은 보지 않는다 — 공개 콘텐츠는 [ShortCode.decode], 이력서는 저장된 10자 코드로
 * 도메인이 판정한다. 쿼리는 컨트롤러가 넘기지 않는다. 끝의 `/` 하나는 허용한다.
 */
sealed interface ShortLinkPath {
    /** 코드 없음 또는 `list` — 서비스 홈으로 보낸다. */
    data object Home : ShortLinkPath

    data class Code(val value: String) : ShortLinkPath

    /** 세그먼트가 둘 이상 — 해석 실패와 같이 처리한다. */
    data object Invalid : ShortLinkPath

    companion object {
        private const val LIST_ALIAS = "list"

        fun parse(path: String): ShortLinkPath {
            val rest = path.removePrefix("/").removeSuffix("/")
            return when {
                rest.isEmpty() || rest == LIST_ALIAS -> Home
                '/' in rest -> Invalid
                else -> Code(rest)
            }
        }
    }
}
