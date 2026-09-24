package com.kgd.ads.presentation.creative.controller

import com.kgd.ads.application.creative.usecase.GetCreativeAssetUseCase
import org.springframework.http.CacheControl
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

/**
 * 소재 이미지. 주소가 내용 해시라 같은 주소의 내용은 바뀌지 않는다 — 1년 불변 캐시.
 * 저장 때 판정한 형식을 그대로 Content-Type 으로 내고 `nosniff` 로 브라우저가 다른 형식으로 읽지 못하게 한다.
 */
@RestController
@RequestMapping("/api/v1/ads")
class CreativeAssetController(
    private val getAsset: GetCreativeAssetUseCase,
) {
    @GetMapping("/assets/{hash}")
    fun asset(@PathVariable hash: String): ResponseEntity<ByteArray> {
        val asset = getAsset.execute(hash) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(asset.contentType))
            .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
            .header(NOSNIFF_HEADER, "nosniff")
            .body(asset.bytes)
    }

    private companion object {
        const val NOSNIFF_HEADER = "X-Content-Type-Options"
    }
}
