package com.kgd.deal.application.offer.service

import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.deal.application.category.port.DealCategoryRepositoryPort
import com.kgd.deal.application.offer.port.DealOfferClickRepositoryPort
import com.kgd.deal.application.offer.port.DealOfferRepositoryPort
import com.kgd.deal.application.offer.usecase.RecordDealClickUseCase
import com.kgd.deal.application.offer.usecase.ResolveDealRedirectUseCase
import com.kgd.deal.application.offer.usecase.ResolveDealRedirectUseCase.Decision
import com.kgd.deal.domain.model.Offer
import com.kgd.deal.domain.model.OfferClick
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.time.Duration
import java.time.LocalDateTime

/** 캐시에 담는 스냅샷. 만료 판정은 캐시가 아니라 요청 시각으로 한다. */
private data class OfferSnapshot(val offer: Offer, val categoryCode: String)

/**
 * 아웃바운드 리다이렉트 (ADR-0069 §3).
 *
 * 자체 리다이렉터를 거치는 이유는 둘 — 링크가 교체돼도 이미 공유된 주소가 죽지 않고,
 * 클릭 수를 우리가 센다. 거치지 않는 것 하나 — **URL 을 건드리지 않는다.**
 */
@Service
class DealRedirectService(
    private val offerRepository: DealOfferRepositoryPort,
    private val categoryRepository: DealCategoryRepositoryPort,
    private val clickRepository: DealOfferClickRepositoryPort,
) : ResolveDealRedirectUseCase, RecordDealClickUseCase {

    private val cache = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(5))
        .maximumSize(1_000)
        .build<String, OfferSnapshot>()

    @Transactional(readOnly = true)
    override fun execute(slug: String, now: LocalDateTime): Decision {
        val snapshot = cache.get(slug) { key -> loadSnapshot(key) } ?: return Decision.NotFound
        val offer = snapshot.offer
        return if (offer.isVisibleAt(now)) {
            Decision.Go(requireNotNull(offer.id), offer.targetUrl)
        } else {
            Decision.Unavailable(snapshot.categoryCode)
        }
    }

    /**
     * 클릭 1건 적재.
     *
     * 호출부는 이 메서드의 실패를 삼킨다. 리다이렉트가 본질이고 통계는 부수이므로,
     * 순서를 뒤집으면 DB 가 흔들릴 때 수익 링크가 통째로 죽는다.
     * [Propagation.REQUIRES_NEW] 로 조회 트랜잭션과 분리해 실패가 밖으로 번지지 않게 한다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    override fun execute(command: RecordDealClickUseCase.Command) {
        clickRepository.save(
            OfferClick(
                offerId = command.offerId,
                clickedAt = LocalDateTime.now(),
                referrerHost = referrerHost(command.referrer),
                uaFamily = uaFamily(command.userAgent),
            ),
        )
        offerRepository.increaseClickCount(command.offerId)
    }

    /** 어드민이 오퍼를 손댔을 때 — 캐시가 옛 링크를 최대 5분 더 내보내지 않게 한다 */
    fun evict(slug: String) = cache.invalidate(slug)

    fun evictAll() = cache.invalidateAll()

    private fun loadSnapshot(slug: String): OfferSnapshot? {
        val offer = offerRepository.findBySlug(slug) ?: return null
        val categoryCode = categoryRepository.findById(offer.categoryId)?.code.orEmpty()
        return OfferSnapshot(offer, categoryCode)
    }

    companion object {
        private val BOT_PATTERN = Regex("bot|crawler|spider|slurp|preview|fetch", RegexOption.IGNORE_CASE)

        /**
         * referrer 는 **호스트만** 남긴다. 전체 URL 은 쿼리에 개인 식별자가 실려 오는 경우가 있고,
         * 어느 채널의 공유가 먹혔는지 보는 데는 호스트면 충분하다.
         */
        internal fun referrerHost(referrer: String?): String? =
            referrer?.takeIf { it.isNotBlank() }
                ?.let { runCatching { URI(it).host }.getOrNull() }
                ?.take(120)

        /**
         * 봇도 제외하지 않고 기록한다 — 실데이터를 봐야 어디까지 걸러야 할지 알 수 있다.
         * 지금 지워버리면 나중에 소급이 안 된다.
         */
        internal fun uaFamily(userAgent: String?): String = when {
            userAgent.isNullOrBlank() -> "unknown"
            BOT_PATTERN.containsMatchIn(userAgent) -> "bot"
            userAgent.contains("Mobi", ignoreCase = true) -> "mobile"
            else -> "desktop"
        }
    }
}
