package com.kgd.codedictionary.application.portfolio.service

import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCodeSnippetRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectSkillRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSkillRepositoryPort
import com.kgd.codedictionary.domain.resume.model.ResumeCodeSnippet
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

/**
 * 공개 아카이브의 스니펫 게이트 (ADR-0066 개정).
 *
 * 지키려는 것 — **잠긴 응답에는 전문이 실리지 않는다.** 화면에서 가리는 게 아니라
 * 응답에 없어야 한다 (회사명 스크럽과 같은 원칙).
 */
class PortfolioProjectServiceTest : BehaviorSpec({

    val categoryRepository = mockk<ResumeCategoryRepositoryPort>()
    val projectRepository = mockk<ResumeProjectRepositoryPort>()
    val skillRepository = mockk<ResumeSkillRepositoryPort>()
    val projectSkillRepository = mockk<ResumeProjectSkillRepositoryPort>()
    val codeSnippetRepository = mockk<ResumeCodeSnippetRepositoryPort>()
    val service = PortfolioProjectService(
        categoryRepository,
        projectRepository,
        skillRepository,
        projectSkillRepository,
        codeSnippetRepository,
    )

    every { categoryRepository.findAll() } returns emptyList()
    every { skillRepository.findAll() } returns emptyList()
    every { projectSkillRepository.skillIdsByProject() } returns emptyMap()

    val longCode = (1..20).joinToString("\n") { "line $it" }

    fun project(id: Long) = ResumeProject(
        id = id,
        title = "프로젝트 $id",
        companyId = null,
        categoryId = null,
        period = null,
        summary = null,
        bodyMarkdown = null,
        publicBodyMarkdown = "공개 본문",
        metrics = emptyList(),
        skillIds = emptyList(),
        detailSlug = null,
        orderNo = 0,
        published = true,
    )

    fun snippet(id: Long, projectId: Long, code: String) = ResumeCodeSnippet(
        id = id,
        projectId = projectId,
        title = "스니펫 $id",
        language = "kotlin",
        filePath = "app/src/main/kotlin/Sample.kt",
        lineStart = 1,
        lineEnd = 20,
        gitUrl = "https://github.com/example/msa",
        code = code,
        orderNo = 0,
    )

    given("스니펫이 붙은 프로젝트가 있을 때") {
        every { projectRepository.findAllPublished() } returns listOf(project(1L))
        every { codeSnippetRepository.snippetsByProject() } returns
            mapOf(1L to listOf(snippet(100L, 1L, longCode)))

        `when`("익명으로 조회하면") {
            val result = service.projects(unlocked = false)
            val snippetDto = result.projects.single().snippets.single()

            then("잠긴 채로 미리보기 8줄만 나간다") {
                snippetDto.locked shouldBe true
                snippetDto.previewCode shouldBe (1..8).joinToString("\n") { "line $it" }
                snippetDto.totalLines shouldBe 20
            }

            then("전문은 응답에 실리지 않는다") {
                snippetDto.code.shouldBeNull()
            }

            then("메타데이터는 잠겨 있어도 나간다 — 무엇이 잠겼는지는 보여야 연다") {
                snippetDto.title shouldBe "스니펫 100"
                snippetDto.language shouldBe "kotlin"
                snippetDto.gitUrl shouldBe "https://github.com/example/msa"
            }
        }

        `when`("잠금 해제 상태로 조회하면") {
            val result = service.projects(unlocked = true)
            val snippetDto = result.projects.single().snippets.single()

            then("전문이 실린다") {
                snippetDto.locked shouldBe false
                snippetDto.code shouldBe longCode
            }
        }
    }

    given("스니펫이 없는 프로젝트일 때") {
        every { projectRepository.findAllPublished() } returns listOf(project(2L))
        every { codeSnippetRepository.snippetsByProject() } returns emptyMap()

        `when`("조회하면") {
            then("빈 목록이다 — 잠금 여부와 무관하다") {
                service.projects(unlocked = false).projects.single().snippets shouldBe emptyList()
            }
        }
    }
})
