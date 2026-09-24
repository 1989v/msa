package com.kgd.ads.domain.creative.policy

import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.placement.model.AdPlacement

/** 소재 이미지 형식. 판정은 확장자·요청 Content-Type 이 아니라 파일 앞 바이트(매직 바이트)로 한다. */
enum class CreativeImageFormat(val contentType: String) {
    PNG("image/png"),
    JPEG("image/jpeg"),
}

/** 이미지 헤더에서 읽은 형식과 가로·세로 픽셀. 픽셀 데이터는 아직 풀지 않은 상태다. */
data class CreativeImageHeader(val format: CreativeImageFormat, val width: Int, val height: Int)

/**
 * 업로드 이미지를 **디코딩하기 전에** 거르는 규칙. 순서가 규칙의 일부다:
 * 매직 바이트 → 헤더의 가로·세로(2000px 초과면 거절) → 크기(300KB) → 타기팅한 모든 지면의 허용 비율.
 *
 * 헤더를 먼저 보는 이유 — 압축된 PNG 는 300KB 안에 20000×20000 을 담을 수 있고, 그것을 풀면 수백 MB 를 잡는다.
 * 가로·세로는 헤더 몇 바이트에 적혀 있으므로 픽셀을 풀지 않고 거절할 수 있다.
 */
object CreativeImageRules {
    const val MAX_BYTES = 300 * 1024
    const val MAX_DIMENSION = 2000

    private val PNG_MAGIC = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    private val JPEG_MAGIC = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())

    /** 통과하면 헤더를 돌려준다. 어느 단계든 어기면 [InvalidCreativeException]. */
    fun inspect(bytes: ByteArray, placements: List<AdPlacement>): CreativeImageHeader {
        val header = readHeader(bytes)
        if (header.width > MAX_DIMENSION || header.height > MAX_DIMENSION) {
            invalid("이미지는 가로·세로 ${MAX_DIMENSION}px 이하여야 합니다 (${header.width}×${header.height})")
        }
        if (bytes.size > MAX_BYTES) invalid("이미지는 ${MAX_BYTES / 1024}KB 이하여야 합니다")
        placements.firstOrNull { !it.fitsImage(header.width, header.height) }?.let {
            invalid("이미지 비율(${header.width}×${header.height})이 지면 ${it.key} 의 허용 비율에 맞지 않습니다")
        }
        return header
    }

    fun readHeader(bytes: ByteArray): CreativeImageHeader = when {
        bytes.startsWith(PNG_MAGIC) -> readPng(bytes)
        bytes.startsWith(JPEG_MAGIC) -> readJpeg(bytes)
        else -> invalid("PNG·JPEG 이미지만 올릴 수 있습니다")
    }

    /** PNG 는 서명 다음이 반드시 IHDR 청크이고, 그 앞 8바이트가 가로·세로(빅엔디언)다. */
    private fun readPng(bytes: ByteArray): CreativeImageHeader {
        if (bytes.size < 24 || String(bytes, 12, 4, Charsets.US_ASCII) != "IHDR") invalid("PNG 헤더를 읽을 수 없습니다")
        return sized(CreativeImageFormat.PNG, int32(bytes, 16), int32(bytes, 20))
    }

    /**
     * JPEG 는 세그먼트를 따라가 첫 SOF(프레임 시작) 마커의 가로·세로를 읽는다.
     * 스캔 데이터(SOS) 전에 SOF 가 없으면 읽을 수 없는 파일이다.
     */
    private fun readJpeg(bytes: ByteArray): CreativeImageHeader {
        var i = 2
        while (i + 3 < bytes.size) {
            if (bytes[i] != 0xFF.toByte()) invalid("JPEG 헤더를 읽을 수 없습니다")
            val marker = bytes[i + 1].toInt() and 0xFF
            when {
                marker == 0xFF -> { i++; continue } // 채움 바이트
                marker == 0x01 || marker in 0xD0..0xD7 -> { i += 2; continue } // 길이 없는 마커
                marker == 0xDA || marker == 0xD9 -> break
            }
            val length = uint16(bytes, i + 2)
            if (length < 2) invalid("JPEG 헤더를 읽을 수 없습니다")
            if (marker in SOF_MARKERS) {
                if (i + 8 >= bytes.size) break
                return sized(CreativeImageFormat.JPEG, uint16(bytes, i + 7), uint16(bytes, i + 5))
            }
            i += 2 + length
        }
        invalid("JPEG 헤더를 읽을 수 없습니다")
    }

    // SOF0~SOF15 중 DHT(C4)·JPG(C8)·DAC(CC) 는 프레임 마커가 아니다.
    private val SOF_MARKERS = (0xC0..0xCF).toSet() - setOf(0xC4, 0xC8, 0xCC)

    private fun sized(format: CreativeImageFormat, width: Int, height: Int): CreativeImageHeader {
        if (width <= 0 || height <= 0) invalid("이미지 가로·세로를 읽을 수 없습니다")
        return CreativeImageHeader(format, width, height)
    }

    private fun ByteArray.startsWith(prefix: ByteArray): Boolean =
        size >= prefix.size && prefix.indices.all { this[it] == prefix[it] }

    // PNG 가로·세로는 31비트 이하 정수다. 음수로 읽히면 규격 밖이라 sized() 가 거절한다.
    private fun int32(b: ByteArray, at: Int): Int =
        ((b[at].toInt() and 0xFF) shl 24) or ((b[at + 1].toInt() and 0xFF) shl 16) or
            ((b[at + 2].toInt() and 0xFF) shl 8) or (b[at + 3].toInt() and 0xFF)

    private fun uint16(b: ByteArray, at: Int): Int {
        if (at + 1 >= b.size) invalid("이미지 헤더가 잘렸습니다")
        return ((b[at].toInt() and 0xFF) shl 8) or (b[at + 1].toInt() and 0xFF)
    }

    private fun invalid(message: String): Nothing = throw InvalidCreativeException(message)
}
