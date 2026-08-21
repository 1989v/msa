package com.kgd.codedictionary.domain.resume

import com.kgd.codedictionary.domain.resume.model.ResumeCodeSnippet
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 미리보기 절단 규칙 (ADR-0066 개정).
 *
 * 공개면과 이력서가 같은 스니펫을 다른 수위로 보여준다 — 어디서 자르는지가 도메인에
 * 한 곳으로 고정되어야 두 화면이 같은 미리보기를 말한다.
 */
class ResumeCodeSnippetTest : BehaviorSpec({

    fun snippet(code: String) = ResumeCodeSnippet(
        id = 1L,
        projectId = 10L,
        title = "멱등 컨슈머",
        language = "kotlin",
        filePath = "order/app/src/main/kotlin/Consumer.kt",
        lineStart = 12,
        lineEnd = 48,
        gitUrl = "https://github.com/example/msa/blob/main/Consumer.kt#L12-L48",
        code = code,
        orderNo = 0,
    )

    given("미리보기 줄 수보다 긴 코드일 때") {
        val code = (1..20).joinToString("\n") { "line $it" }

        `when`("미리보기를 만들면") {
            then("상단 8줄만 남는다") {
                snippet(code).preview() shouldBe (1..8).joinToString("\n") { "line $it" }
            }

            then("전체 줄 수는 원문 기준이다") {
                snippet(code).totalLines shouldBe 20
            }
        }
    }

    given("미리보기 줄 수보다 짧은 코드일 때") {
        val code = "fun main() {\n    println(\"hi\")\n}"

        `when`("미리보기를 만들면") {
            then("전문이 그대로 미리보기다") {
                snippet(code).preview() shouldBe code
                snippet(code).totalLines shouldBe 3
            }
        }
    }

    given("코드가 비어 있을 때") {
        `when`("스니펫을 만들면") {
            then("거부한다 — 빈 코드는 보여줄 것이 없다") {
                shouldThrow<BusinessException> { snippet("   ") }
            }
        }
    }

    given("언어가 비어 있을 때") {
        `when`("스니펫을 만들면") {
            then("거부한다") {
                shouldThrow<BusinessException> {
                    snippet("code").copy(language = " ")
                }
            }
        }
    }
})
