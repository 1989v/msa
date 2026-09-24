package com.kgd.settlement.domain.ledger.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/** 거래 하나의 차변 합 ≠ 대변 합 — 원장에 들어가지 않는다 */
class UnbalancedJournalException(debit: Long, credit: Long, sourceKey: String) :
    BusinessException(ErrorCode.UNBALANCED_JOURNAL, "차변 ${debit}원 ≠ 대변 ${credit}원 (원천 $sourceKey)")

/** 분개 줄·원천 이벤트 금액이 계약에 맞지 않는다(음수·0·판매자 누락·검산 불일치) */
class InvalidJournalException(message: String) : BusinessException(ErrorCode.INVALID_INPUT, message)
