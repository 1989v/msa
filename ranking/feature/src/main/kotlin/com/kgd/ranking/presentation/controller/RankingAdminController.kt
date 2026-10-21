package com.kgd.ranking.presentation.controller

import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException
import com.kgd.common.response.ApiResponse
import com.kgd.ranking.application.admin.dto.*
import com.kgd.ranking.application.admin.usecase.RankingAdminUseCase
import org.springframework.http.HttpStatus
import org.springframework.util.MultiValueMap
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

/** Trusted gateway headers, same contract as ads. Content must remain ingress-private. */
@RestController
@RequestMapping("/api/v1/admin/ranking")
class RankingAdminController(private val admin: RankingAdminUseCase) {
    internal fun identity(user: String?, roles: String?): Long {
        val id = user?.trim()?.toLongOrNull() ?: throw UnauthorizedException()
        if (roles?.split(',')?.none { it.trim() == "ROLE_ADMIN" } != false) throw ForbiddenException()
        return id
    }
    private fun <T> result(block: () -> T): ApiResponse<T> = try { ApiResponse.success(block()) }
    catch (e: AdminValidation) { throw e }
    catch (e: AdminConflict) { throw ResponseStatusException(HttpStatus.CONFLICT, e.message) }
    catch (e: AdminNotFound) { throw ResponseStatusException(HttpStatus.NOT_FOUND, e.message) }
    catch (e: java.time.DateTimeException) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date") }
    catch (e: IllegalArgumentException) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ranking admin request") }

    @ExceptionHandler(AdminValidation::class)
    fun fieldError(error: AdminValidation): org.springframework.http.ResponseEntity<ApiResponse<Nothing>> =
        org.springframework.http.ResponseEntity.badRequest().body(ApiResponse.error("INVALID_FIELD_${error.field}", error.message ?: "Invalid field"))

    @GetMapping("/{*path}")
    fun read(@PathVariable path: String, @RequestParam params: MultiValueMap<String, String>, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?): ApiResponse<Any> {
        identity(user, roles); return result { admin.read(path.trimStart('/'), params) }
    }
    @PatchMapping("/cafe/drinks/{key}/corrections")
    fun correct(@PathVariable key: String, @RequestBody request: CorrectionRequest, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?) = result { admin.correct(key, request, identity(user, roles)) }
    @PostMapping("/cafe/group-corrections/preview")
    fun preview(@RequestBody request: PreviewRequest, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?) = result { admin.preview(request, identity(user, roles)) }
    @PostMapping("/cafe/group-corrections")
    fun apply(@RequestBody request: ApplyPreviewRequest, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?) = result { admin.apply(request, identity(user, roles)) }
    @PatchMapping("/cafe/brands/{brand}/verification")
    fun verify(@PathVariable brand: String, @RequestBody request: VerificationRequest, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?) = result { admin.verify(brand, request, identity(user, roles)) }
    @PostMapping("/conflicts/{id}/resolve")
    fun resolve(@PathVariable id: String, @RequestBody request: ResolveRequest, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?) = result { admin.resolve(id, request, identity(user, roles)) }
    @PostMapping("/operations/{id}/revert")
    fun revert(@PathVariable id: String, @RequestBody request: RevertRequest, @RequestHeader("X-User-Id", required = false) user: String?, @RequestHeader("X-User-Roles", required = false) roles: String?) = result { admin.revert(id, request, identity(user, roles)) }
}
