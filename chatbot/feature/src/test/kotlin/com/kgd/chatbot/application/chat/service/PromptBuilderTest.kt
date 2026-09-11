package com.kgd.chatbot.application.chat.service

import com.kgd.chatbot.application.chat.port.KnowledgeChunk
import com.kgd.chatbot.domain.model.UserRole
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

class PromptBuilderTest : BehaviorSpec({
    val builder = PromptBuilder()
    val publicCategories = setOf("architecture", "guide")
    val chunks = listOf(
        KnowledgeChunk("클린 아키텍처", "의존성은 안쪽으로", "docs/architecture/00.md", "architecture"),
        KnowledgeChunk("배포 비밀", "SealedSecret 키 위치", "docs/standards/secret.md", "standard"),
    )

    given("시스템 프롬프트 조립") {
        `when`("외부 사용자면") {
            then("public 카테고리 자료만 들어가고 접근 제약이 명시된다") {
                val prompt = builder.build(chunks, UserRole.EXTERNAL, publicCategories)

                prompt shouldContain "클린 아키텍처"
                prompt shouldNotContain "배포 비밀"
                prompt shouldContain "외부 사용자"
                prompt shouldContain "architecture, guide"
            }
        }
        `when`("내부 사용자면") {
            then("모든 자료가 들어간다") {
                val prompt = builder.build(chunks, UserRole.INTERNAL, publicCategories)

                prompt shouldContain "클린 아키텍처"
                prompt shouldContain "배포 비밀"
                prompt shouldContain "내부 개발자"
            }
        }
        `when`("들어갈 자료가 하나도 없으면") {
            then("reference_data 블록 자체를 만들지 않는다") {
                val prompt = builder.build(emptyList(), UserRole.INTERNAL, publicCategories)
                // 기본 지시문이 "<reference_data>" 를 문구로 언급하므로 닫는 태그로 블록 유무를 본다
                prompt shouldNotContain "</reference_data>"
            }
        }
        `when`("자료가 상한을 넘으면") {
            then("앞에서부터 담고 넘치는 자료는 자른다") {
                val big = (1..5).map { KnowledgeChunk("자료$it", "x".repeat(20_000), "s$it", "architecture") }
                val prompt = builder.build(big, UserRole.INTERNAL, publicCategories)

                prompt shouldContain "### 자료1"
                prompt shouldContain "### 자료2"
                prompt shouldNotContain "### 자료4"
            }
        }
    }
})
