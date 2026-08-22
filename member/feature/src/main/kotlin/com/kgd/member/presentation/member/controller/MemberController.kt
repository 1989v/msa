package com.kgd.member.presentation.member.controller

import com.kgd.common.response.ApiResponse
import com.kgd.member.application.member.usecase.GetMemberProfileUseCase
import com.kgd.member.application.member.usecase.GetOrCreateMemberUseCase
import com.kgd.member.application.member.usecase.UpdateMemberNameUseCase
import com.kgd.member.application.member.usecase.WithdrawMemberUseCase
import com.kgd.member.domain.model.SsoProvider
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/members")
class MemberController(
    private val getOrCreateMemberUseCase: GetOrCreateMemberUseCase,
    private val getMemberProfileUseCase: GetMemberProfileUseCase,
    private val updateMemberNameUseCase: UpdateMemberNameUseCase,
    private val withdrawMemberUseCase: WithdrawMemberUseCase
) {
    // SSO 기반 회원 조회/생성 (auth 서비스 내부 호출)
    @PostMapping("/sso")
    fun getOrCreateMember(@RequestBody request: SsoMemberRequest): ApiResponse<SsoMemberResponse> {
        val result = getOrCreateMemberUseCase.execute(
            GetOrCreateMemberUseCase.Command(
                ssoProvider = SsoProvider.valueOf(request.ssoProvider),
                ssoProviderId = request.subjectHash
            )
        )
        return ApiResponse.success(
            SsoMemberResponse(
                id = result.id,
                isNewMember = result.isNewMember
            )
        )
    }

    // 내 프로필 조회
    @GetMapping("/me")
    fun getMyProfile(@RequestHeader("X-User-Id") userId: String): ApiResponse<MemberProfileResponse> {
        val result = getMemberProfileUseCase.execute(
            GetMemberProfileUseCase.Query(memberId = userId.toLong())
        )
        return ApiResponse.success(
            MemberProfileResponse(
                id = result.id,
                name = result.name,
                ssoProvider = result.ssoProvider,
                status = result.status.name
            )
        )
    }

    // 이름 수정
    @PatchMapping("/me/name")
    fun updateMyName(
        @RequestHeader("X-User-Id") userId: String,
        @RequestBody request: UpdateNameRequest
    ): ApiResponse<Unit> {
        updateMemberNameUseCase.execute(
            UpdateMemberNameUseCase.Command(
                memberId = userId.toLong(),
                name = request.name
            )
        )
        return ApiResponse.success(Unit)
    }

    // 회원 탈퇴
    @DeleteMapping("/me")
    fun withdraw(@RequestHeader("X-User-Id") userId: String): ApiResponse<Unit> {
        withdrawMemberUseCase.execute(
            WithdrawMemberUseCase.Command(memberId = userId.toLong())
        )
        return ApiResponse.success(Unit)
    }
}

/** [subjectHash] 는 auth 가 HMAC 을 씌운 소셜 식별값이다 (ADR-0078) */
data class SsoMemberRequest(
    val ssoProvider: String,
    val subjectHash: String
)

data class SsoMemberResponse(
    val id: Long,
    val isNewMember: Boolean
)

data class MemberProfileResponse(
    val id: Long,
    val name: String,
    val ssoProvider: String,
    val status: String
)

data class UpdateNameRequest(val name: String)
