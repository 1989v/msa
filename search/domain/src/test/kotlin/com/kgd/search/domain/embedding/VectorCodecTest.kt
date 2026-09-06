package com.kgd.search.domain.embedding

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 벡터 전송 표현 — 색인(batch)·질의(app)·도구(tools/embed)가 **바이트 단위로 같아야** 한다.
 *
 * 아래 base64 는 `ByteBuffer.LITTLE_ENDIAN` + `Base64` 로 만든 고정값이고, 파이썬 도구의
 * `tests/test_vectors.py` 도 **같은 문자열**을 쓴다. 어느 한쪽 엔디안이 바뀌면 예외가 아니라
 * 그럴듯한 쓰레기 벡터가 나오므로, 상수로 묶어 두는 것이 유일한 방어다.
 */
class VectorCodecTest : BehaviorSpec({

    given("고정값 벡터를 주고받을 때") {
        `when`("인코딩하면") {
            then("정해진 base64 여야 한다") {
                VectorCodec.encode(listOf(1.0f, 0.0f, 0.0f, 0.0f)) shouldBe "AACAPwAAAAAAAAAAAAAAAA=="
                VectorCodec.encode(listOf(0.5f, 0.5f, 0.5f, 0.5f)) shouldBe "AAAAPwAAAD8AAAA/AAAAPw=="
                VectorCodec.encode(listOf(-0.6f, 0.8f)) shouldBe "mpkZv83MTD8="
            }
        }
        `when`("디코딩하면") {
            then("원래 값이 나와야 한다") {
                VectorCodec.decode("mpkZv83MTD8=") shouldBe listOf(-0.6f, 0.8f)
                VectorCodec.decode("AACAPwAAAAAAAAAAAAAAAA==") shouldBe listOf(1.0f, 0.0f, 0.0f, 0.0f)
            }
        }
        `when`("왕복시키면") {
            then("1024차원도 그대로여야 한다") {
                val vector = List(1024) { (it % 7) * 0.125f - 0.5f }
                VectorCodec.decode(VectorCodec.encode(vector)) shouldBe vector
            }
        }
    }

    given("망가진 입력을 주면") {
        `when`("길이가 4의 배수가 아니면") {
            then("조용한 쓰레기 벡터 대신 예외여야 한다") {
                shouldThrow<IllegalArgumentException> { VectorCodec.decode("AAAA") }
            }
        }
        `when`("빈 값이면") {
            then("양쪽 다 거부해야 한다") {
                shouldThrow<IllegalArgumentException> { VectorCodec.decode("") }
                shouldThrow<IllegalArgumentException> { VectorCodec.encode(emptyList()) }
            }
        }
    }
})
