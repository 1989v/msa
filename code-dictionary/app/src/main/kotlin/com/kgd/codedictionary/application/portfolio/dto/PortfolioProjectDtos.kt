package com.kgd.codedictionary.application.portfolio.dto

import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCodeSnippet
import com.kgd.codedictionary.domain.resume.model.ResumeProject

/**
 * `/portfolio` 공개 아카이브 (ADR-0066 개정).
 *
 * 이력서와 **같은 데이터를 다른 범위로** 내보낸다. 프로젝트 내용은 공개하되
 * **어느 회사에서 한 일인지는 내보내지 않는다** — 그래서 회사 필드를 아예 두지 않았다.
 * 필드가 없으면 실수로 채울 자리도 없다.
 *
 * 상세 문서 slug 는 싣지 않는다 — 상세는 게이트 뒤 resume 호스트에만 있어 링크하면 404 다.
 *
 * 본문은 **공개용 컬럼만** 싣는다. 게이트 뒤 본문(`bodyMarkdown`)에는 장애 대응의 구체적
 * 경위가 들어가므로 이 DTO 는 그 필드를 아예 모른다 — 이름이 비슷해 실수하기 쉬운 자리라
 * 필드 자체를 두지 않았다.
 */
data class PortfolioProjectsDto(
    val projects: List<PortfolioProjectDto>,
    val categories: List<PortfolioCategoryDto>,
)

data class PortfolioProjectDto(
    val title: String,
    val categoryCode: String?,
    val summary: String?,
    /** 공개용 서술. 게이트 뒤 본문과 다른 글이다. */
    val body: String?,
    val metrics: List<String>,
    val tags: List<String>,
    val snippets: List<PortfolioSnippetDto>,
    val orderNo: Int,
) {
    companion object {
        fun from(
            project: ResumeProject,
            category: ResumeCategory?,
            tags: List<String>,
            snippets: List<PortfolioSnippetDto> = emptyList(),
        ) = PortfolioProjectDto(
            title = project.title,
            categoryCode = category?.code,
            summary = project.summary,
            body = project.publicBodyMarkdown,
            metrics = project.metrics,
            tags = tags,
            snippets = snippets,
            orderNo = project.orderNo,
        )
    }
}

/**
 * 공개면의 코드 스니펫 — 프리미엄 게이트 (ADR-0066 개정).
 *
 * 익명에게는 상단 미리보기만 싣고 전문(`code`)은 **null 이 아니라 자리 자체가 비어** 나간다.
 * 화면에서 가리는 방식은 응답을 열어 보면 끝이라, 회사명 스크럽과 같은 원칙을 쓴다 —
 * 보여주지 않을 것은 응답에 싣지 않는다.
 */
data class PortfolioSnippetDto(
    val id: Long,
    val title: String?,
    val language: String,
    val filePath: String?,
    val lineStart: Int?,
    val lineEnd: Int?,
    val gitUrl: String?,
    /** 상단 8줄 — 전문이 그보다 짧으면 전문 그대로 */
    val previewCode: String,
    val totalLines: Int,
    val locked: Boolean,
    /** 잠금 해제 시에만 실린다 */
    val code: String?,
) {
    companion object {
        fun from(snippet: ResumeCodeSnippet, unlocked: Boolean) = PortfolioSnippetDto(
            id = requireNotNull(snippet.id) { "저장된 스니펫이어야 합니다" },
            title = snippet.title,
            language = snippet.language,
            filePath = snippet.filePath,
            lineStart = snippet.lineStart,
            lineEnd = snippet.lineEnd,
            gitUrl = snippet.gitUrl,
            previewCode = snippet.preview(),
            totalLines = snippet.totalLines,
            locked = !unlocked,
            code = if (unlocked) snippet.code else null,
        )
    }
}

data class PortfolioCategoryDto(
    val code: String,
    val label: String,
    val description: String?,
) {
    companion object {
        fun from(category: ResumeCategory) = PortfolioCategoryDto(
            code = category.code,
            label = category.label,
            description = category.description,
        )
    }
}
