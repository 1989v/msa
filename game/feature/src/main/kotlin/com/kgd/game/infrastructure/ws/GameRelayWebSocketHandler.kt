package com.kgd.game.infrastructure.ws

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

/**
 * `/ws/games/{gameSlug}` raw WebSocket 엔드포인트. 프로토콜은 JSON 한 줄이고
 * 실제 방/매칭/중계 판단은 전부 [GameRelayRegistry] 가 한다 — 여기는 전송 계층 어댑터다.
 *
 * STOMP 를 쓰지 않는 이유: 게스트 대전은 구독 토픽·프레임 헤더·하트비트 협상이 필요 없고,
 * 게임 클라이언트가 단일 HTML 파일이라 stomp.js 의존을 얹을 이유가 없다.
 */
@Component
class GameRelayWebSocketHandler(
    private val registry: GameRelayRegistry,
) : TextWebSocketHandler() {

    private val log = KotlinLogging.logger {}

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val slug = session.uri?.path?.substringAfterLast('/')?.lowercase()
        if (slug == null || !registry.isValidSlug(slug)) {
            session.close(CloseStatus.BAD_DATA)
            return
        }
        registry.onOpen(WebSocketRelayPeer(session), slug)
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        registry.onMessage(session.id, message.payload)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        registry.onClose(session.id)
    }

    override fun handleTransportError(session: WebSocketSession, exception: Throwable) {
        log.debug { "게임 릴레이 전송 오류 ${session.id}: ${exception.message}" }
        registry.onClose(session.id)
        if (session.isOpen) runCatching { session.close(CloseStatus.SERVER_ERROR) }
    }
}

/** `WebSocketSession.sendMessage` 는 동시 호출이 금지돼 있어 세션 단위로 직렬화한다. */
private class WebSocketRelayPeer(private val session: WebSocketSession) : RelayPeer {

    private val log = KotlinLogging.logger {}
    private val sendLock = Any()

    override val id: String get() = session.id

    override fun send(payload: String) {
        try {
            synchronized(sendLock) {
                if (session.isOpen) session.sendMessage(TextMessage(payload))
            }
        } catch (e: Exception) {
            log.debug { "게임 릴레이 전송 실패 ${session.id}: ${e.message}" }
        }
    }

    override fun close(reason: RelayCloseReason) {
        runCatching { session.close(CloseStatus(reason.code, reason.phrase)) }
    }
}
