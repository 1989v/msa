package com.kgd.ads.infrastructure.image

import com.kgd.ads.application.creative.dto.EncodedImage
import com.kgd.ads.application.creative.port.CreativeImageTranscoderPort
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.creative.policy.CreativeImageFormat
import org.springframework.stereotype.Component
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import javax.imageio.ImageIO
import javax.imageio.stream.MemoryCacheImageInputStream
import javax.imageio.stream.MemoryCacheImageOutputStream

/**
 * JDK ImageIO 로 픽셀을 풀고 같은 형식으로 다시 쓴다. 새로 쓴 파일에는 픽셀만 들어가므로 EXIF·텍스트 청크·
 * ICC 같은 원본 메타데이터가 남지 않는다. 임시 파일을 만들지 않도록 메모리 스트림만 쓴다.
 */
@Component
class ImageIoTranscoder : CreativeImageTranscoderPort {

    override fun reencode(bytes: ByteArray, format: CreativeImageFormat): EncodedImage {
        val image = try {
            // ImageIO.read 가 이 스트림을 스스로 닫는다 — 여기서 다시 닫으면 "closed" 예외가 난다.
            ImageIO.read(MemoryCacheImageInputStream(ByteArrayInputStream(bytes)))
        } catch (e: IOException) {
            null
        } catch (e: RuntimeException) {
            // 손상된 청크에서 디코더가 런타임 예외를 내기도 한다 — 업로드 거절이지 서버 오류가 아니다.
            null
        } ?: throw InvalidCreativeException("이미지를 읽을 수 없습니다")

        val out = ByteArrayOutputStream()
        val written = MemoryCacheImageOutputStream(out).use { ImageIO.write(image, format.imageIoName, it) }
        if (!written) throw InvalidCreativeException("이미지를 다시 저장할 수 없습니다")
        return EncodedImage(out.toByteArray(), image.width, image.height)
    }

    private val CreativeImageFormat.imageIoName: String
        get() = when (this) {
            CreativeImageFormat.PNG -> "png"
            CreativeImageFormat.JPEG -> "jpeg"
        }
}
