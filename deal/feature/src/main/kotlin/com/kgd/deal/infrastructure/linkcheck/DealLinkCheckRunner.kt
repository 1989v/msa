package com.kgd.deal.infrastructure.linkcheck

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

private val log = KotlinLogging.logger {}

/**
 * 링크 생존 점검 배치 (ADR-0069 §5).
 *
 * 상주 파드도 새 이미지도 만들지 않는다 — code-dictionary 이미지를 그대로 쓰고
 * `--spring.main.web-application-type=none --spring.profiles.active=kubernetes,linkcheck`
 * 로 CronJob 이 띄웠다가 끝나면 내려간다. 외부 :443 egress 는 이 파드 라벨에만 열린다.
 *
 * 트랜잭션은 [DealLinkCheckService] 가 갖고 있고 여기는 네트워크만 한다 — 네트워크 왕복을
 * 트랜잭션으로 감싸면 커넥션을 수 분간 붙잡는다.
 */
@Component
@Order(0)
@Profile("linkcheck")
class DealLinkCheckRunner(
    private val service: DealLinkCheckService,
) : ApplicationRunner {

    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(CONNECT_TIMEOUT)
        // 리다이렉트를 따라가야 최종 목적지의 생존을 본다. 제휴 링크는 대개 1~3회 튄다.
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build()

    override fun run(args: ApplicationArguments) {
        val targets = service.loadTargets()
        val results = probeAll(targets)
        service.applyResults(results)
        val purged = service.purgeOldClicks(CLICK_RETENTION_DAYS)
        val summary = results.values.groupingBy { it.status }.eachCount()
        log.info { "링크 점검 완료 — 대상 ${targets.size}건 $summary, 클릭 로그 정리 ${purged}행" }
    }

    private fun probeAll(targets: List<LinkCheckTarget>): Map<Long, ProbeResult> =
        targets.mapIndexed { index, target ->
            val result = probe(target.targetUrl)
            log.debug { "${target.slug} → ${result.status}(${result.statusCode})" }
            // 같은 호스트에 몰아치지 않는다. 점검하러 가서 차단당하면 다음 회차부터 전부 오탐이 된다.
            if (index < targets.lastIndex) Thread.sleep(REQUEST_INTERVAL.toMillis())
            target.offerId to result
        }.toMap()

    private fun probe(url: String): ProbeResult {
        val uri = runCatching { URI.create(url) }.getOrNull() ?: return LinkProbeRules.unreachable()
        val head = send(uri, method = "HEAD") ?: return LinkProbeRules.unreachable()
        if (!LinkProbeRules.shouldRetryWithGet(head)) return LinkProbeRules.classify(head)
        // HEAD 를 안 받는 서버가 있다. 바이트 1개짜리 GET 으로 한 번 더 물어본다.
        val get = send(uri, method = "GET", rangeHeader = true) ?: return LinkProbeRules.unreachable()
        return LinkProbeRules.classify(get)
    }

    /** @return HTTP status code, 네트워크 오류면 null */
    private fun send(uri: URI, method: String, rangeHeader: Boolean = false): Int? = runCatching {
        val builder = HttpRequest.newBuilder(uri)
            .timeout(READ_TIMEOUT)
            // 정체를 밝힌다. 차단할 사이트가 판단할 수 있어야 오탐도 줄고 예의도 지킨다.
            .header("User-Agent", USER_AGENT)
        if (rangeHeader) builder.header("Range", "bytes=0-0")
        when (method) {
            "HEAD" -> builder.method("HEAD", HttpRequest.BodyPublishers.noBody())
            else -> builder.GET()
        }
        http.send(builder.build(), HttpResponse.BodyHandlers.discarding()).statusCode()
    }.onFailure { log.debug { "요청 실패 ${uri.host}: ${it.message}" } }.getOrNull()

    companion object {
        private val CONNECT_TIMEOUT: Duration = Duration.ofSeconds(5)
        private val READ_TIMEOUT: Duration = Duration.ofSeconds(5)
        private val REQUEST_INTERVAL: Duration = Duration.ofMillis(300)
        private const val CLICK_RETENTION_DAYS = 90L
        private const val USER_AGENT = "1989v-linkcheck/1.0 (+https://deal.1989v.com)"
    }
}
