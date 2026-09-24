package com.kgd.promotion.application.point.port

import com.kgd.promotion.domain.point.model.PointBalance
import com.kgd.promotion.domain.point.model.PointLedgerEntry

interface PointBalanceRepositoryPort {
    fun findByMemberId(memberId: String): PointBalance?
    fun create(balance: PointBalance): PointBalance

    /** `@Version` 으로 저장한다 — 사이에 다른 변경이 있었으면 낙관적 잠금 예외 */
    fun save(balance: PointBalance): PointBalance
}

/** 포인트 원장 — 추가만. 멱등 키 유니크 */
interface PointLedgerRepositoryPort {
    fun append(entry: PointLedgerEntry): PointLedgerEntry
    fun findRecentByMemberId(memberId: String, limit: Int): List<PointLedgerEntry>
}

/** order 읽기 모델용 `promotion.point.changed`(키 회원 id) — 잔액이 바뀔 때마다 한 행 */
interface PointEventPort {
    fun changed(balance: PointBalance, entry: PointLedgerEntry)
}
