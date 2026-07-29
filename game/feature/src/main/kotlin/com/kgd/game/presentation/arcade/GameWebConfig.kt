package com.kgd.game.presentation.arcade

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

/**
 * 게임 정적 클라이언트 welcome 포워딩.
 *
 * 정적 리소스 디렉토리(/game/)에는 index 자동 매핑이 없어 디렉토리 요청이 500 → index.html forward.
 * 서브도메인 경로(game.<domain> → ingress → gateway 가 / 를 /game 으로 prefix)의 루트 서빙도
 * 이 포워딩이 담당한다.
 */
@Configuration
class GameWebConfig : WebMvcConfigurer {
    override fun addViewControllers(registry: ViewControllerRegistry) {
        registry.addViewController("/game").setViewName("forward:/game/index.html")
        registry.addViewController("/game/").setViewName("forward:/game/index.html")
    }
}
