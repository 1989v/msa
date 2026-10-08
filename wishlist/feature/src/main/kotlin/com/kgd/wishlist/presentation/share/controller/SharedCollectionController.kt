package com.kgd.wishlist.presentation.share.controller

import com.kgd.common.response.ApiResponse
import com.kgd.common.shortlink.ShortLinkRedirects
import com.kgd.wishlist.application.share.usecase.GetSharedCollectionUseCase
import com.kgd.wishlist.application.share.usecase.ResolveCollectionShortLinkUseCase
import com.kgd.wishlist.presentation.share.dto.SharedCollectionResponse
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

/**
 * 공유 묶음 열람과 단축 주소 `/c/{token}` — **로그인 없음** (ADR-0107).
 *
 * `X-User-Id` 를 받지 않는다. 게이트웨이가 이 경로에서 신원 헤더를 지우지만, 받지 않는 것이 먼저다.
 * 설정과 무관하게 항상 등록된다 — 빠지면 `GET /shared/x` 가 찜 컨트롤러의 `PUT/DELETE /{type}/{key}`
 * 와 겹쳐 405 가 된다. 꺼짐 판정은 서비스 첫 줄의 404 다.
 */
@RestController
class SharedCollectionController(
    private val getSharedCollectionUseCase: GetSharedCollectionUseCase,
    private val resolveCollectionShortLinkUseCase: ResolveCollectionShortLinkUseCase,
) {
    @GetMapping("/api/v1/wishlist/shared/{token}")
    fun get(@PathVariable token: String): ApiResponse<SharedCollectionResponse> =
        ApiResponse.success(SharedCollectionResponse.from(getSharedCollectionUseCase.get(token)))

    /** 목적지 호스트는 서비스가 설정에서 정한다 — 요청의 호스트·쿼리는 쓰지 않는다 */
    @GetMapping(PREFIX, "$PREFIX/**")
    fun open(request: HttpServletRequest): ResponseEntity<Void> {
        // `/c` 는 `/c/` 가 떼어지지 않아 "/c" 가 남고, 형식 검사에서 무효로 떨어진다
        val rest = request.requestURI.removePrefix(request.contextPath).removePrefix("$PREFIX/")
        return ShortLinkRedirects.redirect(resolveCollectionShortLinkUseCase.resolve(rest))
    }

    companion object {
        private const val PREFIX = "/c"
    }
}
