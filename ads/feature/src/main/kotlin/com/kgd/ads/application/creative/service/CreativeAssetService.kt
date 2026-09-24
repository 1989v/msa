package com.kgd.ads.application.creative.service

import com.kgd.ads.application.creative.dto.CreativeAsset
import com.kgd.ads.application.creative.port.CreativeReadPort
import com.kgd.ads.application.creative.usecase.GetCreativeAssetUseCase
import org.springframework.stereotype.Service

@Service
class CreativeAssetService(
    private val creativeReadPort: CreativeReadPort,
) : GetCreativeAssetUseCase {

    // 해시는 SHA-256 hex 64자다. 형식이 다르면 DB 를 부르지 않는다.
    override fun execute(hash: String): CreativeAsset? =
        if (HASH.matches(hash)) creativeReadPort.findAsset(hash) else null

    private companion object {
        val HASH = Regex("^[0-9a-f]{64}$")
    }
}
