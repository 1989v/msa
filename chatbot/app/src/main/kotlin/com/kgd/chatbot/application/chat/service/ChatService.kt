package com.kgd.chatbot.application.chat.service

import com.kgd.chatbot.application.chat.port.AiModelPort
import com.kgd.chatbot.application.chat.port.AiModelRequest
import com.kgd.chatbot.application.chat.port.ConversationRepositoryPort
import com.kgd.chatbot.application.chat.port.KnowledgeSourcePort
import com.kgd.chatbot.application.chat.usecase.AskQuestionUseCase
import com.kgd.chatbot.application.chat.usecase.CloseConversationUseCase
import com.kgd.chatbot.application.chat.usecase.GetConversationUseCase
import com.kgd.chatbot.config.ChatbotProperties
import com.kgd.chatbot.domain.exception.AccessDeniedException
import com.kgd.chatbot.domain.exception.ConversationNotFoundException
import com.kgd.chatbot.domain.model.Conversation
import com.kgd.chatbot.domain.model.Message
import com.kgd.chatbot.domain.service.ConversationDomainService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ChatService(
    private val conversationRepository: ConversationRepositoryPort,
    private val aiModelPort: AiModelPort,
    private val knowledgeSourcePort: KnowledgeSourcePort,
    private val promptBuilder: PromptBuilder,
    private val domainService: ConversationDomainService,
    private val properties: ChatbotProperties
) : AskQuestionUseCase, GetConversationUseCase, CloseConversationUseCase {

    override suspend fun execute(command: AskQuestionUseCase.Command): AskQuestionUseCase.Result {
        val conversation = resolveConversation(command)

        val accessDecision = domainService.validateAccess(command.userRole, command.question)
        if (!accessDecision.allowed) {
            throw AccessDeniedException(accessDecision.reason ?: "접근이 거부되었습니다")
        }

        val tokenCount = domainService.estimateTokenCount(command.question)
        conversation.addMessage(Message.createUserMessage(command.question, tokenCount))

        val contextMessages = domainService.buildContextWindow(
            conversation,
            properties.conversation.contextWindowMaxTokens
        )

        val knowledgeChunks = knowledgeSourcePort.search(command.question)

        val systemPrompt = promptBuilder.build(
            knowledgeChunks,
            command.userRole,
            properties.security.publicCategories
        )

        val aiResponse = aiModelPort.generateAnswer(
            AiModelRequest(
                systemPrompt = systemPrompt,
                conversationHistory = contextMessages,
                userQuestion = command.question,
                maxTokens = properties.ai.maxTokens,
                model = properties.ai.model
            )
        )

        conversation.addMessage(
            Message.createAssistantMessage(
                aiResponse.answer,
                aiResponse.outputTokens,
                aiResponse.costUsd
            )
        )
        val saved = conversationRepository.save(conversation)

        val conversationId = saved.id
            ?: throw IllegalStateException("저장된 대화의 ID가 null입니다")

        return AskQuestionUseCase.Result(
            conversationId = conversationId,
            answer = aiResponse.answer,
            tokenCount = aiResponse.inputTokens + aiResponse.outputTokens,
            costUsd = aiResponse.costUsd
        )
    }

    override fun execute(command: GetConversationUseCase.Command): Conversation {
        return conversationRepository.findById(command.conversationId)
            ?: throw ConversationNotFoundException(command.conversationId)
    }

    @Transactional
    override fun execute(command: CloseConversationUseCase.Command) {
        val conversation = conversationRepository.findById(command.conversationId)
            ?: throw ConversationNotFoundException(command.conversationId)
        conversation.close()
        conversationRepository.save(conversation)
    }

    private fun resolveConversation(command: AskQuestionUseCase.Command): Conversation {
        if (command.conversationId != null) {
            return conversationRepository.findById(command.conversationId)
                ?: throw ConversationNotFoundException(command.conversationId)
        }

        return conversationRepository.findByExternalChannelId(
            command.channelType,
            command.externalChannelId
        ) ?: Conversation.create(
            channelType = command.channelType,
            externalChannelId = command.externalChannelId,
            userId = command.userId,
            userRole = command.userRole
        )
    }
}
