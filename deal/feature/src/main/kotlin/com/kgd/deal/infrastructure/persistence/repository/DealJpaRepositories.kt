package com.kgd.deal.infrastructure.persistence.repository

import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.infrastructure.persistence.entity.DealCategoryJpaEntity
import com.kgd.deal.infrastructure.persistence.entity.DealOfferClickJpaEntity
import com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface DealCategoryJpaRepository : JpaRepository<DealCategoryJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<DealCategoryJpaEntity>
    fun findAllByStatusOrderByOrderNoAsc(status: DisplayStatus): List<DealCategoryJpaEntity>
    fun findByCode(code: String): DealCategoryJpaEntity?
    fun existsByCode(code: String): Boolean
}

interface DealOfferJpaRepository : JpaRepository<DealOfferJpaEntity, Long> {

    fun findBySlug(slug: String): DealOfferJpaEntity?
    fun existsBySlug(slug: String): Boolean
    fun existsByCategoryId(categoryId: Long): Boolean
    fun countByCategoryId(categoryId: Long): Long
    fun countByLinkStatus(linkStatus: LinkStatus): Long

    /**
     * 공개 목록 — 전시 판정을 **쿼리에서** 끝낸다.
     *
     * 화면이나 서비스 레이어에서 거르면 페이지네이션·카운트가 전부 어긋나고, 무엇보다
     * 한 곳이라도 필터를 빠뜨리면 만료된 링크가 새어 나간다.
     */
    @Query(
        """
        SELECT o FROM DealOfferJpaEntity o
        WHERE o.categoryId = :categoryId
          AND o.status = com.kgd.deal.domain.model.DisplayStatus.OPEN
          AND (o.validFrom IS NULL OR o.validFrom <= :now)
          AND (o.validUntil IS NULL OR o.validUntil > :now)
        ORDER BY o.orderNo ASC, o.id ASC
        """,
    )
    fun findVisibleByCategory(
        @Param("categoryId") categoryId: Long,
        @Param("now") now: LocalDateTime,
    ): List<DealOfferJpaEntity>

    @Query(
        """
        SELECT o FROM DealOfferJpaEntity o
        WHERE o.status = com.kgd.deal.domain.model.DisplayStatus.OPEN
          AND (o.validFrom IS NULL OR o.validFrom <= :now)
          AND (o.validUntil IS NULL OR o.validUntil > :now)
        ORDER BY o.orderNo ASC, o.id ASC
        """,
    )
    fun findAllVisible(@Param("now") now: LocalDateTime): List<DealOfferJpaEntity>

    /**
     * 공개 검색 — 전시 판정은 [findAllVisible] 과 **같은 조건**이어야 한다.
     *
     * 여기서 조건이 갈리면 목록에는 없는 오퍼가 검색으로만 나오는 구멍이 생긴다.
     *
     * 이스케이프 문자로 역슬래시가 아니라 `!` 를 쓴다 — JPQL 문자열 안의 역슬래시는
     * Kotlin raw string · JPA · JDBC 를 지나며 몇 번 벗겨지는지가 구현마다 달라
     * 조용히 어긋난다. 패턴을 만드는 쪽(DealQueryService)이 같은 문자로 이스케이프한다.
     */
    @Query(
        """
        SELECT o FROM DealOfferJpaEntity o
        WHERE o.status = com.kgd.deal.domain.model.DisplayStatus.OPEN
          AND (o.validFrom IS NULL OR o.validFrom <= :now)
          AND (o.validUntil IS NULL OR o.validUntil > :now)
          AND (
            LOWER(o.title) LIKE :pattern ESCAPE '!'
            OR LOWER(o.merchant) LIKE :pattern ESCAPE '!'
            OR LOWER(o.benefit) LIKE :pattern ESCAPE '!'
            OR LOWER(o.summary) LIKE :pattern ESCAPE '!'
          )
        ORDER BY o.orderNo ASC, o.id ASC
        """,
    )
    fun searchVisible(
        @Param("pattern") pattern: String,
        @Param("now") now: LocalDateTime,
    ): List<DealOfferJpaEntity>

    /** 만료 임박 — 어드민 경고 목록 */
    @Query(
        """
        SELECT o FROM DealOfferJpaEntity o
        WHERE o.status = com.kgd.deal.domain.model.DisplayStatus.OPEN
          AND o.validUntil IS NOT NULL
          AND o.validUntil > :now AND o.validUntil <= :threshold
        ORDER BY o.validUntil ASC
        """,
    )
    fun findExpiringSoon(
        @Param("now") now: LocalDateTime,
        @Param("threshold") threshold: LocalDateTime,
    ): List<DealOfferJpaEntity>

    /** 오래 손대지 않은 오퍼 — 혜택 내용이 조용히 바뀌었을 가능성이 높은 쪽 */
    @Query(
        """
        SELECT o FROM DealOfferJpaEntity o
        WHERE o.status = com.kgd.deal.domain.model.DisplayStatus.OPEN
          AND o.updatedAt < :threshold
        ORDER BY o.updatedAt ASC
        """,
    )
    fun findStale(@Param("threshold") threshold: LocalDateTime): List<DealOfferJpaEntity>

    fun findAllByLinkStatusOrderByLinkCheckedAtAsc(linkStatus: LinkStatus): List<DealOfferJpaEntity>

    /**
     * 비정규화 카운터 증가. 엔티티를 읽어 더하면 동시 클릭이 서로를 덮어쓴다.
     * 정확한 값은 deal_offer_click 이 갖고 있고 이 컬럼은 어드민 정렬용이므로 UPDATE 한 방으로 끝낸다.
     */
    @Modifying
    @Query("UPDATE DealOfferJpaEntity o SET o.clickCount = o.clickCount + 1 WHERE o.id = :id")
    fun increaseClickCount(@Param("id") id: Long): Int
}

interface DealOfferClickJpaRepository : JpaRepository<DealOfferClickJpaEntity, Long> {

    @Query(
        """
        SELECT FUNCTION('DATE', c.clickedAt) AS day, COUNT(c) AS cnt
        FROM DealOfferClickJpaEntity c
        WHERE c.offerId = :offerId AND c.clickedAt >= :from AND c.clickedAt < :to
        GROUP BY FUNCTION('DATE', c.clickedAt)
        ORDER BY day ASC
        """,
    )
    fun countDailyByOffer(
        @Param("offerId") offerId: Long,
        @Param("from") from: LocalDateTime,
        @Param("to") to: LocalDateTime,
    ): List<Array<Any>>

    /** 보존기간(90일) 초과분 정리 — 헬스체크 CronJob 이 겸한다 */
    @Modifying
    @Query("DELETE FROM DealOfferClickJpaEntity c WHERE c.clickedAt < :threshold")
    fun deleteOlderThan(@Param("threshold") threshold: LocalDateTime): Int
}
