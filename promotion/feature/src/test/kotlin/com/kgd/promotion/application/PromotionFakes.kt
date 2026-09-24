package com.kgd.promotion.application

import com.kgd.promotion.application.coupon.port.CouponDefinitionPage
import com.kgd.promotion.application.coupon.port.CouponDefinitionRepositoryPort
import com.kgd.promotion.application.coupon.port.CouponEventPort
import com.kgd.promotion.application.coupon.port.UserCouponRepositoryPort
import com.kgd.promotion.application.coupon.service.CouponClaimService
import com.kgd.promotion.application.hold.port.HoldEvent
import com.kgd.promotion.application.hold.port.HoldEventPort
import com.kgd.promotion.application.hold.port.HoldRestorationRepositoryPort
import com.kgd.promotion.application.hold.port.PromotionHoldRepositoryPort
import com.kgd.promotion.application.hold.service.PromotionHoldExpiryService
import com.kgd.promotion.application.hold.service.PromotionHoldService
import com.kgd.promotion.application.point.port.PointBalanceRepositoryPort
import com.kgd.promotion.application.point.port.PointEventPort
import com.kgd.promotion.application.point.port.PointLedgerRepositoryPort
import com.kgd.promotion.application.point.service.PointLedgerRecorder
import com.kgd.promotion.application.point.service.PointService
import com.kgd.promotion.domain.coupon.exception.CouponAlreadyIssuedException
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponDefinition
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.promotion.domain.coupon.model.UserCoupon
import com.kgd.promotion.domain.hold.model.HoldRestoration
import com.kgd.promotion.domain.hold.model.PromotionHold
import com.kgd.promotion.domain.hold.model.PromotionHoldStatus
import com.kgd.promotion.domain.point.model.PointBalance
import com.kgd.promotion.domain.point.model.PointLedgerEntry
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

val T0: Instant = Instant.parse("2026-10-10T00:00:00Z")

/** 저장소 포트의 메모리 구현 — 저장한 값을 다시 읽어 판정하려고 목 대신 쓴다. 유니크 제약도 흉내 낸다 */
class InMemoryDefinitions : CouponDefinitionRepositoryPort {
    val rows = linkedMapOf<Long, CouponDefinition>()
    private var seq = 0L

    override fun create(definition: CouponDefinition): CouponDefinition = copy(definition, ++seq, 0).also { rows[seq] = it }
    override fun findById(id: Long) = rows[id]
    override fun findAllByIdIn(ids: Collection<Long>) = rows.values.filter { it.id in ids }
    override fun findPage(page: Int, size: Int) = CouponDefinitionPage(rows.values.toList(), rows.size.toLong())
    override fun tryIncrementIssued(id: Long): Boolean {
        val d = rows.getValue(id)
        if (d.issuedCount >= d.issueLimit) return false
        rows[id] = copy(d, id, d.issuedCount + 1)
        return true
    }

    private fun copy(d: CouponDefinition, id: Long, issued: Int) = CouponDefinition.restore(
        id, d.name, d.type, d.amount, d.rateBp, d.maxDiscount, d.minOrderAmount, d.validFrom, d.validUntil, d.issueLimit,
        issued, d.bearer, d.sellerId, d.status, d.createdBy, d.createdAt,
    )
}

class InMemoryUserCoupons : UserCouponRepositoryPort {
    val rows = linkedMapOf<Long, UserCoupon>()
    private var seq = 0L

    override fun create(coupon: UserCoupon): UserCoupon {
        if (existsByMemberIdAndDefinitionId(coupon.memberId, coupon.couponDefinitionId)) {
            throw CouponAlreadyIssuedException(coupon.couponDefinitionId)
        }
        val saved = UserCoupon.restore(++seq, coupon.memberId, coupon.couponDefinitionId, coupon.status, coupon.reservedOrderId, coupon.issuedAt, coupon.updatedAt)
        rows[seq] = saved
        return saved
    }

    override fun save(coupon: UserCoupon) = coupon.also { rows[requireNotNull(it.id)] = it }
    override fun findById(id: Long) = rows[id]
    override fun existsByMemberIdAndDefinitionId(memberId: String, couponDefinitionId: Long) =
        rows.values.any { it.memberId == memberId && it.couponDefinitionId == couponDefinitionId }
    override fun findAllByMemberId(memberId: String) = rows.values.filter { it.memberId == memberId }
}

class InMemoryBalances : PointBalanceRepositoryPort {
    val rows = linkedMapOf<String, PointBalance>()
    private var seq = 0L
    override fun findByMemberId(memberId: String) = rows[memberId]
    override fun create(balance: PointBalance) =
        PointBalance.restore(++seq, balance.memberId, balance.balance, balance.updatedAt).also { rows[it.memberId] = it }
    override fun save(balance: PointBalance) = balance.also { rows[it.memberId] = it }
}

class InMemoryLedger : PointLedgerRepositoryPort {
    val rows = mutableListOf<PointLedgerEntry>()
    override fun append(entry: PointLedgerEntry): PointLedgerEntry {
        check(rows.none { it.idempotencyKey == entry.idempotencyKey }) { "uk_point_ledger_idempotency_key" }
        return entry.copy(id = rows.size + 1L).also { rows += it }
    }
    override fun findRecentByMemberId(memberId: String, limit: Int) = rows.filter { it.memberId == memberId }.reversed().take(limit)
}

class InMemoryHolds : PromotionHoldRepositoryPort {
    val rows = linkedMapOf<Long, PromotionHold>()
    private var seq = 0L

    override fun create(hold: PromotionHold): PromotionHold {
        check(rows.values.none { it.orderId == hold.orderId }) { "uk_promotion_hold_order" }
        val saved = PromotionHold.restore(
            ++seq, hold.orderId, hold.memberId, hold.userCouponId, hold.couponDefinitionId, hold.couponDiscount,
            hold.pointAmount, hold.status, hold.failureReason, hold.expiresAt, hold.restoredPointAmount,
            hold.couponReturned, hold.createdAt, hold.updatedAt,
        )
        rows[seq] = saved
        return saved
    }

    override fun save(hold: PromotionHold) = hold.also { rows[requireNotNull(it.id)] = it }
    override fun findByOrderId(orderId: Long) = rows.values.firstOrNull { it.orderId == orderId }
    override fun findExpiredReservedOrderIds(now: Instant, limit: Int) =
        rows.values.filter { it.status == PromotionHoldStatus.RESERVED && !it.expiresAt.isAfter(now) }.map { it.orderId }.take(limit)
}

class InMemoryRestorations : HoldRestorationRepositoryPort {
    val rows = mutableListOf<HoldRestoration>()
    override fun findByRestoreKey(restoreKey: String) = rows.firstOrNull { it.restoreKey == restoreKey }
    override fun save(restoration: HoldRestoration) { rows += restoration }
}

/** 발행된 이벤트를 모아 두는 포트 — 판정은 여기 쌓인 값으로 */
class RecordingEvents : HoldEventPort, CouponEventPort, PointEventPort {
    val holds = mutableListOf<HoldEvent>()
    val defined = mutableListOf<CouponDefinition>()
    val issued = mutableListOf<UserCoupon>()
    val pointChanges = mutableListOf<PointLedgerEntry>()
    override fun publish(event: HoldEvent) { holds += event }
    override fun defined(definition: CouponDefinition) { defined += definition }
    override fun issued(coupon: UserCoupon) { issued += coupon }
    override fun changed(balance: PointBalance, entry: PointLedgerEntry) { pointChanges += entry }
}

class MutableClock(var now: Instant = T0) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId?): Clock = this
    override fun instant(): Instant = now
}

/** 실제 서비스 조립 — 트랜잭션 프록시만 없다(단위 테스트) */
class PromotionHarness(val clock: MutableClock = MutableClock()) {
    val definitions = InMemoryDefinitions()
    val userCoupons = InMemoryUserCoupons()
    val balances = InMemoryBalances()
    val ledger = InMemoryLedger()
    val holds = InMemoryHolds()
    val restorations = InMemoryRestorations()
    val events = RecordingEvents()
    val recorder = PointLedgerRecorder(balances, ledger, events)
    val holdService = PromotionHoldService(holds, restorations, userCoupons, definitions, recorder, events, clock, Duration.ofMinutes(30))
    val expiry = PromotionHoldExpiryService(holds, holdService, clock)
    val claims = CouponClaimService(definitions, userCoupons, events, clock)
    val pointService = PointService(recorder, ledger, clock)

    /** 플랫폼 정액 쿠폰 정의 — 10/1~10/31, 최소 주문 10,000원 */
    fun fixedCoupon(amount: Long = 1_000L, limit: Int = 10, minOrder: Long = 10_000L): CouponDefinition = definitions.create(
        CouponDefinition.create(
            name = "정액", type = CouponType.FIXED, amount = amount, rateBp = null, maxDiscount = null,
            minOrderAmount = minOrder, validFrom = Instant.parse("2026-10-01T00:00:00Z"),
            validUntil = Instant.parse("2026-10-31T00:00:00Z"), issueLimit = limit, bearer = CouponBearer.PLATFORM,
            sellerId = null, createdBy = "1", now = T0,
        ),
    )

    fun grant(memberId: String, amount: Long) =
        pointService.grant(com.kgd.promotion.application.point.usecase.GrantPointsUseCase.Grant(memberId, amount, "1", "데모"))

    fun balanceOf(memberId: String): Long = balances.findByMemberId(memberId)?.balance ?: 0L
}
