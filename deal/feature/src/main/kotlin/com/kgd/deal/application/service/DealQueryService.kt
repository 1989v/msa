package com.kgd.deal.application.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.deal.application.dto.DealCategoryResponse
import com.kgd.deal.application.dto.DealCategorySection
import com.kgd.deal.application.dto.DealOfferResponse
import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity
import com.kgd.deal.infrastructure.persistence.repository.DealCategoryJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/** 공개 조회 (ADR-0069). 만료·비전시 판정은 전부 쿼리에서 끝난다. */
@Service
@Transactional(readOnly = true)
class DealQueryService(
    private val categoryRepository: DealCategoryJpaRepository,
    private val offerRepository: DealOfferJpaRepository,
) {

    fun categories(): List<DealCategoryResponse> =
        categoryRepository.findAllByStatusOrderByOrderNoAsc(DisplayStatus.OPEN)
            .map { DealCategoryResponse(code = it.code, label = it.label, tagline = it.tagline) }

    fun offers(categoryCode: String, now: LocalDateTime = LocalDateTime.now()): List<DealOfferResponse> {
        val category = categoryRepository.findByCode(categoryCode)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $categoryCode")
        if (category.status != DisplayStatus.OPEN) return emptyList()
        val categoryId = requireNotNull(category.id)
        return offerRepository.findVisibleByCategory(categoryId, now).map { it.toResponse() }
    }

    /**
     * 허브 한 화면분 — 카테고리별 오퍼를 한 번에 준다.
     *
     * 카테고리마다 따로 부르면 화면 하나에 요청이 5번 나가고, 첫 화면이 계단식으로 채워진다.
     * 유입이 SNS 공유라 첫 화면 완성 속도가 곧 이탈률이다.
     */
    fun sections(now: LocalDateTime = LocalDateTime.now()): List<DealCategorySection> {
        val categories = categoryRepository.findAllByStatusOrderByOrderNoAsc(DisplayStatus.OPEN)
        if (categories.isEmpty()) return emptyList()
        val byCategory = offerRepository.findAllVisible(now).groupBy { it.categoryId }
        return categories.map { category ->
            DealCategorySection(
                category = DealCategoryResponse(category.code, category.label, category.tagline),
                offers = byCategory[category.id].orEmpty().map { it.toResponse() },
            )
        }
    }

    private fun DealOfferJpaEntity.toResponse() = DealOfferResponse(
        slug = slug,
        merchant = merchant,
        title = title,
        benefit = benefit,
        summary = summary,
        revenueType = revenueType,
        disclosureRequired = revenueType.requiresDisclosure,
        validUntil = validUntil,
    )
}
