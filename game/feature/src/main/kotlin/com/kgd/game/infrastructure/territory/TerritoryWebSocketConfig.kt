package com.kgd.game.infrastructure.territory

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class TerritoryWebSocketConfig(
    private val handler: TerritoryWebSocketHandler,
    @Value("\${game.territory.origins:https://game.1989v.com,https://1989v.com,http://localhost:4178,http://127.0.0.1:4178,http://localhost:4180,http://127.0.0.1:4180}")
    private val origins: String,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(handler, "/ws/games/territory").setAllowedOrigins(*origins.split(',').map { it.trim() }.toTypedArray())
    }
}
