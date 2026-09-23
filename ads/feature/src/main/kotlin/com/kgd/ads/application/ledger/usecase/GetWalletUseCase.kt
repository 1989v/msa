package com.kgd.ads.application.ledger.usecase

/** 요청 회원의 광고주 지갑 잔액. 광고주가 아니면 null. */
interface GetWalletUseCase {
    fun execute(memberId: Long): Result?

    data class Result(val advertiserId: Long, val balanceMicros: Long)
}
