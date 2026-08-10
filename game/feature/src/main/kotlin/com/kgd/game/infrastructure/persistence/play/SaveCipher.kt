package com.kgd.game.infrastructure.persistence.play

import com.kgd.common.security.AesUtil
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

/**
 * 세이브 본문을 **저장 직전에 암호화**하고 읽을 때 복호화한다.
 *
 * 세이브에는 이제 영구 강화 단계까지 들어간다(lib/meta.js). 서버는 본문을 열어보지 않는
 * 불투명 JSON 계약이므로, 저장소에 평문으로 눕혀 둘 이유가 없다.
 *
 * `game_save_data.data` 는 JSON 컬럼이라 암호문을 그대로 넣을 수 없다. 봉투에 담아
 * 컬럼 타입을 유지한다:
 *
 *     {"v":1,"c":"<base64 ciphertext>"}
 *
 * **기존 평문 행은 봉투가 없다** — 그 모양으로 판별해 그대로 읽고, 다음 저장 때 자연히
 * 암호화된다. 일괄 변환 마이그레이션이 필요 없다(Flyway SQL 로는 AES 를 부를 수도 없다).
 *
 * > 이 암호화가 막는 것과 못 막는 것을 분명히 해 둔다.
 * > **막는 것**: 저장소·백업이 유출됐을 때 진행도가 그대로 읽히는 것.
 * > **못 막는 것**: 조작. 클라이언트가 값을 부풀려 보내면 서버는 그대로 암호화해 담는다.
 * > 조작 방지는 서버 권위 검증(game_run 시드 소모 같은)의 몫이지 암호화의 몫이 아니다.
 */
@Component
class SaveCipher(
    @Value("\${encryption.aes-key:default-aes-key-exactly-32bytes!}") private val configuredKey: String,
) {
    private val log = KotlinLogging.logger {}

    // 호스트의 공통 보안 자동설정(kgd.common.security)에 기대지 않는다 — 그 스위치가 꺼진
    // 호스트에 폴드되면 컨텍스트가 통째로 못 뜬다(실제로 code-dictionary 에서 그렇게 깨졌다).
    // 재분리해도 이 파일만 따라가면 되도록 game 이 자기 키로 자기 도구를 만든다.
    private val aesUtil = AesUtil(configuredKey)

    private companion object {
        const val VERSION = 1
        const val DEFAULT_KEY = "default-aes-key-exactly-32bytes!"
        val ENVELOPE = Regex("""^\s*\{\s*"v"\s*:\s*\d+\s*,\s*"c"\s*:\s*"([^"]*)"\s*}\s*$""")
    }

    /** 기본 키로 운영에 뜨면 암호화는 장식이다 — 조용히 넘어가지 않는다. */
    @EventListener(ApplicationReadyEvent::class)
    fun warnOnDefaultKey() {
        if (configuredKey == DEFAULT_KEY) {
            log.warn {
                "세이브 암호화가 기본 키로 동작 중이다 — 공개된 값이라 실질 보호가 없다. " +
                    "encryption.aes-key 를 배포 환경 비밀로 주입할 것."
            }
        }
    }

    fun encrypt(plain: String): String =
        """{"v":$VERSION,"c":"${aesUtil.encrypt(plain)}"}"""

    /** 봉투가 아니면 암호화 이전에 저장된 평문이다 — 그대로 돌려준다. */
    fun decrypt(stored: String): String {
        val cipher = ENVELOPE.find(stored)?.groupValues?.get(1) ?: return stored
        return runCatching { aesUtil.decrypt(cipher) }
            .getOrElse {
                // 키가 바뀌면 복호화가 안 된다. 세이브를 잃는 것보다 빈 값을 주는 편이 낫다 —
                // 게임은 신규 세이브로 시작하고, 로그로 원인을 남긴다.
                log.error(it) { "세이브 복호화 실패 — 키가 바뀌었는지 확인할 것" }
                ""
            }
    }
}
