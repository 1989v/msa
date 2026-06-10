package com.kgd.codedictionary.infrastructure.persistence.portfolio.entity

import com.kgd.codedictionary.domain.portfolio.model.PortfolioCard
import com.kgd.codedictionary.domain.portfolio.model.Visibility
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "portfolio_card")
class PortfolioCardJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    title: String,
    summary: String?,
    body: String,
    periodStart: LocalDate?,
    periodEnd: LocalDate?,
    role: String?,
    impact: Int,
    visibility: Visibility,
    tags: List<String> = emptyList(),
    keywords: List<String> = emptyList(),
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(nullable = false, length = 200)
    var title: String = title
        private set

    @Column(length = 500)
    var summary: String? = summary
        private set

    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    var body: String = body
        private set

    @Column(name = "period_start")
    var periodStart: LocalDate? = periodStart
        private set

    @Column(name = "period_end")
    var periodEnd: LocalDate? = periodEnd
        private set

    @Column(length = 100)
    var role: String? = role
        private set

    @Column(nullable = false)
    var impact: Int = impact
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var visibility: Visibility = visibility
        private set

    @Convert(converter = StringListJsonConverter::class)
    @Column(columnDefinition = "json", nullable = true)
    var tags: List<String> = tags
        private set

    @Convert(converter = StringListJsonConverter::class)
    @Column(columnDefinition = "json", nullable = true)
    var keywords: List<String> = keywords
        private set

    /** 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md) */
    fun update(card: PortfolioCard) {
        title = card.title
        summary = card.summary
        body = card.body
        periodStart = card.periodStart
        periodEnd = card.periodEnd
        role = card.role
        impact = card.impact
        visibility = card.visibility
        tags = card.tags
        keywords = card.keywords
    }

    fun toDomain(): PortfolioCard = PortfolioCard.restore(
        id = id,
        title = title,
        summary = summary,
        body = body,
        periodStart = periodStart,
        periodEnd = periodEnd,
        role = role,
        impact = impact,
        visibility = visibility,
        tags = tags,
        keywords = keywords,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun fromDomain(card: PortfolioCard): PortfolioCardJpaEntity = PortfolioCardJpaEntity(
            id = card.id,
            title = card.title,
            summary = card.summary,
            body = card.body,
            periodStart = card.periodStart,
            periodEnd = card.periodEnd,
            role = card.role,
            impact = card.impact,
            visibility = card.visibility,
            tags = card.tags,
            keywords = card.keywords,
        )
    }
}
