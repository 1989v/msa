package com.kgd.chatbot.application.chat.port

interface KnowledgeSourcePort {
    fun search(query: String, maxResults: Int = 5): List<KnowledgeChunk>
    fun getCategories(): List<String>
    fun reload()
}

data class KnowledgeChunk(
    val title: String,
    val content: String,
    val source: String,
    val category: String
)
