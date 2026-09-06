package com.kgd.place.domain.attraction.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import java.time.LocalDateTime

class AttractionEmbeddingTest : BehaviorSpec({

    // 차원은 MRL 하한(32)에 맞춘다 — 그보다 작은 벡터는 model_ref 가 애초에 거부한다
    val dim = EmbeddingModelRef.MIN_DIM
    val ref = EmbeddingModelRef("dragonkue/snowflake-arctic-embed-l-v2.0-ko", "55ec6e9", dim)
    val text = "경복궁 · 역사 · 서울특별시 종로구 사직로 161"
    /** 앞자리에 값을 넣고 나머지는 0 인 길이 n 의 단위 벡터. */
    fun unit(n: Int = dim, vararg head: Float): FloatArray {
        val v = FloatArray(n) { if (it < head.size) head[it] else 0f }
        val norm = AttractionEmbedding.l2Norm(v).toFloat()
        return FloatArray(n) { v[it] / norm }
    }

    Given("model_ref") {
        When("문자열로 왕복하면") {
            Then("같은 값이 된다") {
                EmbeddingModelRef.parse(ref.value) shouldBe ref
                ref.value shouldBe "dragonkue/snowflake-arctic-embed-l-v2.0-ko@55ec6e9#d$dim"
            }
        }
        When("형식이 틀리면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { EmbeddingModelRef.parse("모델만") }
                shouldThrow<IllegalArgumentException> { EmbeddingModelRef("m", "short", dim) }  // 리비전 7자 아님
                shouldThrow<IllegalArgumentException> { EmbeddingModelRef("m@x", "55ec6e9", dim) }
                shouldThrow<IllegalArgumentException> { EmbeddingModelRef("m", "55ec6e9", 8) }  // 차원 하한 미만
            }
        }
    }

    Given("임베딩 저장") {
        val vector = unit(head = floatArrayOf(1f, 2f, 3f, 4f))
        val hash = EmbeddingText.hash(ref, text)

        When("차원·해시·정규화가 맞으면") {
            Then("만들어진다") {
                val e = AttractionEmbedding.create(1L, ref, text, hash, vector)
                e.attractionId shouldBe 1L
                e.modelRef shouldBe ref
                e.vector.size shouldBe dim
            }
        }
        When("벡터 차원이 model_ref 와 다르면") {
            Then("거부한다 — 다른 공간의 벡터가 섞이면 코사인이 뜻을 잃는다") {
                val e = shouldThrow<IllegalArgumentException> {
                    AttractionEmbedding.create(1L, ref, text, hash, unit(dim - 1, 1f, 2f, 3f))
                }
                e.message!! shouldContain "차원"
            }
        }
        When("해시가 텍스트와 어긋나면") {
            Then("거부한다 — 도구가 다른 텍스트로 계산했다는 뜻이다") {
                shouldThrow<IllegalArgumentException> {
                    AttractionEmbedding.create(1L, ref, text, EmbeddingText.hash(ref, "다른 텍스트"), vector)
                }
            }
        }
        When("벡터가 정규화돼 있지 않으면") {
            Then("거부한다 — 정규화를 전제로 내적을 코사인으로 쓴다") {
                shouldThrow<IllegalArgumentException> {
                    AttractionEmbedding.create(1L, ref, text, hash, FloatArray(dim) { 2f })
                }
            }
        }
        When("텍스트가 비면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> {
                    AttractionEmbedding.create(1L, ref, "  ", EmbeddingText.hash(ref, "  "), vector)
                }
            }
        }
    }

    Given("touch") {
        When("텍스트가 그대로라 시각만 밀 때") {
            Then("벡터와 해시는 유지되고 시각만 바뀐다") {
                val at = LocalDateTime.of(2026, 9, 6, 4, 30)
                val e = AttractionEmbedding.create(1L, ref, text, EmbeddingText.hash(ref, text), unit(head = floatArrayOf(1f)))
                val t = e.touched(at)
                t.embeddedAt shouldBe at
                t.textHash shouldBe e.textHash
                t.vector.toList() shouldBe e.vector.toList()
            }
        }
    }

    Given("해시 규약") {
        When("model_ref 가 다르면") {
            Then("같은 텍스트라도 다른 해시다 — 모델 교체가 전량 재임베딩으로 이어지는 근거") {
                val other = EmbeddingModelRef("google/embeddinggemma-300m", "57c266a", dim)
                (EmbeddingText.hash(ref, text) == EmbeddingText.hash(other, text)) shouldBe false
            }
        }
        When("도구와 같은 규약인지 확인하면") {
            Then("sha256(model_ref + LF + text) 고정값과 일치한다") {
                EmbeddingText.hash("m@1234567#d32", "abc") shouldBe
                    java.security.MessageDigest.getInstance("SHA-256")
                        .digest("m@1234567#d32\nabc".toByteArray())
                        .joinToString("") { "%02x".format(it) }
            }
        }
    }
})
