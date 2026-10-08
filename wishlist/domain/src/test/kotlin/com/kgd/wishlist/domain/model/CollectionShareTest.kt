package com.kgd.wishlist.domain.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class CollectionShareTest : BehaviorSpec({
    val now = Instant.parse("2026-10-09T03:00:00Z")
    val clock = Clock.fixed(now, ZoneOffset.UTC)

    Given("공유 링크 생성") {
        When("100번 만들면") {
            val tokens = (1..100).map {
                CollectionShare.create(collectionId = 7L, memberId = 1L, clock = clock).token
            }
            Then("토큰은 모두 영숫자 10자다") {
                tokens.forEach { it shouldMatch CollectionShare.TOKEN_PATTERN }
                tokens.forEach { it.length shouldBe 10 }
            }
        }

        When("만료 일수를 주지 않으면") {
            val share = CollectionShare.create(collectionId = 7L, memberId = 1L, clock = clock)
            Then("고정 시각 기준 30일 뒤에 만료된다") {
                share.createdAt shouldBe now
                share.expiresAt shouldBe now.plus(Duration.ofDays(30))
                share.collectionId shouldBe 7L
                share.memberId shouldBe 1L
                share.revokedAt shouldBe null
                share.id shouldBe null
            }
        }

        When("만료 일수가 null 이면") {
            val share = CollectionShare.create(collectionId = 7L, memberId = 1L, expiresInDays = null, clock = clock)
            Then("만료가 없다") {
                share.expiresAt shouldBe null
                share.isAlive(now.plus(Duration.ofDays(10_000))) shouldBe true
            }
        }

        When("만료 일수가 1 또는 365 이면") {
            Then("만들어진다") {
                CollectionShare.create(7L, 1L, 1, clock).expiresAt shouldBe now.plus(Duration.ofDays(1))
                CollectionShare.create(7L, 1L, 365, clock).expiresAt shouldBe now.plus(Duration.ofDays(365))
            }
        }

        When("만료 일수가 1~365 밖이면") {
            Then("거부된다") {
                listOf(0, -1, 366).forEach { days ->
                    shouldThrow<IllegalArgumentException> { CollectionShare.create(7L, 1L, days, clock) }
                }
            }
        }
    }

    Given("만료 판정") {
        val share = CollectionShare.create(collectionId = 7L, memberId = 1L, expiresInDays = 1, clock = clock)
        val expiresAt = now.plus(Duration.ofDays(1))

        When("만료 시각 직전이면") {
            Then("살아 있다") { share.isAlive(expiresAt.minusNanos(1)) shouldBe true }
        }
        When("만료 시각과 같으면") {
            Then("죽었다") { share.isAlive(expiresAt) shouldBe false }
        }
        When("만료 시각 뒤면") {
            Then("죽었다") { share.isAlive(expiresAt.plusSeconds(1)) shouldBe false }
        }
    }

    Given("폐기") {
        When("폐기하면") {
            val share = CollectionShare.create(collectionId = 7L, memberId = 1L, expiresInDays = null, clock = clock)
            share.revoke(now)
            Then("만료가 없어도 죽는다") {
                share.revokedAt shouldBe now
                share.isAlive(now) shouldBe false
                share.isAlive(now.plusSeconds(60)) shouldBe false
            }
        }

        When("두 번 폐기하면") {
            val share = CollectionShare.create(collectionId = 7L, memberId = 1L, clock = clock)
            share.revoke(now)
            share.revoke(now.plusSeconds(60))
            Then("처음 폐기 시각이 남는다") {
                share.revokedAt shouldBe now
                share.isAlive(now) shouldBe false
            }
        }
    }
})
