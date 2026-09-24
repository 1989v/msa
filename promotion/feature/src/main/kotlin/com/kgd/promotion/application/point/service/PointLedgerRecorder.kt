package com.kgd.promotion.application.point.service

import com.kgd.promotion.application.point.port.PointBalanceRepositoryPort
import com.kgd.promotion.application.point.port.PointEventPort
import com.kgd.promotion.application.point.port.PointLedgerRepositoryPort
import com.kgd.promotion.domain.point.model.PointBalance
import com.kgd.promotion.domain.point.model.PointLedgerEntry
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * 잔액 변경을 남기는 한 곳 — 잔액 행 저장 · 원장 한 줄 · `promotion.point.changed` 가 같이 간다.
 * 호출자의 트랜잭션 안에서만 부른다(지급 · 보류 · 원복).
 */
@Component
class PointLedgerRecorder(
    private val balances: PointBalanceRepositoryPort,
    private val ledger: PointLedgerRepositoryPort,
    private val events: PointEventPort,
) {
    fun find(memberId: String): PointBalance? = balances.findByMemberId(memberId)

    fun findOrOpen(memberId: String, now: Instant): PointBalance =
        balances.findByMemberId(memberId) ?: balances.create(PointBalance.open(memberId, now))

    /** [change] 는 잔액 도메인 메서드 호출 — 잔액과 원장 줄이 한 번에 나온다 */
    fun record(balance: PointBalance, change: (PointBalance) -> PointLedgerEntry): PointBalance {
        val entry = change(balance)
        val saved = balances.save(balance)
        val appended = ledger.append(entry)
        events.changed(saved, appended)
        return saved
    }
}
