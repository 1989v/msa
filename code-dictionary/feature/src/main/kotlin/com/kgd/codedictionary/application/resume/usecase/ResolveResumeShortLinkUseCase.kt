package com.kgd.codedictionary.application.resume.usecase

/**
 * 단축 주소 `/r/{code}` 해석. 목적지는 언제나 있다 — 실패(형식 오류·없음·폐기)는 resume 홈이고,
 * 응답에서 실패 종류를 구분하지 않는다. 302 응답은 컨트롤러가 만든다.
 */
interface ResolveResumeShortLinkUseCase {

    /** [path] 는 `/r` 뒤의 경로다(`""`, `"/"`, `"/list"`, `"/{code}"`). 쿼리는 넘기지 않는다. */
    fun execute(path: String): Resolution

    data class Resolution(
        val outcome: Outcome,
        /** 링크를 찾았을 때만 있다. 로그에는 코드·토큰 대신 이 값만 남긴다. */
        val shareLinkId: Long?,
        /** 302 목적지. 토큰이 들어 있을 수 있어 로그에 남기지 않는다. */
        val location: String,
    )

    enum class Outcome {
        RESOLVED,

        /** 코드 없음(`/r`, `/r/`) 또는 `/r/list` */
        HOME,
        MALFORMED,
        NOT_FOUND,
        REVOKED,
    }
}
