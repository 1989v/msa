package com.kgd.ads.presentation.support

import com.kgd.ads.application.creative.dto.CreativeAsset
import org.springframework.http.CacheControl
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity

/**
 * 인증된 미리보기 응답. 심사 전·반려 이미지도 내므로 공유 캐시에 남지 않게 `no-store`,
 * 저장 형식 그대로의 Content-Type 을 `nosniff` 로 고정한다.
 */
internal object ImageResponses {
    fun preview(asset: CreativeAsset): ResponseEntity<ByteArray> =
        ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(asset.contentType))
            .cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .body(asset.bytes)
}
