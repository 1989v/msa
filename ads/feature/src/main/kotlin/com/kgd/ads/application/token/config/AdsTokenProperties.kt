package com.kgd.ads.application.token.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 노출·클릭 토큰 서명 키.
 *
 * **키가 없거나 짧으면 뜨지 않는다.** 공개된 기본값으로 폴백하면 누구나 서명을 만들 수 있어
 * 과금 검증이 도는 채로 아무것도 막지 않는다. 다른 서비스의 HMAC 키와 공유하지 않는다.
 * [secretPrevious] 는 키 교체 중에만 넣는다 — 교체 전에 발급된 토큰을 수명 동안 검증하기 위해서다.
 */
@ConfigurationProperties(prefix = "ads.token")
class AdsTokenProperties(
    secret: String = "",
    secretPrevious: String = "",
) {
    val currentKey: ByteArray = secret.trim().toByteArray().also {
        check(it.size >= MIN_KEY_BYTES) {
            "ads.token.secret 이 없거나 너무 짧습니다(최소 ${MIN_KEY_BYTES}바이트). ADS_TOKEN_SECRET 을 주입하세요."
        }
    }

    val previousKey: ByteArray? = secretPrevious.trim().takeIf { it.isNotEmpty() }?.toByteArray()?.also {
        check(it.size >= MIN_KEY_BYTES) {
            "ads.token.secret-previous 가 너무 짧습니다(최소 ${MIN_KEY_BYTES}바이트). 교체 중이 아니면 비워 두세요."
        }
    }

    // 키가 로그·액추에이터 출력에 실리지 않게 가린다.
    override fun toString(): String = "AdsTokenProperties(currentKey=***, previousKey=${if (previousKey == null) "none" else "***"})"

    companion object {
        const val MIN_KEY_BYTES = 32
    }
}
