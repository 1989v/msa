package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionEmbeddingRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionEmbeddingsUseCase
import com.kgd.place.domain.attraction.model.AttractionEmbedding
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.domain.attraction.model.EmbeddingText
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

class AttractionEmbeddingServiceTest : BehaviorSpec({

    val repository = mockk<AttractionEmbeddingRepositoryPort>(relaxed = true)
    val service = AttractionEmbeddingService(repository)

    val dim = EmbeddingModelRef.MIN_DIM
    val ref = EmbeddingModelRef("dragonkue/snowflake-arctic-embed-l-v2.0-ko", "55ec6e9", dim)
    val text = "경복궁 · 역사 · 서울특별시 종로구 사직로 161"
    val hash = EmbeddingText.hash(ref, text)
    fun unit(first: Float = 1f): FloatArray = FloatArray(dim) { if (it == 0) first else 0f }
        .let { v -> FloatArray(dim) { v[it] / AttractionEmbedding.l2Norm(v).toFloat() } }

    fun item(id: Long = 1L, t: String = text, h: String = hash, v: FloatArray? = unit()) =
        SyncAttractionEmbeddingsUseCase.Item(id, t, h, v)

    fun stored(id: Long = 1L, t: String = text, h: String = hash) =
        AttractionEmbedding.create(id, ref, t, h, unit(), LocalDateTime.of(2026, 9, 1, 0, 0), id = 100L)

    // 목을 스펙 레벨에 두면 호출 이력이 테스트 사이에 남는다 — `verify(exactly = 0)` 이 남의 호출을 세게 된다.
    beforeTest {
        clearMocks(repository)
        every { repository.saveAll(any()) } returns 1
        every { repository.existingAttractionIds(any()) } answers { firstArg<List<Long>>().toSet() }
        every { repository.findByModelAndIds(any(), any()) } returns emptyList()
    }

    Given("벡터 upsert") {
        When("저장된 것이 없으면") {
            Then("신규로 센다") {
                service.upsert(ref.value, listOf(item())) shouldBe
                    SyncAttractionEmbeddingsUseCase.Applied(inserted = 1, updated = 0, touched = 0)
            }
        }
        When("이미 있으면") {
            Then("갱신으로 세고 기존 id 를 물려준다 — 새 행이 생기면 유니크 키에 걸린다") {
                every { repository.findByModelAndIds(any(), any()) } returns listOf(stored())
                val saved = slot<List<AttractionEmbedding>>()
                every { repository.saveAll(capture(saved)) } returns 1

                service.upsert(ref.value, listOf(item(v = unit(2f)))) shouldBe
                    SyncAttractionEmbeddingsUseCase.Applied(inserted = 0, updated = 1, touched = 0)
                saved.captured.single().id shouldBe 100L
            }
        }
        When("없는 관광지 id 가 섞이면") {
            Then("요청 전체를 거부한다 — 읽히지 않을 벡터를 남기지 않는다") {
                every { repository.existingAttractionIds(any()) } returns setOf(1L)
                val e = shouldThrow<IllegalArgumentException> {
                    service.upsert(ref.value, listOf(item(1L), item(999L)))
                }
                e.message!! shouldContain "존재하지 않는"
                verify(exactly = 0) { repository.saveAll(any()) }
            }
        }
        When("같은 id 가 요청 안에 두 번 있으면") {
            Then("거부한다 — 어느 쪽이 이겼는지 도구가 알 수 없다") {
                shouldThrow<IllegalArgumentException> { service.upsert(ref.value, listOf(item(1L), item(1L))) }
            }
        }
        When("빈 요청이면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { service.upsert(ref.value, emptyList()) }
            }
        }
        When("model_ref 형식이 틀리면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { service.upsert("이상한값", listOf(item())) }
            }
        }
    }

    Given("touch — 벡터 없이 보내는 요청") {
        When("저장된 해시와 같으면") {
            Then("시각만 밀고 벡터는 그대로 둔다") {
                every { repository.findByModelAndIds(any(), any()) } returns listOf(stored())
                val saved = slot<List<AttractionEmbedding>>()
                every { repository.saveAll(capture(saved)) } returns 1

                service.upsert(ref.value, listOf(item(v = null))) shouldBe
                    SyncAttractionEmbeddingsUseCase.Applied(inserted = 0, updated = 0, touched = 1)
                saved.captured.single().textHash shouldBe hash
            }
        }
        When("해시가 다르면") {
            Then("거부한다 — 텍스트가 바뀌었으면 벡터도 새로 와야 한다") {
                every { repository.findByModelAndIds(any(), any()) } returns listOf(stored())
                val e = shouldThrow<IllegalArgumentException> {
                    service.upsert(ref.value, listOf(item(h = EmbeddingText.hash(ref, "바뀐 텍스트"), v = null)))
                }
                e.message!! shouldContain "text_hash"
            }
        }
        When("저장된 것이 아예 없으면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { service.upsert(ref.value, listOf(item(v = null))) }
            }
        }
    }

    Given("status") {
        When("현황을 물으면") {
            Then("전체·완료·없음·stale 을 함께 준다 — 채움이 멈춘 것을 이 숫자로 안다") {
                every { repository.countActiveAttractions() } returns 44924L
                every { repository.countByModel(ref.value) } returns 44000L
                every { repository.countPending(ref.value) } returns (924L to 12L)
                every { repository.lastEmbeddedAt(ref.value) } returns LocalDateTime.of(2026, 9, 6, 4, 30)

                val s = service.status(ref.value)
                s.total shouldBe 44924L
                s.embedded shouldBe 44000L
                s.missing shouldBe 924L
                s.stale shouldBe 12L
            }
        }
    }

    Given("lookup") {
        When("빈 목록이면") {
            Then("저장소를 부르지 않는다") {
                service.lookup(ref.value, emptyList()) shouldBe emptyList()
                verify(exactly = 0) { repository.findByModelAndIds(any(), any()) }
            }
        }
        When("id 를 주면") {
            Then("벡터와 해시를 돌려준다") {
                every { repository.findByModelAndIds(ref.value, listOf(1L)) } returns listOf(stored())
                val found = service.lookup(ref.value, listOf(1L)).single()
                found.attractionId shouldBe 1L
                found.textHash shouldBe hash
                found.vector.size shouldBe dim
            }
        }
    }
})
