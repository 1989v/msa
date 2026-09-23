package com.kgd.ads.application.ledger.usecase

/** 광고주 지갑에 가상 크레딧을 충전한다(원장 거래 `TOPUP`). */
interface TopUpUseCase {
    fun execute(command: Command): Result

    data class Command(val memberId: Long, val amountMicros: Long, val idempotencyKey: String)
    data class Result(val transactionId: Long, val balanceMicros: Long)
}
