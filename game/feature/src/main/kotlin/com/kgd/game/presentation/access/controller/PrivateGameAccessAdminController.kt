package com.kgd.game.presentation.access.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.access.dto.PrivateGameAccessDto
import com.kgd.game.application.access.usecase.ManagePrivateGameAccessUseCase
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/**
 * 비밀 게임 허용 명단 — 어드민 전용 (게이트웨이에서 ROLE_ADMIN 게이트).
 *
 * **회원 번호로 넣는다.** 이 플랫폼은 소셜에서 이메일·실명을 받지 않으므로(ADR-0078)
 * 사람을 가리킬 수 있는 것은 회원 번호와 닉네임뿐이다. 판정은 번호로 하고, 누구인지는
 * [PrivateGameAccessRequest.note] 에 사람 말로 적어 둔다.
 */
@RestController
@RequestMapping("/api/v1/admin/games/private")
class PrivateGameAccessAdminController(
    private val manage: ManagePrivateGameAccessUseCase,
) {
    @GetMapping("/{slug}/members")
    fun list(@PathVariable slug: String): ApiResponse<List<PrivateGameAccessDto>> =
        ApiResponse.success(manage.list(slug))

    @PostMapping("/{slug}/members")
    @ResponseStatus(HttpStatus.CREATED)
    fun grant(
        @PathVariable slug: String,
        @RequestBody request: PrivateGameAccessRequest,
    ): ApiResponse<PrivateGameAccessDto> =
        ApiResponse.success(manage.grant(slug, request.memberId, request.note?.takeIf { it.isNotBlank() }))

    @DeleteMapping("/{slug}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun revoke(@PathVariable slug: String, @PathVariable memberId: Long) {
        if (!manage.revoke(slug, memberId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "허용 명단에 없는 회원이다: $memberId")
        }
    }
}

data class PrivateGameAccessRequest(
    @field:Positive(message = "회원 번호는 1 이상이어야 한다")
    val memberId: Long,
    @field:Size(max = 200, message = "메모는 200자를 넘을 수 없다")
    val note: String? = null,
)
