package com.kgd.chatbot.application.chat.service

import com.kgd.chatbot.application.chat.port.KnowledgeSourcePort
import com.kgd.chatbot.application.chat.usecase.ReloadKnowledgeBaseUseCase
import org.springframework.stereotype.Service

@Service
class KnowledgeBaseService(
    private val knowledgeSourcePort: KnowledgeSourcePort,
) : ReloadKnowledgeBaseUseCase {

    override fun execute(): ReloadKnowledgeBaseUseCase.Result {
        knowledgeSourcePort.reload()
        return ReloadKnowledgeBaseUseCase.Result(categories = knowledgeSourcePort.getCategories())
    }
}
