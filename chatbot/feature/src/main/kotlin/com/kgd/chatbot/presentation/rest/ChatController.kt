package com.kgd.chatbot.presentation.rest

import com.kgd.chatbot.application.chat.usecase.AskQuestionUseCase
import com.kgd.chatbot.application.chat.usecase.CloseConversationUseCase
import com.kgd.chatbot.application.chat.usecase.GetConversationUseCase
import com.kgd.chatbot.domain.model.UserRole
import com.kgd.chatbot.presentation.rest.dto.ChatResponse
import com.kgd.chatbot.presentation.rest.dto.ConversationResponse
import com.kgd.chatbot.presentation.rest.dto.MessageResponse
import com.kgd.chatbot.presentation.rest.dto.SendMessageRequest
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/chat")
class ChatController(
    private val askQuestionUseCase: AskQuestionUseCase,
    private val getConversationUseCase: GetConversationUseCase,
    private val closeConversationUseCase: CloseConversationUseCase
) {
    @PostMapping("/conversations/{id}/messages")
    suspend fun sendMessage(
        @PathVariable id: Long,
        @RequestHeader("X-User-Id") userId: String,
        @RequestHeader("X-User-Role", defaultValue = "EXTERNAL") userRole: String,
        @Valid @RequestBody request: SendMessageRequest
    ): ApiResponse<ChatResponse> {
        val result = askQuestionUseCase.execute(
            request.copy(conversationId = id)
                .toCommand(userId, UserRole.valueOf(userRole), id.toString())
        )
        return ApiResponse.success(ChatResponse.from(result))
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/conversations")
    suspend fun startConversation(
        @RequestHeader("X-User-Id") userId: String,
        @RequestHeader("X-User-Role", defaultValue = "EXTERNAL") userRole: String,
        @RequestHeader("X-Session-Id") sessionId: String,
        @Valid @RequestBody request: SendMessageRequest
    ): ApiResponse<ChatResponse> {
        val result = askQuestionUseCase.execute(
            request.toCommand(userId, UserRole.valueOf(userRole), sessionId)
        )
        return ApiResponse.success(ChatResponse.from(result))
    }

    @GetMapping("/conversations/{id}")
    fun getConversation(@PathVariable id: Long): ApiResponse<ConversationResponse> {
        val conversation = getConversationUseCase.execute(GetConversationUseCase.Command(id))
        return ApiResponse.success(ConversationResponse.from(conversation))
    }

    @GetMapping("/conversations/{id}/messages")
    fun getMessages(@PathVariable id: Long): ApiResponse<List<MessageResponse>> {
        val conversation = getConversationUseCase.execute(GetConversationUseCase.Command(id))
        val messages = conversation.messages.map { MessageResponse.from(it) }
        return ApiResponse.success(messages)
    }

    @DeleteMapping("/conversations/{id}")
    fun closeConversation(@PathVariable id: Long): ApiResponse<Unit> {
        closeConversationUseCase.execute(CloseConversationUseCase.Command(id))
        return ApiResponse.success()
    }
}
