package com.kgd.settlement.infrastructure.payout

import com.kgd.settlement.application.statement.port.PayoutPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

/**
 * 모의 송금 — 실제 송금은 범위 밖(스펙 Out of Scope). 계좌를 복호화하지 않는다: 판매자 id 와 정산서로 송금 기록(참조)만 만든다.
 * 참조는 정산서마다 같아서 재시도가 두 번째 송금이 되지 않는다. 참조는 정산서 행(`payout_reference`)에 남는다.
 */
@Component
class MockPayoutAdapter : PayoutPort {
    private val log = KotlinLogging.logger {}

    override fun transfer(sellerId: Long, statementId: Long, amount: Long): String {
        val reference = "MOCK-PAYOUT-$sellerId-$statementId"
        log.info { "모의 송금: seller=$sellerId, statement=$statementId, amount=$amount, ref=$reference" }
        return reference
    }
}
