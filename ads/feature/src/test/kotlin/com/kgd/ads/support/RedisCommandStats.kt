package com.kgd.ads.support

import org.springframework.data.redis.core.StringRedisTemplate

/**
 * Redis 서버가 센 명령 수 — 판정 근거가 앱 코드가 아니라 서버의 `INFO commandstats` 다.
 * 측정 자체에 쓰는 `config`·`info` 는 뺀다(Redis 7 은 하위 명령을 `config|resetstat` 으로 센다).
 */
class RedisCommandStats(private val template: StringRedisTemplate) {
    fun reset() {
        template.execute { it.serverCommands().resetConfigStats() }
    }

    /** 명령 이름 → 호출 수 */
    fun calls(): Map<String, Long> {
        val info = template.execute { it.serverCommands().info("commandstats") } ?: return emptyMap()
        return info.stringPropertyNames()
            .filter { it.startsWith("cmdstat_") }
            .associate { name -> name.removePrefix("cmdstat_") to Regex("calls=(\\d+)").find(info.getProperty(name))!!.groupValues[1].toLong() }
            .filterKeys { it.substringBefore('|') !in setOf("config", "info") }
    }
}
