package com.kgd.codedictionary.infrastructure.persistence.resume.entity

import com.kgd.codedictionary.domain.resume.model.CareerPeriod
import com.kgd.codedictionary.domain.resume.model.ResumeCategory
import com.kgd.codedictionary.domain.resume.model.ResumeCompany
import com.kgd.codedictionary.domain.resume.model.ResumeProject
import com.kgd.codedictionary.domain.resume.model.ResumeSkillGroup
import com.kgd.codedictionary.infrastructure.persistence.portfolio.entity.StringListJsonConverter
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.YearMonth

/** 월 단위 값은 DATE 의 1일로 저장한다 — 정렬·범위 조회가 그대로 되고 일자는 의미가 없다. */
internal fun YearMonth.toDate(): LocalDate = atDay(1)

internal fun LocalDate.toYearMonth(): YearMonth = YearMonth.from(this)

@Entity
@Table(name = "resume_category")
class ResumeCategoryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 40, unique = true)
    val code: String = "",

    label: String = "",
    description: String? = null,
    orderNo: Int = 0,
) {
    @Column(nullable = false, length = 80)
    var label: String = label
        private set

    @Column(length = 300)
    var description: String? = description
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    fun update(category: ResumeCategory) {
        label = category.label
        description = category.description
        orderNo = category.orderNo
    }

    fun toDomain() = ResumeCategory(
        id = id,
        code = code,
        label = label,
        description = description,
        orderNo = orderNo,
    )

    companion object {
        fun fromDomain(category: ResumeCategory) = ResumeCategoryJpaEntity(
            id = category.id,
            code = category.code,
            label = category.label,
            description = category.description,
            orderNo = category.orderNo,
        )
    }
}

@Entity
@Table(name = "resume_company")
class ResumeCompanyJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    name: String = "",
    startMonth: LocalDate = LocalDate.now(),
    endMonth: LocalDate? = null,
    position: String? = null,
    team: String? = null,
    note: String? = null,
) {
    @Column(nullable = false, length = 120)
    var name: String = name
        private set

    @Column(name = "start_month", nullable = false)
    var startMonth: LocalDate = startMonth
        private set

    /** null 이면 재직 중 */
    @Column(name = "end_month")
    var endMonth: LocalDate? = endMonth
        private set

    @Column(length = 120)
    var position: String? = position
        private set

    @Column(length = 120)
    var team: String? = team
        private set

    @Column(length = 500)
    var note: String? = note
        private set

    fun update(company: ResumeCompany) {
        name = company.name
        startMonth = company.period.start.toDate()
        endMonth = company.period.end?.toDate()
        position = company.position
        team = company.team
        note = company.note
    }

    fun toDomain() = ResumeCompany(
        id = id,
        name = name,
        period = CareerPeriod(startMonth.toYearMonth(), endMonth?.toYearMonth()),
        position = position,
        team = team,
        note = note,
    )

    companion object {
        fun fromDomain(company: ResumeCompany) = ResumeCompanyJpaEntity(
            id = company.id,
            name = company.name,
            startMonth = company.period.start.toDate(),
            endMonth = company.period.end?.toDate(),
            position = company.position,
            team = company.team,
            note = company.note,
        )
    }
}

@Entity
@Table(name = "resume_project")
class ResumeProjectJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    title: String = "",
    companyId: Long? = null,
    categoryId: Long? = null,
    startMonth: LocalDate? = null,
    endMonth: LocalDate? = null,
    summary: String? = null,
    bodyMarkdown: String? = null,
    metrics: List<String> = emptyList(),
    tags: List<String> = emptyList(),
    detailSlug: String? = null,
    orderNo: Int = 0,
    published: Boolean = true,
) {
    @Column(nullable = false, length = 200)
    var title: String = title
        private set

    @Column(name = "company_id")
    var companyId: Long? = companyId
        private set

    @Column(name = "category_id")
    var categoryId: Long? = categoryId
        private set

    @Column(name = "start_month")
    var startMonth: LocalDate? = startMonth
        private set

    @Column(name = "end_month")
    var endMonth: LocalDate? = endMonth
        private set

    @Column(length = 500)
    var summary: String? = summary
        private set

    @Column(name = "body_markdown", columnDefinition = "MEDIUMTEXT")
    var bodyMarkdown: String? = bodyMarkdown
        private set

    @Convert(converter = StringListJsonConverter::class)
    @Column(columnDefinition = "json")
    var metrics: List<String> = metrics
        private set

    @Convert(converter = StringListJsonConverter::class)
    @Column(columnDefinition = "json")
    var tags: List<String> = tags
        private set

    @Column(name = "detail_slug", length = 80)
    var detailSlug: String? = detailSlug
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    @Column(nullable = false)
    var published: Boolean = published
        private set

    fun update(project: ResumeProject) {
        title = project.title
        companyId = project.companyId
        categoryId = project.categoryId
        startMonth = project.period?.start?.toDate()
        endMonth = project.period?.end?.toDate()
        summary = project.summary
        bodyMarkdown = project.bodyMarkdown
        metrics = project.metrics
        tags = project.tags
        detailSlug = project.detailSlug
        orderNo = project.orderNo
        published = project.published
    }

    fun toDomain() = ResumeProject(
        id = id,
        title = title,
        companyId = companyId,
        categoryId = categoryId,
        period = startMonth?.let { CareerPeriod(it.toYearMonth(), endMonth?.toYearMonth()) },
        summary = summary,
        bodyMarkdown = bodyMarkdown,
        metrics = metrics,
        tags = tags,
        detailSlug = detailSlug,
        orderNo = orderNo,
        published = published,
    )

    companion object {
        fun fromDomain(project: ResumeProject) = ResumeProjectJpaEntity(
            id = project.id,
            title = project.title,
            companyId = project.companyId,
            categoryId = project.categoryId,
            startMonth = project.period?.start?.toDate(),
            endMonth = project.period?.end?.toDate(),
            summary = project.summary,
            bodyMarkdown = project.bodyMarkdown,
            metrics = project.metrics,
            tags = project.tags,
            detailSlug = project.detailSlug,
            orderNo = project.orderNo,
            published = project.published,
        )
    }
}

@Entity
@Table(name = "resume_skill_group")
class ResumeSkillGroupJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    label: String = "",
    items: List<String> = emptyList(),
    note: String? = null,
    orderNo: Int = 0,
) {
    @Column(nullable = false, length = 80)
    var label: String = label
        private set

    @Convert(converter = StringListJsonConverter::class)
    @Column(columnDefinition = "json", nullable = false)
    var items: List<String> = items
        private set

    @Column(length = 300)
    var note: String? = note
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    fun update(group: ResumeSkillGroup) {
        label = group.label
        items = group.items
        note = group.note
        orderNo = group.orderNo
    }

    fun toDomain() = ResumeSkillGroup(
        id = id,
        label = label,
        items = items,
        note = note,
        orderNo = orderNo,
    )

    companion object {
        fun fromDomain(group: ResumeSkillGroup) = ResumeSkillGroupJpaEntity(
            id = group.id,
            label = group.label,
            items = group.items,
            note = group.note,
            orderNo = group.orderNo,
        )
    }
}
