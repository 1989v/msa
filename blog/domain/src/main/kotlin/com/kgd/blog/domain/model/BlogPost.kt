package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * 글.
 *
 * 소유권 판정([isOwnedBy])이 이 도메인의 핵심이다 — 게이트웨이는 "로그인했는가"까지만 알고,
 * "내 글인가"는 여기서만 답할 수 있다. 서비스가 각자 `authorId == profileId` 를 쓰기 시작하면
 * 한 곳을 고칠 때 다른 곳이 남는다.
 */
data class BlogPost(
    val id: Long?,
    val authorProfileId: Long,
    val categoryId: Long,
    val slug: String,
    val title: String,
    val summary: String?,
    val body: String,
    val coverImageUrl: String?,
    val status: PostStatus,
    val publishedAt: LocalDateTime?,
) {
    init {
        if (!SLUG_PATTERN.matches(slug)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "글 슬러그 형식이 올바르지 않습니다: $slug")
        }
        if (title.isBlank() || title.length > MAX_TITLE) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "제목은 1~$MAX_TITLE 자여야 합니다")
        }
        if (body.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "본문은 비어 있을 수 없습니다")
        }
        if (summary != null && summary.length > MAX_SUMMARY) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "요약은 $MAX_SUMMARY 자를 넘을 수 없습니다")
        }
        if (status == PostStatus.PUBLISHED && publishedAt == null) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "발행된 글은 발행 시각이 필요합니다")
        }
    }

    val readingMinutes: Int get() = readingMinutesOf(body)

    fun isOwnedBy(profileId: Long?): Boolean = profileId != null && profileId == authorProfileId

    /**
     * 소유자이거나 어드민이어야 통과. 어드민을 여기서 함께 받는 이유는 호출부마다
     * `|| isAdmin` 을 붙이다가 한 군데를 빠뜨리는 것이 이 종류 버그의 전형이기 때문이다.
     */
    fun requireEditableBy(profileId: Long?, isAdmin: Boolean) {
        if (!isAdmin && !isOwnedBy(profileId)) {
            throw BusinessException(ErrorCode.FORBIDDEN, "본인이 작성한 글만 수정할 수 있습니다")
        }
    }

    fun requireTransitionTo(next: PostStatus) {
        if (status == next) return
        if (!status.canTransitionTo(next)) {
            throw BusinessException(
                ErrorCode.INVALID_INPUT,
                "글 상태를 $status 에서 $next 로 바꿀 수 없습니다",
            )
        }
    }

    /**
     * 메타 설명·OG description 으로 쓸 문구. 요약이 없으면 본문에서 뽑는다 —
     * 설명이 비면 검색결과와 공유 카드가 통째로 비어 보인다.
     */
    fun descriptionOrExcerpt(max: Int = MAX_SUMMARY): String {
        val source = summary?.takeIf { it.isNotBlank() } ?: plainTextExcerpt(body, max)
        return source.take(max)
    }

    companion object {
        const val MAX_TITLE = 200
        const val MAX_SUMMARY = 300
        const val MAX_SLUG = 80

        /** 한국어 기준 분당 읽는 글자 수. 정확한 값이 아니라 안정적인 값이 목적이다 */
        private const val CHARS_PER_MINUTE = 500
        private val SLUG_PATTERN = Regex("^[a-z0-9][a-z0-9-]{2,${MAX_SLUG - 1}}$")
        private val NON_SLUG = Regex("[^a-z0-9]+")
        private val DATE_PREFIX = DateTimeFormatter.ofPattern("yyyyMMdd")

        fun readingMinutesOf(body: String): Int =
            maxOf(1, (body.length + CHARS_PER_MINUTE - 1) / CHARS_PER_MINUTE)

        /**
         * 슬러그 확정. 입력이 있으면 그것을 쓰고, 없으면 제목에서 ASCII 슬러그를 뽑는다.
         *
         * **제목이 한글이면 뽑히는 게 없다.** 그게 예외가 아니라 기본 경로다 —
         * 그때는 `yyyyMMdd-{seed}` 로 간다. 한글을 로마자로 옮기지 않는 이유는 옮김 규칙이
         * 사람마다 달라 주소가 예측 불가능해지고, 나중에 규칙을 바꾸면 기존 주소가 죽기 때문이다.
         */
        fun resolveSlug(requested: String?, title: String, now: LocalDateTime, seed: String): String {
            requested?.trim()?.takeIf { it.isNotEmpty() }?.let {
                if (!SLUG_PATTERN.matches(it)) {
                    throw BusinessException(ErrorCode.INVALID_INPUT, "슬러그는 영소문자·숫자·하이픈 3~$MAX_SLUG 자여야 합니다")
                }
                return it
            }
            val fromTitle = title.lowercase().replace(NON_SLUG, "-").trim('-').take(MAX_SLUG).trim('-')
            if (SLUG_PATTERN.matches(fromTitle)) return fromTitle
            return "${now.format(DATE_PREFIX)}-${seed.lowercase().take(8)}"
        }

        /** 마크다운 표기를 걷어낸 첫 문단 — 서버 메타와 목록 카드가 함께 쓴다 */
        fun plainTextExcerpt(body: String, max: Int): String =
            body.lineSequence()
                .map { it.trim() }
                .filter { it.isNotEmpty() && !it.startsWith("```") && !it.startsWith("|") }
                .map { line ->
                    line.replace(Regex("^#{1,6}\\s*"), "")
                        .replace(Regex("!?\\[([^\\]]*)]\\([^)]*\\)"), "$1")
                        .replace(Regex("[*_`>]"), "")
                        .trim()
                }
                .filter { it.isNotEmpty() }
                .joinToString(" ")
                .take(max)
                .trim()
    }
}
