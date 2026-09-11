package com.kgd.chatbot.application.chat.service

import com.kgd.chatbot.application.chat.port.KnowledgeChunk
import com.kgd.chatbot.domain.model.UserRole
import org.springframework.stereotype.Component

@Component
class PromptBuilder {

    companion object {
        private const val MAX_SYSTEM_PROMPT_CHARS = 60_000
        private const val MIN_KNOWLEDGE_CHARS = 2_000
    }

    fun build(
        knowledgeChunks: List<KnowledgeChunk>,
        userRole: UserRole,
        publicCategories: Set<String>
    ): String {
        val baseInstruction = buildBaseInstruction(userRole)
        val accessConstraint = buildAccessConstraint(userRole, publicCategories)

        val baseLength = baseInstruction.length + accessConstraint.length + 200 // 태그 오버헤드
        val availableForKnowledge = (MAX_SYSTEM_PROMPT_CHARS - baseLength)
            .coerceAtLeast(MIN_KNOWLEDGE_CHARS)

        val filteredChunks = if (userRole == UserRole.EXTERNAL) {
            knowledgeChunks.filter { it.category in publicCategories }
        } else {
            knowledgeChunks
        }

        val knowledgeContext = buildKnowledgeContext(filteredChunks, availableForKnowledge)

        return buildString {
            append(baseInstruction)
            append("\n\n")
            append(accessConstraint)
            if (knowledgeContext.isNotEmpty()) {
                append("\n\n<reference_data>\n")
                append(knowledgeContext)
                append("\n</reference_data>")
            }
        }
    }

    private fun buildBaseInstruction(userRole: UserRole): String = """
        |당신은 MSA Commerce Platform 프로젝트의 기술 어시스턴트입니다.
        |프로젝트의 아키텍처, 코드 컨벤션, 정책, 운영 가이드에 대해 답변합니다.
        |
        |## 응답 규칙
        |- 제공된 참고 자료(<reference_data>)에 기반하여 답변하세요.
        |- 참고 자료에 없는 내용은 "해당 정보를 문서에서 찾을 수 없습니다"라고 답변하세요.
        |- 답변은 구체적이고 간결하게 작성하세요.
        |- 코드 예시가 도움이 되는 경우 포함하세요.
        |- API Key, 환경변수 값, 비밀번호 등 민감 정보를 절대 포함하지 마세요.
    """.trimMargin()

    private fun buildAccessConstraint(userRole: UserRole, publicCategories: Set<String>): String {
        if (userRole == UserRole.INTERNAL) {
            return "## 접근 권한\n사용자: 내부 개발자 — 모든 문서에 접근 가능합니다."
        }
        return """
            |## 접근 권한
            |사용자: 외부 사용자 — public 카테고리(${publicCategories.joinToString(", ")}) 문서만 답변 가능합니다.
            |private/internal 관련 질문에는 "해당 정보는 외부 사용자에게 제공할 수 없습니다"라고 답변하세요.
        """.trimMargin()
    }

    private fun buildKnowledgeContext(chunks: List<KnowledgeChunk>, maxChars: Int): String {
        val sb = StringBuilder()
        for (chunk in chunks) {
            val entry = "### ${chunk.title} (${chunk.source})\n${chunk.content}\n\n"
            if (sb.length + entry.length > maxChars) break
            sb.append(entry)
        }
        return sb.toString().trimEnd()
    }
}
