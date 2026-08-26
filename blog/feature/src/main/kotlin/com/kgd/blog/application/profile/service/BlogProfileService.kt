package com.kgd.blog.application.profile.service

import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.application.profile.usecase.ApplyAsBlogAuthorUseCase
import com.kgd.blog.application.profile.usecase.UpdateBlogProfileUseCase
import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 블로그 신원의 단일 관문 (ADR-0072 §2).
 *
 * "이 사람이 글을 쓸 수 있는가"를 판정하는 곳은 여기 하나다. 서비스마다 role/status 를
 * 직접 보기 시작하면 정지 처분이 한 경로에서만 먹는 상태가 만들어진다.
 */
@Service
@Transactional(readOnly = true)
class BlogProfileService(
    private val profileRepository: BlogProfileRepositoryPort,
    private val postRepository: BlogPostRepositoryPort,
) : UpdateBlogProfileUseCase, ApplyAsBlogAuthorUseCase {

    fun find(identity: BlogIdentity): BlogProfile? =
        identity.memberId?.let { profileRepository.findByMemberId(it) }

    /** 로그인은 게이트웨이가 보장한다. 여기서 없다는 것은 라우트가 잘못 걸린 것이다 */
    fun requireMemberId(identity: BlogIdentity): Long =
        identity.memberId ?: throw BusinessException(ErrorCode.UNAUTHORIZED, "로그인이 필요합니다")

    /** 글을 쓰려는 경로의 관문. 어드민은 프로필이 없으면 만들어 준다(글에 저자가 반드시 있어야 한다) */
    @Transactional
    fun requireWritableProfile(identity: BlogIdentity): BlogProfile {
        val memberId = requireMemberId(identity)
        val existing = profileRepository.findByMemberId(memberId)
        if (existing != null) {
            if (identity.isAdmin) existing.requireCanInteract() else existing.requireCanWrite()
            return existing
        }
        if (!identity.isAdmin) {
            throw BusinessException(ErrorCode.FORBIDDEN, "블로그 작성 권한이 없습니다")
        }
        // 저자 없는 글이 생기면 작성자 공간·목록·JSON-LD 가 전부 예외 분기를 갖게 된다.
        // 신원은 "편집자" 다 — 사칭 금칙어(BlogProfile.RESERVED_NAME_TERMS)를 남에게만 걸고
        // 시스템이 만드는 프로필은 "관리자" 를 쓰면, 그 이름이 진짜인지 사칭인지 읽는 쪽이 구분할 수 없다.
        return profileRepository.save(
            BlogProfile(
                id = null,
                memberId = memberId,
                handle = uniqueHandle("editor-$memberId"),
                displayName = "편집자",
                bio = null,
                avatarUrl = null,
                role = ProfileRole.AUTHOR,
                status = ProfileStatus.ACTIVE,
            ),
        )
    }

    /** 댓글 경로의 관문. 첫 댓글이면 독자 프로필을 만든다 */
    @Transactional
    fun requireInteractiveProfile(identity: BlogIdentity, displayName: String?): BlogProfile {
        val memberId = requireMemberId(identity)
        val existing = profileRepository.findByMemberId(memberId)
        if (existing != null) {
            existing.requireCanInteract()
            return existing
        }
        val name = displayName?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "표시할 이름이 필요합니다")
        return profileRepository.save(BlogProfile.newReader(memberId, name))
    }

    @Transactional
    override fun execute(command: UpdateBlogProfileUseCase.Command): BlogProfileAdminResponse {
        val (identity, request) = command
        val profile = find(identity)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "블로그 프로필이 없습니다")
        val displayName = request.displayName.trim()
        // 도메인 생성 시점의 검증이 갱신에도 그대로 걸린다 (copy 도 init 을 탄다)
        BlogProfile.validateDisplayName(displayName)
        return response(profileRepository.save(profile.updateProfile(displayName, request.bio, request.avatarUrl)))
    }

    /**
     * 저자 신청. 핸들은 승인 전에 선점한다 — 승인 시점에 남이 가져가 있으면
     * 승인 자체가 실패하고, 그 실패를 신청자가 알 방법이 없다.
     */
    @Transactional
    override fun execute(command: ApplyAsBlogAuthorUseCase.Command): BlogProfileAdminResponse {
        val (identity, request) = command
        val memberId = requireMemberId(identity)
        val handle = request.handle.trim().lowercase()
        val displayName = request.displayName.trim()
        BlogProfile.validateHandle(handle)
        BlogProfile.validateDisplayName(displayName)

        val profile = profileRepository.findByMemberId(memberId)
            ?: profileRepository.save(BlogProfile.newReader(memberId, displayName))
        profile.requireCanInteract()
        if (profile.role == ProfileRole.AUTHOR && profile.status == ProfileStatus.ACTIVE) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 저자입니다")
        }
        if (profile.handle != handle && profileRepository.existsByHandle(handle)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 사용 중인 핸들입니다: $handle")
        }
        val applied = profile.updateProfile(displayName, request.bio, profile.avatarUrl).applyAsAuthor(handle)
        return response(profileRepository.save(applied))
    }

    fun response(profile: BlogProfile) = BlogProfileAdminResponse(
        id = profile.id ?: 0,
        memberId = profile.memberId,
        handle = profile.handle,
        displayName = profile.displayName,
        bio = profile.bio,
        role = profile.role,
        status = profile.status,
        postCount = profile.id?.let { postRepository.countByAuthor(it, null) } ?: 0,
        approvedAt = profile.approvedAt,
        createdAt = profile.createdAt,
    )

    /** 어드민 자동 생성 시에만 쓴다 — 충돌하면 뒤에 숫자를 붙인다 */
    private fun uniqueHandle(base: String): String {
        if (!profileRepository.existsByHandle(base)) return base
        var suffix = 2
        while (profileRepository.existsByHandle("$base-$suffix")) suffix++
        return "$base-$suffix"
    }
}
