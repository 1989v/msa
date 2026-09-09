package com.kgd.game.infrastructure.party

import com.kgd.game.application.party.port.PartySeatTokenPort
import com.kgd.game.application.party.port.SeatClaim
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * 좌석 토큰 서명 (ADR-0092) — HMAC-SHA256.
 *
 * **키가 없으면 뜨지 않는다.** 공개된 기본값으로 폴백하면 서명을 누구나 만들 수 있어
 * 검사가 도는 채로 아무것도 막지 않는다 — 안 무는 검사는 없는 것보다 나쁘다.
 * 아케이드 세션 토큰과 같은 키(`GAME_HMAC_SECRET`)를 쓰되 서명 대상이 달라 클래스를 나눈다.
 */
@Component
class HmacPartySeatTokenService(
    @Value("\${game.security.hmac-secret:}") secret: String,
) : PartySeatTokenPort {

    private val key: ByteArray = secret.trim().toByteArray().also {
        check(it.size >= MIN_KEY_BYTES) {
            "game.security.hmac-secret 가 없거나 너무 짧습니다(최소 ${MIN_KEY_BYTES}바이트). " +
                "GAME_HMAC_SECRET 을 주입하세요 — 이 키 없이는 좌석 토큰이 위조를 막지 못합니다."
        }
    }

    override fun issue(claim: SeatClaim): String = sign(payload(claim))

    override fun verify(token: String, claim: SeatClaim): Boolean {
        if (token.isEmpty()) return false
        // 길이가 다르면 isEqual 이 곧장 false 를 내므로 시간 비교의 의미가 남는다
        return MessageDigest.isEqual(sign(payload(claim)).toByteArray(), token.toByteArray())
    }

    /**
     * 여섯 항을 전부 싣는다 — 하나라도 빠지면 포트 문서의 「막나 O」 한 줄이 X 로 바뀐다.
     * 구분자는 값에 안 나오는 문자여야 한다(방 코드는 대문자·숫자, 나머지는 정수).
     */
    private fun payload(c: SeatClaim) =
        "${c.roomCode}|${c.roomCreatedMs}|${c.roundNo}|${c.seat}|${c.seatEpoch}"

    private fun sign(data: String): String {
        val mac = Mac.getInstance(ALGORITHM)
        mac.init(SecretKeySpec(key, ALGORITHM))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.toByteArray()))
    }

    private companion object {
        const val ALGORITHM = "HmacSHA256"
        const val MIN_KEY_BYTES = 32
    }
}
