package com.kgd.game.infrastructure.ws

/**
 * 릴레이가 다루는 접속자 한 명. Spring 의 `WebSocketSession` 을 감싸는 얇은 포트로,
 * 방 배정·매칭·중계 로직을 실제 소켓 없이 단위 테스트할 수 있게 한다.
 */
interface RelayPeer {
    /** 세션 식별자 — 레지스트리의 접속자 키 */
    val id: String

    fun send(payload: String)

    fun close(reason: RelayCloseReason)
}

/**
 * 릴레이가 능동적으로 끊을 때 쓰는 사유. 4000~4999 는 애플리케이션 정의 구간(RFC 6455)이라
 * 클라이언트가 "왜 끊겼는지"를 코드만으로 구분할 수 있다.
 */
enum class RelayCloseReason(val code: Int, val phrase: String) {
    RATE_LIMIT(4029, "rate limit exceeded"),
    TOO_LARGE(4013, "message too large"),
    IDLE(4008, "idle timeout"),
}
