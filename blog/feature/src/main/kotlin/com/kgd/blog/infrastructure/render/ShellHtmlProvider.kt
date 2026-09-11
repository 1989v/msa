package com.kgd.blog.infrastructure.render

import com.github.benmanes.caffeine.cache.Caffeine
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import com.kgd.blog.application.post.port.BlogShellPort
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * portal-fe 가 서빙하는 `index.html` 셸을 클러스터 내부에서 받아 온다 (ADR-0072 §6).
 *
 * 자산 파일명에 해시가 붙기 때문에 셸을 이 서비스가 들고 있을 수 없다 — FE 를 배포할 때마다
 * 백엔드도 같이 고쳐야 하는 결합이 생긴다. 실제 셸을 받아 오면 FE 배포만으로 최신이 된다.
 *
 * 캐시는 5분. **실패해도 마지막 정상본을 계속 쓴다** — 셸을 못 받는 것이 글이 안 보이는
 * 이유가 되어서는 안 된다.
 */
@Component
class ShellHtmlProvider(
    @Value("\${blog.shell-url:http://portal-fe/index.html}") private val shellUrl: String,
) : BlogShellPort {
    private val log = KotlinLogging.logger {}
    private val restClient = RestClient.builder().build()

    private val cache = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(5))
        .maximumSize(1)
        .build<String, String>()

    /** 캐시가 만료되고 페치도 실패했을 때 쓰는 마지막 정상본 */
    @Volatile
    private var lastGood: String? = null

    /** 마지막 시도의 결과. 헬스가 읽는다 — 실패해도 200 이 나가므로 응답만 봐서는 알 수 없다. */
    @Volatile
    private var state: ShellState = ShellState.UNKNOWN

    /**
     * 셸 페치 상태. 호출해도 페치를 유발하지 않는다 — [shell] 이 갱신한 값을 읽기만 한다.
     */
    fun state(): ShellState = state

    /**
     * 셸 HTML. 한 번도 받아 오지 못했으면 null 이고, 호출부는 SPA 없는 최소 HTML 로 떨어진다.
     */
    override fun shell(): String? {
        cache.getIfPresent(KEY)?.let { return it }
        return runCatching {
            val html = restClient.get().uri(shellUrl).retrieve().body(String::class.java)
            // 마커가 없으면 우리가 아는 셸이 아니다 — 치환이 조용히 실패해 메타가 안 붙는 것보다
            // 최소 HTML 로 떨어지는 편이 낫다
            require(!html.isNullOrBlank() && html.contains(SEO_START)) { "셸에 seo 마커가 없다" }
            cache.put(KEY, html)
            lastGood = html
            state = ShellState.OK
            html
        }.getOrElse {
            state = if (lastGood != null) ShellState.STALE else ShellState.MISSING
            log.warn(it) { "portal-fe 셸을 받지 못했다 — 마지막 정상본으로 대체 (url=$shellUrl)" }
            lastGood
        }
    }

    /** 셸 페치 상태. [STALE]·[MISSING] 은 글이 200 으로 나가는 채로 품질이 깎인 상태다. */
    enum class ShellState {
        /** 아직 한 번도 페치하지 않았다 (요청이 오기 전) */
        UNKNOWN,

        /** 최근 5분 안에 받아 왔다 */
        OK,

        /** 페치는 실패했지만 마지막 정상본으로 서빙 중 — 자산 해시가 옛것일 수 있다 */
        STALE,

        /** 한 번도 못 받았다 — SPA 없는 최소 HTML 이 나간다 */
        MISSING,
    }

    companion object {
        private const val KEY = "shell"
        const val SEO_START = "<!--seo:start-->"
        const val SEO_END = "<!--seo:end-->"
        const val ROOT_DIV = "<div id=\"root\"></div>"
    }
}
