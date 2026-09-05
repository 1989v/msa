package com.kgd.game.presentation.access.controller

import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase.Verdict
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 비밀 게임의 관문.
 *
 * **정적 파일 요청마다 도는 자리다.** ingress 가 `/games/{slug}/` 아래의 모든 요청을
 * 받기 전에 이 주소로 먼저 물어본다(`auth-url`). 204 면 파일을 내주고, 아니면 막는다 —
 * 그래서 주소를 알아도 허용되지 않은 계정은 wasm 한 덩이조차 못 받는다.
 *
 * **여기만 쿠키를 직접 읽는다.** 다른 API 는 게이트웨이가 `Authorization` 헤더를 보고
 * `X-User-Id` 를 붙여 주지만, 브라우저가 `.wasm` 을 받을 때는 헤더를 못 붙인다 —
 * 그때 신원을 담고 오는 것은 도메인 쿠키뿐이다(ADR-0079). 쿠키를 **꺼내는** 것까지가
 * 이 층의 일이고, 그게 누구인지 **푸는** 것은 application 이 포트로 한다.
 *
 * **응답에 본문을 담지 않는다.** nginx 는 상태 코드만 보고, 본문은 버려진다.
 */
@RestController
@RequestMapping("/api/v1/games/private")
class PrivateGameGateController(
    private val checkAccess: CheckPrivateGameAccessUseCase,
) {
    @GetMapping("/{slug}/allow")
    fun allow(@PathVariable slug: String, request: HttpServletRequest): ResponseEntity<Void> =
        when (checkAccess.execute(slug, tokenFrom(request))) {
            // 로그인하면 될 수도 있는 사람은 401 — ingress 가 로그인 화면으로 보낸다
            Verdict.NO_TOKEN, Verdict.BAD_TOKEN -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
            // 로그인했는데도 안 되는 사람은 403 — 로그인 화면으로 보내면 무한히 돈다
            Verdict.DENIED -> ResponseEntity.status(HttpStatus.FORBIDDEN).build()
            Verdict.ALLOWED -> ResponseEntity.noContent().build()
        }

    private fun tokenFrom(request: HttpServletRequest): String? =
        request.cookies?.firstOrNull { it.name == ACCESS_TOKEN_COOKIE }?.value

    companion object {
        /** `.1989v.com` 도메인 쿠키. 이름은 `portal-fe` · `games/lib/auth.js` 와 같아야 한다. */
        const val ACCESS_TOKEN_COOKIE = "portal_access_token"
    }
}
