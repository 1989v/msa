package com.kgd.game.infrastructure.territory

import com.kgd.game.application.profile.port.*
import com.kgd.game.application.profile.usecase.GamePlayerProfileUseCase
import com.kgd.game.application.territory.service.*
import com.kgd.game.presentation.profile.controller.*
import com.kgd.game.presentation.territory.controller.TerritoryTicketController
import com.kgd.game.infrastructure.ws.*
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/** Test source only: real engine/HTTP/WebSocket, local verification profiles, no production identity bypass. */
object TerritoryLocalServer {
    @JvmStatic fun main(args: Array<String>) {
        val assets = generateSequence(File(System.getProperty("user.dir"))) { it.parentFile }
            .map { File(it, "portal-fe/public") }.first { it.isDirectory }
        SpringApplication(TerritoryLocalContext::class.java).apply {
            setDefaultProperties(mapOf("server.address" to "127.0.0.1", "server.port" to "4180",
                "spring.web.resources.static-locations" to "file:${assets.absolutePath}/"))
        }.run(*args)
        println("TERRITORY_LOCAL http://127.0.0.1:4180/games/territory/ — verification profiles only")
    }
}

@EnableAutoConfiguration(exclude = [DataSourceAutoConfiguration::class, DataSourceTransactionManagerAutoConfiguration::class, HibernateJpaAutoConfiguration::class])
@Import(TerritoryTicketService::class, TerritoryWorldService::class, TerritoryTicketController::class,
    GamePlayerIdentityResolver::class, GamePlayerProfileController::class,
    TerritoryWebSocketHandler::class, TerritoryWebSocketConfig::class,
    GameRelayRegistry::class, GameRelayWebSocketHandler::class, GameRelayWebSocketConfig::class)
class TerritoryLocalContext {
    @Bean fun localIndex(): WebMvcConfigurer = object : WebMvcConfigurer {
        override fun addViewControllers(registry: ViewControllerRegistry) {
            registry.addViewController("/games/territory/").setViewName("forward:/games/territory/index.html")
        }
    }
    @Bean fun localVerificationProfiles(): GamePlayerProfileUseCase = object : GamePlayerProfileUseCase {
        private val values = ConcurrentHashMap<GamePlayerOwner, GamePlayerProfile>()
        override fun get(owner: GamePlayerOwner): GamePlayerProfile? = if (owner.memberId != null)
            GamePlayerProfile("verify-${owner.memberId}", "검증 ${owner.memberId}") else values[owner]
        override fun save(owner: GamePlayerOwner, nickname: String): GamePlayerProfile {
            require(nickname.isNotBlank() && nickname.length <= 16)
            return values.compute(owner) { _, old -> GamePlayerProfile(old?.playerId ?: "verify-${values.size + 1}-guest", nickname) }.let { requireNotNull(it) }
        }
    }
}
