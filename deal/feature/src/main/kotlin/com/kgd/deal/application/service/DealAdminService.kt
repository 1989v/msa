package com.kgd.deal.application.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.deal.application.dto.DealAttentionResponse
import com.kgd.deal.application.dto.DealCategoryAdminResponse
import com.kgd.deal.application.dto.DealCategoryRequest
import com.kgd.deal.application.dto.DealClickDaily
import com.kgd.deal.application.dto.DealOfferAdminResponse
import com.kgd.deal.application.dto.DealOfferRequest
import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.domain.model.Offer
import com.kgd.deal.infrastructure.persistence.entity.DealCategoryJpaEntity
import com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity
import com.kgd.deal.infrastructure.persistence.repository.DealCategoryJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferClickJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.sql.Date as SqlDate
import java.time.LocalDate
import java.time.LocalDateTime

/** 어드민 CRUD + 방치 감시 (ADR-0069). 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다. */
@Service
@Transactional(readOnly = true)
class DealAdminService(
    private val categoryRepository: DealCategoryJpaRepository,
    private val offerRepository: DealOfferJpaRepository,
    private val clickRepository: DealOfferClickJpaRepository,
    private val redirectService: DealRedirectService,
) {

    // ─── 카테고리 ───

    fun categories(): List<DealCategoryAdminResponse> =
        categoryRepository.findAllByOrderByOrderNoAsc().map { it.toAdminResponse() }

    @Transactional
    fun createCategory(request: DealCategoryRequest): DealCategoryAdminResponse {
        if (categoryRepository.existsByCode(request.code)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 있는 카테고리 코드입니다: ${request.code}")
        }
        val domain = request.toDomain(id = null)
        return categoryRepository.save(DealCategoryJpaEntity.fromDomain(domain)).toAdminResponse()
    }

    @Transactional
    fun updateCategory(id: Long, request: DealCategoryRequest): DealCategoryAdminResponse {
        val entity = categoryRepository.findById(id).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $id")
        }
        if (entity.code != request.code) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 코드는 바꿀 수 없습니다 — 공유된 링크가 깨집니다")
        }
        entity.update(request.toDomain(id))
        // 카테고리 상태가 바뀌면 만료 리다이렉트 목적지도 바뀐다
        redirectService.evictAll()
        return entity.toAdminResponse()
    }

    @Transactional
    fun deleteCategory(id: Long) {
        if (offerRepository.existsByCategoryId(id)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "오퍼가 남아 있는 카테고리는 지울 수 없습니다")
        }
        categoryRepository.deleteById(id)
    }

    // ─── 오퍼 ───

    fun offers(categoryId: Long?, linkStatus: LinkStatus?): List<DealOfferAdminResponse> {
        val codes = categoryCodes()
        return offerRepository.findAll()
            .filter { categoryId == null || it.categoryId == categoryId }
            .filter { linkStatus == null || it.linkStatus == linkStatus }
            .sortedWith(compareBy({ it.categoryId }, { it.orderNo }, { it.id }))
            .map { it.toAdminResponse(codes) }
    }

    @Transactional
    fun createOffer(request: DealOfferRequest): DealOfferAdminResponse {
        if (offerRepository.existsBySlug(request.slug)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 있는 slug 입니다: ${request.slug}")
        }
        requireCategory(request.categoryId)
        val saved = offerRepository.save(DealOfferJpaEntity.fromDomain(request.toDomain(id = null)))
        return saved.toAdminResponse(categoryCodes())
    }

    @Transactional
    fun updateOffer(id: Long, request: DealOfferRequest): DealOfferAdminResponse {
        val entity = offerRepository.findById(id).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "오퍼를 찾을 수 없습니다: $id")
        }
        if (entity.slug != request.slug) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "slug 는 바꿀 수 없습니다 — 이미 공유된 링크가 죽습니다")
        }
        requireCategory(request.categoryId)
        entity.update(request.toDomain(id))
        // 캐시가 옛 링크를 최대 5분 더 내보내지 않게 한다
        redirectService.evict(entity.slug)
        return entity.toAdminResponse(categoryCodes())
    }

    @Transactional
    fun deleteOffer(id: Long) {
        val entity = offerRepository.findById(id).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "오퍼를 찾을 수 없습니다: $id")
        }
        offerRepository.delete(entity)
        redirectService.evict(entity.slug)
    }

    // ─── 방치 감시 ───

    /**
     * 어드민이 손봐야 하는 것들. 죽은 링크 방치가 이런 페이지의 실패 원인 1번이라
     * 세 갈래를 한 응답으로 묶어 대시보드 한 줄에 띄운다.
     */
    fun attention(now: LocalDateTime = LocalDateTime.now()): DealAttentionResponse {
        val codes = categoryCodes()
        return DealAttentionResponse(
            expiringSoon = offerRepository.findExpiringSoon(now, now.plusDays(EXPIRY_WARNING_DAYS))
                .map { it.toAdminResponse(codes) },
            stale = offerRepository.findStale(now.minusDays(STALE_DAYS)).map { it.toAdminResponse(codes) },
            broken = offerRepository.findAllByLinkStatusOrderByLinkCheckedAtAsc(LinkStatus.BROKEN)
                .map { it.toAdminResponse(codes) },
        )
    }

    fun clicks(offerId: Long, from: LocalDate, to: LocalDate): List<DealClickDaily> =
        clickRepository.countDailyByOffer(offerId, from.atStartOfDay(), to.plusDays(1).atStartOfDay())
            .map { row ->
                DealClickDaily(
                    date = when (val day = row[0]) {
                        is SqlDate -> day.toLocalDate()
                        is LocalDate -> day
                        else -> LocalDate.parse(day.toString())
                    },
                    count = (row[1] as Number).toLong(),
                )
            }

    // ─── 매핑 ───

    private fun requireCategory(categoryId: Long) {
        if (!categoryRepository.existsById(categoryId)) {
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

    private fun DealCategoryJpaEntity.toAdminResponse(): DealCategoryAdminResponse {
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

    private fun DealOfferJpaEntity.toAdminResponse(categoryCodes: Map<Long, String>) = DealOfferAdminResponse(
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
