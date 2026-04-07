package com.kgd.chatbot.config

import com.kgd.chatbot.domain.service.ConversationDomainService
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling

@Configuration
@EnableConfigurationProperties(ChatbotProperties::class)
@EnableScheduling
class ChatbotConfig {

    @Bean
    fun conversationDomainService(): ConversationDomainService =
        ConversationDomainService()
}
