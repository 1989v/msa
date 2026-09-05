package com.kgd.game.presentation.access.controller

import com.kgd.common.security.JwtUtil
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

private val log = KotlinLogging.logger {}

/**
 * 비밀 게임의 관문.
 *
 * **정적 파일 요청마다 도는 자리다.** ingress 가 `/games/{slug}/` 아래의 모든 요청을
 * 받기 전에 이 주소로 먼저 물어본다(`auth-url`). 200 이면 파일을 내주고, 아니면 막는다 —
 * 그래서 주소를 알아도 허용되지 않은 계정은 wasm 한 덩이조차 못 받는다.
 *
 * **여기만 쿠키를 직접 읽는다.** 다른 API 는 게이트웨이가 `Authorization` 헤더를 보고
 * `X-User-Id` 를 붙여 주지만, 브라우저가 `.wasm` 을 받을 때는 헤더를 못 붙인다 —
 * 그때 신원을 담고 오는 것은 도메인 쿠키뿐이다(ADR-0079).
 *
 * **응답에 본문을 담지 않는다.** nginx 는 상태 코드만 보고, 본문은 버려진다.
 */
@RestController
@RequestMapping("/api/v1/games/private")
class PrivateGameGateController(
    private val checkAccess: CheckPrivateGameAccessUseCase,
    private val jwtUtil: JwtUtil,
) {
    @GetMapping("/{slug}/allow")
    fun allow(@PathVariable slug: String, request: HttpServletRequest): ResponseEntity<Void> {
        val token = tokenFrom(request)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        if (!jwtUtil.isValid(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
        }

        val memberId = jwtUtil.extractUserId(token)?.toLongOrNull()
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        if (!checkAccess.execute(slug, memberId)) {
            // 누가 두드렸는지는 남긴다 — 「나는 되는 줄 알았다」를 확인할 방법이 있어야 한다
            log.info { "비밀 게임 접근 거절 — slug=$slug member=$memberId" }
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        }
        return ResponseEntity.noContent().build()
    }

    private fun tokenFrom(request: HttpServletRequest): String? =
        request.cookies?.firstOrNull { it.name == ACCESS_TOKEN_COOKIE }?.value?.takeIf { it.isNotBlank() }

    companion object {
        /** `.1989v.com` 도메인 쿠키. 이름은 `portal-fe` · `games/lib/auth.js` 와 같아야 한다. */
        const val ACCESS_TOKEN_COOKIE = "portal_access_token"
    }
}
