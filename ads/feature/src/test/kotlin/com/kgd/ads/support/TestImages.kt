package com.kgd.ads.support

import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.util.zip.CRC32
import java.util.zip.Deflater
import java.util.zip.DeflaterOutputStream
import javax.imageio.ImageIO

/** 업로드 검사용 이미지 바이트. 규격을 어기는 파일도 헤더는 규격대로 만든다 — 어느 단계에서 걸리는지가 검사 대상이다. */
object TestImages {
    const val METADATA_KEYWORD = "SecretCamera"

    /**
     * 실제 PNG. [withMetadata] 면 IHDR 뒤에 tEXt 청크를 끼운다 — 다시 인코딩하면 사라져야 한다.
     * 저장 주소가 내용 해시라 같은 그림은 스펙끼리 같은 에셋이 된다. 승인 여부를 따로 보려면 [shade] 를 달리 준다.
     */
    fun png(width: Int, height: Int, withMetadata: Boolean = false, shade: Int = 0): ByteArray {
        val image = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
        image.createGraphics().apply { color = Color(30, 90, shade and 0xFF); fillRect(0, 0, width, height); dispose() }
        val bytes = ByteArrayOutputStream().also { ImageIO.write(image, "png", it) }.toByteArray()
        if (!withMetadata) return bytes
        val ihdrEnd = 8 + 8 + 13 + 4
        return bytes.copyOfRange(0, ihdrEnd) + chunk("tEXt", "$METADATA_KEYWORD\u0000owner=someone".toByteArray()) +
            bytes.copyOfRange(ihdrEnd, bytes.size)
    }

    fun jpeg(width: Int, height: Int): ByteArray {
        val image = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
        image.createGraphics().apply { color = Color(200, 60, 40); fillRect(0, 0, width, height); dispose() }
        return ByteArrayOutputStream().also { ImageIO.write(image, "jpeg", it) }.toByteArray()
    }

    /**
     * 규격대로 만든 압축 폭탄 — 20000×20000 1비트 흑백 PNG. 픽셀을 풀면 50MB 짜리 래스터지만 0 만 있어 압축본은 수십 KB 다.
     */
    fun pngBomb(width: Int = 20_000, height: Int = 20_000): ByteArray {
        val rowBytes = 1 + (width + 7) / 8 // 필터 바이트 + 1비트 픽셀
        val raw = ByteArrayOutputStream()
        DeflaterOutputStream(raw, Deflater(Deflater.BEST_COMPRESSION)).use { out ->
            val row = ByteArray(rowBytes)
            repeat(height) { out.write(row) }
        }
        val ihdr = ByteArrayOutputStream().also {
            DataOutputStream(it).apply {
                writeInt(width); writeInt(height)
                writeByte(1) // bit depth
                writeByte(0) // grayscale
                writeByte(0); writeByte(0); writeByte(0)
            }
        }.toByteArray()
        return PNG_SIGNATURE + chunk("IHDR", ihdr) + chunk("IDAT", raw.toByteArray()) + chunk("IEND", ByteArray(0))
    }

    /** 유효한 이미지 뒤에 0 을 붙여 정확히 [size] 바이트로 — 헤더는 멀쩡하고 크기만 넘는다. */
    fun padTo(bytes: ByteArray, size: Int): ByteArray = bytes + ByteArray(size - bytes.size)

    val GIF: ByteArray = "GIF89a".toByteArray() + byteArrayOf(0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x3B)

    private val PNG_SIGNATURE = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)

    private fun chunk(type: String, data: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        val dos = DataOutputStream(out)
        dos.writeInt(data.size)
        val typeBytes = type.toByteArray(Charsets.US_ASCII)
        dos.write(typeBytes)
        dos.write(data)
        dos.writeInt(CRC32().apply { update(typeBytes); update(data) }.value.toInt())
        return out.toByteArray()
    }
}
