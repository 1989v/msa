package com.kgd.deal.infrastructure.linkcheck

import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.infrastructure.persistence.repository.DealOfferClickJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/** 점검 대상 한 건 — 트랜잭션 밖으로 들고 나가는 값이라 엔티티가 아니다 */
data class LinkCheckTarget(val offerId: Long, val slug: String, val targetUrl: String)

/**
 * 링크 점검의 **DB 쪽**만 담당한다 (ADR-0069 §5).
 *
 * HTTP 호출은 여기 들어오지 않는다. 수십~수백 건의 네트워크 왕복을 한 트랜잭션으로 감싸면
 * 커넥션 하나를 수 분간 붙잡아 free-tier 풀을 말린다 (docs/conventions/transactional-usage.md).
 * 그래서 "대상 읽기 → (밖에서 점검) → 결과 쓰기"로 트랜잭션을 두 토막 낸다.
 */
@Service
class DealLinkCheckService(
    private val offerRepository: DealOfferJpaRepository,
    private val clickRepository: DealOfferClickJpaRepository,
) {

    /** HOLD 는 화면에 안 나가므로 점검하지 않는다 — 남의 서버를 괜히 두드릴 이유가 없다 */
    @Transactional(readOnly = true)
    fun loadTargets(): List<LinkCheckTarget> =
        offerRepository.findAll()
            .filter { it.status != DisplayStatus.HOLD }
            .map { LinkCheckTarget(requireNotNull(it.id), it.slug, it.targetUrl) }

    @Transactional
    fun applyResults(results: Map<Long, ProbeResult>) {
        if (results.isEmpty()) return
        val checkedAt = LocalDateTime.now()
        offerRepository.findAllById(results.keys).forEach { offer ->
            results[offer.id]?.let { offer.recordLinkCheck(it.status, it.statusCode, checkedAt) }
        }
    }

    /** 보존기간 초과 클릭 로그 정리 — 배치 하나를 위해 배치를 또 만들지 않는다 */
    @Transactional
    fun purgeOldClicks(retentionDays: Long): Int =
        clickRepository.deleteOlderThan(LocalDateTime.now().minusDays(retentionDays))
}
