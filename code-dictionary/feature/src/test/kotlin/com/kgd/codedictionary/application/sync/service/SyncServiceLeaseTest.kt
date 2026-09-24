package com.kgd.codedictionary.application.sync.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.application.ontology.dto.OntologyState
import com.kgd.codedictionary.application.ontology.port.OntologySyncStatePort
import com.kgd.codedictionary.application.search.port.ConceptIndexingPort
import com.kgd.codedictionary.application.sync.dto.SyncOutcome
import com.kgd.codedictionary.application.sync.port.IndexAliasPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.clearAllMocks
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.verify
import io.mockk.verifyOrder
import org.springframework.data.domain.PageImpl

/**
 * 파드 간 단일 실행과 대상 해시 고정 — 옛 색인이 별칭을 되돌리거나, 옛 내용을 최신 완료로 적는 일을 막는다.
 */
class SyncServiceLeaseTest : BehaviorSpec({

    val concepts = mockk<ConceptRepositoryPort>()
    val indexes = mockk<ConceptIndexRepositoryPort>()
    val indexing = mockk<ConceptIndexingPort>(relaxed = true)
    val alias = mockk<IndexAliasPort>(relaxed = true)
    val state = mockk<OntologySyncStatePort>(relaxed = true)
    val service = SyncService(concepts, indexes, indexing, alias, IndexSyncJobRegistry(), state, { it.run() }, "concept-index", 2)
    val owner = SyncService.OWNER

    beforeContainer {
        clearAllMocks()
        every { concepts.findAllWithSynonyms() } returns emptyList()
        every { indexes.findAll(any()) } returns PageImpl(emptyList())
        every { alias.createTimestampedIndexName("concept-index") } returnsMany listOf("concept-index_1", "concept-index_2")
        every { state.releaseLease(any()) } just runs
    }

    given("다른 인스턴스가 리스를 쥐고 있다") {
        every { state.tryAcquireLease(owner, any()) } returns null
        then("Busy 이고 인덱스를 만들지 않는다") {
            service.syncNow() shouldBe SyncOutcome.Busy
            verify(exactly = 0) { alias.createIndex(any()) }
        }
    }

    given("색인하는 동안 새 revision 이 적용됐다") {
        every { state.tryAcquireLease(owner, any()) } returns "h1"
        every { state.readState() } returnsMany listOf(OntologyState(2, "h2", "h1"), OntologyState(2, "h2", "h1"))
        then("옛 인덱스를 버리고 최신으로 다시 돌아 h2 만 derived 로 적는다") {
            val out = service.syncNow()
            out.shouldBeInstanceOf<SyncOutcome.Done>().targetHash shouldBe "h2"
            verifyOrder {
                alias.deleteIndex("concept-index_1")
                state.retarget(owner, "h2")
                alias.swapAlias("concept-index", "concept-index_2", 2)
                state.recordDerived(owner, "h2")
                state.releaseLease(owner)
            }
            verify(exactly = 0) { alias.swapAlias("concept-index", "concept-index_1", any()) }
            verify(exactly = 0) { state.recordDerived(owner, "h1") }
        }
    }

    given("색인하는 동안 내용이 그대로다") {
        every { state.tryAcquireLease(owner, any()) } returns "h1"
        every { state.readState() } returns OntologyState(1, "h1", null)
        then("시작 때 고정한 h1 을 적고 리스를 놓는다") {
            service.syncNow().shouldBeInstanceOf<SyncOutcome.Done>().targetHash shouldBe "h1"
            verify { state.recordDerived(owner, "h1") }
            verify { state.releaseLease(owner) }
        }
    }
})
