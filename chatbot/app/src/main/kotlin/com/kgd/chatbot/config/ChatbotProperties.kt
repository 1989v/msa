package com.kgd.chatbot.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "chatbot")
data class ChatbotProperties(
    val ai: AiProperties = AiProperties(),
    val knowledge: KnowledgeProperties = KnowledgeProperties(),
    val conversation: ConversationProperties = ConversationProperties(),
    val slack: SlackProperties = SlackProperties(),
    val security: SecurityProperties = SecurityProperties()
) {
    data class AiProperties(
        val apiKey: String = "",
        val model: String = "claude-sonnet-4-6",
        val maxTokens: Int = 4096,
        val maxBudgetPerRequest: Double = 0.50,
        val maxBudgetPerDay: Double = 50.00,
        val timeoutSeconds: Long = 30,
        val maxConcurrent: Int = 5
    )

    data class KnowledgeProperties(
        val type: String = "filesystem",
        val docsRoot: String = ".",
        val categories: Map<String, String> = mapOf(
            "architecture" to "docs/architecture",
            "adr" to "docs/adr",
            "guide" to "CLAUDE.md"
        )
    )

    data class ConversationProperties(
        val contextWindowMaxTokens: Int = 10000,
        val sessionTimeoutMinutes: Int = 60,
        val maxMessagesPerSession: Int = 50
    )

    data class SlackProperties(
        val signingSecret: String? = null,
        val botToken: String? = null
    )

    data class SecurityProperties(
        val publicCategories: Set<String> = setOf("architecture", "guide"),
        val internalOnlyCategories: Set<String> = setOf("standard", "spec")
    )
}
