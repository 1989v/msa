package com.kgd.deal.application.offer.port

import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.domain.model.Offer
import java.time.LocalDateTime

interface DealOfferRepositoryPort {
    fun findAll(): List<Offer>
    fun findById(id: Long): Offer?
    fun findBySlug(slug: String): Offer?
    fun existsBySlug(slug: String): Boolean
    fun existsByCategoryId(categoryId: Long): Boolean
    fun countByCategoryId(categoryId: Long): Long

    /** 전시 판정(OPEN + 기간)은 저장소가 끝낸다 — 한 곳이라도 필터를 빠뜨리면 만료 링크가 샌다 */
    fun findVisibleByCategory(categoryId: Long, now: LocalDateTime): List<Offer>
    fun findAllVisible(now: LocalDateTime): List<Offer>
    /** [pattern] 은 LIKE 패턴 — 이스케이프 문자는 `!` (호출부가 같은 문자로 이스케이프한다) */
    fun searchVisible(pattern: String, now: LocalDateTime): List<Offer>

    fun findExpiringSoon(now: LocalDateTime, threshold: LocalDateTime): List<Offer>
    fun findStale(threshold: LocalDateTime): List<Offer>
    /** linkCheckedAt 오름차순 */
    fun findAllByLinkStatus(linkStatus: LinkStatus): List<Offer>

    /** id 가 있으면 편집 값만 갱신(관측값 유지), 없으면 생성 */
    fun save(offer: Offer): Offer
    fun deleteById(id: Long)
    /** 비정규화 카운터 — 동시 클릭이 서로를 덮어쓰지 않게 UPDATE 한 방 */
    fun increaseClickCount(id: Long)
}
