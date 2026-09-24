package com.kgd.codedictionary.application.concept.service

import com.kgd.codedictionary.application.concept.dto.UpdateConceptCommand
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.concept.exception.ManagedConceptException
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.verify

/** 온톨로지 파일이 관리하는 개념은 어드민 수정·삭제가 저장소까지 가지 않는다 */
class ConceptServiceManagedTest : BehaviorSpec({

    val repo = mockk<ConceptRepositoryPort>()
    val indexRepo = mockk<ConceptIndexRepositoryPort>()
    val service = ConceptService(repo, indexRepo)

    fun concept(id: Long, managedBy: String?) = Concept.restore(
        id = id, conceptId = "c$id", name = "개념$id", category = ConceptCategory.BASICS,
        level = ConceptLevel.BEGINNER, description = "설명", synonyms = emptyList(), relatedConceptIds = emptyList(),
        kind = managedBy?.let { ConceptKind.MECHANISM }, managedBy = managedBy,
    )

    beforeEach { clearMocks(repo, indexRepo) }

    given("관리 개념") {
        `when`("수정하면") {
            then("ManagedConceptException 이고 저장하지 않는다") {
                every { repo.findById(1) } returns concept(1, "search")
                shouldThrow<ManagedConceptException> {
                    service.update(1, UpdateConceptCommand(name = "바뀜", category = null, level = null, description = null, synonyms = null))
                }
                verify(exactly = 0) { repo.save(any()) }
            }
        }
        `when`("삭제하면") {
            then("ManagedConceptException 이고 지우지 않는다") {
                every { repo.findById(1) } returns concept(1, "search")
                shouldThrow<ManagedConceptException> { service.delete(1) }
                verify(exactly = 0) { repo.delete(any()) }
            }
        }
    }

    given("관리 표시가 없는 개념") {
        `when`("삭제하면") {
            then("지운다") {
                every { repo.findById(2) } returns concept(2, null)
                every { repo.delete(2) } just runs
                service.delete(2)
                verify(exactly = 1) { repo.delete(2) }
            }
        }
    }
})
