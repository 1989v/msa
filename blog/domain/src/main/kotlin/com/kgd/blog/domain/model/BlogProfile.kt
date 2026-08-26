package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

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
    // ─── 관측값 — 본인 편집 대상이 아니다. 승인 경로와 시스템만 채운다 ───
    val approvedAt: LocalDateTime? = null,
    val approvedByMemberId: Long? = null,
    val createdAt: LocalDateTime? = null,
) {
    init {
        validateDisplayName(displayName)
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

    /** 본인이 고치는 값만. 역할·상태는 어드민 경로로만 바뀐다 */
    fun updateProfile(displayName: String, bio: String?, avatarUrl: String?): BlogProfile =
        copy(displayName = displayName, bio = bio, avatarUrl = avatarUrl)

    /** 저자 신청 — 승인 전까지 핸들을 선점해 둔다(중복 신청·핸들 경합 방지) */
    fun applyAsAuthor(handle: String): BlogProfile =
        copy(handle = handle, role = ProfileRole.AUTHOR, status = ProfileStatus.PENDING)

    /** 승인 — 누가 언제 승인했는지 남긴다. 정지·복구 판단의 근거가 된다 */
    fun approve(approverMemberId: Long, at: LocalDateTime): BlogProfile =
        copy(role = ProfileRole.AUTHOR, status = ProfileStatus.ACTIVE, approvedAt = at, approvedByMemberId = approverMemberId)

    fun withStatus(status: ProfileStatus): BlogProfile = copy(status = status)

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

        /**
         * 신원을 사칭하는 데 쓰이는 말 — **부분 문자열**로 막는다. 핸들과 표시명 양쪽에 건다.
         *
         * 경로 충돌(RESERVED_HANDLES)과 목적이 다르므로 목록을 합치지 않는다. 저쪽은
         * 정확히 일치할 때만 문제지만("posts" 는 막고 "posts-of-kgd" 는 괜찮다), 이쪽은
         * "블로그관리자"·"admin-2" 처럼 붙여 쓴 것이 오히려 더 그럴듯해 보인다.
         *
         * 브랜드 이름(1989v)도 여기 있다 — 사이트 자신을 자칭하는 저자를 만들지 않기 위해서다.
         * 부분 일치라 "grassroots" 같은 무해한 말도 걸린다. 사칭 하나를 놓치는 쪽보다 낫다고 봤다.
         */
        val RESERVED_NAME_TERMS = setOf(
            "admin", "manager", "moderator", "official", "operator",
            "staff", "support", "sysop", "system", "owner", "root", "1989v",
            "어드민", "관리자", "관리인", "운영자", "운영진", "운영팀", "매니저", "공식", "고객센터",
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
            if (reservedTermIn(handle) != null) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "사용할 수 없는 핸들입니다: $handle")
            }
        }

        fun validateDisplayName(displayName: String) {
            if (displayName.isBlank() || displayName.length > MAX_DISPLAY_NAME) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "표시명은 1~$MAX_DISPLAY_NAME 자여야 합니다")
            }
            reservedTermIn(displayName)?.let {
                throw BusinessException(ErrorCode.INVALID_INPUT, "표시명에 쓸 수 없는 말이 있습니다: $it")
            }
        }

        /**
         * 걸린 금칙어, 없으면 null.
         *
         * 구분자를 먼저 지우고 본다 — 그러지 않으면 "a.d.m.i.n"·"관 리 자" 가 그대로 통과한다.
         */
        private fun reservedTermIn(value: String): String? {
            val normalized = value.lowercase().filter { it.isLetterOrDigit() }
            return RESERVED_NAME_TERMS.firstOrNull { it in normalized }
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
