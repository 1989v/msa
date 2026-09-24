package com.kgd.codedictionary.infrastructure.persistence.concept

import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.infrastructure.persistence.concept.adapter.ConceptEdgeRepositoryAdapter
import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptEdgeJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.concept.repository.ConceptEdgeJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

/**
 * 롤링 배포 호환 — 이 코드가 모르는 관계 kind 가 DB 에 있어도 간선 읽기가 죽지 않고 그 행만 빠진다.
 * 새 관계(USES 등)는 이 코드부터 정상 해석이다.
 */
class ConceptEdgeJpaEntityTest : BehaviorSpec({

    fun row(id: Long, kind: String) = ConceptEdgeJpaEntity(
        id = id, fromConceptId = "a$id", toConceptId = "b$id", kind = kind, ordinal = 0,
        reason = if (kind == "AFFECTS") "상주 32× ↓" else null,
    )

    given("간선 표에 아는 kind 와 모르는 미래 kind 가 섞여 있다") {
        val jpa = mockk<ConceptEdgeJpaRepository>()
        every { jpa.findAll() } returns listOf(row(1, "CONTAINS"), row(2, "FUTURE_KIND"), row(3, "USES"), row(4, "AFFECTS"))
        val adapter = ConceptEdgeRepositoryAdapter(jpa)

        `when`("전량을 읽으면") {
            val edges = adapter.findAll()
            then("모르는 kind 행만 빠지고 나머지는 정상으로 온다") {
                edges.map { it.kind } shouldContainExactly listOf(ConceptEdgeKind.CONTAINS, ConceptEdgeKind.USES, ConceptEdgeKind.AFFECTS)
            }
            then("reason 이 도메인까지 실린다") {
                edges.first { it.kind == ConceptEdgeKind.AFFECTS }.reason shouldBe "상주 32× ↓"
            }
        }
    }
})
