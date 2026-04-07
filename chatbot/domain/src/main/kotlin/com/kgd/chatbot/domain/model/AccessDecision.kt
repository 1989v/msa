package com.kgd.chatbot.domain.model

data class AccessDecision(
    val allowed: Boolean,
    val reason: String? = null
) {
    companion object {
        fun allow(): AccessDecision = AccessDecision(allowed = true)
        fun deny(reason: String): AccessDecision = AccessDecision(allowed = false, reason = reason)
    }
}
