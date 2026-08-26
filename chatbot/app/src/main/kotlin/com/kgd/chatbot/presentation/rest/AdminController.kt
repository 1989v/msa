package com.kgd.chatbot.presentation.rest

import com.kgd.chatbot.application.chat.usecase.ReloadKnowledgeBaseUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/chat/admin")
class AdminController(
    private val reloadKnowledgeBase: ReloadKnowledgeBaseUseCase,
) {
    @PostMapping("/reload")
    fun reloadKnowledge(): ApiResponse<Map<String, Any>> {
        val result = reloadKnowledgeBase.execute()
        return ApiResponse.success(
            mapOf(
                "status" to "reloaded",
                "categories" to result.categories,
            ),
        )
    }
}
