package com.kgd.ranking.infrastructure.routes

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

private val logger = KotlinLogging.logger {}

/**
 * 길찾기 호출을 **캐시와 일일 예산 뒤에** 둔다 (ADR-0081 §6).
 *
 * 이 플랫폼에서 사용자 요청마다 외부를 부르는 경로는 여기 하나뿐이고, 무료 구간이
 * **월 10,000콜(하루 약 333회)** 이다. 두 가지가 그 예산을 지킨다.
 *
 * **① 경로는 출발·도착만으로 정해진다.** 유종·이탈 시간·셀프 여부를 바꿔도 경로는 같은데,
 * 화면은 조건을 바꿀 때마다 다시 찾는다 — 캐시가 없으면 한 사람이 조건 세 개를 만져보는
 * 것만으로 3콜을 쓴다. 게다가 인기 구간(서울→부산)은 여러 사람이 같은 경로를 부른다.
 *
 * **② 예산을 넘기면 부르지 않는다.** 무료 한도는 상한이 아니라 통과 지점이라, 막지 않으면
 * 인기가 생긴 달에 청구서로 알게 된다.
 *
 * 좌표는 약 100m 격자로 반올림해 키를 만든다. 지도 클릭 좌표는 두 번 같을 수 없어
 * 반올림하지 않으면 캐시가 영원히 비어 있다.
 *
 * > Maps Platform 약관은 경로 좌표의 임시 캐시를 **최대 30일**까지 허용한다. 7일은 그 안이고,
 * > 배포마다 파드가 재기동되며 어차피 비워진다.
 */
@Component
class CachedRouteLookup(
    private val client: GoogleRoutesClient,
    @Value("\${ranking.google-routes.daily-budget:300}") private val dailyBudget: Int,
    private val clock: Clock = Clock.system(ZoneId.of("Asia/Seoul")),
) {
    private val cache: Cache<String, RouteResult> = Caffeine.newBuilder()
        .maximumSize(500)
        .expireAfterWrite(Duration.ofDays(7))
        .build()

    // 파드가 하나라는 전제의 카운터다. replica 를 늘리면 예산도 그만큼 늘어난다 —
    // free tier 단일 노드라 지금은 맞지만, 늘릴 때 같이 봐야 한다.
    private var budgetDate: LocalDate = LocalDate.now(clock)
    private val spentToday = AtomicInteger(0)

    fun route(origin: LatLng, destination: LatLng): RouteResult {
        val key = cacheKey(origin, destination)
        cache.getIfPresent(key)?.let { return it }

        consumeBudget()
        val result = client.computeRoute(origin, destination)
        cache.put(key, result)
        return result
    }

    /** 오늘 쓴 콜 수 — 운영 확인용. */
    fun spent(): Int = synchronized(this) {
        rollOverIfNewDay()
        spentToday.get()
    }

    private fun consumeBudget() = synchronized(this) {
        rollOverIfNewDay()
        if (spentToday.get() >= dailyBudget) {
            logger.warn { "[ROUTES] 일일 예산 $dailyBudget 소진 — 호출하지 않는다" }
            throw BusinessException(
                ErrorCode.EXTERNAL_API_ERROR,
                "오늘 경로 탐색 한도를 모두 사용했습니다. 내일 다시 이용해 주세요 (리더보드는 그대로 볼 수 있습니다).",
            )
        }
        spentToday.incrementAndGet()
    }

    private fun rollOverIfNewDay() {
        val today = LocalDate.now(clock)
        if (today != budgetDate) {
            budgetDate = today
            spentToday.set(0)
        }
    }

    /** 약 100m 격자. 지도 클릭 좌표가 두 번 같을 수 없어 반올림 없이는 캐시가 비어 있다. */
    private fun cacheKey(origin: LatLng, destination: LatLng) = String.format(
        Locale.ROOT,
        "%.3f,%.3f>%.3f,%.3f",
        origin.latitude, origin.longitude, destination.latitude, destination.longitude,
    )
}
