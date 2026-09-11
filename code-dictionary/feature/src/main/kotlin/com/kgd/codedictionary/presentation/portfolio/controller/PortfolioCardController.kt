package com.kgd.codedictionary.presentation.portfolio.controller

import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardDetailDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardSummaryDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioProjectsDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioTimelineDto
import com.kgd.codedictionary.application.portfolio.usecase.GetPortfolioProjectsUseCase
import com.kgd.codedictionary.application.portfolio.usecase.GetPortfolioCardsUseCase
import com.kgd.codedictionary.application.portfolio.dto.PortfolioSort
import com.kgd.codedictionary.application.portfolio.usecase.GetPortfolioTimelineUseCase
import com.kgd.codedictionary.application.portfolio.dto.SnippetUnlockDto
import com.kgd.codedictionary.application.portfolio.usecase.UnlockSnippetUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/portfolio")
class PortfolioCardController(
    private val getPortfolioCards: GetPortfolioCardsUseCase,
    private val getTimeline: GetPortfolioTimelineUseCase,
    private val getProjects: GetPortfolioProjectsUseCase,
    private val unlockSnippet: UnlockSnippetUseCase,
) {

    /** 메인의 포트폴리오 타임라인 (ADR-0066). 재직 기간·직무 + 개인 프로젝트만 나간다. */
    @GetMapping("/timeline")
    fun timeline(): ApiResponse<PortfolioTimelineDto> =
        ApiResponse.success(getTimeline.timeline())

    /**
     * `/portfolio` 공개 아카이브 (ADR-0066 개정).
     *
     * 공개로 표시된 프로젝트 전부가 나가되 **회사명은 나가지 않는다.**
     * 타임라인(`/timeline`)이 개인 프로젝트만 싣는 것과 범위가 다르다.
     *
     * 코드 스니펫 전문은 프리미엄이다 — 로그인 사용자(게이트웨이가 주입하는 X-User-Id)
     * 이거나 광고 시청 토큰(`?unlock=`, [snippetUnlock] 발급)이 유효할 때만 실린다.
     * 토큰을 헤더가 아니라 쿼리로 받는 이유: 이력서 공유 토큰(`?token=`)과 같은 결로,
     * 익명 GET 에 커스텀 헤더를 더하면 CORS preflight 만 는다.
     */
    @GetMapping("/projects")
    fun projects(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestParam(required = false) unlock: String?,
    ): ApiResponse<PortfolioProjectsDto> =
        ApiResponse.success(
            getProjects.projects(
                unlocked = userId != null || unlockSnippet.isValid(unlock),
            ),
        )

    /** 광고 시청 완료 보상 — 스니펫 잠금 해제 토큰 발급 */
    @PostMapping("/snippet-unlock")
    fun snippetUnlock(): ApiResponse<SnippetUnlockDto> =
        ApiResponse.success(unlockSnippet.issue())

    @GetMapping("/cards")
    fun list(
        @RequestParam(required = false) sort: String?,
        @RequestParam(required = false) stack: String?,
        @RequestParam(required = false) q: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): ApiResponse<Page<PortfolioCardSummaryDto>> {
        val stacks = stack?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
        val result = getPortfolioCards.list(
            sort = PortfolioSort.parse(sort),
            stacks = stacks,
            q = q,
            page = page,
            size = size,
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/cards/{id}")
    fun detail(@PathVariable id: Long): ApiResponse<PortfolioCardDetailDto> =
        ApiResponse.success(getPortfolioCards.findById(id))
}
