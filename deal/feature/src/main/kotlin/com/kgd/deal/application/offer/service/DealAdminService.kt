package com.kgd.deal.application.offer.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.deal.application.category.dto.DealCategoryAdminResponse
import com.kgd.deal.application.category.dto.DealCategoryRequest
import com.kgd.deal.application.category.port.DealCategoryRepositoryPort
import com.kgd.deal.application.category.usecase.CreateDealCategoryUseCase
import com.kgd.deal.application.category.usecase.DeleteDealCategoryUseCase
import com.kgd.deal.application.category.usecase.ListDealCategoriesAdminUseCase
import com.kgd.deal.application.category.usecase.UpdateDealCategoryUseCase
import com.kgd.deal.application.offer.dto.DealAttentionResponse
import com.kgd.deal.application.offer.dto.DealClickDaily
import com.kgd.deal.application.offer.dto.DealOfferAdminResponse
import com.kgd.deal.application.offer.dto.DealOfferRequest
import com.kgd.deal.application.offer.port.DealOfferClickRepositoryPort
import com.kgd.deal.application.offer.port.DealOfferRepositoryPort
import com.kgd.deal.application.offer.usecase.CreateDealOfferUseCase
import com.kgd.deal.application.offer.usecase.DeleteDealOfferUseCase
import com.kgd.deal.application.offer.usecase.GetDealAttentionUseCase
import com.kgd.deal.application.offer.usecase.GetDealOfferClicksUseCase
import com.kgd.deal.application.offer.usecase.ListDealOffersAdminUseCase
import com.kgd.deal.application.offer.usecase.UpdateDealOfferUseCase
import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.domain.model.Offer
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/** 어드민 CRUD + 방치 감시 (ADR-0069). 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다. */
@Service
@Transactional(readOnly = true)
class DealAdminService(
    private val categoryRepository: DealCategoryRepositoryPort,
    private val offerRepository: DealOfferRepositoryPort,
    private val clickRepository: DealOfferClickRepositoryPort,
    private val redirectService: DealRedirectService,
) : ListDealCategoriesAdminUseCase, CreateDealCategoryUseCase, UpdateDealCategoryUseCase, DeleteDealCategoryUseCase,
    ListDealOffersAdminUseCase, CreateDealOfferUseCase, UpdateDealOfferUseCase, DeleteDealOfferUseCase,
    GetDealAttentionUseCase, GetDealOfferClicksUseCase {

    // ─── 카테고리 ───

    override fun execute(): List<DealCategoryAdminResponse> =
        categoryRepository.findAll().map { it.toAdminResponse() }

    @Transactional
    override fun execute(request: DealCategoryRequest): DealCategoryAdminResponse {
        if (categoryRepository.existsByCode(request.code)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 있는 카테고리 코드입니다: ${request.code}")
        }
        return categoryRepository.save(request.toDomain(id = null)).toAdminResponse()
    }

    @Transactional
    override fun execute(command: UpdateDealCategoryUseCase.Command): DealCategoryAdminResponse {
        val (id, request) = command
        val existing = categoryRepository.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $id")
        if (existing.code != request.code) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 코드는 바꿀 수 없습니다 — 공유된 링크가 깨집니다")
        }
        val saved = categoryRepository.save(request.toDomain(id))
        // 카테고리 상태가 바뀌면 만료 리다이렉트 목적지도 바뀐다
        redirectService.evictAll()
        return saved.toAdminResponse()
    }

    @Transactional
    override fun execute(command: DeleteDealCategoryUseCase.Command) {
        val id = command.id
        if (offerRepository.existsByCategoryId(id)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "오퍼가 남아 있는 카테고리는 지울 수 없습니다")
        }
        categoryRepository.deleteById(id)
    }

    // ─── 오퍼 ───

    override fun execute(query: ListDealOffersAdminUseCase.Query): List<DealOfferAdminResponse> {
        val codes = categoryCodes()
        return offerRepository.findAll()
            .filter { query.categoryId == null || it.categoryId == query.categoryId }
            .filter { query.linkStatus == null || it.linkStatus == query.linkStatus }
            .sortedWith(compareBy({ it.categoryId }, { it.orderNo }, { it.id }))
            .map { it.toAdminResponse(codes) }
    }

    @Transactional
    override fun execute(request: DealOfferRequest): DealOfferAdminResponse {
        if (offerRepository.existsBySlug(request.slug)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 있는 slug 입니다: ${request.slug}")
        }
        requireCategory(request.categoryId)
        return offerRepository.save(request.toDomain(id = null)).toAdminResponse(categoryCodes())
    }

    @Transactional
    override fun execute(command: UpdateDealOfferUseCase.Command): DealOfferAdminResponse {
        val (id, request) = command
        val existing = offerRepository.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "오퍼를 찾을 수 없습니다: $id")
        if (existing.slug != request.slug) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "slug 는 바꿀 수 없습니다 — 이미 공유된 링크가 죽습니다")
        }
        requireCategory(request.categoryId)
        val saved = offerRepository.save(request.toDomain(id))
        // 캐시가 옛 링크를 최대 5분 더 내보내지 않게 한다
        redirectService.evict(saved.slug)
        return saved.toAdminResponse(categoryCodes())
    }

    @Transactional
    override fun execute(command: DeleteDealOfferUseCase.Command) {
        val id = command.id
        val existing = offerRepository.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "오퍼를 찾을 수 없습니다: $id")
        offerRepository.deleteById(id)
        redirectService.evict(existing.slug)
    }

    // ─── 방치 감시 ───

    /**
     * 어드민이 손봐야 하는 것들. 죽은 링크 방치가 이런 페이지의 실패 원인 1번이라
     * 세 갈래를 한 응답으로 묶어 대시보드 한 줄에 띄운다.
     */
    override fun execute(now: LocalDateTime): DealAttentionResponse {
        val codes = categoryCodes()
        return DealAttentionResponse(
            expiringSoon = offerRepository.findExpiringSoon(now, now.plusDays(EXPIRY_WARNING_DAYS))
                .map { it.toAdminResponse(codes) },
            stale = offerRepository.findStale(now.minusDays(STALE_DAYS)).map { it.toAdminResponse(codes) },
            broken = offerRepository.findAllByLinkStatus(LinkStatus.BROKEN).map { it.toAdminResponse(codes) },
        )
    }

    override fun execute(query: GetDealOfferClicksUseCase.Query): List<DealClickDaily> =
        clickRepository.countDailyByOffer(query.offerId, query.from.atStartOfDay(), query.to.plusDays(1).atStartOfDay())
            .map { DealClickDaily(date = it.date, count = it.count) }

    // ─── 매핑 ───

    private fun requireCategory(categoryId: Long) {
        if (categoryRepository.findById(categoryId) == null) {
            throw BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $categoryId")
        }
    }

    private fun categoryCodes(): Map<Long, String> =
        categoryRepository.findAll().associate { requireNotNull(it.id) to it.code }

    private fun DealCategoryRequest.toDomain(id: Long?) = DealCategory(
        id = id,
        code = code,
        label = label,
        tagline = tagline,
        status = status,
        orderNo = orderNo,
    )

    private fun DealOfferRequest.toDomain(id: Long?) = Offer(
        id = id,
        slug = slug,
        categoryId = categoryId,
        merchant = merchant,
        title = title,
        benefit = benefit,
        summary = summary,
        targetUrl = targetUrl,
        revenueType = revenueType,
        network = network?.takeIf { it.isNotBlank() },
        status = status,
        validFrom = validFrom,
        validUntil = validUntil,
        orderNo = orderNo,
    )

    private fun DealCategory.toAdminResponse(): DealCategoryAdminResponse {
        val categoryId = requireNotNull(id)
        return DealCategoryAdminResponse(
            id = categoryId,
            code = code,
            label = label,
            tagline = tagline,
            status = status,
            orderNo = orderNo,
            // 카테고리는 5행 수준이라 건별 count 로 충분하다. 행이 늘면 group-by 한 방으로 바꾼다.
            offerCount = offerRepository.countByCategoryId(categoryId),
        )
    }

    private fun Offer.toAdminResponse(categoryCodes: Map<Long, String>) = DealOfferAdminResponse(
        id = requireNotNull(id),
        slug = slug,
        categoryId = categoryId,
        categoryCode = categoryCodes[categoryId].orEmpty(),
        merchant = merchant,
        title = title,
        benefit = benefit,
        summary = summary,
        targetUrl = targetUrl,
        revenueType = revenueType,
        network = network,
        status = status,
        validFrom = validFrom,
        validUntil = validUntil,
        orderNo = orderNo,
        clickCount = clickCount,
        linkStatus = linkStatus,
        linkStatusCode = linkStatusCode,
        linkCheckedAt = linkCheckedAt,
        updatedAt = updatedAt,
    )

    companion object {
        private const val EXPIRY_WARNING_DAYS = 14L
        private const val STALE_DAYS = 90L
    }
}
