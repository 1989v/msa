package com.kgd.deal.application.offer.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.deal.application.category.dto.DealCategoryResponse
import com.kgd.deal.application.category.port.DealCategoryRepositoryPort
import com.kgd.deal.application.category.usecase.GetDealCategoriesUseCase
import com.kgd.deal.application.offer.dto.DealCategorySection
import com.kgd.deal.application.offer.dto.DealOfferResponse
import com.kgd.deal.application.offer.port.DealOfferRepositoryPort
import com.kgd.deal.application.offer.usecase.GetDealOffersUseCase
import com.kgd.deal.application.offer.usecase.GetDealSectionsUseCase
import com.kgd.deal.application.offer.usecase.SearchDealOffersUseCase
import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.domain.model.Offer
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/** 공개 조회 (ADR-0069). 만료·비전시 판정은 전부 저장소에서 끝난다. */
@Service
@Transactional(readOnly = true)
class DealQueryService(
    private val categoryRepository: DealCategoryRepositoryPort,
    private val offerRepository: DealOfferRepositoryPort,
) : GetDealCategoriesUseCase, GetDealOffersUseCase, GetDealSectionsUseCase, SearchDealOffersUseCase {

    override fun execute(): List<DealCategoryResponse> =
        categoryRepository.findAllByStatus(DisplayStatus.OPEN).map { it.toResponse() }

    override fun execute(query: GetDealOffersUseCase.Query): List<DealOfferResponse> {
        val category = categoryRepository.findByCode(query.categoryCode)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: ${query.categoryCode}")
        if (category.status != DisplayStatus.OPEN) return emptyList()
        val categoryId = requireNotNull(category.id)
        return offerRepository.findVisibleByCategory(categoryId, query.now).map { it.toResponse() }
    }

    /**
     * 허브 한 화면분 — 카테고리별 오퍼를 한 번에 준다.
     *
     * 카테고리마다 따로 부르면 화면 하나에 요청이 5번 나가고, 첫 화면이 계단식으로 채워진다.
     * 유입이 SNS 공유라 첫 화면 완성 속도가 곧 이탈률이다.
     */
    override fun execute(now: LocalDateTime): List<DealCategorySection> {
        val categories = categoryRepository.findAllByStatus(DisplayStatus.OPEN)
        if (categories.isEmpty()) return emptyList()
        val byCategory = offerRepository.findAllVisible(now).groupBy { it.categoryId }
        return categories.map { category ->
            DealCategorySection(
                category = category.toResponse(),
                offers = byCategory[category.id].orEmpty().map { it.toResponse() },
            )
        }
    }

    /**
     * 이름 · 제공처 · 혜택 · 요약으로 찾는다 (ADR-0069 개정).
     *
     * 응답 모양이 목록과 같다. 검색 결과에도 "어느 분류의 혜택인지"가 필요하고,
     * 모양이 같으면 화면이 목록과 결과를 한 컴포넌트로 그린다 — 다른 DTO 를 만들면
     * 고지 배지·만료 표시 같은 규칙이 두 벌이 되고 한쪽만 고쳐지는 날이 온다.
     *
     * 검색은 화면 상태이지 주소가 아니다 — 허브 URL 은 하나뿐이고 canonical 도 하나다
     * (질의마다 주소가 생기면 같은 카탈로그가 무한한 URL 로 갈라진다).
     */
    override fun execute(query: SearchDealOffersUseCase.Query): List<DealCategorySection> {
        // 길이를 자르는 것은 방어다. 검색어는 공개 파라미터라 임의 길이가 들어올 수 있고,
        // 그대로 LIKE 패턴이 되면 매칭 비용만 키운다. 오퍼 필드 자체가 이보다 짧다.
        val keyword = query.keyword.trim().take(MAX_QUERY_LENGTH)
        if (keyword.isBlank()) return emptyList()

        val hits = offerRepository.searchVisible("%${escapeLike(keyword.lowercase())}%", query.now)
        if (hits.isEmpty()) return emptyList()

        // 카테고리는 OPEN 인 것만 훑는다 — 내려간 분류의 오퍼가 검색으로 새어 나가지 않게.
        // 빈 분류를 남기는 목록과 달리 결과가 없는 분류는 뺀다: 목록은 레이아웃이
        // 흔들리지 않아야 하지만, 검색 결과의 빈 분류는 읽는 사람에게 잡음이다.
        val byCategory = hits.groupBy { it.categoryId }
        return categoryRepository.findAllByStatus(DisplayStatus.OPEN)
            .mapNotNull { category ->
                val offers = byCategory[category.id].orEmpty()
                if (offers.isEmpty()) {
                    null
                } else {
                    DealCategorySection(category = category.toResponse(), offers = offers.map { it.toResponse() })
                }
            }
    }

    /** LIKE 와일드카드를 글자로 되돌린다. 이스케이프 문자 자신을 먼저 바꿔야 한다. */
    private fun escapeLike(value: String): String =
        value.replace("!", "!!").replace("%", "!%").replace("_", "!_")

    private fun DealCategory.toResponse() = DealCategoryResponse(code = code, label = label, tagline = tagline)

    private fun Offer.toResponse() = DealOfferResponse(
        slug = slug,
        merchant = merchant,
        title = title,
        benefit = benefit,
        summary = summary,
        revenueType = revenueType,
        disclosureRequired = requiresDisclosure(),
        validUntil = validUntil,
    )

    companion object {
        private const val MAX_QUERY_LENGTH = 60
    }
}
