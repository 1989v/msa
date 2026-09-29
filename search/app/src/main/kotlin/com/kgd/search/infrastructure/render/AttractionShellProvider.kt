package com.kgd.search.infrastructure.render

import com.github.benmanes.caffeine.cache.Caffeine
import com.github.benmanes.caffeine.cache.Ticker
import com.kgd.search.application.attraction.port.AttractionShellPort
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.net.http.HttpClient
import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * portal-fe 의 `index.html` 셸을 클러스터 안에서 받아 온다 — 블로그 `ShellHtmlProvider` 의 사본에
 * 두 가지를 더했다(ADR-0103, 두 번째 사용처. 셋째가 생기면 공통 모듈로 올린다).
 *
 * - **시간 초과 1초.** 이 경로는 크롤러가 5만 URL 을 훑는다. portal-fe 가 응답하지 않을 때
 *   요청마다 스레드가 기본 타임아웃까지 묶이면 JSON 검색 API 까지 번진다.
 * - **실패 뒤 30초는 다시 받지 않는다.** 실패는 캐시되지 않으므로, 없으면 요청마다 다시 부른다.
 *
 * 캐시 5분, 실패하면 마지막 정상본. 한 번도 못 받았으면 null — 렌더러가 최소 HTML 로 떨어진다.
 */
@Component
class AttractionShellProvider(
    properties: AttractionRenderProperties,
    private val clock: Clock = Clock.systemUTC(),
) : AttractionShellPort {
    private val log = KotlinLogging.logger {}
    private val shellUrl = properties.shellUrl

    private val restClient = RestClient.builder()
        .requestFactory(
            JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(FETCH_TIMEOUT).build())
                .apply { setReadTimeout(FETCH_TIMEOUT) },
        )
        .build()

    // 만료는 주입한 시계로 잰다 — 테스트가 5분을 기다리지 않게
    private val cache = Caffeine.newBuilder()
        .expireAfterWrite(CACHE_TTL)
        .maximumSize(1)
        .ticker(Ticker { clock.millis() * 1_000_000 })
        .build<String, String>()

    @Volatile
    private var lastGood: String? = null

    @Volatile
    private var failedAt: Instant? = null

    /** 마지막 시도의 결과. 셸을 못 받아도 페이지는 200 으로 나가므로 응답만 봐서는 알 수 없다. */
    @Volatile
    private var state: ShellState = ShellState.UNKNOWN

    /** 헬스가 읽는다. 호출해도 받기를 일으키지 않는다. */
    fun state(): ShellState = state

    override fun shell(): String? {
        cache.getIfPresent(KEY)?.let { return it }
        val now = clock.instant()
        if (failedAt?.let { Duration.between(it, now) < RETRY_BACKOFF } == true) return lastGood
        return try {
            val html = restClient.get().uri(shellUrl).retrieve().body(String::class.java)
            // 마커가 없으면 우리가 아는 셸이 아니다 — 치환이 조용히 빠져 메타 없는 페이지가 나가는 것보다
            // 최소 HTML 이 낫다
            require(!html.isNullOrBlank() && html.contains(SEO_START)) { "셸에 seo 마커가 없다" }
            cache.put(KEY, html)
            lastGood = html
            failedAt = null
            state = ShellState.OK
            html
        } catch (e: Exception) {
            failedAt = now
            state = if (lastGood != null) ShellState.STALE else ShellState.MISSING
            log.warn(e) { "portal-fe 셸을 받지 못했다 — ${RETRY_BACKOFF.seconds}초 동안 마지막 정상본으로 대체 (url=$shellUrl, state=$state)" }
            lastGood
        }
    }

    /** [STALE]·[MISSING] 은 페이지가 200 으로 나가는 채로 품질이 깎인 상태다. */
    enum class ShellState {
        /** 아직 한 번도 받지 않았다 (요청이 오기 전) */
        UNKNOWN,

        /** 최근에 받아 왔다 */
        OK,

        /** 받기는 실패했지만 마지막 정상본으로 서빙 중 — 자산 해시가 옛것일 수 있다 */
        STALE,

        /** 한 번도 못 받았다 — SPA 없는 최소 HTML 이 나간다 */
        MISSING,
    }

    companion object {
        private const val KEY = "shell"
        const val SEO_START = "<!--seo:start-->"
        private val FETCH_TIMEOUT: Duration = Duration.ofSeconds(1)
        private val CACHE_TTL: Duration = Duration.ofMinutes(5)
        private val RETRY_BACKOFF: Duration = Duration.ofSeconds(30)
    }
}
