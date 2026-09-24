package com.kgd.ads.support

import com.kgd.ads.application.creative.dto.EncodedImage
import com.kgd.ads.application.creative.port.CreativeImageTranscoderPort
import com.kgd.ads.domain.creative.policy.CreativeImageFormat
import java.util.concurrent.atomic.AtomicInteger

/**
 * 운영 디코더(ImageIO)를 감싸 호출 수를 센다 — 「헤더에서 거절한 이미지는 디코더가 한 번도 불리지 않는다」를
 * 디코더 자신의 호출로 판정한다. 정상 업로드에서 수가 오르는 것으로 계측기가 살아 있는 것도 함께 확인한다.
 */
class CountingImageTranscoder(private val delegate: CreativeImageTranscoderPort) : CreativeImageTranscoderPort {
    private val calls = AtomicInteger()

    val count: Int get() = calls.get()

    override fun reencode(bytes: ByteArray, format: CreativeImageFormat): EncodedImage {
        calls.incrementAndGet()
        return delegate.reencode(bytes, format)
    }
}
