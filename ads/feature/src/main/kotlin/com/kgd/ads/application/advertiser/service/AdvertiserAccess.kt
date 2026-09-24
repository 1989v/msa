package com.kgd.ads.application.advertiser.service

import com.kgd.ads.application.advertiser.port.AdvertiserPort
import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Component

/**
 * 요청 회원 → 광고주. 광고주 API 의 모든 조회·쓰기는 여기서 얻은 광고주 id 로 범위를 좁힌다 —
 * 요청이 광고주 id 를 직접 들고 오지 않는다.
 */
@Component
class AdvertiserAccess(
    private val advertiserPort: AdvertiserPort,
) {
    fun require(memberId: Long): Advertiser =
        advertiserPort.findByMemberId(memberId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "광고주 등록이 필요합니다")

    /** 정지된 광고주는 조회만 된다. */
    fun requireWritable(memberId: Long): Advertiser {
        val advertiser = require(memberId)
        if (!advertiser.canWrite) throw BusinessException(ErrorCode.FORBIDDEN, "정지된 광고주는 변경할 수 없습니다")
        return advertiser
    }
}
