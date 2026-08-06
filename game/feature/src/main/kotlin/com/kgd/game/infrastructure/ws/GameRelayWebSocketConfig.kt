package com.kgd.game.infrastructure.ws

import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

/**
 * 게임 릴레이 엔드포인트 등록. 호스트 앱(code-dictionary:app)이 `com.kgd.game` 을 스캔하므로
 * 이 설정만으로 폴드된 JVM 에 WebSocket 이 붙는다 (ADR-0059).
 *
 * Origin 검증을 열어두는 이유: 요청이 ingress → gateway → code-dictionary 로 두 번 프록시되어
 * 서버가 보는 Host 는 `code-dictionary:8089` 인 반면 브라우저 Origin 은 공개 도메인이다.
 * Spring 기본 same-origin 검사로는 정상 트래픽까지 막힌다. 릴레이는 인증도 개인정보도 없고
 * 방 수·메시지 수 상한이 걸려 있어 교차 오리진 접속의 실익이 없다.
 */
@Configuration
@EnableWebSocket
class GameRelayWebSocketConfig(
    private val handler: GameRelayWebSocketHandler,
) : WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(handler, "/ws/games/*").setAllowedOriginPatterns("*")
    }
}
