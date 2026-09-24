package com.kgd.ads.application.advertiser.usecase

import com.kgd.ads.application.advertiser.dto.AdvertiserAdminView

/** 운영자의 광고주 관리 — 목록·정지·해제. 정지는 다음 인덱스 갱신(1분 안)에 결정에서 빠진다. */
interface ManageAdvertiserUseCase {
    fun list(): List<AdvertiserAdminView>
    fun suspend(command: Suspend): AdvertiserAdminView
    fun unsuspend(command: Unsuspend): AdvertiserAdminView

    data class Suspend(val advertiserId: Long, val reason: String, val actorMemberId: Long)
    data class Unsuspend(val advertiserId: Long, val actorMemberId: Long)
}
