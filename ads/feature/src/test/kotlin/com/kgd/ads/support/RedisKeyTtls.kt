package com.kgd.ads.support

import org.springframework.data.redis.core.ScanOptions
import org.springframework.data.redis.core.StringRedisTemplate

/** `ads:` 로 시작하는 모든 키의 TTL(초). 판정 근거는 서버의 `TTL` 응답이다 — -1 이면 수명 없는 키. */
fun adsKeyTtls(template: StringRedisTemplate): Map<String, Long> {
    val keys = template.scan(ScanOptions.scanOptions().match("ads:*").count(1000).build()).use { it.asSequence().toList() }
    return keys.associateWith { requireNotNull(template.getExpire(it)) }
}
