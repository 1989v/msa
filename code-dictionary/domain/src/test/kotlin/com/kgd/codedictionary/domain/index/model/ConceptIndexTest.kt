package com.kgd.codedictionary.domain.index.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class ConceptIndexTest : BehaviorSpec({
    given("ConceptIndex 생성 시") {
        `when`("유효한 데이터가 주어지면") {
            then("ConceptIndex가 정상적으로 생성되고 indexedAt이 설정되어야 한다") {
                val location = CodeLocation(
                    filePath = "src/main/kotlin/Example.kt",
                    lineStart = 10,
                    lineEnd = 20,
                    gitUrl = "https://github.com/example/repo/blob/main/Example.kt#L10-L20"
                )

                val index = ConceptIndex.create(
                    conceptId = "singleton-pattern",
                    location = location,
                    codeSnippet = "object Singleton { }",
                    description = "싱글턴 패턴 구현 예시",
                    gitCommitHash = "abc123"
                )

                index.conceptId shouldBe "singleton-pattern"
                index.location shouldBe location
                index.codeSnippet shouldBe "object Singleton { }"
                index.description shouldBe "싱글턴 패턴 구현 예시"
                index.gitCommitHash shouldBe "abc123"
                index.indexedAt shouldNotBe null
                index.id shouldBe null
            }
        }

        `when`("conceptId가 빈 문자열이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                val location = CodeLocation(
                    filePath = "src/main/kotlin/Example.kt",
                    lineStart = 1,
                    lineEnd = 5
                )

                shouldThrow<IllegalArgumentException> {
                    ConceptIndex.create(
                        conceptId = "",
                        location = location
                    )
                }
            }
        }
    }
})
