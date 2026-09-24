package com.kgd.ads.application.creative.port

import com.kgd.ads.application.creative.dto.CreativeAsset
import com.kgd.ads.application.creative.dto.CreativeLanding

interface CreativeReadPort {
    /** 소재의 상태와 랜딩. 없는 소재면 null. */
    fun findLanding(creativeId: Long): CreativeLanding?

    fun findAsset(hash: String): CreativeAsset?

    /** 이 이미지를 쓰는 승인된 소재가 있는지 — 공개 에셋 응답의 조건. */
    fun isApprovedImage(hash: String): Boolean
}
