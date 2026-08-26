package com.kgd.chatbot.application.chat.usecase

/** 문서 지식원 재적재 (ADR-0052). 어드민이 문서를 갱신한 뒤 부른다. */
interface ReloadKnowledgeBaseUseCase {
    fun execute(): Result

    data class Result(val categories: List<String>)
}
