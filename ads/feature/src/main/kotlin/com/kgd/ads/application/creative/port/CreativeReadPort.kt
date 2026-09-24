package com.kgd.ads.application.creative.port

import com.kgd.ads.application.creative.dto.CreativeAsset
import com.kgd.ads.application.creative.dto.CreativeLanding

interface CreativeReadPort {
    /** 소재의 상태와 랜딩. 없는 소재면 null. */
    fun findLanding(creativeId: Long): CreativeLanding?

    fun findAsset(hash: String): CreativeAsset?
}
