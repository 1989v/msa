package com.kgd.ads.application.creative.port

import com.kgd.ads.application.creative.dto.EncodedImage
import com.kgd.ads.application.creative.dto.StoredImage
import com.kgd.ads.domain.creative.policy.CreativeImageFormat
import java.time.LocalDateTime

/**
 * 이미지 디코딩·재인코딩. 픽셀을 푸는 곳은 여기 하나뿐이다 — 헤더 검사([com.kgd.ads.domain.creative.policy.CreativeImageRules])를
 * 통과한 바이트만 넘긴다. 다시 인코딩하면 EXIF·텍스트 청크 같은 메타데이터가 남지 않는다.
 */
interface CreativeImageTranscoderPort {
    fun reencode(bytes: ByteArray, format: CreativeImageFormat): EncodedImage
}

/** 내용 해시로 이미지를 저장한다. 같은 해시가 이미 있으면 그대로 둔다(같은 내용이다). */
interface CreativeAssetStorePort {
    fun saveIfAbsent(image: StoredImage, now: LocalDateTime)
}
