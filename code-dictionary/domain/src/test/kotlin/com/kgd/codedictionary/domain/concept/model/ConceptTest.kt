package com.kgd.codedictionary.domain.concept.model

import com.kgd.codedictionary.domain.concept.exception.ManagedConceptException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ConceptTest : BehaviorSpec({
    given("Concept 생성 시") {
        `when`("유효한 데이터가 주어지면") {
            then("Concept이 정상적으로 생성되어야 한다") {
                val concept = Concept.create(
                    conceptId = "singleton-pattern",
                    name = "싱글턴 패턴",
                    category = ConceptCategory.DESIGN_PATTERN,
                    level = ConceptLevel.INTERMEDIATE,
                    description = "인스턴스를 하나만 생성하는 디자인 패턴",
                    synonyms = listOf("Singleton"),
                    relatedConceptIds = listOf("factory-pattern")
                )

                concept.conceptId shouldBe "singleton-pattern"
                concept.name shouldBe "싱글턴 패턴"
                concept.category shouldBe ConceptCategory.DESIGN_PATTERN
                concept.level shouldBe ConceptLevel.INTERMEDIATE
                concept.description shouldBe "인스턴스를 하나만 생성하는 디자인 패턴"
                concept.synonyms shouldBe listOf("Singleton")
                concept.relatedConceptIds shouldBe listOf("factory-pattern")
                concept.id shouldBe null
            }
        }

        `when`("conceptId가 빈 문자열이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Concept.create(
                        conceptId = "",
                        name = "테스트",
                        category = ConceptCategory.BASICS,
                        level = ConceptLevel.BEGINNER,
                        description = "테스트 설명"
                    )
                }
            }
        }

        `when`("name이 빈 문자열이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Concept.create(
                        conceptId = "test-concept",
                        name = "",
                        category = ConceptCategory.BASICS,
                        level = ConceptLevel.BEGINNER,
                        description = "테스트 설명"
                    )
                }
            }
        }
    }

    given("Concept 수정 시") {
        val concept = Concept.create(
            conceptId = "singleton-pattern",
            name = "싱글턴 패턴",
            category = ConceptCategory.DESIGN_PATTERN,
            level = ConceptLevel.INTERMEDIATE,
            description = "원래 설명",
            synonyms = listOf("Singleton")
        )

        `when`("updateSynonyms를 호출하면") {
            then("새로운 동의어 목록으로 변경되어야 한다") {
                val newSynonyms = listOf("Singleton", "Single Instance")
                concept.updateSynonyms(newSynonyms)

                concept.synonyms shouldBe newSynonyms
            }
        }

        `when`("updateDescription을 호출하면") {
            then("새로운 설명으로 변경되어야 한다") {
                val newDescription = "변경된 설명"
                concept.updateDescription(newDescription)

                concept.description shouldBe newDescription
            }
        }
    }
    given("온톨로지 파일이 관리하는 개념") {
        val managed = Concept.restore(
            id = 1L, conceptId = "bm25", name = "BM25", category = ConceptCategory.ALGORITHM,
            level = ConceptLevel.INTERMEDIATE, description = "스파스", synonyms = emptyList(),
            relatedConceptIds = emptyList(), kind = ConceptKind.MECHANISM, managedBy = "search",
        )

        `when`("이름·동의어·설명을 고치려 하면") {
            then("셋 다 ManagedConceptException 으로 거부되고 값은 그대로다") {
                shouldThrow<ManagedConceptException> { managed.update(name = "바뀐 이름") }
                shouldThrow<ManagedConceptException> { managed.updateSynonyms(listOf("x")) }
                shouldThrow<ManagedConceptException> { managed.updateDescription("바뀐 설명") }
                managed.name shouldBe "BM25"
                managed.description shouldBe "스파스"
            }
        }

        `when`("관리 표시가 없는 개념이면") {
            then("그대로 고칠 수 있다") {
                val free = Concept.create("free", "자유", ConceptCategory.BASICS, ConceptLevel.BEGINNER, "설명")
                free.update(name = "바뀜")
                free.name shouldBe "바뀜"
            }
        }
    }
})
