package com.kgd.ads.application.creative.service

import com.kgd.ads.application.creative.dto.StoredImage
import com.kgd.ads.application.creative.port.CreativeAssetStorePort
import com.kgd.ads.application.creative.port.CreativeImageTranscoderPort
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.creative.policy.CreativeImageRules
import com.kgd.ads.domain.placement.model.AdPlacement
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.time.LocalDateTime

/**
 * 업로드 이미지 처리 순서: 헤더 검사(매직 바이트 → 가로·세로 → 크기 → 지면 비율) → 디코딩·재인코딩 → 내용 해시 저장.
 * 디코딩은 헤더 검사를 통과한 뒤에만 한다 — 순서를 바꾸면 300KB 짜리 압축 폭탄이 수백 MB 를 잡는다.
 */
@Component
class CreativeImageService(
    private val transcoder: CreativeImageTranscoderPort,
    private val assetStore: CreativeAssetStorePort,
) {
    /** @return 저장한 이미지의 내용 해시 */
    fun store(bytes: ByteArray, placements: List<AdPlacement>, now: LocalDateTime): String {
        val header = CreativeImageRules.inspect(bytes, placements)
        val encoded = transcoder.reencode(bytes, header.format)
        // 헤더가 픽셀과 다른 크기를 적었으면 위 검사가 엉뚱한 값을 본 것이다.
        if (encoded.width != header.width || encoded.height != header.height) {
            throw InvalidCreativeException("이미지 헤더의 크기와 실제 크기가 다릅니다")
        }
        val hash = MessageDigest.getInstance("SHA-256").digest(encoded.bytes).joinToString("") { "%02x".format(it) }
        assetStore.saveIfAbsent(StoredImage(hash, header.format.contentType, encoded.bytes, encoded.width, encoded.height), now)
        return hash
    }
}
