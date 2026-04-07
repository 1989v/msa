package com.kgd.chatbot

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class ChatbotApplication

fun main(args: Array<String>) {
    runApplication<ChatbotApplication>(*args)
}
