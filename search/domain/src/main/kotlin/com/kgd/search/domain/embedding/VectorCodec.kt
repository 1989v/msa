package com.kgd.search.domain.embedding

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Base64

/**
 * 벡터 전송 표현 — **float32 little-endian 바이트의 base64** (ADR-0090).
 *
 * place 내부 API 응답, `query_vectors` 인덱스의 `binary` 필드, 도구(`tools/embed`)가 모두 이 표현을 쓴다.
 * 실수 배열 JSON 보다 3배 작고 파싱이 빠르다(로컬 프로브: 512차원 8만 항목 float JSON = 642MB, 플랜 §8.4).
 *
 * **도메인에 두는 이유**: 색인(`search:batch`)과 질의(`search:app`)가 같은 규약을 써야 하는데,
 * 각자 사본을 가지면 한쪽 엔디안만 바뀌어도 예외 없이 **그럴듯한 쓰레기 벡터**가 나와
 * 검색 품질만 조용히 무너진다. 배포 단위는 둘이어도 규약은 하나다.
 */
object VectorCodec {

    fun decode(base64: String): List<Float> {
        val bytes = Base64.getDecoder().decode(base64)
        require(bytes.isNotEmpty()) { "빈 벡터입니다" }
        require(bytes.size % Float.SIZE_BYTES == 0) { "벡터 바이트 길이가 4의 배수가 아닙니다: ${bytes.size}" }
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        return List(bytes.size / Float.SIZE_BYTES) { buffer.float }
    }

    fun encode(vector: List<Float>): String {
        require(vector.isNotEmpty()) { "빈 벡터입니다" }
        val buffer = ByteBuffer.allocate(vector.size * Float.SIZE_BYTES).order(ByteOrder.LITTLE_ENDIAN)
        vector.forEach { buffer.putFloat(it) }
        return Base64.getEncoder().encodeToString(buffer.array())
    }
}
