package com.kgd.ads.application.creative.usecase

import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.domain.creative.model.CreativeRejectReason

/** 운영자 심사. 승인은 다음 인덱스 갱신(1분 안)에 게재 후보가 된다. 반려는 사유 코드가 필수다. */
interface ReviewCreativeUseCase {
    fun pending(): List<CreativeView>
    fun approve(actorMemberId: Long, creativeId: Long): CreativeView
    fun reject(actorMemberId: Long, creativeId: Long, reason: CreativeRejectReason): CreativeView
}
