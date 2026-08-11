package com.kgd.codedictionary.application.portfolio.service

import com.kgd.codedictionary.application.resume.port.ResumeCategoryRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeCompanyRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeProjectRepositoryPort
import com.kgd.codedictionary.domain.resume.model.CareerPeriod
import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.YearMonth

/**
 * 메인 타임라인의 공개 범위 (ADR-0066 / ADR-0064 개정).
 *
 * 지키려는 것은 하나다 — **회사에서 한 일은 공개 응답에 실리지 않는다.**
 * 재직 기간·직무까지는 공개하기로 했으므로, 경계가 어디인지 여기서 고정한다.
 */
class PortfolioTimelineServiceTest : BehaviorSpec({

    val companyRepository = mockk<ResumeCompanyRepositoryPort>()
    val categoryRepository = mockk<ResumeCategoryRepositoryPort>()
    val projectRepository = mockk<ResumeProjectRepositoryPort>()
    val service = PortfolioTimelineService(companyRepository, categoryRepository, projectRepository)

    fun company(name: String, start: String, end: String?) = ResumeCompany(
        id = 1L,
        name = name,
        period = CareerPeriod(YearMonth.parse(start), end?.let { YearMonth.parse(it) }),
        position = "백엔드 엔지니어",
        team = "검색팀",
        note = "사내 검색 개편 주도",
    )

    fun project(title: String, companyId: Long?, start: String?) = ResumeProject(
        id = null,
        title = title,
        companyId = companyId,
        categoryId = 100L,
        period = start?.let { CareerPeriod(YearMonth.parse(it), null) },
        summary = "요약",
        bodyMarkdown = "본문",
        metrics = listOf("P99 320ms"),
        tags = listOf("Kotlin"),
        detailSlug = "detail-slug",
        orderNo = 1,
        published = true,
    )

    val category = ResumeCategory(id = 100L, code = "search", label = "검색", description = null, orderNo = 1)

    given("타임라인을 조회할 때") {
        every { companyRepository.findAll() } returns listOf(company("A사", "2019-03", "2023-02"))
        every { categoryRepository.findAll() } returns listOf(category)
        every { projectRepository.findAllPublishedPersonal() } returns
            listOf(project("K-관광 검색", companyId = null, start = "2026-06"))

        val result = service.timeline()

        `when`("프로젝트를 읽으면") {
            then("개인 프로젝트 전용 조회만 쓴다 — 전체 조회는 건드리지 않는다") {
                verify(exactly = 1) { projectRepository.findAllPublishedPersonal() }
                verify(exactly = 0) { projectRepository.findAllPublished() }
                verify(exactly = 0) { projectRepository.findAll() }
            }
        }

        `when`("회사 정보를 내보내면") {
            then("이름·기간·직무만 나간다") {
                val company = result.companies.single()
                company.name shouldBe "A사"
                company.startMonth shouldBe "2019-03"
                company.endMonth shouldBe "2023-02"
                company.ongoing shouldBe false
                company.position shouldBe "백엔드 엔지니어"
            }
        }

        `when`("개인 프로젝트를 내보내면") {
            then("카테고리 코드와 성과지표까지 나간다") {
                val project = result.projects.single()
                project.title shouldBe "K-관광 검색"
                project.categoryCode shouldBe "search"
                project.metrics shouldContainExactly listOf("P99 320ms")
            }
        }

        `when`("경력 총량을 계산하면") {
            then("재직 기간에서 산출한다") {
                result.career.totalMonths shouldBe 48
            }
        }
    }

    given("여러 건이 있을 때") {
        every { companyRepository.findAll() } returns listOf(
            company("A사", "2019-03", "2023-02"),
            company("B사", "2023-03", null),
        )
        every { categoryRepository.findAll() } returns listOf(category)
        every { projectRepository.findAllPublishedPersonal() } returns listOf(
            project("오래된 프로젝트", companyId = null, start = "2024-01"),
            project("최근 프로젝트", companyId = null, start = "2026-06"),
            project("기간 없는 프로젝트", companyId = null, start = null),
        )

        val result = service.timeline()

        `when`("타임라인으로 배열하면") {
            then("최근이 위로 오고 기간 없는 건 맨 아래다") {
                result.projects.map { it.title } shouldContainExactly
                    listOf("최근 프로젝트", "오래된 프로젝트", "기간 없는 프로젝트")
            }

            then("회사도 최근 재직이 위다") {
                result.companies.map { it.name } shouldContainExactly listOf("B사", "A사")
            }
        }
    }
})
