package com.kgd.common.quota

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.ValueOperations
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

class ExternalApiQuotaLedgerSpec : BehaviorSpec({

    // 2026-08-24 12:00 KST 고정 — 자정 TTL 계산이 시각에 의존한다
    val clock = Clock.fixed(Instant.parse("2026-08-24T03:00:00Z"), RedisExternalApiQuotaLedger.SEOUL)

    class Fixture(
        val ledger: RedisExternalApiQuotaLedger,
        val redis: StringRedisTemplate,
        val ops: ValueOperations<String, String>,
    )

    fun ledgerWith(afterIncrement: Long?): Fixture {
        val redis = mockk<StringRedisTemplate>(relaxed = true)
        val ops = mockk<ValueOperations<String, String>>(relaxed = true)
        every { redis.opsForValue() } returns ops
        every { ops.increment(any<String>(), any<Long>()) } returns afterIncrement
        return Fixture(RedisExternalApiQuotaLedger(redis, clock), redis, ops)
    }

    given("키 포맷 — 언어 간 계약") {
        then("provider 키와 KST 날짜로 만든다") {
            RedisExternalApiQuotaLedger.keyOf(
                ExternalApiProvider.NAVER_SEARCH,
                LocalDate.of(2026, 8, 24),
            ) shouldBe "external-api-quota:naver-search:2026-08-24"
        }

        then("Python 래퍼가 같은 문자열을 만들어야 합산이 성립한다") {
            RedisExternalApiQuotaLedger.keyOf(
                ExternalApiProvider.GOOGLE_PLACES,
                LocalDate.of(2026, 1, 5),
            ) shouldBe "external-api-quota:google-places:2026-01-05"
        }
    }

    given("한도가 있는 provider") {
        val provider = ExternalApiProvider.NAVER_SEARCH // 25,000

        `when`("한도 안이면") {
            val ledger = ledgerWith(afterIncrement = 24_999).ledger
            then("통과시킨다") { ledger.tryAcquire(provider) shouldBe true }
        }

        `when`("증가 후 값이 한도와 같으면") {
            val ledger = ledgerWith(afterIncrement = 25_000).ledger
            then("아직 통과 — 마지막 한 콜은 써도 된다") { ledger.tryAcquire(provider) shouldBe true }
        }

        `when`("한도를 넘기면") {
            val ledger = ledgerWith(afterIncrement = 25_001).ledger
            then("차단한다") { ledger.tryAcquire(provider) shouldBe false }
        }
    }

    given("한도가 없는 provider (관측만)") {
        val provider = ExternalApiProvider.DATA_GO_KR

        `when`("아무리 많이 써도") {
            val f = ledgerWith(afterIncrement = 9_999_999)
            val allowed = f.ledger.tryAcquire(provider)

            then("막지 않는다") { allowed shouldBe true }
            then("그래도 센다 — 관측이 목적이다") {
                verify { f.ops.increment(any<String>(), 1L) }
            }
        }
    }

    given("비용이 가중되는 provider") {
        then("YouTube 는 콜이 아니라 units 로 센다") {
            val f = ledgerWith(afterIncrement = 100)
            f.ledger.tryAcquire(ExternalApiProvider.YOUTUBE_DATA, cost = 100)
            // search.list 1콜 = 100 units. 콜 수로 세면 100배 틀린다.
            verify { f.ops.increment(any<String>(), 100L) }
        }
    }

    given("Redis 가 죽으면") {
        val redis = mockk<StringRedisTemplate>()
        every { redis.opsForValue() } throws IllegalStateException("connection refused")
        val ledger = RedisExternalApiQuotaLedger(redis, clock)

        then("fail-open — 호출을 통과시킨다") {
            // 쿼터 초과는 다음 날 회복되지만 수집 중단은 회복되지 않는다 (ADR-0082)
            ledger.tryAcquire(ExternalApiProvider.NAVER_SEARCH) shouldBe true
        }

        then("사용량 조회는 0 으로 본다") {
            ledger.used(ExternalApiProvider.NAVER_SEARCH) shouldBe 0L
        }
    }

    given("첫 증가일 때만") {
        then("만료를 건다 — 매번 걸면 자정 넘어까지 밀린다") {
            val f = ledgerWith(afterIncrement = 1)
            f.ledger.tryAcquire(ExternalApiProvider.NAVER_SEARCH)
            verify(exactly = 1) { f.redis.expire(any(), any()) }
        }

        then("두 번째부터는 만료를 건드리지 않는다") {
            val f = ledgerWith(afterIncrement = 2)
            f.ledger.tryAcquire(ExternalApiProvider.NAVER_SEARCH)
            verify(exactly = 0) { f.redis.expire(any(), any()) }
        }
    }

    given("provider 설정") {
        then("한도가 없는 것은 enforced 가 아니다") {
            ExternalApiProvider.DATA_GO_KR.enforced shouldBe false
            ExternalApiProvider.EXCHANGE_MARKET_DATA.enforced shouldBe false
            ExternalApiProvider.NAVER_SEARCH.enforced shouldBe true
        }
    }
})
