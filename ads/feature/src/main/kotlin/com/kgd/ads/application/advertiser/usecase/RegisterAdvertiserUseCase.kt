package com.kgd.ads.application.advertiser.usecase

/** 로그인 회원을 광고주로 등록한다. 이미 등록돼 있으면 그 광고주를 돌려준다. */
interface RegisterAdvertiserUseCase {
    fun execute(command: Command): Result

    data class Command(val memberId: Long, val displayName: String)
    data class Result(val advertiserId: Long)
}
