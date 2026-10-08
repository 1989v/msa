package com.kgd.game.application.shortlink.usecase

/**
 * 단축 주소 `/g/{code}` 해석. 목적지는 언제나 있다 — 실패(형식 오류·없음·공개 아님)는 game 홈이고,
 * 응답에서 실패 종류를 구분하지 않는다. 302 응답은 컨트롤러가 만든다.
 */
interface ResolveGameShortLinkUseCase {

    /** [path] 는 `/g` 뒤의 경로다(`""`, `"/"`, `"/list"`, `"/{code}"`). 쿼리는 넘기지 않는다. */
    fun execute(path: String): Resolution

    data class Resolution(
        val outcome: Outcome,
        /** 코드를 디코딩했을 때만 있다 — 그 id 의 게임이 없을 수도 있다. */
        val gameId: Long?,
        /** 302 목적지 */
        val location: String,
    )

    enum class Outcome {
        RESOLVED,

        /** 코드 없음(`/g`, `/g/`) 또는 `/g/list` */
        HOME,
        MALFORMED,
        NOT_FOUND,

        /** 게임은 있지만 플레이할 수 없는 상태 — 공개 상세와 같은 판정 */
        NOT_PUBLIC,
    }
}
