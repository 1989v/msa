package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 블로그 안의 신원 (ADR-0072 §2).
 *
 * **작성 권한은 전역 역할이 아니라 이 객체가 갖는다.** `ROLE_AUTHOR` 를 auth 의 Role enum 에
 * 더하지 않은 이유는 두 가지다 — 역할 하나로는 핸들·표시명·소개를 담지 못해 어차피 이
 * 프로필이 필요하고, 권한 진실이 JWT 클레임과 두 군데로 갈리면 정지 처분이 토큰 만료
 * 전까지 먹지 않는다.
 *
 * 게이트웨이는 "로그인했는가"까지만 본다. "쓸 수 있는가"와 "내 글인가"는 엣지가 알 수 없다.
 */
data class BlogProfile(
    val id: Long?,
    val memberId: Long,
    val handle: String?,
    val displayName: String,
    val bio: String?,
    val avatarUrl: String?,
    val role: ProfileRole,
    val status: ProfileStatus,
) {
    init {
        if (displayName.isBlank() || displayName.length > MAX_DISPLAY_NAME) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "표시명은 1~$MAX_DISPLAY_NAME 자여야 합니다")
        }
        handle?.let(::validateHandle)
        if (role == ProfileRole.AUTHOR && handle == null) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "저자는 핸들이 필요합니다")
        }
    }

    /** 글을 쓰고 고칠 수 있는가. 승인 대기(PENDING)와 정지(SUSPENDED)는 둘 다 불가 */
    fun canWrite(): Boolean = role == ProfileRole.AUTHOR && status == ProfileStatus.ACTIVE

    /**
     * 댓글을 남길 수 있는가.
     *
     * 정지가 글쓰기만 막고 댓글을 열어 두면 처분이 사실상 무력해진다. 두 경로가 같은
     * 판정을 쓰도록 도메인에 둔다.
     */
    fun canInteract(): Boolean = status == ProfileStatus.ACTIVE

    fun requireCanWrite() {
        if (!canWrite()) {
            throw BusinessException(ErrorCode.FORBIDDEN, "블로그 작성 권한이 없습니다")
        }
    }

    fun requireCanInteract() {
        if (!canInteract()) {
            throw BusinessException(ErrorCode.FORBIDDEN, "이용이 제한된 계정입니다")
        }
    }

    /** 작성자 공간(`/authors/{handle}`)을 갖는가 — 승인 전에는 공간이 없다 */
    fun hasPublicSpace(): Boolean = canWrite() && handle != null

    companion object {
        const val MAX_DISPLAY_NAME = 40
        private val HANDLE_PATTERN = Regex("^[a-z0-9][a-z0-9-]{2,29}$")

        /**
         * 핸들로 쓸 수 없는 값 — blog 호스트의 실제 경로와 충돌한다.
         * 경로를 추가하면 여기도 함께 늘린다. 빠뜨리면 그 경로가 통째로 가려진다.
         */
        val RESERVED_HANDLES = setOf(
            "admin", "api", "posts", "authors", "c", "studio", "login", "logout",
            "new", "write", "edit", "settings", "search", "tag", "tags", "rss", "feed",
            "sitemap", "robots", "assets", "static", "oauth", "me",
        )

        fun validateHandle(handle: String) {
            if (!HANDLE_PATTERN.matches(handle)) {
                throw BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "핸들은 영소문자·숫자·하이픈 3~30자여야 합니다: $handle",
                )
            }
            if (handle in RESERVED_HANDLES) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "사용할 수 없는 핸들입니다: $handle")
            }
        }

        /** 첫 댓글 시 자동 생성되는 독자 프로필 */
        fun newReader(memberId: Long, displayName: String) = BlogProfile(
            id = null,
            memberId = memberId,
            handle = null,
            displayName = displayName,
            bio = null,
            avatarUrl = null,
            role = ProfileRole.READER,
            status = ProfileStatus.ACTIVE,
        )
    }
}
