package com.kgd.blog.application.shortlink.usecase

/**
 * 단축 주소 `/b/{code}` 해석. 목적지는 언제나 있다 — 실패(형식 오류·없음·공개 아님)는 blog 홈이고,
 * 응답에서 실패 종류를 구분하지 않는다. 302 응답은 컨트롤러가 만든다.
 */
interface ResolveBlogShortLinkUseCase {

    /** [path] 는 `/b` 뒤의 경로다(`""`, `"/"`, `"/list"`, `"/{code}"`). 쿼리는 넘기지 않는다. */
    fun execute(path: String): Resolution

    data class Resolution(
        val outcome: Outcome,
        /** 코드를 디코딩했을 때만 있다 — 그 id 의 글이 없을 수도 있다. */
        val postId: Long?,
        /** 302 목적지 */
        val location: String,
    )

    enum class Outcome {
        RESOLVED,

        /** 코드 없음(`/b`, `/b/`) 또는 `/b/list` */
        HOME,
        MALFORMED,
        NOT_FOUND,

        /** 글은 있지만 공개 상태가 아님(초안·보관) */
        NOT_PUBLIC,
    }
}
