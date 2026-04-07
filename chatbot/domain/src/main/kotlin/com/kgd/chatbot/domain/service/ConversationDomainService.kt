package com.kgd.chatbot.domain.service

import com.kgd.chatbot.domain.model.*

class ConversationDomainService {

    fun buildContextWindow(conversation: Conversation, maxTokens: Int): List<Message> {
        val messages = conversation.messages
        if (messages.isEmpty()) return emptyList()

        val result = mutableListOf<Message>()
        var totalTokens = 0

        for (message in messages.reversed()) {
            if (totalTokens + message.tokenCount > maxTokens) break
            result.add(0, message)
            totalTokens += message.tokenCount
        }
        return result
    }

    fun validateAccess(userRole: UserRole, query: String): AccessDecision {
        if (userRole == UserRole.INTERNAL) {
            return AccessDecision.allow()
        }

        val restrictedKeywords = listOf(
            "private", "internal", "secret", "credential", "env",
            "password", "token", "api key", "비밀", "인증키"
        )

        val lowerQuery = query.lowercase()
        val matchedKeyword = restrictedKeywords.firstOrNull { lowerQuery.contains(it) }
        if (matchedKeyword != null) {
            return AccessDecision.deny("해당 정보는 외부 사용자에게 제공할 수 없습니다")
        }

        return AccessDecision.allow()
    }

    fun estimateTokenCount(text: String): Int {
        // 한국어 + 영어 혼합 기준 대략적 추정 (1 token ≈ 3~4 chars)
        return (text.length / 3.5).toInt().coerceAtLeast(1)
    }
}
