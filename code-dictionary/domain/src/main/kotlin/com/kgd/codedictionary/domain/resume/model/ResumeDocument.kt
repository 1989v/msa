package com.kgd.codedictionary.domain.resume.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/** 화면 한 장에 대응하는 이력서 문서. 본문은 마크다운 원문 그대로 보관한다 (ADR-0064). */
class ResumeDocument private constructor(
    val id: Long?,
    val slug: String,
    val title: String,
    val bodyMarkdown: String,
    val kind: ResumeDocumentKind,
    val orderNo: Int,
    val published: Boolean,
    val createdAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
) {

    companion object {
        private val SLUG_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,79}$")

        fun create(
            slug: String,
            title: String,
            bodyMarkdown: String,
            kind: ResumeDocumentKind,
            orderNo: Int = 0,
            published: Boolean = true,
        ): ResumeDocument = restore(
            id = null,
            slug = slug,
            title = title,
            bodyMarkdown = bodyMarkdown,
            kind = kind,
            orderNo = orderNo,
            published = published,
        )

        fun restore(
            id: Long?,
            slug: String,
            title: String,
            bodyMarkdown: String,
            kind: ResumeDocumentKind,
            orderNo: Int,
            published: Boolean,
            createdAt: LocalDateTime? = null,
            updatedAt: LocalDateTime? = null,
        ): ResumeDocument {
            val normalizedSlug = slug.trim().lowercase()
            if (!SLUG_PATTERN.matches(normalizedSlug)) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "slug 형식이 올바르지 않습니다: $slug")
            }
            if (title.isBlank()) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "title 은 비어 있을 수 없습니다")
            }
            if (bodyMarkdown.isBlank()) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "본문은 비어 있을 수 없습니다")
            }
            return ResumeDocument(
                id = id,
                slug = normalizedSlug,
                title = title.trim(),
                bodyMarkdown = bodyMarkdown,
                kind = kind,
                orderNo = orderNo,
                published = published,
                createdAt = createdAt,
                updatedAt = updatedAt,
            )
        }
    }
}

enum class ResumeDocumentKind {
    /** 메인 1장 — 스크롤 없이 훑는 요약 */
    MAIN,

    /** 상세 화면 */
    DETAIL,
    ;

    companion object {
        fun parse(raw: String?): ResumeDocumentKind =
            entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) } ?: DETAIL
    }
}
